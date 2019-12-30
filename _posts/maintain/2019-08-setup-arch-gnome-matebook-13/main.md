update BIOS on Windows, just download and run the exe. https://consumer.huawei.com/en/support/laptops/matebook-13/

1. just run `dhcpcd` to enable dhcp and get IP, then `ping` should work
2. mkfs.ext4 /dev/nvme0n1p2
    mkswap /dev/nvme0n1p3
    swapon /dev/nvme0n1p3
3. mount /dev/nvme0n1p2 /mnt
    mount /dev/nvme0n1p1 /mnt/boot
4. pacstrap /mnt base
5. genfstab -U /mnt >> /mnt/etc/fstab
    - then delete the / line: I don't know but an instruction tell me to do it and it works
6. ln -sf /usr/share/zoneinfo/Asia/Hong_Kong /etc/localtime
7. hwclock --systohc
8. edit /etc/locale.gen and run locale-gen
9. echo "LANG=en_HK.UTF-8" > /etc/locale.conf
10. edit /etc/hostname and /etc/hosts
11. add user, or set password for root
12. bootctl install && bootctl update
12. pacman -S linux intel-ucode
13. edit /boot/loader
    - loader.conf:
        timeout 2
        default arch
    - entries/arch.conf
        title Arch Linux
        linux /vmlinuz-linux
        initrd /intel-ucode.img
        initrd /initramfs-linux.img
        options root=UUID=6506d705-55ee-4c67-86c5-35b48bd147f0 rw
14. edit /etc/mkinitcpio.conf and insert systemd after base in HOOKS, then run `mkinitcpio -p linux`
