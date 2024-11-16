# held-karp

A pure JavaScript implementation of the [Held–Karp algorithm](https://en.wikipedia.org/wiki/Held%E2%80%93Karp_algorithm) for solving the [travelling salesman problem](https://en.wikipedia.org/wiki/Traveling_salesman_problem). This package also includes a [WebAssembly implementation](#webassembly-implementation) of the same algorithm.

```sh
npm install held-karp
```

Held–Karp is the best known [*exact* algorithm for TSP](https://en.wikipedia.org/wiki/Travelling_salesman_problem#Exact_algorithms), and requires [*O*(*n*<sup>2</sup>2<sup>*n*</sup>) time and *O*(*n*2<sup>*n*</sup>) space](https://en.wikipedia.org/wiki/Held%E2%80%93Karp_algorithm#Algorithmic_complexity). This means the number of cities which can be handled is principally constrained by memory usage. Given 4GiB of memory:

* The JavaScript implementation computes optimal Hamiltonian cycles for **up to 23 cities** (paths for up to 22 cities), in around 6.5 seconds.
* The WebAssembly implementation computes optimal Hamiltonian cycles for **up to 24 cities** (paths for up to 23 cities), in around 15.5 seconds.

See [Performance](#performance) for discussion of, among other things, what happens when additional memory is granted.

Note that inexact algorithms for TSP exist with much better running time and memory usage characteristics.

## API

### JavaScript implementation

```js
import assert from 'node:assert/strict'
import { getCycle, getPath } from 'held-karp'

// Symmetric case from https://stackoverflow.com/a/27195735
const cities = [
  [0, 29, 20, 21, 16, 31, 100, 12, 4, 31, 18],
  [29, 0, 15, 29, 28, 40, 72, 21, 29, 41, 12],
  [20, 15, 0, 15, 14, 25, 81, 9, 23, 27, 13],
  [21, 29, 15, 0, 4, 12, 92, 12, 25, 13, 25],
  [16, 28, 14, 4, 0, 16, 94, 9, 20, 16, 22],
  [31, 40, 25, 12, 16, 0, 95, 24, 36, 3, 37],
  [100, 72, 81, 92, 94, 95, 0, 90, 101, 99, 84],
  [12, 21, 9, 12, 9, 24, 90, 0, 15, 25, 13],
  [4, 29, 23, 25, 20, 36, 101, 15, 0, 35, 18],
  [31, 41, 27, 13, 16, 3, 99, 25, 35, 0, 38],
  [18, 12, 13, 25, 22, 37, 84, 13, 18, 38, 0],
]
assert.deepEqual(getCycle(cities), { l: 253, cycle: [0, 7, 4, 3, 9, 5, 2, 6, 1, 10, 8, 0] })
assert.deepEqual(getPath(cities), { l: 160, path: [6, 1, 10, 2, 7, 8, 0, 4, 3, 5, 9] })

// two cities disconnected from one another,
// no cycle is possible
const disconnected = [
  [0, Infinity],
  [Infinity, 0]
]
assert.deepEqual(getCycle(disconnected), { l: Infinity, cycle: [0, 1, 0] })
assert.deepEqual(getPath(disconnected), { l: Infinity, path: [0, 1] })

// degenerate case with 1 city
const degenerate = [
  [0]
]
assert.deepEqual(getCycle(degenerate), { l: 0, cycle: [0, 0] })
assert.deepEqual(getPath(degenerate), { l: 0, path: [0] })
```

#### getCycle(d: number[][]): { cycle: number[], l: number }

`d` must be a square array of arrays of numbers, such that `d[u][v]` is the length of the direct edge from city `u` to city `v`. `d[u][u]` will be ignored for all `u`. `d` must contain at least one city and need not be symmetric. If two cities are not connected at all, set `d[u][v]` to `Infinity`. This can result in cases where no cycle is possible, in which case the returned "solution" will have length `Infinity`.

Returns `{ cycle, l }` where `cycle` is an optimal cycle consisting of *n* + 1 city numbers starting and ending with `0` and `l` is the length of the cycle.

#### getPath(d: number[][]): { path: number[], l: number }

Similar to `getCycle`, but returns `{ path, l }` where `path` is an optimal path consisting of *n* city numbers, *not* necessarily starting or ending with `0`, and `l` is the length of the path. Again, if no path is possible, `l` will be `Infinity` and `path` should be discarded.

### WebAssembly implementation

```js
import { getCycle, getPath } from 'held-karp/wasm'

const cities = [
  [0, 50],
  [50, 0]
]
await getCycle(cities)
await getPath(cities)
```

#### async getCycle(d: number[][]): { cycle: number[], l: number }

Same as the JavaScript implementation except that `getCycle` is asynchronous.

#### async getPath(d: number[][]): { path: number[], l: number }

Same as the JavaScript implementation except that `getPath` is asynchronous.

## Performance

For performance tests, run `npm run perf -- 23`, specifying whatever number of cities you wish from 1 to 23, or higher if you're feeling ambitious. *n* random cities will be placed randomly in a unit square, distances between them will be computed, then HK will be carried out to determine a cycle, capturing timings. Both the JavaScript and WebAssembly implementations will be exercised.

The JavaScript implementation has been optimised as best I can for performance, both for speed and memory usage. On my machine, 23 cities can be handled in around 6.5 to 7.0 seconds. With 24 cities, I find that Node.js starts crashing... even if I grant it significantly more memory (the default is 4GiB). I am guessing that this is because Node.js dislikes it when we try to allocate an array with more than ~100,000,000 elements (two of them, actually). But I'm not certain what's actually going on here. Nominally, a JavaScript array can be as many as ~4,000,000,000 entries long.

The WebAssembly implementation's usage of memory is more efficient, which allows us to go to 24 cities, 1 more than the JavaScript implementation. 4GiB of memory is the [maximum that WebAssembly can address](https://developer.mozilla.org/en-US/docs/WebAssembly/JavaScript_interface/Memory/Memory#:~:text=Wasm%20currently%20only%20allows%2032%2Dbit%20addressing).

There are some further performance optimisations available here:

* Distances are stored using 64-bit floats. We could use 32-bit integers instead. This would reduce memory usage by about a third and allow us to go to 25 cities. However, we could no longer have non-integer distances. Also, we could no longer use `Infinity` as a sentinel value for cities which are not connected together at all and for city layouts where a Hamiltonian cycle is not possible.
* City IDs are stored using 32-bit integers. We could use 16-bit integers. Combined with the previous change, this would allow us to go to 26 cities. However, this is relatively difficult because WebAssembly doesn't have native 16-bit integers - we would need to pack two city IDs into each single 32-bit integer, manually, instead.
* Distances and city IDs are stored in two separate areas of a single [`Memory` object](https://developer.mozilla.org/en-US/docs/WebAssembly/JavaScript_interface/Memory). Could we store them in [two separate `Memory` objects](https://developer.mozilla.org/en-US/docs/WebAssembly/Understanding_the_text_format#multiple_memories)? `wat2wasm` does not appear to support this yet.

I was expecting the WebAssembly implementation's performance to be at least an order of magnitude faster than the JavaScript implementation. In practice, however...

```
{
  l: 3.9236567563914644,
  cycle: [
     0,  1, 16, 10, 4, 18, 17, 11,
    21,  6,  9, 12, 7, 15, 14, 13,
     2, 22, 19,  3, 8, 20,  5,  0
  ]
}
HK/JS: 6.740s

{
  l: 3.9236567563914644,
  cycle: [
     0,  1, 16, 10, 4, 18, 17, 11,
    21,  6,  9, 12, 7, 15, 14, 13,
     2, 22, 19,  3, 8, 20,  5,  0
  ]
}
HK/WASM: 7.010s
```

...the two implementations appear to be comparable and the WebAssembly is actually a fraction slower. This was very surprising to me. What explanation could there be for this?

* My WebAssembly is poorly optimised?
* WebAssembly is generally not as efficient as I thought?
* Node.js/V8/TurboFan is much more efficient for pure computation tasks than I thought?
