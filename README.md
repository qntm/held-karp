# held-karp

A pure JavaScript implementation of the [Held–Karp algorithm](https://en.wikipedia.org/wiki/Held%E2%80%93Karp_algorithm) for solving the [travelling salesman problem](https://en.wikipedia.org/wiki/Traveling_salesman_problem). This package also includes a [WebAssembly implementation](#webassembly-implementation) of the same algorithm.

```sh
npm install held-karp
```

Held–Karp is the best known [*exact* algorithm for TSP](https://en.wikipedia.org/wiki/Travelling_salesman_problem#Exact_algorithms), and requires [*O*(*n*<sup>2</sup>2<sup>*n*</sup>) time and *O*(*n*2<sup>*n*</sup>) space](https://en.wikipedia.org/wiki/Held%E2%80%93Karp_algorithm#Algorithmic_complexity). Execution time and memory usage are therefore significant considerations as *n* grows.

* The JavaScript implementation computes optimal Hamiltonian cycles for **up to 28 cities** (paths for up to 27 cities). This consumes approximately 31 GiB of memory and takes ~5 minutes.
* The WebAssembly implementation computes optimal Hamiltonian cycles for **up to 24 cities** (paths for up to 23 cities). This consumes approximately 4 GiB of memory and takes ~15.5 seconds.

See [Performance](#performance) for further discussion of these limits.

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

For performance tests, run _e.g._ `npm run perf -- 24`, specifying whatever number of cities you wish. *n* cities will be placed randomly in a unit square, distances between them will be computed, then HK will be carried out to determine a cycle, capturing timings. Both the JavaScript and WebAssembly implementations will be exercised.

Internally, Held–Karp works by computing a large table of intermediate results, then reading an optimal cycle out of the table. The principal limitation for our purposes is the size of the array we can allocate to store these results, which must have 2<sup>*n* - 1</sup>(*n* - 1) entries.

The JavaScript implementation is highly optimised. It uses a `Float64Array` to store intermediate path lengths and a `Uint8Array` to store intermediate city IDs. The maximum number of elements of a [typed array](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Typed_arrays) in JavaScript is 2<sup>32</sup> - 1 = 4,294,967,296, which means we're **capped at *n* = 28** (3,623,878,656 elements). At 8 bytes per element in the `Float64Array` and 1 byte per element in the `Uint8Array`, the two arrays consume 30.4GiB of memory, plus change. Running time obviously varies depending on how much memory Node.js has available, but seems to be in the 4.5–7 minute range in this case. For *n* = 24, running time is more like 15 seconds.

WebAssembly has `f64`s but no `i8`s; the smallest numerical type it has is an `i32`. That means we're looking at 8 bytes per intermediate path length and 4 bytes per intermediate city ID. WebAssembly is also [capped at 4GiB](https://developer.mozilla.org/en-US/docs/WebAssembly/JavaScript_interface/Memory/Memory#:~:text=Wasm%20currently%20only%20allows%2032%2Dbit%20addressing), which in turn **caps us at *n* = 24** (192,937,984 elements per array, 2.2GiB of memory across the two arrays). The WebAssembly has been *somewhat* hand-optimised, but...

```
n = 24

{
  l: 3.5102663956036024,
  cycle: [
     0, 17, 11, 2,  6,  3, 12, 21,
    19,  8, 13, 5, 18, 14,  1, 20,
    23,  7,  9, 4, 22, 16, 15, 10,
     0
  ]
}
HK/JS: 15.071s

{
  l: 3.5102663956036024,
  cycle: [
     0, 17, 11, 2,  6,  3, 12, 21,
    19,  8, 13, 5, 18, 14,  1, 20,
    23,  7,  9, 4, 22, 16, 15, 10,
     0
  ]
}
HK/WASM: 33.295s
```

...it looks like it still falls quite a long way short of the JavaScript optimisations built into [Node.js](https://nodejs.org)/[V8](https://v8.dev/2)/[TurboFan](https://v8.dev/docs/turbofan). To be continued!</p>
