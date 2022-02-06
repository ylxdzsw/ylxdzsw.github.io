function gacha_calculator(g, p, z, a, w, cache={}) {
    const limit = 100007;
    if (p >= limit) {
        throw "too big"
    }

    if (g < 100) {
        return g + z
    }

    const key = g * limit + p

    if (cache[key] !== undefined) {
        return z + cache[key]
    }

    result = 0.01 * a * gacha_calculator(g + p - 20, 0, z, a, w, cache) +
             0.01 * (1 - a) * (g + p - 20 + z) +
             0.1 * gacha_calculator(g - 100 + Math.floor(0.05 * (p + 80)), p + 80 - Math.floor(0.05 * (p + 80)), z, a, w, cache) +
             0.49 * gacha_calculator(g - 100 + Math.floor(0.01 * (p + 80)), p + 80 - Math.floor(0.01 * (p + 80)), z, a, w, cache) +
             0.1 * gacha_calculator(g - 100, p + 80, z + 2 * w.q5_gun, a, w, cache) +
             0.1 * gacha_calculator(g - 100, p + 80, z + 2 * w.q5_bread, a, w, cache) +
             0.1 * gacha_calculator(g - 100, p + 80, z + 2 * w.q1_gun, a, w, cache) +
             0.1 * gacha_calculator(g - 100, p + 80, z + 2 * w.q1_bread, a, w, cache)

    cache[key] = result - z

    return result
}

function gacha_handler() {
    let a = 0
    if (document.querySelector('#gacha-a').checked) {
        a = 1
    }

    let w = { q5_gun: 0, q5_bread: 0, q1_gun: 0, q1_bread: 0 }
    if (document.querySelector('#gacha-w').checked) {
        w = { q5_gun: 10, q5_bread: 50, q1_gun: 1, q1_bread: 5 }
    }

    const g = parseInt(document.querySelector('#gacha-g').value)
    const p = parseInt(document.querySelector('#gacha-p').value)

    const e = gacha_calculator(g, p, 0, a, w)

    document.querySelector('#gacha-result-a').textContent = a
    document.querySelector('#gacha-result-w-q5-gun').textContent = w.q5_gun
    document.querySelector('#gacha-result-w-q5-bread').textContent = w.q5_bread
    document.querySelector('#gacha-result-w-q1-gun').textContent = w.q1_gun
    document.querySelector('#gacha-result-w-q1-bread').textContent = w.q1_bread
    document.querySelector('#gacha-result-e').textContent = e
}

document.querySelector('#gacha-a').addEventListener('change', gacha_handler)
document.querySelector('#gacha-w').addEventListener('change', gacha_handler)
document.querySelector('#gacha-g').addEventListener('change', gacha_handler)
document.querySelector('#gacha-p').addEventListener('change', gacha_handler)
gacha_handler()
