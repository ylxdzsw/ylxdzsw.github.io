/*
This script build the blog by:
1. get a list of posts by find main.* in `_posts` folder recursively
2. delete compiled posts that do not appears in above list
3. calculate hashs of posts and compare them with those in `state.json`
4. recompile posts that hashes do not match, them update `state.json`
5. generate the index page
*/

const fs = require('fs')
const cp = require('child_process')
const path = require('path')
const crypto = require('crypto')

class Post {
    constructor(path) {
        this.path = path
    }

    getHash() {
        const hasher = crypto.createHash('md5')

        function hash(p) {
            const stat = fs.statSync(p)
            if (stat.isFile()) {
                hasher.update(path.basename(p))
                hasher.update(fs.readFileSync(p))
            } else if (stat.isDirectory()) {
                hasher.update(path.basename(p))
                for (const name of fs.readdirSync(p).sort())
                    hash(path.join(p, name))
            } else {
                throw new Error("what the fuck is this?")
            }
        }

        hash(this.path)

        return hasher.digest('hex')
    }
}

class JadePost extends Post {
    async compile() {
        const target = path.join(this.path, "main.jade")
        const result = path.join(__dirname, path.basename(this.path) + '.html')
        return new Promise((resolve, reject) => {
            cp.exec(`nattoppet ${target} > ${result}`, (err) => err ? reject(err) : resolve())
        })
    }
}

class HTMLPost extends Post {
    async compile() {
        const src = path.join(this.path, "main.html")
        const dst = path.join(__dirname, path.basename(this.path) + '.html')
        return new Promise((resolve, reject) => {
            fs.copyFile(src, dst, (err) => err ? reject(err) : resolve())
        })
    }
}

class TeXPost extends Post {
    async compile() {
        try {
            return await (async () => {
                return new Promise((resolve, reject) => {
                    cp.exec(`latexmk -interaction=nonstopmode -pdf`, { cwd: this.path }, (err) => {
                        if (err) return reject(err)

                        const src = path.join(this.path, "main.pdf")
                        const dst = path.join(__dirname, path.basename(this.path) + '.pdf')
                        fs.copyFile(src, dst, (err) => err ? reject(err) : resolve())
                    })
                })
            })()
        } finally { // clean up without waiting
            for (const postfix of ["aux", "fdb_latexmk", "fls", "log", "pdf", "synctex.gz", "synctex(busy)", "bbl", "idx", "out", "blg", "dvi"]) {
                fs.unlink(path.join(this.path, "main." + postfix), ()=>0)
            }
        }
    }
}

class PDFPost extends Post {
    async compile() {
        const src = path.join(this.path, "main.pdf")
        const dst = path.join(__dirname, path.basename(this.path) + '.pdf')
        return new Promise((resolve, reject) => {
            fs.copyFile(src, dst, (err) => err ? reject(err) : resolve())
        })
    }
}

const posts = new Set()

const post = (x, postfix) => {
    x = x.split(path.sep)
    x = x[x.length-1] + '.' + postfix
    posts.add(x)
    return x
}

const walk = dir => {
    const list = fs.readdirSync(dir).sort()

    for (let item of list) {
        const stat = fs.statSync(path.join(dir, item))

        if (stat.isFile()) {
            if (item == "main.jade" || item == "main.html") {
                const name = post(dir, 'html')
                fs.writeFileSync(name, compile(path.join(dir, item)))
                break
            } else if (item == "main.pdf") {
                const name = post(dir, 'pdf')
                fs.copyFileSync(path.join(dir, item), name)
            } else if (item == "main.tex") {
                post(dir, 'pdf')
                for (let postfix of ["aux", "fdb_latexmk", "fls", "log", "pdf", "synctex.gz", "synctex(busy)", "bbl", "idx", "out", "blg", "dvi"]) {
                    fs.unlink(path.join(dir, "main." + postfix), e=>0)
                }
            }
        } else if (stat.isDirectory()) {
            walk(path.join(dir, item))
        }
    }
}

walk(__dirname + "/_posts")
let index = path.join(opt, "index.jade")
let msg = ''
if (fs.existsSync(index)) {
    index = pug.renderFile(index, {filename: index, basedir: '/'}, {posts: [...posts]}).body
    index = minify.render(index, { removeAttributeQuotes:true, removeComments:true }).body
    fs.writeFileSync("index.html", index)
    msg = "and an index"
}
console.info(`build finished, ${posts.size} bundles ${msg} generated`)
