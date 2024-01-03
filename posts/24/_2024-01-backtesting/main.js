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

    log(msg) {
        app.emit("log", msg)
    },

    async backtest(strategy, opts) {
        const strategy_fun = new Function("with (this) { " + strategy + " }")
        const ctx = {
            history: [],
            candles: app.active_dataset,
            log: true,
            interest: 0, // annualized interest rate of cash
            slippage: 0,
            ...opts
        }
        for (let i = 0; i < ctx.candles.length; i++) {
            const env = new BacktestEnvironment(ctx, i)
            strategy_fun.call(env)
            if (i == ctx.candles.length - 1)
                if (env.holding > 0) // force selling at the end
                    env.sell()
                else // and prevent buying
                    env.action = null

            switch (env.action) {
                case "buy":
                    ctx.log && env.log(`买入${(env.cash / env.price).toFixed(2)}份标的，价格${env.price.toFixed(2)}`)
                    env.cash_after_action = 0
                    env.holding_after_action = env.cash / env.price * (1 - ctx.slippage)
                    break
                case "sell":
                    ctx.log && env.log(`卖出${env.holding.toFixed(2)}份标的，价格${env.price.toFixed(2)}，收益${(100*env.profit).toFixed(2)}%`)
                    env.cash_after_action = env.holding * env.price * (1 - ctx.slippage)
                    env.holding_after_action = 0
                    break
                default:
                    env.cash_after_action = env.cash * Math.pow(1 + ctx.interest, 1 / 365)
                    env.holding_after_action = env.holding
            }

            i % 32 == 1 && await new Promise(resolve => setTimeout(resolve, 0))

            ctx.history.push(env)
        }
        return ctx.history
    },

    analyze_backtest_result(history) {
        const total_profit = history[history.length - 1].cash_after_action / 10000 - 1
        const holding_days = history.filter(x => x.action == 'sell').map(x => x.holding_days).reduce((a, b) => a + b, 0)
        const max_profit = history.filter(x => x.action == 'sell').map(x => x.profit).reduce((a, b) => Math.max(a, b), 0)
        const min_profit = history.filter(x => x.action == 'sell').map(x => x.profit).reduce((a, b) => Math.min(a, b), 0)
        return `\
=== 回测结果 ===
总日数：${history.length}
总收益：${(total_profit * 100).toFixed(2)}%，年化：${(100 * Math.pow(1 + total_profit, 365 / history.length) - 100).toFixed(2)}%
持仓日数：${holding_days}，占总日数：${(100 * holding_days / history.length).toFixed(2)}%
最大单次持仓收益：${(100 * max_profit).toFixed(2)}%，亏损：${(100 * min_profit).toFixed(2)}%
`
    }
}


class BacktestEnvironment {
    constructor(ctx, day) {
        this.ctx = ctx
        this.day = day

        this.action = null // to be filled by strategy
        this.cash_after_action = null // to be filled after calling strategy
        this.holding_after_action = null // to be filled after calling strategy
    }

    get open() {
        return this.ctx.candles[this.day].open
    }

    get close() {
        return this.ctx.candles[this.day].close
    }

    get high() {
        return this.ctx.candles[this.day].high
    }

    get low() {
        return this.ctx.candles[this.day].low
    }

    get volume() {
        return this.ctx.candles[this.day].volume
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

    get holding_days() {
        if (!this.holding) return 0
        for (let i = -1; i >= -this.day; i--)
            if (this.t(i).action == 'buy')
                return -i
    }

    get holding_price() {
        if (!this.holding) return 0
        return this.t(-this.holding_days).price
    }

    get profit() {
        if (!this.holding) return 0
        return this.holding * this.price / this.t(-this.holding_days).cash - 1
    }

    get profit_annualized() {
        if (!this.holding) return 0
        return Math.pow(1 + this.profit, 365 / this.holding_days) - 1
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
        if (this.day + i < 0) return this.ctx.history[0] ?? this
        return this.ctx.history[this.day + i]
    }

    log(msg) {
        app.log(`${new Date(this.ctx.candles[this.day].timestamp).toLocaleDateString()}：${msg}`)
    }

    MA(n) {
        let sum = 0
        for (let i = 0; i < n; i++) {
            sum += this.t(-i).price
        }
        return sum / n
    }

    EMA(n) {
        if (this.day == 0) return this.price
        const key = `EMA_${n}`
        this[key] ??= this.price * 2 / (n + 1) + this.t(-1).EMA(n) * (n - 1) / (n + 1)
        return this[key]
    }

    DIF(fast=12, slow=26) {
        return this.EMA(fast) - this.EMA(slow)
    }

    DEA(fast=12, slow=26, n=9) {
        if (this.day == 0) return this.DIF(fast, slow)
        const key = `DEA_${fast}_${slow}_${n}`
        this[key] ??= this.DIF(fast, slow) * 2 / (n + 1) + this.t(-1).DEA(fast, slow, n) * (n - 1) / (n + 1)
        return this[key]
    }

    MACD(fast=12, slow=26, n=9) {
        return 2 * (this.DIF(fast, slow) - this.DEA(fast, slow, n))
    }

    RSI(n=14) {
        const gains = []
        const losses = []
        for (let i = 0; i < n; i++) {
            const diff = this.t(-i).price - this.t(-i-1).price
            diff > 0 ? gains.push(diff) :
            diff < 0 ? losses.push(-diff) : null
        }
        if (gains.length == 0) return 0
        if (losses.length == 0) return 100
        const gain = gains.reduce((a, b) => a + b, 0) / gains.length
        const loss = losses.reduce((a, b) => a + b, 0) / losses.length
        return 100 - 100 / (1 + gain / loss)
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

// TODO:
// bootstraping
// random walk data synthesis
// annotate simulation result on chart
