window.onload = ->
    encode = (x) -> URL.createObjectURL new Blob [x], type: "application/octstream"
    document.getElementById('old_pub').href = encode """@nattoppet:public-A83BF777.gpg"""
    document.getElementById('old_rev').href = encode """@nattoppet:revoke-A83BF777.gpg"""
    fetch '@nattoppet:public-EB65746D.bin'
        .then (x) -> do x.blob
        .then (x) -> document.getElementById('new_pub').href = encode x
