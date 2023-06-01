## Random Notes on Unshare-based Containers

[unshare(1)](https://man7.org/linux/man-pages/man1/unshare.1.html) is part of
[util-linux](https://github.com/util-linux/util-linux) that is pre-installed on literally every linux distros and can
be utilized to provide _"installation-free"_ lightweight containers. This article includes some notes and code snippets
about this usage.

This software and the namespace functionalities in the kernel are still under rapid development. Linux kernel 4.17+ and
util-linux 2.39+ are required to run the snippets.

### Prepare an Arch container

```bash
mkdir arch && cd arch
pacstrap -KNP . pacman archlinux-keyring
rm var/cache/pacman/pkg/* # optional, save space
```

> The `-N` option causes `pacstrap` to run inside a [user namespace](https://man7.org/linux/man-pages/man7/user_namespaces.7.html).
> If it reports errors like `unshare: no line matching user "xxx" in /etc/subuid`, run the following commands in
> the host system as root:
> 
> ```
> echo "$USER:65536:65536" >> /etc/subuid
> echo "$USER:65536:65536" >> /etc/subgid
> ```
> 
> The `$USER` variable should be **manually** replaced with the user that are intended to be used to create the
> container because root privilege is required to edit these files and `$USER` will be subsequently become `root`.

Next, use the following command to edit `pacman.conf` to comment out the "CheckSpace" option, or `pacman` will complain
that `/` is not mounted.

```bash
awk -i inplace '/^CheckSpace/{print "#"$0; next}{print}' etc/pacman.conf
```

Then add a simple script `start.sh` for starting the container:

```
> start.sh <<"EOF"
SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )

unshare -rm --map-auto --propagation slave bash -c "\
    mount -R /proc $SCRIPT_DIR/proc;\
    mount -R /dev $SCRIPT_DIR/dev;\
    mount --bind /etc/resolv.conf $SCRIPT_DIR/etc/resolv.conf;\
    mount -o nodev,nosuid,size=16G -t tmpfs tmpfs $SCRIPT_DIR/tmp;\
    mount -o nodev,nosuid,size=16G -t tmpfs tmpfs $SCRIPT_DIR/run;\
    export HOME=/root;\
    export SHELL=/usr/bin/bash;\
    export PATH=/usr/bin;\
    chroot $SCRIPT_DIR $*"
EOF

chmod +x start.sh
```

> The first command actually starts with `>`. Some may add a [useless `cat`](https://en.wikipedia.org/wiki/Cat_(Unix)#Useless_use_of_cat)
> in front of it to feel better. The double quotes around `EOF` prevents shell from expanding the variables before writing
> to the file.

Now we can enter the container with by running `start.sh`.

### Prepare and run sshd

Inside container:

```bash
pacman -S openssh
ssh-keygen -A
awk -i inplace '/^#Port 22/{print "Port 3922"; next}{print}' /etc/ssh/sshd_config
```

Inside host system in the container folder:

```bash
mkdir root/.ssh
cp ~/.ssh/id_rsa.pub root/.ssh/authorized_keys

./start.sh /usr/bin/sshd
```

> The `--map-auto` option of `unshare` in `start.sh` is important because `sshd` uses `setgid` and will fail due to
> insufficient privilege if the user namespace is not mapped.

Now the container can be accessed by:

```bash
ssh root@localhost -p 3922
```

### Save container into an image

Run in the host system inside the container folder. The image file is saved adjacent to the container folder.

```bash
export XZ_OPT="-e -T 0"
tar -cJvf ../image.tar.xz .
sha256sum ../image.tar.xz
```

### Instantiate an image into a container

```bash
mkdir container
tar xf image.tar.xz -C container
```

### Prepare an Alpine container

The latest download link can be found at [https://alpinelinux.org/downloads](https://alpinelinux.org/downloads).

```
mkdir alpine && cd alpine
wget 'https://dl-cdn.alpinelinux.org/alpine/v3.18/releases/x86_64/alpine-minirootfs-3.18.0-x86_64.tar.gz'
tar xf *.tar.gz && rm *.tar.gz

> start.sh <<"EOF"
SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )

unshare -rm --map-auto --propagation slave bash -c "\
    mount -R /proc $SCRIPT_DIR/proc;\
    mount -R /dev $SCRIPT_DIR/dev;\
    mount --bind /etc/resolv.conf $SCRIPT_DIR/etc/resolv.conf;\
    mount -o nodev,nosuid,size=16G -t tmpfs tmpfs $SCRIPT_DIR/tmp;\
    mount -o nodev,nosuid,size=16G -t tmpfs tmpfs $SCRIPT_DIR/run;\
    export HOME=/root;\
    export SHELL=/bin/sh;\
    export PATH=/usr/bin:/usr/sbin:/bin:/sbin;\
    chroot $SCRIPT_DIR $*"
EOF

chmod +x start.sh

touch etc/resolv.conf
```

### Some of my containers

```
wget 'https://r2.ylxdzsw.com/arch.230601.tar.xz'   # 116M sha256sum 24ef32def517576a5f22b8f2fdc4577450fa31ab120448820ff0b636bdc6d6e4
wget 'https://r2.ylxdzsw.com/alpine.230601.tar.xz' # 2.6M sha256sum 39f31ede4d550c388c24b2eacb37d55f862d65b9ec106b480b6545ba1a841c0e
wget 'https://r2.ylxdzsw.com/pluto.230601.tar.xz'  # 132M sha256sum 6183b4b5fa71cc29f7269e5e700ebeec5dbd427003217ead2723d55f833c2e5d
```
