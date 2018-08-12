const download = (str, name="download.txt") => {
    const url = URL.createObjectURL(new Blob([str], { type: "application/json" }))
    const el = document.createElement('a')
    el.download = name
    el.href = url
    el.click()
}

const gpg_keys = {
    old_pub: "@nattoppet:public-A83BF777.gpg",
    old_rev: "@nattoppet:revoke-A83BF777.gpg",
    new_pub: fetch("@nattoppet:public-EB65746D.gpg").then(x=>x.blob())
}
