const color_map = {
    map: Object.create(null),
    next_color: 16,
    get(key) {
        if (!this.map[key]) {
            this.map[key] = this.next_color
            this.next_color += 40
        }
        return this.map[key]
    }
}

const code_generator = new Blockly.Generator('JavaScript')
const js_order = { // https://github.com/google/blockly/blob/1fe82b23545b9a344d5365f15b01dd7bbea2bcbc/generators/javascript/javascript_generator.js#L29
    ATOMIC: 0,            // 0 "" ...
    NEW: 1.1,             // new
    MEMBER: 1.2,          // . []
    FUNCTION_CALL: 2,     // ()
    INCREMENT: 3,         // ++
    DECREMENT: 3,         // --
    BITWISE_NOT: 4.1,     // ~
    UNARY_PLUS: 4.2,      // +
    UNARY_NEGATION: 4.3,  // -
    LOGICAL_NOT: 4.4,     // !
    TYPEOF: 4.5,          // typeof
    VOID: 4.6,            // void
    DELETE: 4.7,          // delete
    AWAIT: 4.8,           // await
    EXPONENTIATION: 5.0,  // **
    MULTIPLICATION: 5.1,  // *
    DIVISION: 5.2,        // /
    MODULUS: 5.3,         // %
    SUBTRACTION: 6.1,     // -
    ADDITION: 6.2,        // +
    BITWISE_SHIFT: 7,     // << >> >>>
    RELATIONAL: 8,        // < <= > >=
    IN: 8,                // in
    INSTANCEOF: 8,        // instanceof
    EQUALITY: 9,          // == != === !==
    BITWISE_AND: 10,      // &
    BITWISE_XOR: 11,      // ^
    BITWISE_OR: 12,       // |
    LOGICAL_AND: 13,      // &&
    LOGICAL_OR: 14,       // ||
    CONDITIONAL: 15,      // ?:
    ASSIGNMENT: 16,       //: += -= **= *= /= %= <<= >>= ...
    YIELD: 17,            // yield
    COMMA: 18,            // ,
    NONE: 99,             // (...)
}

code_generator.scrub_ = (block, code, opt_thisOnly) => {
    const nextBlock = block.nextConnection && block.nextConnection.targetBlock()
    const nextCode = opt_thisOnly ? '' : code_generator.blockToCode(nextBlock)
    return `${code}${nextCode.trim().length > 0 ? '\n' : ''}${nextCode}`
}

function add_data_block(id, name, category) {
    Blockly.Blocks[id] = {
        category,
        init() {
            this.appendDummyInput()
                .appendField(name)
            this.setOutput(true)
            this.setColour(color_map.get(this.category))
        },
    }
    code_generator.forBlock[id] = () => [id, js_order.ATOMIC]
}

function add_binary_block(id, name, category, op, order, output_type) {
    Blockly.Blocks[id] = {
        category,
        init() {
            this.appendValueInput('left')
            this.appendValueInput('right')
                .appendField(name)
            this.setInputsInline(true)
            this.setOutput(true, output_type)
            this.setColour(color_map.get(this.category))
        }
    }
    code_generator.forBlock[id] = (block, generator) => {
        const left = generator.valueToCode(block, 'left', order)
        const right = generator.valueToCode(block, 'right', order)
        return [`${left} ${op} ${right}`, order]
    }
}

Blockly.Blocks['if'] = {
    category: '逻辑',
    init() {
        this.appendValueInput('if')
            .setCheck('Boolean')
            .appendField('如果')
        this.appendStatementInput('then')
            .appendField('就')
        this.setPreviousStatement(true)
        this.setNextStatement(true)
        this.setColour(color_map.get(this.category))
    }
}
code_generator.forBlock['if'] = (block, generator) => {
    const cond = generator.valueToCode(block, 'if', js_order.NONE)
    const then = generator.statementToCode(block, 'then')
    return `if (${cond}) {\n${then}\n}`
}

Blockly.Blocks['if_else'] = {
    category: '逻辑',
    init() {
        this.appendValueInput('if')
            .setCheck('Boolean')
            .appendField('如果')
        this.appendStatementInput('then')
            .appendField('就')
        this.appendStatementInput('else')
            .appendField('否则')
        this.setPreviousStatement(true)
        this.setNextStatement(true)
        this.setColour(color_map.get(this.category))
    }
}
code_generator.forBlock['if_else'] = (block, generator) => {
    const cond = generator.valueToCode(block, 'if', js_order.NONE)
    const then = generator.statementToCode(block, 'then')
    const else_ = generator.statementToCode(block, 'else')
    return `if (${cond}) {\n${then}\n} else {\n${else_}\n}`
}

