function gen_primes(n=100000) {
    let primes = new Set(Array(n-2).fill().map((_, i) => i+2))
    for (let i = 2; i < n; i++) if (primes.has(i))
        for (let j = i * 2; j < n; j += i)
            primes.delete(j)
    primes = Array.from(primes)
    primes.sort((a, b) => a - b)
    return primes
}

function draw_spiral(numbers, c, s) {
    const ctx = document.querySelector('canvas').getContext('2d')
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
    const center_x = ctx.canvas.width / 2
    const center_y = ctx.canvas.height / 2
    const r = 500 / s

    for (const number of numbers) if (number < s) {
        const x = center_x + r * number * Math.cos(c * number / 100)
        const y = center_y + r * number * Math.sin(c * number / 100)
        ctx.beginPath()
        ctx.arc(x, y, 1 + number / s, 0, 2 * Math.PI)
        ctx.fill()
    }
}

function redraw(numbers) {
    draw_spiral(numbers, document.getElementById("c").value, document.getElementById("s").value)
}

if (typeof Deno != 'undefined')
    Deno.writeTextFileSync('primes.json', JSON.stringify(gen_primes()))
else {
    const primes = gen_primes()
    document.querySelectorAll('input[type=range]').forEach(slider => slider.addEventListener('input', () => redraw(primes)))
    redraw(primes)
}
