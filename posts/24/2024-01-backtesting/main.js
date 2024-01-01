const app = {
    handlers: Object.create(null),

    on(event, callback) {
        app.handlers[event] ??= [] // WeakSet is not iterable
        app.handlers[event].push(new WeakRef(callback))
    },

    emit(event, args) {
        const callbacks = app.handlers[event] ?? []
        if (!callbacks.length) console.warn("message no handler", event)
        for (let i = 0; i < callbacks.length; i++) {
            const callback = callbacks[i].deref()
            if (callback) {
                callback(args)
            } else {
                callbacks[i] = callbacks[callbacks.length - 1]
                callbacks.pop()
                i--
            }
        }
    },

    save_to_local_storage() {

    },
}

addEventListener('load', async () => {
    await window.json_ready

    app.emit("load-data", window.bitfinex_btcusd_1d)
})

addEventListener("beforeunload", () => {
    return app.save_to_local_storage()
})


// https://klinecharts.com/guide/chart-api.html
// https://docs.bitfinex.com/reference/rest-public-candles
