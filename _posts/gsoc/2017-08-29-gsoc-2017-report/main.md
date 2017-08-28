## GSoC 2017: final report

It has been about 4 months since Google and Julia org kindly accepted my first GSoC proposal, and the exciting program
is ending. My project is focused on improving the training process of [Flux.jl](https://github.com/FluxML/Flux.jl), but
since that don't fill 3 months full-time work, I also made some enhancements for [Knet.jl](https://github.com/denizyuret/Knet.jl)
in the last a few weeks.

### About Flux

Flux is a julia ML library under active development. At the time when I start participating this program, Flux compiles
arbitrary julia function wraped by a macro `@net` to a computation graph which can then run on MXNet or TensorFlow
backend. However a few weeks ago, it switched to a custom auto diff implementation and runs on
[CUDANative](https://github.com/JuliaGPU/CUDAnative.jl). The code base changed like a totally different project, but the
idea is the same: you just write the forward pass of your model in plain julia and get the ability to train it on GPUs
for free.

My main contributions are:

- [optimizers](https://github.com/FluxML/Flux.jl/pull/26): Flux default to the basic SGD to train a model, which performs
not very well for some models. I implemented several popular optimizers including AdaGrad, RMSProp, Adam, etc. The code
is orgnized by components, so one can easily compose `decay` or `momentum` with custom components to make a new optimizer.

- [batch training](https://github.com/FluxML/Flux.jl/pull/18): Flux is originaly designed to handle single instance and
batch seamlessly, however the implementation is not complete. I added a `Batched` type to iter over data in batch and
fix several places to make batched input works in both backends.

- [training julia model](https://github.com/FluxML/Flux.jl/pull/44): Flux is aimed to compile and run models in backends,
but it is also useful to test the training process in pure julia. I implemented the `back!` method for primitive layers
so we can train a `Chain` of primitive layers in pure julia.

- [training on TensorFlow backend](https://github.com/FluxML/Flux.jl/pull/51): When I first read Flux, it use the
native training function provided by [TensorFlow.jl](https://github.com/malmaud/TensorFlow.jl). Later, it swiched to a
custom implementation to keep unified with MXNet backend, but unfortunately, the implementation is broken. I fixed and
tested the training on TensorFlow backend

- [callback with `throttle`](https://github.com/FluxML/Flux.jl/pull/52): Previously Flux use a macro to call the callback
function during training. I implemented the `throttle` function from [underscore.js](https://github.com/jashkenas/underscore/blob/master/underscore.js#L835) so things can be less magic.

Most of them are already merged, however, since Flux is switching to a new archtecture, some of these changes are outdated
and some are broken. They need to be rebased when Flux become relatively stable again.

### About Knet

Knet is another ML library which is built from scratch. It contains an AD implementation seperated as
[AutoGrad.jl](https://github.com/denizyuret/AutoGrad.jl), an `KArray` type that runs on GPU, and some neural network
functions. Knet records the computation graph dynamically, so the user can freely run a model contains branches or loops
without unrolling or something like that.

My main contributions are:

- [support Julia v0.6](https://github.com/denizyuret/AutoGrad.jl/pull/24): One of the biggest breaking change of Julia
v0.6 is the changed semantic of "dot operations". A series of dot oprerations will be fused to a single `broadcast` call
by the julia compiler, which is conflict with current AutoGrad implementation. I implemented a little trick to circumvent
the fusing using the dispatch mechanism so it pass the test on Julia v0.6.

- [modular interface](https://github.com/denizyuret/Knet.jl/pull/152): The primary API of Knet is `grad`, which returns
a function that calculates the gradients of the first argument of a function. This means one need to put all trainable
parameters together in a data structure and pass it to the forward function. For models involves many layers, this is
annoying and error prone. I implemented a modular interface like Flux or PyTorch, which keeps and update their parameters
themselves. I also provided some common layers, which can be used as building blocks of more complicated models.

### Conclusion

This summer I learnt and practised a lot of things of Julia and neural networks, with the stipends from Google. I really
thank my mentor [Mike J Innes](https://github.com/MikeInnes) who keep indicating the right direction to go and helping
out when I get stucked.
