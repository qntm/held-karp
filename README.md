# held-karp

This repo contains both JavaScript and WebAssembly implementations of the [Held–Karp algorithm](https://en.wikipedia.org/wiki/Held%E2%80%93Karp_algorithm) for solving the [travelling salesman problem](https://en.wikipedia.org/wiki/Traveling_salesman_problem).

I needed a HK twice this year for unrelated projects so I thought I might as well share my pure JavaScript implementation. Later on, I decided that this would be a good project to use to learn WebAssembly, hence the near-identical WASM implementation which sits alongside the pure JavaScript implementation.

## API

### getCycle

For `getCycle`, the parameter `d` must be a square array of arrays of numbers, such that `d[u][v]` is the length of the direct edge from city `u` to city `v`. `d[u][u]` will be ignored for all `u`. `d` need not be symmetric. If two cities are not connected at all, set `d[u][v]` to `Infinity`. This can result in cases where no cycle is possible, in which case the returned "solution" will have length `Infinity`.

Returns `{ cycle, l }` where `cycle` is an optimal array of city numbers starting and ending with `0`, and `l` is the length of the cycle.

### getPath

Similar to `getCycle`, but returns `{ path, l }` where `path` is an optimal path through all the cities, *not* necessarily starting or ending with `0`. Again, if no path is possible, `l` will be `Infinity` and `path` should be discarded.

## Examples

```js
import assert from 'node:assert/strict'
import { getCycle, getPath } from './held-karp.js'

// https://stackoverflow.com/a/27195735
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

## Limitations

 `d` must contain at least 1 city. Held–Karp [requires *O*(*n*<sup>2</sup>2<sup>*n*</sup>) time and *O*(*n*2<sup>*n*</sup>) space](https://en.wikipedia.org/wiki/Held%E2%80%93Karp_algorithm#Algorithmic_complexity). On my laptop, I was able to `getPath` for 23 cities (equivalent to `getCycle` on 24 cities) in about 25 seconds using around 4GB of memory. This met my requirements.

I fully acknowledge that JavaScript is the wrong programming language for something like this and other languages would be an order of magnitude more efficient in memory usage and several orders of magnitude better in running time. 
