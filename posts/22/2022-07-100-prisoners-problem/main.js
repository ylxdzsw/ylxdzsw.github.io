function random_permutate_100() {
    const boxes = []
    for (let i = 0; i < 100; i++)
        boxes.push(i)

    let currentIndex = boxes.length, randomIndex

    while (currentIndex != 0) {
        randomIndex = Math.floor(Math.random() * currentIndex)
        currentIndex--

        [boxes[currentIndex], boxes[randomIndex]] = [boxes[randomIndex], boxes[currentIndex]]
    }

    return boxes
}

function simulate(boxes, prisoner_id) {
    let next = prisoner_id

    for (let trial = 0; trial < 50; trial++) {
        const box_value = boxes[next]
        if (box_value == prisoner_id)
            return true
        next = box_value
    }

    return false
}

function simulate_all() {
    const boxes = random_permutate_100()
    let count = 0

    for (let i = 0; i < 100; i++)
        count += simulate(boxes, i)

    return count == 100
}

;(async () => {
    let n_success = 0
    const output = document.querySelector("#a")

    for (let n = 1; n <= 100000; n++) {
        if (simulate_all())
            n_success++

        output.innerHTML = `${n_success} / ${n} = ${n_success / n}`
        if (n % 1000 == 0)
            await new Promise(resolve => setTimeout(resolve, 0))
    }
})()

