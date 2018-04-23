## Solidity 踩坑笔记

第一次听说以太坊的时候，我还是觉得很不屑的。比特币一开始就伴随着脚本出现，并且靠它实现了多签名等花式玩法，更是后面隔离见证和闪电网络的基石，可以说是非常有预见性的一个设计。而以太坊不过是给它加了一些指令，再撸了一大堆轮子称为所谓的生态，很有强行吹逼抬价格的态势。

不过不管有多少坑，有多少人骂，有多少竞争对手各方面都比他好，以太坊总算是活了下来，并且稳居第二大币之位，近期应该是很难倒了。作为一个幸存者，总是有值得学习的地方，而且也为了将来跟人吹逼方便，我决定试试用Solidity写个智能合约，体验一下传说中的Dapp。

### 制定目标：2048

网上搜了一圈，现在的智能合约应用其实极其同质化，抄来抄去抄的最多的基本可以分成三类：

- 代币类，各种ICO改来改去都跟官网那个Demo区别不大，无非就是锁仓烧币啥的。
- 猫类，或者各种宠物/卡牌/家园游戏，总之就是庞氏骗局，炒到一定程度就不会有人买了。何况这猫一点也不萌。
- 对赌类，乐透啦，赌区块链数据啦什么的。

当然，还有从官网例子改的各种会议、投票、拍卖什么的。我也打算做一个游戏，当然不是那种抽奖拍卖类，而是游戏王或者Advance Wars By Web那样的。基本思路就是发布一个智能合约实例来开始一场游戏，其他人可以加入到其中，每一步都将自己的操作提交到智能合约上，通过搜集一些熵让矿工来处理随机事件以及游戏逻辑。这样和传统的通过对战平台玩相比有几个好处，首先它们对延迟并不是太敏感，以太坊一笔交易通常要数十秒来处理，对这几个游戏体验影响不算太大。其次每次对战都由矿工认证，可以用于很严肃的比赛，不用担心有人作弊，回访还会永久保存。再次还可以来赌博，毕竟像乐透那种，既然都是密码学支撑的随机了，明知期望严格小于0的情况下还去赌的人就不那么多了。而通过游戏来的话，每个人都会觉得自己更胜一筹，觉得下盘能赢的心理就会更强一些。

这样的机制有一个小问题，就是区块链是透明的。以游戏王为例的话，如果由矿工来抽卡，对方可以直接从区块链上看到你的牌组啊手牌啊什么的。不过这个问题可以解决，就是开局双方都生成一个随机种子，并且把哈希提交上去。之后使用固定的随机算法，通过自己的种子和每一步矿工发布的随机数来进行随机。在结束的时候双方再发布自己的随机种子，矿工重演一下所有的随机数确认没有人作弊。这样每个人没办法预知自己的下一张牌，因为需要用到矿工发布的随机数；不知道对方的情况，因为要到游戏结束对方才会提交卡组啊、随机种子什么的。而自己又不能随意改变这些，否则在游戏结束的时候通不过验证。

然而思考了半天，最后查了一下gas的价格，顿时觉得前面全都白想了。一笔交易稍微复杂一点就要将近10刀，一盘AWBW打下来估计上千美元了，这种手续费下要赌只能是100ETH以上的大手笔还差不多，受众面也太小了。思考来思考去，觉得这样的对战游戏似乎根本没法有效地实现，只好退而求其次，做个单机游戏。单机游戏肯定要随机数扮演重要角色，不然就没什么可玩的了。理想状态下，应该要让胜负基本由随机数决定，但是又让玩家感觉自己的技巧在发挥作用。

最后选择了2048。它的策略非常简单，有经验的玩家基本可以把把达成1024，但是又很难上4096或者更高。只需要开局的时候支付赌注，然后矿工会发一个随机数过来，然后玩家就自己high，玩完了之后将replay交给矿工验证，因为使用同一个随机数种子和随机算法，矿工可以再现整个局并且计算得分，然后通过得分来发放奖励。这样一共只要两个交易，而且第一个交易基本没有什么计算，总的成本大概一局15美元左右，还是勉强可以接受的。

这样只有一个问题，就是玩家可以悔棋：因为只是开局的时候拿到随机种子，之后就自己玩，所以总是可以预知之后的随机数，从另一个角度说就是可以无限悔棋，甚至自己写软件来暴力搜索。不太清楚如果每把都使用最优策略平均能拿到多少分，不过考虑到智能合约里的钱就那么多，要是有玩家逆天的话也只是提交失败而已，我反正怎么都不可能亏钱¯\\\_(ツ)\_/¯。

