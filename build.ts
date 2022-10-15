#!/usr/bin/env -S deno run -A --unstable

import { createHash } from "https://deno.land/std@0.127.0/hash/mod.ts"
import * as path from "https://deno.land/std@0.127.0/path/mod.ts"

const __dirname = path.dirname(path.fromFileUrl(import.meta.url))

const now = Date.now()

const purge_cache = Deno.args.includes("--purge-cache")

abstract class Post {
    path: string
    hash: string
    link: string
    name: string | null = null
    timestamp: number | null = null

    constructor(p: string) {
        this.path = p
        this.hash = this.get_hash()
        this.link = this.get_link()
        if (!this.link.startsWith('_'))
            this.name = path.parse(this.link).name
    }

    abstract get_link(): string

    abstract compile(): Promise<void>

    get_hash() {
        const hasher = createHash('md5')

        function hash(p: string, init_dir = false) {
            const stat = Deno.statSync(p)
            if (stat.isFile) {
                hasher.update(path.basename(p))
                hasher.update(Deno.readFileSync(p))
            } else if (stat.isDirectory) {
                !init_dir && hasher.update(path.basename(p))
                for (const name of [...Deno.readDirSync(p)].map(x=>x.name).sort())
                    hash(path.join(p, name))
            } else {
                throw new Error("what the fuck is this? " + p)
            }
        }

        hash(this.path, true)

        return hasher.toString('hex')
    }
}

class YMDPost extends Post {
    get_link() {
        return path.basename(this.path) + '.html'
    }

    async compile() {
        const result = path.join(__dirname, this.link)
        const nattoppet_url = "https://raw.githubusercontent.com/ylxdzsw/nattoppet/master/nattoppet.ts"
        const cmd = [
            "bash",
            "-c",
            `deno run -A --unstable --no-check ${nattoppet_url} ${this.path}/main.ymd > ${result}`
        ]
        const child = Deno.run({ cmd })
        await child.status()
    }
}

class HTMLPost extends Post {
    get_link() {
        return path.basename(this.path) + '.html'
    }

    async compile() {
        const src = path.join(this.path, "main.html")
        const dst = path.join(__dirname, this.link)
        await Deno.copyFile(src, dst)
    }
}

class TeXPost extends Post {
    get_link() {
        return path.basename(this.path) + '.pdf'
    }

    async compile() {
        try {
            const status = await Deno.run({
                cmd: ["latexmk", "main.tex", "-interaction=nonstopmode", "-pdf"],
                cwd: this.path
            }).status()

            if (status.code != 0)
                throw "latexmk failed with code: " + status.code

            const src = path.join(this.path, "main.pdf")
            const dst = path.join(__dirname, this.link)
            await Deno.copyFile(src, dst)
        } finally {
            const tasks = []
            for (const postfix of ["aux", "fdb_latexmk", "fls", "log", "pdf", "synctex.gz",
                                   "synctex(busy)", "bbl", "idx", "out", "blg", "dvi", "nav", "snm", "toc"])
                tasks.push(Deno.remove(path.join(this.path, "main." + postfix)))
            await Promise.allSettled(tasks)
        }
    }
}

class PDFPost extends Post {
    get_link() {
        return path.basename(this.path) + '.pdf'
    }

    async compile() {
        const src = path.join(this.path, "main.pdf")
        const dst = path.join(__dirname, this.link)
        await Deno.copyFile(src, dst)
    }
}

// step 1. get a list of posts by find main.* in `_posts` folder recursively

const posts: any[] = []

const walk = (dir: string) => {
    const list = [...Deno.readDirSync(dir)].map(x=>x.name)

    switch (false) {
        case !list.includes("main.ymd"): return posts.push(new YMDPost(dir))
        case !list.includes("main.html"): return posts.push(new HTMLPost(dir))
        case !list.includes("main.tex"): return posts.push(new TeXPost(dir))
        case !list.includes("main.pdf"): return posts.push(new PDFPost(dir))
    }

    for (const item of list) {
        const subdir = path.join(dir, item)
        Deno.statSync(subdir).isDirectory && walk(subdir)
    }
}

walk(path.join(__dirname, "posts"))

// step 2. compare the hashes of posts with those in `info.json` and set update timestamps

const hashdict: Record<string, Post> = Object.create(null)

for (const p of posts)
    hashdict[p.hash] = p

for (const p of JSON.parse(Deno.readTextFileSync(path.join(__dirname, 'info.json')))) {
    const x = hashdict[p.hash]
    if (x) x.timestamp = p.timestamp
}

// step 3. recompile posts whose hashes do not match, then update `info.json`

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

Deno.writeTextFileSync(path.join(__dirname, 'info.json'), infostr.slice(0, -2) + '\n]')

// step 4. handle links in `links.txt`

const links = Deno.readTextFileSync(path.join(__dirname, 'links.txt')).split('\n')

