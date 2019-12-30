## A Container for Data Analysis

Data analysis often requires many storage and computation power, so poor guys like me needs to use shared servers
provided by school/company. However, using shared servers means

0. The server assigned to me often changes, and I need to install my environment again on the new server.
0. Others may change the environment by following a random stupid outdated blog with `sudo`, and break my code, or
   worse, break the whole system.

Except for that, some softwares like `frp` or `julia` are not included in the official repos of many distros, installing
them requires extra work. Also, ML ecosystem are evolving and the packages are fragile. A installation instruction that
works today may fail tomorrow.

After wasting enough life on setting up environments, I decided to make a container today. The goals are:

- easy to install: better in no more than 3 lines.
- works out of the box: `import sklearn` right after installing.
- no root permission required.

### Building the container

First decision is what container containerization technology to use. Most popular choices include `LXC` and `docker`,
but I prefer to use `systemd-container` because

0. It is installed by default on Arch, so no additional package need to be installed on the host.
0. It is just a plain directory of a rootfs, which makes debugging or modification from host extreamly easy.
0. Being a plain rootfs also means it can be used without `systemd-container` and even without root access.

The next step is to select a distro. Arch is the first comes to my mind of course. However, `pacman` is too big for a
container. Another problem is that Arch packages often comes with "devel" files like headers and docs, which my
container doesn't need. Thus I turned to Alpine. Using musl rather than glibc really made some trubles first, but I got
a much smaller image as return.

Making the image is really easy. First, find the url of "Mini Root Filesystem" from the
[Alpine website](https://alpinelinux.org/downloads/), then run the following command to pull it.

```
sudo machinectl pull-tar --verify=checksum http://dl-cdn.alpinelinux.org/alpine/v3.10/releases/x86_64/alpine-minirootfs-3.10.3-x86_64.tar.gz alpine
```

This will download the tarball, check sha, and put it into `/var/lib/machines/alpine`. `machinectl` comes with Arch by
default, and can be installed on Ubuntu with `sudo apt install systemd-container`. After it done (this should be fast
since the tarball is only 5M), enter the container by `systemd-nspawn -M alpine`.

The package manager of Alpine is very simple and fast (faster than `pacman` IMO!). Install basic packages as following:

```
apk add python3 python3-dev # for python
apk add R R-dev # for R
apk add g++ linux-headers zeromq # for building jupyter kernels
apk add npm # for jupyter extensions
```

There are several packages not in the official registar. For example, `frp` and `julia`. I had to download the binary
mannually and put them into `/usr`. Note the official `julia` builds are based on glibc. Luckily there is a musl
build [here](github.com/fredrikekre/julia-alpine), and it works fine for me.

After installing these packages, we can start installing "scientific" packages with `pip3` and the built-in package
managers of `julia` and `R`. Note that since most pre-built wheels are depend on glibc, `pip3` needs to compile pretty
much everything, which is very slow (It takes more than 30 min to get `sklearn`).

Finally, after the container is filled with high end packages, export it with

```
sudo machinectl export-tar jupyter jupyter.tar.xz
```

### Usage

My image is shared on Google Drive and served by CloudFlare, it includes

- **jupyter lab**, with python3, julia, R kernels and drawio extension;
- **frpc** to allow connecting the server from outside (with a public visiable server running `frps`);
- **python3** with numpy, pandas and sklearn;
- **R** with ggplot2 and forecast;
- and **Julia** with PyCall and RCall :)

To install the container, just run

```
sudo machinectl pull-tar --verify=no https://gdrive.ylxdzsw.com/container%20images/jupyter.tar.xz
```

Then start the jupyter service with

```
sudo systemd-run systemd-nspawn -M jupyter jupyter lab --allow-root --ip=0.0.0.0 --port=8848
```