### 以太全家桶

以太坊一个让我很不喜欢的地方就是轮子多，概念多，花了好长时间才勉强捋顺这一堆东西：

- Gas：其实就是手续费，每笔交易需要支付 `gas limit * gas price` 的费用。为什么不直接设定手续费，而是要设定两个数呢，并不知道。我能想到的唯一好处就是`gas limit`可以单独估计，不受行情影响。不过总之并不需要先去购买一个叫Gas的东西，这也是我刚开始困扰了很久的东西。其实大可把Gas当成一个虚概念，它只是计算时用的，实际交易还是以ETH支付手续费。值得注意的是如果Gas不够导致交易失败了，交易会回卷，就像从来没有发出过一样，但是手续费是拿不回来的。这点和BTC不一样，BTC手续费不够就一直挂着等到有好心矿工来为止。
- EVM：高大上的以太虚拟机，或者也可以看作智能合约的解释器。除了知道它性能很差以外，没有什么需要注意的。
- Solidity：一个轮子语言，用来编译成智能合约的。网上都说像Javascript，我倒觉得更像C。最大的特点是坑多，反直觉。好在有个Linter还算给力，还有Remix也省了不少事。
- Remix：一个在线IDE，可以编译Solidity并且发送到以太网络上去。还有个debugger，虽然体验一般，但是功能还是有的。编译那里也可以把ABI复制下来，所以有了这个东西基本上什么都不用装了。
- web3：一个API库，用来调用与以太网络相关的操作，比如发起交易啊，在链上搜索什么的。它使用自有协议和以太坊节点通信。
- Metamask：一个浏览器插件，可以注入web3到每个网页上。基本可以看作一个以太坊钱包并且自带一个web3库。

### 合约设计

Solidity里一个contract可以看成一个类，由一些成员变量(称为state variable)和方法组成。一个合约可以创建多次，每次都会形成不同的合约实例，有着各自的地址，互不相干。