for (const link of links) {
    const [src, dest, time] = link.split(' ')
    if (time) {
        posts.push({
            name: src,
            link: dest,
            timestamp: parseInt(time)
        })
    } else {
        Deno.writeTextFileSync(path.join(__dirname, src), `<!DOCTYPE HTML><meta charset="UTF-8"><meta http-equiv="refresh" content="0; url=${dest}"><title>Redirection</title>This page has been moved to <a href="${dest}">${dest}</a>`)
        posts.push({ link: src })
    }
}

// step 5. delete compiled posts that do not appear in the source

for (const p of [...Deno.readDirSync(__dirname)].map(x=>x.name)
                    .filter(x=>x.endsWith('.html') || x.endsWith('.pdf'))) {
    posts.some(x => x.link == p) || Deno.remove(path.join(__dirname, p)).catch(_=>0)
}

// step 6. generate the index page

const stale_color = (time: number) => {
    const this_year = new Date(now).getFullYear()
    const compile_year = new Date(time).getFullYear()
    const color_list = ['lime', 'greenyellow', 'yellow', 'orange', 'tomato']
    return color_list[this_year - compile_year] || 'red'
}

const RSS_icon = `<svg xmlns="http://www.w3.org/2000/svg" version="1.1" width="1rem" height="1rem" id="RSSicon" viewBox="0 0 256 256"><defs><linearGradient x1="0.085" y1="0.085" x2="0.915" y2="0.915" id="RSSg"><stop offset="0.0" stop-color="#E3702D"/><stop offset="0.1071" stop-color="#EA7D31"/><stop offset="0.3503" stop-color="#F69537"/><stop offset="0.5" stop-color="#FB9E3A"/><stop offset="0.7016" stop-color="#EA7C31"/><stop offset="0.8866" stop-color="#DE642B"/><stop offset="1.0" stop-color="#D95B29"/></linearGradient></defs><rect width="256" height="256" rx="55" ry="55" x="0" y="0" fill="#CC5D15"/><rect width="246" height="246" rx="50" ry="50" x="5" y="5" fill="#F49C52"/><rect width="236" height="236" rx="47" ry="47" x="10" y="10" fill="url(#RSSg)"/><circle cx="68" cy="189" r="24" fill="#FFF"/><path d="M160 213h-34a82 82 0 0 0 -82 -82v-34a116 116 0 0 1 116 116z" fill="#FFF"/><path d="M184 213A140 140 0 0 0 44 73 V 38a175 175 0 0 1 175 175z" fill="#FFF"/></svg>`

const index_head = `<!DOCTYPE HTML><meta charset="UTF-8"><meta name=viewport content="width=device-width"><title>ylxdzsw's blog</title><style>li{padding-left:0.8em;list-style-type:none}@media(max-width:415px){.detail{display:none}h1{font-size:1.5em}}</style><h1 style="display:inline;margin:0.2em 0.5em 0.2em 0.2em">ylxdzsw's blog</h1><a target="_blank" href="feed.xml" style="margin-right:1em">${RSS_icon}</a><a target="_blank" href="_about.html">About me</a><hr>\n`
const index_foot = `<hr><p>Copyright © 2015-${new Date(now).getFullYear()}: root@ylxdzsw.com</p>`
const index_body = posts.filter(x => x.name)
                        .sort((a, b) => a.name < b.name ? 1 : -1)
                        .map(x => `<li style="border-left:solid ${stale_color(x.timestamp)}"><a target="_blank" href="${x.link}">${x.name}</a> <span class="detail" style="color:gray;font-size:0.85em">(last update: ${new Date(x.timestamp).toLocaleString('en-HK')})</span></li>\n`)
                        .join('')

Deno.writeTextFileSync(path.join(__dirname, 'index.html'), index_head + index_body + index_foot)

// Step 7. generate the RSS feed

const feed_head = `<?xml version="1.0" encoding="utf-8"?><rss version="2.0"><channel><title>ylxdzsw's blog</title><link>https://blog.ylxdzsw.com/</link><description>Works, thoughts, life, and balderdash.</description>\n<lastBuildDate>${new Date(now).toUTCString()}</lastBuildDate>\n`
const feed_foot = `</channel></rss>`
const feed_body = posts.filter(x => x.name)
                       .sort((a, b) => a.name < b.name ? 1 : -1)
                       .slice(0, 15)
                       .map(x => `<item><title>${x.name}</title><link>${new URL(x.link, "https://blog.ylxdzsw.com").href}</link><guid>${x.hash}</guid><pubDate>${new Date(x.timestamp).toUTCString()}</pubDate></item>\n`)
                       .join('')

Deno.writeTextFileSync(path.join(__dirname, 'feed.xml'), feed_head + feed_body + feed_foot)

// wait and done

Promise.all(tasks).then(() => {
    console.info(`build finished in ${Date.now() - now}ms, ${tasks.length} post updated`)
})
