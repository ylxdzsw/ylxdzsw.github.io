#!/usr/bin/env node

/*
Copyright (c) 2018: Zhang Shiwei (ylxdzsw@gmail.com)

This script build the blog by:
1. get a list of posts by find main.* in `_posts` folder recursively
2. compare the hashs of posts with those in `info.json` and set update timestamps
3. recompile posts that hashes do not match, then update `info.json`
4. handle links in `links.txt`
5. delete compiled posts that do not appear in the source
6. generate the index page
*/

"don't use strict"

const now = Date.now()

const fs = require('fs')
const cp = require('child_process')
const path = require('path')
const crypto = require('crypto')

class Post {
    constructor(p) {
        this.path = p
        this.hash = this.getHash()
        this.link = this.getLink()
        if (!this.link.startsWith('_')) {
            this.name = path.parse(this.link).name
        }
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
    getLink() {
        return path.basename(this.path) + '.html'
    }

    compile() {
        const target = path.join(this.path, "main.jade")
        const result = path.join(__dirname, this.link)
        return new Promise((resolve, reject) => {
            cp.exec(`nattoppet ${target} > ${result}`, (err) => err ? reject(err) : resolve())
        })
    }
}

class HTMLPost extends Post {
    getLink() {
        return path.basename(this.path) + '.html'
    }

    compile() {
        const src = path.join(this.path, "main.html")
        const dst = path.join(__dirname, this.link)
        return new Promise((resolve, reject) => {
            fs.copyFile(src, dst, (err) => err ? reject(err) : resolve())
        })
    }
}

class TeXPost extends Post {
    getLink() {
        return path.basename(this.path) + '.pdf'
    }

    compile() {
        const clean_up = () => {
            const tasks = []
            for (const postfix of ["aux", "fdb_latexmk", "fls", "log", "pdf", "synctex.gz",
                                   "synctex(busy)", "bbl", "idx", "out", "blg", "dvi"]) {
                tasks.push(new Promise((resolve, reject) => {
                    fs.unlink(path.join(this.path, "main." + postfix), resolve)
                }))
            }
            return Promise.all(tasks)
        }

        return new Promise((resolve, reject) => {
            cp.exec(`latexmk main.tex -interaction=nonstopmode -pdf`, { cwd: this.path }, (err) => {
                if (err) return reject(err)

                const src = path.join(this.path, "main.pdf")
                const dst = path.join(__dirname, this.link)
                fs.copyFile(src, dst, (err) => err ? reject(err) : resolve())
            })
        }).then(v => new Promise((resolve, reject) => clean_up().then(x=>resolve(v))),
                e => new Promise((resolve, reject) => clean_up().then(x=>reject(e))))
    }
}

class PDFPost extends Post {
    getLink() {
        return path.basename(this.path) + '.pdf'
    }

    compile() {
        const src = path.join(this.path, "main.pdf")
        const dst = path.join(__dirname, this.link)
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

// step 2. compare the hashs of posts with those in `info.json` and set update timestamps

const hashdict = Object.create(null)

for (const p of posts)
    hashdict[p.hash] = p

for (const p of JSON.parse(fs.readFileSync(path.join(__dirname, 'info.json'), { encoding: 'utf8' }))) {
    const x = hashdict[p.hash]
    if (x) x.timestamp = p.timestamp
}

// step 3. recompile posts that hashes do not match, then update `info.json`

const tasks = []
let infostr = '[\n'

for (const p of posts.sort((a, b) => a.hash > b.hash ? 1 : -1)) {
    if (!p.timestamp) { // TODO: maybe limit concurrent compilation?
        tasks.push(p.compile())
        p.timestamp = now
    }
    infostr += `  { "hash": "${p.hash}", "timestamp": ${p.timestamp} },\n` // manually build the json so ensuring the order so git better diff it.
}

fs.writeFileSync(path.join(__dirname, 'info.json'), infostr.slice(0, -2) + '\n]')

// step 4. handle links in `links.txt`

const links = fs.readFileSync(path.join(__dirname, 'links.txt')).toString().split('\n')

for (const link of links) {
    const [src, dest, time] = link.split(' ')
    if (time) {
        posts.push({
            name: src,
            link: dest,
            timestamp: parseInt(time)
        })
    } else {
        fs.writeFileSync(path.join(__dirname, src), `<!DOCTYPE HTML><meta charset="UTF-8"><meta http-equiv="refresh" content="0; url=${dest}"><title>Redirection</title>This page has been moved to <a href="${dest}">${dest}</a>`)
        posts.push({ link: src })
    }
}

// step 5. delete compiled posts that do not appear in the source

for (const p of fs.readdirSync(__dirname)
                  .filter(x=>x.endsWith('.html') || x.endsWith('.pdf'))
                  .filter(x=>!x.startsWith('google') && !x.startsWith('index'))) {
    posts.some(x => x.link == p) || fs.unlink(path.join(__dirname, p), ()=>0)
}

// step 6. generate the index page

const stale_color = time => {
    const diff = now - time
    return diff < 604800000 ? 'lime' : // 7 days
           diff < 2592000000 ? 'greenyellow' : // 30 days
           diff < 8640000000 ? 'yellow' : // 100 days
           diff < 31536000000 ? 'orange' : // 365 days
           diff < 86400000000 ? 'tomato' : 'red' // 1000 days
}

const index_head = `<!DOCTYPE HTML><meta charset="UTF-8"><meta name=viewport content="width=device-width"><title>ylxdzsw's blog</title><style>li{padding-left:0.8em;list-style-type:none}@media(max-width:415px){.detail{display:none}}</style><h1 style="display:inline;margin:0.2em 0.5em 0.2em 0.2em">ylxdzsw's blog</h1><a target="_blank" href="_about.html">About me</a><hr>\n`
const index_foot = `<hr><p>Copyright © 2015-2018: root@ylxdzsw.com</p>`
const index_body = posts.filter(x => x.name)
                        .sort((a, b) => a.name < b.name ? 1 : -1)
                        .map(x => `<li style="border-left:solid ${stale_color(x.timestamp)}"><a target="_blank" href="${x.link}">${x.name}</a> <span class="detail" style="color:gray;font-size:0.85em">(last update at ${new Date(x.timestamp).toLocaleString()})</span></li>\n`)
                        .join('')

fs.writeFileSync(path.join(__dirname, 'index.html'), index_head + index_body + index_foot)

// wait and done

Promise.all(tasks).then(() => {
    console.info(`build finished in ${Date.now() - now}ms, ${tasks.length} post updated`)
    process.exit(0)
})
