## Gnome 3.32 Upgrading Notes

Manjaro has moved a new batch of updates to the stable channel last week, including Gnome 3.32 - a project that breaks
existing extensions in every single updates. Unfortunately, my system crashes after `pacman -Syu`. I was busy so I just
reverted everything with Timeshift and stayed with 3.30. Yesterday I got a mouse and notice that Gnome 3.32 added a long
waited feature that allows one to disable mouse acceleration directly in tweak tools, so I choose to take the time to do
the updates. Here are the problems I experienced and my solutions to them.

### Gnome Crashing

The most disappointing part of the update is, well, it does not run anymore. After entering password in GDM, my screen
turns gray and a mouse pointer appears, but nothing more happens. After about 5 seconds of non-responding, it goes back
to GDM and requires password again.

Switching to another tty by <kbd>Ctrl+Alt+F3</kbd> and inspecting the logs by `journalctl -xe`, it seems gnome crashed
during starting. The coredump traces show something related to `libmozjs.so`. I tried to disable all extensions by
`gsettings set org.gnome.shell enabled-extensions '[]'` and it suprisingly worked. Gnome now starts.

### Fix extension

I further hunted down the extension that causes the problem, and the result is quiet embarassing: it's [my own
extension](https://github.com/ylxdzsw/gnome-shell-extension-shadowsocks). After several rounds of debugging, I found the
two breaking changes that causes problems. First, `panelMenu.Button::_init` is the one causes the crash. Previously
it is needed to properly initialize the button, but now it is seems to be obsolete and become problematic. Just remove it
solved the crashing. The second problem is that `Uint8Array::toString` has silently changed its semantics: in the past it
interprets all bytes in the array but now it stops at the first '\0' and ignores the following bytes. This makes reading
`/proc/{pid}/cmdline` a little bit harder. I solved it by using `String.fromCharCode.apply` instead. It only supports
ASCII chars, but is sufficient for my use case.

### Gnome Terminal

After the update, Gnome Terminal shows at least 3 new problems. First, it does not get focus when started by
<kbd>Super+num</kbd>. This is actually a [known bug](https://gitlab.gnome.org/GNOME/gnome-shell/issues/1043) and has
[already been fixed](https://gitlab.gnome.org/GNOME/mutter/merge_requests/518). However, it is still not land in the
stable channel of Manjaro. Second, the icon theme does not applied anymore, because a `org.gnome` prefix is added to the
icon name. This has also been addressed by [the icon theme I'm using](https://github.com/PapirusDevelopmentTeam/papirus-icon-theme).
I temporately switched to unstable channel and installed the updated packages to fix the problems. The last problem is
much more disruptive for me: it now gets a fat and useless header bar. The new header bar is so ugly that I uninstalled
Gnome Terminal without any hesitation after I found that there is no option to disable it. I installed Terminator and
tuned it to be visually similar to the original Gnome Terminal. So far it works fine, though it takes slightly longer to
open.

### Panel transparency

Another enhancement of Gnome 3.32 is that it removed the transparency feature of panel bar. Although I'm not a big fan
of transparent panel bars, my wallpaper not plays good with a black top. Fortunately there is [a great extension](https://extensions.gnome.org/extension/1708/transparent-top-bar)
that recovers the original behaviour and it works perfectly for me.

### Huge "user" icon in status menu

Just as [reported in the forum](https://forum.manjaro.org/t/icon-issue-in-gnome-3-32-status-menu/81616), this is a very
obvious problem and it is somewhat ridiculous that it appears in the stable channel. I have to uninstall the
`manjaro-gdm-theme` to solve the problem.
