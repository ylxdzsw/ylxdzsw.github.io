async function run(args) {
    return `\
simulated: ${simulate(args.d, args.r).toFixed(3)}
calculated: ${calc(args.d, args.r).toFixed(3)}
`
}

function calc(d, r) {
    return d * Math.pow(r, d-1)
}

// simulate the probability of x ducks inside y occupied size
function simulate(d, r, rounds=20000) {
    let count = 0
    outer: for (let i = 0; i < rounds; i++) {
        const ducks = [...Array(d).keys()].map(() => Math.random())
        ducks.sort()
        // if and only if there exist a gap > 1 - y between two adjacent ducks
        for (let j = 0; j < d - 1; j++) if (ducks[j + 1] - ducks[j] > 1 - r) {
            count++
            continue outer
        }
        // the gap may between the last one and the first one
        if (ducks[0] + 1 - ducks[d-1] > 1 - r)
            count++
    }
    return count / rounds
}

if (typeof Deno != 'undefined')
    run({d: 4, r: 0.5}).then(console.log)