Now jupyter is running at `http://<server>:8848` with default password `fuck`. Though I'm totally fine with this
password, it can be easily changed in `/root/.jupyter/jupyter_notebook_config.py`. If the server is behind NAT,
[frp](https://github.com/fatedier/frp) can be used to allow external access.

### Run the container without root access and without systemd

It's well known that anyone capable of `chroot` also has the ability to break out. But (not so) recently Linux got a new
feature called namespace. With it we can run our container without root access.

To run the container, just download and untar, then use `unshare` to simulate `chroot`:

```
wget https://gdrive.ylxdzsw.com/container%20images/jupyter.tar.xz
tar -Jxvf jupyter.tar.xz
unshare -r -m --propagation slave bash -c "mount -R /proc proc; mount -R /dev dev; chroot . /bin/sh -l"
```

Now we are in the container! `unshare` is a thin wrapper around the `unshare(2)`, which create a new namespace where the
user id is 0. The `mount`s allow us to see the outside world and interact with the kernel. The full command to run and
detach jupyter from host without systemd is:

```
setsid unshare -r -m --propagation slave bash -c 'mount -R /proc proc; mount -R /dev dev; chroot . /bin/sh -l -c "HOME=/root jupyter lab --allow-root --ip=0.0.0.0 --port=8848"' > /dev/null 2>&1
```

<!--https://wiki.archlinux.org/index.php/Chroot#Using_chroot-->

### Troubleshooting

#### import RCall on terminal is fine, but on Jupyter fails. 

```
Warning: RCall.jl: Error: package or namespace load failed for "methods" in dyn.load(file, DLLpath = DLLpath, ...):
 unable to load shared object '/usr/lib/R/library/methods/libs/methods.so':
  Error loading shared library libR.so: No such file or directory (needed by /usr/lib/R/library/methods/libs/methods.so)
Error: package or namespace load failed for "utils" in dyn.load(file, DLLpath = DLLpath, ...):
 unable to load shared object '/usr/lib/R/library/utils/libs/utils.so':
  Error loading shared library libR.so: No such file or directory (needed by /usr/lib/R/library/utils/libs/utils.so)
Error: package or namespace load failed for "grDevices" in dyn.load(file, DLLpath = DLLpath, ...):
 unable to load shared object '/usr/lib/R/library/grDevices/libs/grDevices.so':
  Error loading shared library libR.so: No such file or directory (needed by /usr/lib/R/library/grDevices/libs/grDevices.so)
Error: package or namespace load failed for "graphics" in dyn.load(file, DLLpath = DLLpath, ...):
 unable to load shared object '/usr/lib/R/library/grDevices/libs/grDevices.so':
  Error loading shared library libR.so: No such file or directory (needed by /usr/lib/R/library/grDevices/libs/grDevices.so)
Error: package or namespace load failed for "stats" in dyn.load(file, DLLpath = DLLpath, ...):
 unable to load shared object '/usr/lib/R/library/grDevices/libs/grDevices.so':
  Error loading shared library libR.so: No such file or directory (needed by /usr/lib/R/library/grDevices/libs/grDevices.so)
Error: package or namespace load failed for "methods" in dyn.load(file, DLLpath = DLLpath, ...):
 unable to load shared object '/usr/lib/R/library/methods/libs/methods.so':
  Error loading shared library libR.so: No such file or directory (needed by /usr/lib/R/library/methods/libs/methods.so)
During startup - Warning messages:
1: package "methods" in options("defaultPackages") was not found 
2: package "utils" in options("defaultPackages") was not found 
3: package "grDevices" in options("defaultPackages") was not found 
4: package "graphics" in options("defaultPackages") was not found 
5: package "stats" in options("defaultPackages") was not found 
6: package "methods" in options("defaultPackages") was not found 
@ RCall /root/.julia/packages/RCall/g7dhB/src/io.jl:113
InitError: REvalError: Error in options(rcalljl_device = png) : object 'png' not found
during initialization of module RCall
```

**Solution**: it is because `libR.so` is put on a strange place `/usr/lib/R/lib`, along with the fact that jupyter doesn't
load `/etc/profile`, so julia can't find it. I had to mannually set `"env": {"LD_LIBRARY_PATH": "/usr/lib:/usr/local/lib:/usr/lib/R/lib"}`
in `~/.local/share/jupyter/kernels/julia-1.2/kernel.json`
