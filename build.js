#!/usr/bin/env node

/*
Copyright (c) 2018-2020: Zhang Shiwei (ylxdzsw@gmail.com)

This script build the blog by:
1. get a list of posts by find main.* in `_posts` folder recursively
2. compare the hashs of posts with those in `info.json` and set update timestamps
3. recompile posts that hashes do not match, then update `info.json`
4. handle links in `links.txt`
5. delete compiled posts that do not appear in the source
6. generate the index page
7. generate the RSS feed
*/

// TODO: LinkPost instead of the links.txt

"don't use strict"

const now = Date.now()

const fs = require('fs')
const cp = require('child_process')
const path = require('path')
const crypto = require('crypto')

const purge_cache = process.argv.includes("--purge-cache")

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

class YMDPost extends Post {
    getLink() {
        return path.basename(this.path) + '.html'
    }

    compile() {
        const result = path.join(__dirname, this.link)
        return new Promise((resolve, reject) => {
            const cmd = `bash -c "npx nattoppet ${this.path.replace(/\\/g, '/')}/main.ymd > ${result.replace(/\\/g, '/')}"`
            cp.exec(cmd, (err) => err ? reject(err) : resolve())
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
                                   "synctex(busy)", "bbl", "idx", "out", "blg", "dvi", "nav", "snm", "toc"]) {
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

    switch (false) {
        case !list.includes("main.ymd"): return posts.push(new YMDPost(dir))
        case !list.includes("main.html"): return posts.push(new HTMLPost(dir))
        case !list.includes("main.tex"): return posts.push(new TeXPost(dir))
        case !list.includes("main.pdf"): return posts.push(new PDFPost(dir))
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
    } else if (purge_cache && p instanceof YMDPost) {
        tasks.push(p.compile())
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

const RSS_icon = `<svg xmlns="http://www.w3.org/2000/svg" version="1.1" width="1rem" height="1rem" id="RSSicon" viewBox="0 0 256 256"><defs><linearGradient x1="0.085" y1="0.085" x2="0.915" y2="0.915" id="RSSg"><stop offset="0.0" stop-color="#E3702D"/><stop offset="0.1071" stop-color="#EA7D31"/><stop offset="0.3503" stop-color="#F69537"/><stop offset="0.5" stop-color="#FB9E3A"/><stop offset="0.7016" stop-color="#EA7C31"/><stop offset="0.8866" stop-color="#DE642B"/><stop offset="1.0" stop-color="#D95B29"/></linearGradient></defs><rect width="256" height="256" rx="55" ry="55" x="0" y="0" fill="#CC5D15"/><rect width="246" height="246" rx="50" ry="50" x="5" y="5" fill="#F49C52"/><rect width="236" height="236" rx="47" ry="47" x="10" y="10" fill="url(#RSSg)"/><circle cx="68" cy="189" r="24" fill="#FFF"/><path d="M160 213h-34a82 82 0 0 0 -82 -82v-34a116 116 0 0 1 116 116z" fill="#FFF"/><path d="M184 213A140 140 0 0 0 44 73 V 38a175 175 0 0 1 175 175z" fill="#FFF"/></svg>`

const index_head = `<!DOCTYPE HTML><meta charset="UTF-8"><meta name=viewport content="width=device-width"><title>ylxdzsw's blog</title><style>li{padding-left:0.8em;list-style-type:none}@media(max-width:415px){.detail{display:none}h1{font-size:1.5em}}</style><h1 style="display:inline;margin:0.2em 0.5em 0.2em 0.2em">ylxdzsw's blog</h1><a target="_blank" href="feed.xml" style="margin-right:1em">${RSS_icon}</a><a target="_blank" href="_about.html">About me</a><hr>\n`
const index_foot = `<hr><p>Copyright © 2015-${new Date().getFullYear()}: root@ylxdzsw.com</p>`
const index_body = posts.filter(x => x.name)
                        .sort((a, b) => a.name < b.name ? 1 : -1)
                        .map(x => `<li style="border-left:solid ${stale_color(x.timestamp)}"><a target="_blank" href="${x.link}">${x.name}</a> <span class="detail" style="color:gray;font-size:0.85em">(last update at ${new Date(x.timestamp).toLocaleString('en-HK')})</span></li>\n`)
                        .join('')

fs.writeFileSync(path.join(__dirname, 'index.html'), index_head + index_body + index_foot)

// Step 7. generate the RSS feed

const feed_head = `<?xml version="1.0" encoding="utf-8"?><rss version="2.0"><channel><title>ylxdzsw's blog</title><link>https://blog.ylxdzsw.com/</link><description>Works, thoughts, life, and balderdash.</description>\n<lastBuildDate>${new Date(now).toUTCString()}</lastBuildDate>\n`
const feed_foot = `</channel></rss>`
const feed_body = posts.filter(x => x.name)
                       .sort((a, b) => a.name < b.name ? 1 : -1)
                       .slice(0, 15)
                       .map(x => `<item><title>${x.name}</title><link>https://blog.ylxdzsw.com/${x.link}</link><guid>${x.hash}</guid><pubDate>${new Date(x.timestamp).toUTCString()}</pubDate></item>\n`)
                       .join('')

fs.writeFileSync(path.join(__dirname, 'feed.xml'), feed_head + feed_body + feed_foot)

// wait and done

Promise.all(tasks).then(() => {
    console.info(`build finished in ${Date.now() - now}ms, ${tasks.length} post updated`)
    process.exit(0)
})
