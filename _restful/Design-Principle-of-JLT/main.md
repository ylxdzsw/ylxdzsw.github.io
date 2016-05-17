## JLT设计小记

在给[Restful.jl](https://github.com/ylxdzsw/Restful.jl)加上静态文件服务的过程中我突然意识到Julia似乎缺少一个给力的模板引擎。
虽然Restful.jl设计是用来支持WebApp的，但是服务器模板渲染对于一些偏展示的页面来说还是非常方便的。
在[METADATA](https://github.com/JuliaLang/METADATA.jl)上搜了一番，只发现个[Hiccup.jl](https://github.com/JunoLab/Hiccup.jl)，有点像以前用过的[CoffeeKup](https://github.com/mauricemach/coffeekup)，
是一堆函数，利用语言本身的嵌套调用结构来表达HTML，但是我个人很不喜欢这种方式，受限于语言本身的语法，DSL定义没法像[Jade](https://github.com/jadejs/jade)那么自由，又由于抛弃了HTML本身的语法，
不但不能复制粘贴原有代码，还平添学习成本。所以几番思考之后，决定自己造一个轮子。

### 最初的想法

首先想的是
