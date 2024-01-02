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

    log(info) {
        console.log(info)
    },

    backtest(strategy, trace=app.active_dataset, log=true) {
        const strategy_fun = new Function("with (this) { " + strategy + " }")
        const history = []
        for (let i = 0; i < trace.length; i++) {
            const env = new BacktestEnvironment(trace, history, i)
            strategy_fun.call(env)
            if (i == trace.length - 1)
                if (env.holding > 0) // force selling at the end
                    env.sell()
                else // and prevent buying
                    env.action = null

            switch (env.action) {
                case "buy":
                    log && app.log(`${new Date(trace[i].timestamp).toLocaleDateString()}：买入${(env.cash / env.price).toPrecision(4)}份标的，价格${env.price}`)
                    env.cash_after_action = 0
                    env.holding_after_action = env.cash / env.price
                    break
                case "sell":
                    log && app.log(`${new Date(trace[i].timestamp).toLocaleDateString()}：卖出${env.holding.toPrecision(4)}份标的，价格${env.price}，收益${(100*env.profit).toPrecision(4)}%`)
                    env.cash_after_action = env.holding * env.price
                    env.holding_after_action = 0
                    break
                default:
                    env.cash_after_action = env.cash
                    env.holding_after_action = env.holding
            }

            history.push(env)
        }
        return history[history.length - 1].cash_after_action
    }
}


class BacktestEnvironment {
    constructor(candles, history, day) {
        this.candles = candles
        this.history = history
        this.day = day

        this.action = null // to be filled by strategy
        this.cash_after_action = null // to be filled after calling strategy
        this.holding_after_action = null // to be filled after calling strategy
    }

    get open() {
        return this.candles[this.day].open
    }

    get close() {
        return this.candles[this.day].close
    }

    get high() {
        return this.candles[this.day].high
    }

    get low() {
        return this.candles[this.day].low
    }

    get volume() {
        return this.candles[this.day].volume
    }

    get price() {
        return this.close
    }

    get cash() {
        if (this.day == 0) return 10000
        return this.t(-1).cash_after_action
    }

    get holding() {
        if (this.day == 0) return 0
        return this.t(-1).holding_after_action
    }

    get profit() {
        if (!this.holding) return 0
        for (let i = -1; i >= -this.day; i--)
            if (this.t(i).action == "buy")
                return this.holding * this.price / this.t(i).cash - 1
    }

    buy() {
        if (this.cash > 0) this.action = "buy"
    }

    sell() {
        if (this.holding > 0) this.action = "sell"
    }

    t(i) {
        if (i > 0) throw new Error("t(i) i must be negative")
        if (i == 0) return this
        if (this.day + i < 0) return this.history[0] ?? this
        return this.history[this.day + i]
    }

    log(msg) {
        app.log(msg)
    }

    MA(n) {
        let sum = 0
        for (let i = 0; i < n; i++) {
            sum += this.t(-i).price
        }
        return sum / n
    }
}

addEventListener('load', async () => {
    await window.json_ready
    app.emit("load")
})

addEventListener("beforeunload", () => {
    app.emit("save")
})

// https://klinecharts.com/guide/chart-api.html
// https://docs.bitfinex.com/reference/rest-public-candles