对我的2048来说，显然不需要太复杂的分解，使用究极设计模式[God Object](https://en.wikipedia.org/wiki/God_object)模式就足够了。

首先要选择的是一个大实例还是每次游戏都创建一个新实例。一个大实例是说我一次性创建一个合约实例，之后每个人游戏都调用其中的一个方法来开始一次新游戏，在这个合约里使用一个mapping来保存正在进行的游戏的情况。每次都创建新实例是说把智能合约的代码或者编译好的程序放在里面，玩家自己上传创建一个实例然后玩。但是后者有一个问题，就是我没办法及时打钱进去：玩家肯定是冲着赚我的钱来的，但是他们自己创建的合约里面并没有我的钱。想了一会儿没找到什么好办法，就选择了使用一个大实例的方案。

那么总的合约看起来是这样的：

```
pragma solidity ^0.4.21;

contract D2048 {
    mapping(bytes32 => uint16) public scores;

    event Game(address player, uint time, uint32 seed);
    event Score(address player, uint time, uint16 score);

    function start_game() payable public {
        ...
        emit Game(...)
    }

    function submit(uint time, uint16 score, bytes solution) public {
        ...
        emit Score(...)
    }

    function refund(uint amount) public returns (string) {...}
```

玩家调用`start_game()`来开启一场新游戏并且支付赌注，矿工根据打包时间和玩家地址生成一个随机种子并且广播出去。注意使用时间作为随机种子意味着矿工可以进行调整以便生成想要的种子，因此Solidity官方也不建议这么做。不过显然不会有矿工大费周章去攻击我这种垃圾游戏。

之后玩家使用得到的随机种子进行游戏，并且记录整个游戏步骤。游戏结束后将步骤上传到`submit()`方法，矿工再重演整个游戏过程，如果没有出现错误的话再将和游戏得分相关的奖励发放回玩家。如果出现错误，比如玩家自行修改了客户端程序造成了不同步的游戏，就自动回卷整个交易，玩家要么只能自己拿着种子再玩一遍正常的游戏，反正不通过的方案肯定是提交不上的。

最后是我的提币后门`refund()`。设计上必然是我要盈利的，那么我得留一个函数让我把钱提出来。这个函数只要检查发起人是不是我就行了，如果是就转账。

### 随机数

遇到的第一个blocker是随机数。2048需要两个随机，首先是开局的时候要产生一个随机种子，其次在游戏过程中，每一步要随机选择一个地方来产生新的小块。Solidity不自带随机数方案，看了一下网上的其它随机应用，大概分成两种，一种是从用户操作中收集熵，这种比较适合每个时间段都一定有不止一个用户的应用，比如乐透；另一种就是从区块上采集熵，包括区块哈希、编号、时间什么的。不过这种方法意味着矿工可以一定程度上操纵随机数，官方文档也提到了这一点。不过显然对于我的2048来说，这并不在考虑之内。所以我的最终方案是使用玩家地址和区块时间二者hash作为每局游戏的随机种子，再使用[Xorshift](https://en.wikipedia.org/wiki/Xorshift)算法来从种子生成随机序列。选择它的原因主要是快，毕竟在EVM上时间就是金钱啊。反正不管多么随机，玩家都是一开始就得到随机种子就确定了整个随机序列，防也防不住，所以只要玩起来稍微有点随机性就够了。

随机数这块大致代码是这样的：

```
struct Random {
    uint32 state;
    uint8 i;
}

function get_rand(Random rand, uint8 n) pure internal returns (uint16) {
    while (true) {
        if (rand.i >= 8) {
            rand.state = xorshift32(rand.state);
            rand.i = 0;
        }

        uint8 r = uint8(rand.state >> (rand.i << 4)) & 0x0f;
        rand.i += 1;
        
        if (r < n) {
            return r;
        }
    }
}

function xorshift32(uint32 state) pure internal returns (uint32 x) {
    x = state;
    x ^= x << 13;
    x ^= x >> 17;
    x ^= x << 5;
}

function start_game() payable public {
    bytes32 seed = keccak256(now, msg.sender);
    ...
    emit Game(msg.sender, now, uint32(seed));
}

function submit(uint time, uint16 score, bytes solution) public {
    bytes32 seed = keccak256(time, msg.sender);
    ...
    validate_solution(uint32(seed), score, solution);
    ...
    emit Score(msg.sender, time, score);
}

function validate_solution(uint32 seed, uint16 score, bytes solution) pure internal {
    Random memory rand = Random(seed, 0);
    ...
}
```

#### 坑之变量存储位置

上面代码执行`validate_solution`的时候，使用随机种子初始化一个Random变量，包含了随机数的状态。因为计算价格昂贵，我把xorshift每次产生的32位随机数都拆成了8个4位来用，所以得使用一个结构体来存储。每次调用`get_rand`的时候，要么改变i表示当前用到了哪一位，要么在用完了之后执行xorshift产生下一组。这在几乎所有语言里，都是天经地义的，但是Solidity偏偏有个蛋疼的变量存储位置的概念。

官网文档如下：

> The Ethereum Virtual Machine has three areas where it can store items.
> 
> The first is “storage”, where all the contract state variables reside. Every contract has its own storage and it is persistent between function calls and quite expensive to use.
> 
> The second is “memory”, this is used to hold temporary values. It is erased between (external) function calls and is cheaper to use.
> 
> The third one is the stack, which is used to hold small local variables. It is almost free to use, but can only hold a limited amount of values.
> 
> For almost all types, you cannot specify where they should be stored, because they are copied everytime they are used.
> 
> The types where the so-called storage location is important are structs and arrays. If you e.g. pass such variables in function calls, their data is not copied if it can stay in memory or stay in storage. This means that you can modify their content in the called function and these modifications will still be visible in the caller.
> 
> There are defaults for the storage location depending on which type of variable it concerns:
> 
> state variables are always in storage
> function arguments are in memory by default
> local variables of struct, array or mapping type reference storage by default
> local variables of value type (i.e. neither array, nor struct nor mapping) are stored in the stack
> 
> Functions can be declared view in which case they promise not to modify the state.

读了3遍，我只想说mmp，越看越不明白好不好。比如第三行那个"(external)"加个括号是什么意思，是只有external的函数调用会擦掉还是普通函数调用和external函数调用都会擦掉？我的代码里需要反复调用`get_rand`来更新随机数发生器的状态，这应该算不external的函数调用，那到底会不会擦掉呢？上StackOverflow又是查又是问，基本上所有人都是引用这篇根本读不懂的文档，浪费了我将近一个小时。最后还是通过Remix得到了解决。

不得不说Remix确实是个好东西。使用Javascript VM选项可以在浏览器里直接执行智能合约，既不需要手续费又没有延迟。我把相关东西都试了一遍，终于勉强搞清楚了变量存储位置这一蛋疼机制：

- 首先使用`Random r`定义出的变量与其说是结构体不如说是结构体指针。使用`Random storage r`和`Random memory r`可以定义两种不同的指针指向不同的位置，有点写GPU代码的感觉。默认的类型是`storage`，默认值是`0`，也就是单独执行`Random r`，得到的是指向storage开头的一个指针。
- `state variable`和`storage`可以说是相互对应的关系。首先`state variable`全都是存在`storage`里的，这点很明确。不那么明确的是，其实根本没办法在函数里创建`storage`上的东西，函数里只能创建`storage`指针，而这些指针有意义的用法就是用来指向`state variables`。只能通过给变长的`state variables`(比如变长数组、mapping)添加元素的方式来把变量复制到`storage`上去，而又不搞乱原有的`state variables`。
- 文档里说的`function call`感觉是指transaction，而不是`get_rand()`这种函数调用。在一个函数里调用其它的函数，`memory variable`并不会被擦除，里面的修改也是可见的。

其实讲道理搞清楚结构体和数组变量都是指针之后，还是挺好理解的。把`storage`,`memory`和`stack`分别想象成文件、堆和栈就好了，函数调用就跟C的一样，而transaction就像是一个新的进程。`pure`是说这个函数不会进行IO(读写state variable，包括storage指针，因为他们都必然指向state variable)。只是这个文档写得莫名其妙，EVM的设计还是很符合直觉的。

#### 坑之变量类型转换

另一个蛋疼的地方是变量类型，尤其是bytes和各种数值型之间的转换。网上有一堆内联汇编的，不过后来发现Solidity里面可以使用`type()`来直接进行类型转换，如果位数变少了，就只保留低位，如果多了，就在高位补0。不仅数值变量之间可以这么做，数组也没问题。这个是非常magic-free的操作，可以看成像C里面指针的类型转换一样，变量本身的内存比特是保证不变的。了解这一点之后类型转换就很predictable了。

### 游戏逻辑

在玩家提交方案的时候，智能合约要重演整个游戏过程，所以游戏的代码也得完整复制到智能合约上来。好在2048并不复杂，上下左右四种操作，代码也是对称的。也许有方法可以重用，不过并不想蛋疼，还是Ctrl+C四次来得快。这样一来虽然搞出一个一百多行的超级函数，不过从逻辑上看还是很清晰的。可惜人算不如天算，又遇到一个神坑："Compiler error: Stack too deep, try removing local variables."

#### 坑之栈大小

乍一看"Stack too deep"，我还以为是overflow了，赶紧检查有没有递归。然而看了半天，别说递归了，连函数调用都没有，tm就一个简单暴力的线性函数，这怎么爆栈？

上网查了一下，原来Solidity还有栈变量大小限制，一般不超过16个，这个报错指的其实是这个东西。想想也是，这是"Compiler error"，栈溢出怎么也得运行时才会发生。但是对于这个开发组的表达能力我真是无力吐槽，什么叫"deep"，这种语文水平考行测估计得考到30岁吧。

解决方法倒也简单，就是拆分，只要哪一块没有用到全部的局部变量就拆出来作为一个新的函数。理解了memory变量的参数传递语义之后，拆分函数还是挺简单的。

### 客户端

智能合约写好之后，不可能让用户拿命令行玩，前端还是要有的。fork了一下[这个已经被fork 15000+次的传奇项目](https://github.com/gabrielecirulli/2048)，但是看了一下并不是很好改。代码倒是非常模块化，但是过于模块化了——一个简单的功能也分得到处都是，无从改起。结果最后基本删了个干净，相当于照着它的设计重写了。不过好在毕竟简单，也没花太长时间。

MetaMask也是个坑，光是找怎么传bytes类型的数据就查了半天。资料实在太少，设计也乱七八糟无法理解，只能是试着来。幸亏调试起来还算方便，使用ropsten的测试网络，一笔交易差不多也就是十来秒，有什么不明白的就拿免费的测试ETH试一下。最后摇摇摆摆地总算是跑起来了，虽然极有可能随便遇到点小情况就要崩。。

试玩的时候发现我的算法和原版2048有些出入，不过随意啦，反正这游戏又没有ISO标准。总的来说效果还行吧，也算是体验了一把传说中的Dapp，以后可以自称智能合约开发者了，妈妈再也不用担心我忽悠不到钱了。

试玩地址：[https://blog.ylxdzsw.com/D2048/](https://blog.ylxdzsw.com/D2048/)
