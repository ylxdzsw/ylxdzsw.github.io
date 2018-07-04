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

}

class HTMLPost extends Post {

}

class TeXPost extends Post {

}

class PDFPost extends Post {

}
