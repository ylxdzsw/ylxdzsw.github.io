## 像一门语言一样使用julia的参数化类型

### 参数化类型

参数化类型是julia类型系统的一个重要部分，最基本的类型像数组`Array{T,N}`就用到了类型参数，其中T表示元素的类型，而N为数组的维度。
例如`Array{Int, 1}`表示一维的整数数组，`Array{Rational, 2}`表示一个有理数矩阵。

julia的参数化类型和一般的泛型相比，其强大之处在于

1. 类型参数不一定是其它类型，还可以是整数、浮点数、符号(Symbol类型)甚至用户自定义的immutable类型。
2. 参数包含参数化类型的函数，可以通过模式匹配获得参数化类型的类型参数，例如函数`dims{N}(::Array{Int,N})=N`返回整数数组的维度。

### 与Erlang比较

Erlang是一门经典的函数式语言，它通过模式匹配+递归来组织程序流程，这恰好和julia的类型分派相似，这使得我们可以将一些Erlang程序"直译"成使用参数化类型的julia代码。

要"直译"Erlang代码，我们首先定义几个"基本类型"和"基本操作"，这些在这整篇博文中都会用到

```julia
immutable Atom{X} end
immutable List{H, T} end

Atom(x) = Atom{x}

List() = List{}
List(x) = List{x, List{}}
List(x, t...) = List{x, List(t...)}

+{a, b}(::Type{Atom{a}}, ::Type{Atom{b}}) = Atom{a+b}
-{a, b}(::Type{Atom{a}}, ::Type{Atom{b}}) = Atom{a-b}
*{a, b}(::Type{Atom{a}}, ::Type{Atom{b}}) = Atom{a*b}
/{a, b}(::Type{Atom{a}}, ::Type{Atom{b}}) = Atom{a/b}
```

其中`atom`和`list`的概念都是来自于Erlang([链接](http://erlang.org/doc/getting_started/seq_prog.html))，其中List()对应Erlang的list，而List{}对应Erlang的tuple

通过这两个类型，我们使用下面的规则来"直译"Erlang代码

- 函数形参中，`X` -> `Type{Atom{X}}`，`[]` -> `Type{List{}}`，`[H|T]` -> `Type{List{H, T}}`
- 函数调用时，`X` -> `Atom(X)`，`[]` -> `List()`，`[a, b, ...]` -> `List(a, b, ...)`，`{x, y}` -> `List{x, y}`

下面是来自[http://erlang.org/doc/getting_started/seq_prog.html]()的几个例子

### 阶乘

- Erlang

```erlang
fac(1) ->
    1;
fac(N) ->
    N * fac(N - 1).
```

```erlang
6> fac(4).
24
```

- julia参数化类型

```julia
fac(::Type{Atom{1}}) = Atom(1)
fac{N}(::Type{Atom{N}}) = Atom(N) * fac(Atom(N-1))
```

```julia
julia> fac(Atom(4))
Atom{24}
```

### 求列表长度

- Erlang

```erlang
list_length([]) ->
    0;    
list_length([First | Rest]) ->
    1 + list_length(Rest).
```

```erlang
29> list_length([1,2,3,4,5,6,7]).
7
```

- julia参数化类型

```julia
list_length(::Type{List{}}) = Atom(0)
list_length{First, Rest}(::Type{List{First, Rest}}) = Atom(1) + list_length(Rest)
```

```julia
julia> list_length(List(1,2,3,4,5,6,7))
Atom{7}
```

### 稍微复杂一点的例子

- Erlang

```erlang
format_temps([])->                        % No output for an empty list
    ok;
format_temps([City | Rest]) ->
    print_temp(convert_to_celsius(City)),
    format_temps(Rest).

convert_to_celsius({Name, {c, Temp}}) ->  % No conversion needed
    {Name, {c, Temp}};
convert_to_celsius({Name, {f, Temp}}) ->  % Do the conversion
    {Name, {c, (Temp - 32) * 5 / 9}}.

print_temp({Name, {c, Temp}}) ->
    io:format("~-15w ~w c~n", [Name, Temp]).
```

```erlang
36> format_temps([{moscow, {c, -10}}, {cape_town, {f, 70}},
{stockholm, {c, -4}}, {paris, {f, 28}}, {london, {f, 36}}]).
moscow          -10 c
cape_town       21.11111111111111 c
stockholm       -4 c
paris           -2.2222222222222223 c
london          2.2222222222222223 c
ok
```

- julia参数化类型

```julia
format_temps(::Type{List{}}) = Atom(:ok)
format_temps{City, Rest}(::Type{List{City, Rest}}) = begin
    print_temp(convert_to_celsius(City))
    format_temps(Rest)
end

convert_to_celsius{Name, Temp}(::Type{List{Name, List{Atom{:c}, Temp}}}) = begin
    List{Name, List{Atom(:c), Temp}}
end
convert_to_celsius{Name, Temp}(::Type{List{Name, List{Atom{:f}, Temp}}}) = begin
    List{Name, List{Atom(:c), (Temp - Atom(32)) * Atom(5) / Atom(9)}}
end

print_temp{Name, Temp}(::Type{List{Atom{Name}, List{Atom{:c}, Atom{Temp}}}}) = begin
    @printf("%-15s %f c\n", Name, Temp)
end
```

```julia
julia> format_temps(List(List{Atom(:moscow), List{Atom(:c), Atom(-10)}},
                         List{Atom(:cape_town), List{Atom(:f), Atom(70)}},
                         List{Atom(:stockholm), List{Atom(:c), Atom(-4)}},
                         List{Atom(:paris), List{Atom(:f), Atom(28)}},
                         List{Atom(:london), List{Atom(:f), Atom(36)}}))
moscow          -10.000000 c
cape_town       21.111111 c
stockholm       -4.000000 c
paris           -2.222222 c
london          2.222222 c
Atom{:ok}
```

可以看到由于语法的问题，julia的代码视觉干扰比较严重(通过宏可以解决)，但是功能上已经可以完成很多工作了，绝不只是能用来声明一个集合的元素类型。