Blockly.Blocks['and'] = {
    category: '逻辑',
    init() {
        this.appendValueInput('left')
            .setCheck('Boolean')
        this.appendValueInput('right')
            .setCheck('Boolean')
            .appendField('且')
        this.setInputsInline(true)
        this.setOutput(true, 'Boolean')
        this.setColour(color_map.get(this.category))
    }
}
code_generator.forBlock['and'] = (block, generator) => {
    const left = generator.valueToCode(block, 'left', js_order.LOGICAL_AND)
    const right = generator.valueToCode(block, 'right', js_order.LOGICAL_AND)
    return [`${left} && ${right}`, js_order.LOGICAL_AND]
}

Blockly.Blocks['or'] = {
    category: '逻辑',
    init() {
        this.appendValueInput('left')
            .setCheck('Boolean')
        this.appendValueInput('right')
            .setCheck('Boolean')
            .appendField('或')
        this.setInputsInline(true)
        this.setOutput(true, 'Boolean')
        this.setColour(color_map.get(this.category))
    }
}
code_generator.forBlock['or'] = (block, generator) => {
    const left = generator.valueToCode(block, 'left', js_order.LOGICAL_OR)
    const right = generator.valueToCode(block, 'right', js_order.LOGICAL_OR)
    return [`${left} || ${right}`, js_order.LOGICAL_OR]
}

Blockly.Blocks['not'] = {
    category: '逻辑',
    init() {
        this.appendValueInput('value')
            .setCheck('Boolean')
            .appendField('非')
        this.setInputsInline(true)
        this.setOutput(true, 'Boolean')
        this.setColour(color_map.get(this.category))
    }
}
code_generator.forBlock['not'] = (block, generator) => {
    const value = generator.valueToCode(block, 'value', js_order.LOGICAL_NOT)
    return [`!${value}`, js_order.LOGICAL_NOT]
}

Blockly.Blocks['buy'] = {
    category: '操作',
    init() {
        this.appendDummyInput()
            .appendField('买入')
        this.setPreviousStatement(true)
        this.setNextStatement(true)
        this.setColour(color_map.get(this.category))
    }
}
code_generator.forBlock['buy'] = () => 'buy()'

Blockly.Blocks['sell'] = {
    category: '操作',
    init() {
        this.appendDummyInput()
            .appendField('卖出')
        this.setPreviousStatement(true)
        this.setNextStatement(true)
        this.setColour(color_map.get(this.category))
    }
}
code_generator.forBlock['sell'] = () => 'sell()'

Blockly.Blocks['log'] = {
    category: '操作',
    init() {
        this.appendDummyInput()
            .appendField('打印日志')
            .appendField(new Blockly.FieldTextInput('信息'), 'msg')
        this.setPreviousStatement(true)
        this.setNextStatement(true)
        this.setColour(color_map.get(this.category))
    }
}
code_generator.forBlock['log'] = block => {
    const msg = block.getFieldValue('msg')
    return `log("${msg}")`
}

Blockly.Blocks['log_variable'] = {
    category: '操作',
    init() {
        this.appendValueInput('value')
            .appendField('打印变量')
        this.setPreviousStatement(true)
        this.setNextStatement(true)
        this.setColour(color_map.get(this.category))
    }
}
code_generator.forBlock['log_variable'] = (block, generator) => {
    const value = generator.valueToCode(block, 'value', js_order.NONE)
    return `log(${value})`
}

Blockly.Blocks['constant'] = {
    category: '计算',
    init() {
        this.appendDummyInput()
            .appendField('常数')
            .appendField(new Blockly.FieldNumber(0), 'value')
        this.setOutput(true)
        this.setColour(color_map.get(this.category))
    }
}
code_generator.forBlock['constant'] = block => {
    const value = block.getFieldValue('value')
    return [value, js_order.ATOMIC]
}

add_binary_block('add', '加', '计算', '+', js_order.ADDITION)
add_binary_block('subtract', '减', '计算', '-', js_order.SUBTRACTION)
add_binary_block('multiply', '乘', '计算', '*', js_order.MULTIPLICATION)
add_binary_block('divide', '除', '计算', '/', js_order.DIVISION)
add_binary_block('pow', '乘方', '计算', '**', js_order.EXPONENTIATION)

