/*
Copyright (c) 2018: Zhang Shiwei (ylxdzsw@gmail.com)

This script build the blog by:
1. get a list of posts by find main.* in `_posts` folder recursively
2. delete compiled posts that do not appear in the above list
3. compare the hashs of posts with those in `info.json` and set update timestamps
4. recompile posts that hashes do not match, then update `info.json`
5. generate the index page
*/

"don't use strict"

const starttime = Date.now()

const fs = require('fs')
const cp = require('child_process')
const path = require('path')
const crypto = require('crypto')

class Post {
    constructor(path) {
        this.path = path
        this.hash = this.getHash()
        this.name = this.getName()
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
                throw new Error("what the fuck is this? " + p)
            }
        }

        hash(this.path)

        return hasher.digest('hex')
    }
}

class JadePost extends Post {
    getName() {
        return path.basename(this.path) + '.html'
    }

    async compile() {
        const target = path.join(this.path, "main.jade")
        const result = path.join(__dirname, this.getName())
        return new Promise((resolve, reject) => {
            cp.exec(`nattoppet ${target} > ${result}`, (err) => err ? reject(err) : resolve())
        })
    }
}

class HTMLPost extends Post {
    getName() {
        return path.basename(this.path) + '.html'
    }

    async compile() {
        const src = path.join(this.path, "main.html")
        const dst = path.join(__dirname, this.getName())
        return new Promise((resolve, reject) => {
            fs.copyFile(src, dst, (err) => err ? reject(err) : resolve())
        })
    }
}

class TeXPost extends Post {
    getName() {
        return path.basename(this.path) + '.pdf'
    }

    async compile() {
        try {
            return await (async () => {
                return new Promise((resolve, reject) => {
                    cp.exec(`latexmk main.tex -interaction=nonstopmode -pdf`, { cwd: this.path }, (err) => {
                        if (err) return reject(err)

                        const src = path.join(this.path, "main.pdf")
                        const dst = path.join(__dirname, this.getName())
                        fs.copyFile(src, dst, (err) => err ? reject(err) : resolve())
                    })
                })
            })()
        } finally { // clean up without waiting
            for (const postfix of ["aux", "fdb_latexmk", "fls", "log", "pdf", "synctex.gz",
                                   "synctex(busy)", "bbl", "idx", "out", "blg", "dvi"]) {
                fs.unlink(path.join(this.path, "main." + postfix), ()=>0)
            }
        }
    }
}

class PDFPost extends Post {
    getName() {
        return path.basename(this.path) + '.pdf'
    }

    async compile() {
        const src = path.join(this.path, "main.pdf")
        const dst = path.join(__dirname, this.getName())
        return new Promise((resolve, reject) => {
            fs.copyFile(src, dst, (err) => err ? reject(err) : resolve())
        })
    }
}

// step 1. get a list of posts by find main.* in `_posts` folder recursively

const posts = []

const walk = dir => {
    const list = fs.readdirSync(dir)

    if (list.includes("main.jade")) {
        return posts.push(new JadePost(dir))
    } else if (list.includes("main.html")) {
        return posts.push(new HTMLPost(dir))
    } else if (list.includes("main.tex")) {
        return posts.push(new TeXPost(dir))
    } else if (list.includes("main.pdf")) {
        return posts.push(new PDFPost(dir))
    }

    for (const item of list) {
        const subdir = path.join(dir, item)
        fs.statSync(subdir).isDirectory() && walk(subdir)
    }
}

walk(path.join(__dirname, "_posts"))

// step 2. delete compiled posts that do not appear in the above list

for (const p of fs.readdirSync(__dirname)
                  .filter(x=>x.endsWith('.html') || x.endsWith('.pdf'))
                  .filter(x=>!x.startsWith('google') && !x.startsWith('index'))) {
    posts.some(x => x.name == p) || fs.unlink(path.join(__dirname, p), ()=>0)
}

// step 3. compare the hashs of posts with those in `info.json` and set update timestamps

const hashdict = Object.create(null)

for (const p of posts)
    hashdict[p.hash] = p

for (const p of JSON.parse(fs.readFileSync(path.join(__dirname, 'info.json'), { encoding: 'utf8' }))) {
    const x = hashdict[p.hash]
    if (x) x.timestamp = p.timestamp
}

// step 4. recompile posts that hashes do not match, then update `info.json`

const tasks = []
let infostr = '[\n'

for (const p of posts.sort((a, b) => a.hash > b.hash ? 1 : -1)) {
    if (!p.timestamp) { // TODO: maybe limit concurrent compilation?
        tasks.push(p.compile())
        p.timestamp = Date.now()
    }
    infostr += `  { "hash": "${p.hash}", "timestamp": ${p.timestamp} },\n` // manually build the json so ensuring the order so git better diff it.
}

fs.writeFileSync(path.join(__dirname, 'info.json'), infostr.slice(0, -2) + '\n]')

// step 5. generate the index page

const index_head = `<!DOCTYPE html><html><head><meta charset=utf8><meta name=viewport content="width=device-width"><title>ylxdzsw's blog</title></head><body><h1 id=title>stay young, stay naïve</h1><hr>`
const index_foot = `<hr><p>Copyright © 2015-2018: root@ylxdzsw.com</p></body></html>`
const index_body = posts.sort((a, b) => a.name < b.name ? 1 : -1)
                        .map(x => `<li><a target="_blank" href="${x.name}">${path.basename(x.path)}</a> (last update at ${new Date(x.timestamp).toLocaleString()})</li>`)
                        .join('')

fs.writeFileSync(path.join(__dirname, 'index.html'), index_head + index_body + index_foot)

// wait and done

Promise.all(tasks).then(() => {
    console.info(`build finished in ${Date.now() - starttime}ms, ${tasks.length} post updated`)
    process.exit(0)
})
