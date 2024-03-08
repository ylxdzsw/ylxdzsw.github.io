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
            verbose: true,
            silent: false,
            ...opts
        }
        for (let i = 0; i < ctx.candles.length; i++) {
            const env = new BacktestEnvironment(ctx, i)

            function long(price) {
                const limit = env.balance / price
                const volume = limit - env.holding

                ctx.verbose && env.log(`买入${volume.toFixed(2)}份标的，价格${price.toFixed(2)}`)
                env.cash = 0
                env.holding = limit
            }

            function short(price) {
                const limit = -env.balance / price
                const volume = env.holding - limit

                ctx.verbose && env.log(`卖出${volume.toFixed(2)}份标的，价格${price.toFixed(2)}`)
                env.cash = env.balance - limit * price
                env.holding = limit
            }

            function close(price) {
                const volume = env.holding

                if (ctx.verbose && volume > 0)
                    env.log(`卖出${volume.toFixed(2)}份标的，价格${price.toFixed(2)}`)
                else if (ctx.verbose && volume < 0)
                    env.log(`买入${-volume.toFixed(2)}份标的，价格${price.toFixed(2)}`)

                env.cash = env.balance
                env.holding = 0
            }

            let order_index = 0
            while (order_index < env.orders.length) {
                const order = env.orders[order_index]
                if (order.condition == ">=" && env.high > order.price) {
                    env.orders.splice(order_index, 1)
                    if (order.direction == "long") long(order.price)
                    if (order.direction == "short") short(order.price)
                    if (order.direction == "close") close(order.price)
                    order.callback()
                    order_index = 0
                    continue
                }

                if (order.condition == "<=" && env.low < order.price) {
                    env.orders.splice(order_index, 1)
                    if (order.direction == "long") long(order.price)
                    if (order.direction == "short") short(order.price)
                    if (order.direction == "close") close(order.price)
                    order.callback()
                    order_index = 0
                    continue
                }

                order_index++
            }

            strategy_fun.call(env)

            if (i == ctx.candles.length - 1) { // force selling at the end
                env.clear_orders()
                env.order("close")
            }

            order_index = 0
            while (order_index < env.orders.length) {
                const order = env.orders[order_index]
                if (order.condition == null) { // market order
                    env.orders.splice(order_index, 1)
                    if (order.direction == "long") long(env.price)
                    if (order.direction == "short") short(env.price)
                    if (order.direction == "close") close(env.price)
                    order.callback()
                    order_index = 0
                    continue
                }

                order_index++
            }

            !ctx.silent && i % 16 == 1 && await new Promise(resolve => setTimeout(resolve, 0))

            ctx.history.push(env)
        }
        return ctx.history
    },

    analyze_backtest_result(history) {
        const total_profit = history[history.length - 1].balance / history[0].balance - 1
        const holding_days = history.filter(x => x.holding != 0).length

        let high = history[0].balance
        let drawdown = 0
        for (let i = 1; i < history.length; i++) {
            high = Math.max(high, history[i].balance)
            drawdown = Math.min(drawdown, history[i].balance / high - 1)
        }

        const returns = history.map(x => x.balance / x.t(-1).balance - 1).slice(1)
        const avg_return = returns.reduce((a, b) => a + b, 0) / returns.length
        const std = Math.sqrt(returns.map(x => Math.pow(x - avg_return, 2)).reduce((a, b) => a + b, 0) / returns.length)
        const sharpe = avg_return / std

return `\
=== 回测结果 ===
总日数：${history.length}，总收益：${(total_profit * 100).toFixed(2)}%，年化：${(100 * Math.pow(1 + total_profit, 365 / history.length) - 100).toFixed(2)}%
持仓日数：${holding_days}，占总日数：${(100 * holding_days / history.length).toFixed(2)}%
最大回撤：${(100 * drawdown).toFixed(2)}%，夏普比率：${(100 * sharpe).toFixed(2)}
`
        // const transactions = history.filter(x => x.holding * x.t(-1).holding <= 0 && x.t(-1).holding != 0)

        // const holding_days = transactions.map(x => x.t(-1).holding_days + 1).reduce((a, b) => a + b, 0)
        // const max_profit = transactions.map(x => x.t(-1).profit).reduce((a, b) => Math.max(a, b), 0)
        // const min_profit = transactions.map(x => x.t(-1).profit).reduce((a, b) => Math.min(a, b), 0)
        // const winning_rate = transactions.map(x => x.t(-1).profit > 0 ? 1 : 0).reduce((a, b) => a + b, 0) / transactions.length
        // const avg_profit = transactions.map(x => x.t(-1).profit).reduce((a, b) => a + b, 0) / transactions.length

//         return `\
// === 回测结果 ===
// 总日数：${history.length}，交易笔数：${transactions.length}
// 总收益：${(total_profit * 100).toFixed(2)}%，年化：${(100 * Math.pow(1 + total_profit, 365 / history.length) - 100).toFixed(2)}%
// 持仓日数：${holding_days}，占总日数：${(100 * holding_days / history.length).toFixed(2)}%
// 最大单次持仓收益：${(100 * max_profit).toFixed(2)}%，最大亏损：${(100 * min_profit).toFixed(2)}%
// 胜率：${(100 * winning_rate).toFixed(2)}%，平均每次盈利：${(100 * avg_profit).toFixed(2)}%
// `
    }
}

class BacktestEnvironment {
    constructor(ctx, day) {
        this.ctx = ctx
        this.day = day

        // market orders are executed immedately and reflects on the assets; others are executed during the next day
        this.orders = day == 0 ? [] : [...this.t(-1).orders]

        // assets after action without executing orders
        this.cash = day == 0 ? 10000 : this.t(-1).cash
        this.holding = day == 0 ? 0 : this.t(-1).holding
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

    get balance() {
        return this.cash + this.holding * this.price
    }

    get holding_days() {
        if (this.holding == 0) return 0
        for (let i = 1; i <= this.day; i++)
            if (this.t(-i).holding * this.holding <= 0)
                return i
    }

    get holding_price() {
        if (this.holding == 0) return 0
        return this.t(-this.holding_days).price
    }

    get profit() {
        if (this.holding == 0) return 0
        return this.balance - this.t(-this.holding_days).balance
    }

    get profit_annualized() {
        if (this.holding == 0) return 0
        return Math.pow(1 + this.profit, 365 / this.holding_days) - 1
    }

    order(direction, condition, price, callback) {
        if (callback === undefined) {
            callback = () => this.clear_orders()
        } else if (callback === false) {
            callback = () => {}
        }

        console.log({direction, condition, price, callback})

        this.orders.push({
            direction, // "long", "short"
            condition, // ">=", "<=". null for market order
            price, // null for market order
            callback, // executed upon order filled
        })
    }

    clear_orders() {
        this.orders = []
    }

    buy() {
        if (this.holding == 0) {
            this.clear_orders()
            this.order("long")
        }
    }

    sell() {
        if (this.holding > 0) {
            this.clear_orders()
            this.order("close")
        }
    }

    t(i) {
        if (i > 0) throw new Error("t(i) i must be negative")
        if (i == 0) return this
        if (this.day + i < 0) return this.ctx.history[0] ?? this
        return this.ctx.history[this.day + i]
    }

    log(msg) {
        if (!this.ctx.silent)
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
// random walk data synthesis
// annotate simulation result on chart