add_binary_block('gt', '大于', '比较', '>', js_order.RELATIONAL, 'Boolean')
Blockly.Blocks['gt_constant'] = {
    category: '比较',
    init() {
        this.appendValueInput('value')
        this.appendDummyInput()
            .appendField('大于')
            .appendField(new Blockly.FieldNumber(0), 'n')
        this.setOutput(true, 'Boolean')
        this.setColour(color_map.get(this.category))
    }
}
code_generator.forBlock['gt_constant'] = (block, generator) => {
    const value = generator.valueToCode(block, 'value', js_order.RELATIONAL)
    const n = block.getFieldValue('n')
    return [`${value} > ${n}`, js_order.RELATIONAL]
}
add_binary_block('gte', '大于等于', '比较', '>=', js_order.RELATIONAL, 'Boolean')
add_binary_block('lt', '小于', '比较', '<', js_order.RELATIONAL, 'Boolean')
Blockly.Blocks['lt_constant'] = {
    category: '比较',
    init() {
        this.appendValueInput('value')
        this.appendDummyInput()
            .appendField('小于')
            .appendField(new Blockly.FieldNumber(0), 'n')
        this.setOutput(true, 'Boolean')
        this.setColour(color_map.get(this.category))
    }
}
code_generator.forBlock['lt_constant'] = (block, generator) => {
    const value = generator.valueToCode(block, 'value', js_order.RELATIONAL)
    const n = block.getFieldValue('n')
    return [`${value} < ${n}`, js_order.RELATIONAL]
}
add_binary_block('lte', '小于等于', '比较', 'Boolean')

Blockly.Blocks['t'] = {
    category: '数据',
    init() {
        this.appendValueInput('value')
            .appendField(new Blockly.FieldNumber(1), `n`)
            .appendField('天前的')
        this.setOutput(true)
        this.setColour(color_map.get(this.category))
    }
}
code_generator.forBlock['t'] = (block, generator) => {
    const n = block.getFieldValue('n')
    const value = generator.valueToCode(block, 'value', js_order.NONE)
    return [`t(-${n}).${value}`, js_order.MEMBER]
}

Blockly.Blocks['t_variable'] = {
    category: '数据',
    init() {
        this.appendValueInput('n')
        this.appendDummyInput()
            .appendField('天前的')
        this.appendValueInput('value')
        this.setOutput(true)
        this.setColour(color_map.get(this.category))
    }
}
code_generator.forBlock['t_variable'] = (block, generator) => {
    const n = generator.valueToCode(block, 'n', js_order.NONE)
    const value = generator.valueToCode(block, 'value', js_order.NONE)
    return [`t(-${n}).${value}`, js_order.MEMBER]
}

add_data_block('price', '价格', '数据')
add_data_block('volume', '成交量', '数据')
add_data_block('open', '开盘价', '数据')
add_data_block('close', '收盘价', '数据')
add_data_block('high', '最高价', '数据')
add_data_block('low', '最低价', '数据')

add_data_block('profit', '当前持仓收益率(%)', '持仓')
add_data_block('profit_annualized', '当前持仓年化收益率(%)', '持仓')
add_data_block('holding', '当前持仓量', '持仓')
add_data_block('holding_days', '当前持仓天数', '持仓')
add_data_block('cash', '当前现金', '持仓')

function add_technical_indicator_block(name, arity, defaults = []) {
    Blockly.Blocks[name] = {
        category: '指标',
        init() {
            this.appendDummyInput()
                .appendField(name.toUpperCase() + '(')
            for (let i = 0; i < arity; i++) {
                let input = this.appendDummyInput()
                    .appendField(new Blockly.FieldNumber(defaults[i]), `arg${i}`)
                if (i !== arity - 1)
                    input.appendField(',')
            }
            this.appendDummyInput()
                .appendField(')')
            this.setInputsInline(true)
            this.setOutput(true)
            this.setColour(color_map.get(this.category))
        }
    }
    code_generator.forBlock[name] = (block, generator) => {
        const args = []
        for (let i = 0; i < arity; i++) {
            args.push(block.getFieldValue(`arg${i}`))
        }
        return [`${name}(${args.join(', ')})`, js_order.FUNCTION_CALL]
    }
}

add_technical_indicator_block('ma', 1, [5])
add_technical_indicator_block('ema', 1, [5])
add_technical_indicator_block('dif', 2, [12, 26])
add_technical_indicator_block('dea', 2, [12, 26])
add_technical_indicator_block('macd', 3, [12, 26, 9])
add_technical_indicator_block('rsi', 1, [14])

const toolbox = {
    kind: 'categoryToolbox',
    contents: Object.entries(Object.entries(Blockly.Blocks).map(([name, block]) => ({
        kind: 'block',
        type: name,
        category: block.category
    })).reduce((rv, x) => {
        (rv[x.category] = rv[x.category] || []).push(x)
        return rv
    }, Object.create(null))).map(([name, contents]) => ({
        kind: 'category',
        colour: color_map.get(name),
        name, contents
    }))
}

const workspace = Blockly.inject('blocklyDiv', { toolbox })

workspace.addChangeListener(e => {
    if (workspace.isDragging()) return // Don't update while changes are happening.
    document.getElementById("output").textContent = code_generator.workspaceToCode(workspace)
})

document.querySelector('#copy button').addEventListener('click', () => {
    const code = code_generator.workspaceToCode(workspace)
    navigator.clipboard.writeText(code)
})
