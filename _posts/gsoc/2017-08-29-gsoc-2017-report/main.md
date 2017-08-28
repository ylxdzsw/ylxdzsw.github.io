## GSOC 2017: final report

It has been about 4 months since Google and Julia org kindly accepted my first GSOC proposal, and the exciting program
is ending. My project is focused on improving the training process of [Flux.jl](https://github.com/FluxML/Flux.jl), but
since that don't fill 3 months full-time work, I also made some enhancement for [Knet.jl](https://github.com/denizyuret/Knet.jl)
in the last a few weeks.

### About Flux

Flux is a julia ML library under active development. At the time when I start participating this program, Flux compiles
arbitrary julia function wraped by a macro `@net` to a computation graph which can then run on MXNet or TensorFlow
backend. However a few weeks ago, it switched to a custom auto diff implementation and runs on CUDANative. The code base
changed like a totally different project, but the idea is the same: you just write the forward pass of your model in plain
julia and get the ability to train it on GPUs for free.

My primary contributions are:

- [batch training](https://github.com/FluxML/Flux.jl/pull/18) Flux is originaly designed to run single instance or
batch seamlessly, however the implementation is not complete. I added a `Batched` type to iter over data in batch and
fix several places to make batched input works in both backends.

- [training julia model](https://github.com/FluxML/Flux.jl/pull/44) Flux is aimed to compile and run models in backends,
but it is also useful to test the training process in pure julia. I implemented the `back!` method for primitive layers
so we can train a `Chain` of primitive layers in pure julia.
