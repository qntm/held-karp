# held-karp

A pure JavaScript implementation of the [Held–Karp algorithm](https://en.wikipedia.org/wiki/Held%E2%80%93Karp_algorithm) for solving the [travelling salesman problem](https://en.wikipedia.org/wiki/Traveling_salesman_problem).

I needed HK twice this year for unrelated projects, so I thought I might as well make a proper consumable package out of my pure JavaScript implementation.

Held–Karp [requires *O*(*n*<sup>2</sup>2<sup>*n*</sup>) time and *O*(*n*2<sup>*n*</sup>) space](https://en.wikipedia.org/wiki/Held%E2%80%93Karp_algorithm#Algorithmic_complexity). This implementation computes cycles for up to 23 cities (paths for up to 22 cities) in around 7 seconds; beyond this point odd things start happening. See below for more performance characteristics of this implementation.

## API

### getCycle(d: number[][]): { cycle: number[], l: number }

The parameter `d` must be a square array of arrays of numbers, such that `d[u][v]` is the length of the direct edge from city `u` to city `v`. `d[u][u]` will be ignored for all `u`. `d` must contain at least one city and need not be symmetric. If two cities are not connected at all, set `d[u][v]` to `Infinity`. This can result in cases where no cycle is possible, in which case the returned "solution" will have length `Infinity`.

Returns `{ cycle, l }` where `cycle` is an optimal cycle consisting of *n* + 1 city numbers starting and ending with `0` and `l` is the length of the cycle.

### getPath(d: number[][]): { path: number[], l: number }

Similar to `getCycle`, but returns `{ path, l }` where `path` is an optimal path consisting of *n* city numbers, *not* necessarily starting or ending with `0`, and `l` is the length of the path. Again, if no path is possible, `l` will be `Infinity` and `path` should be discarded.

## Examples

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
assert.deepEqual(await getCycle(cities), { l: 253, cycle: [0, 7, 4, 3, 9, 5, 2, 6, 1, 10, 8, 0] })
assert.deepEqual(await getPath(cities), { l: 160, path: [6, 1, 10, 2, 7, 8, 0, 4, 3, 5, 9] })

// two cities disconnected from one another,
// no cycle is possible
const disconnected = [
  [0, Infinity],
  [Infinity, 0]
]
assert.deepEqual(await getCycle(disconnected), { l: Infinity, cycle: [0, 1, 0] })
assert.deepEqual(await getPath(disconnected), { l: Infinity, path: [0, 1] })

// degenerate case with 1 city
const degenerate = [
  [0]
]
assert.deepEqual(await getCycle(degenerate), { l: 0, cycle: [0, 0] })
assert.deepEqual(await getPath(degenerate), { l: 0, path: [0] })
```

## Performance

This implementation is suitable for computing TSP on up to 23 cities.



This implementation has been optimised somewhat. On my machine, it can compute 

The WebAssembly implementation has a hard cap at 24 cities, as this is the most that can be handled using [a single 4GiB chunk of memory](https://developer.mozilla.org/en-US/docs/WebAssembly/JavaScript_interface/Memory/Memory#:~:text=Wasm%20currently%20only%20allows%2032%2Dbit%20addressing). This runs to completion in around ??? seconds on my machine. There are some potential memory usage optimisations here:

* We could use 32-bit integers to measure intercity distances instead of 64-bit floats. This would allow us to go to 25 cities. However, this would mean that we could no longer use `Infinity` as a sentinel value for cities which are not connected together at all and for city layouts where a Hamiltonian cycle is not possible.
* We could store city IDs using 16-bit integers instead of 32-bit integers. This would allow us to go to 26 cities. However, this is relatively difficult because WASM doesn't have native 16-bit integers - we would need to pack two city IDs into each single 32-bit integer, manually, instead.
* Could we store distances and city IDs in separate memory pools?

The JavaScript implementation can handle 23 cities in around ??? seconds on my machine. At 24 cities it is using more than 4GiB of memory. Of course, the sky is the limit here.



## Memory usage

For the purposes of this work, travelling salesman distances are measured using 64-bit floats. That's the native number format for JavaScript and it makes it the easiest to set the problem up. It also makes it extremely easy to use `Infinity` as a sentinel value for cities which are not connected together at all and for city layouts where a Hamiltonian cycle is not possible.

City identifiers (numbers from 0 to *n* - 1 inclusive) are stored as 32-bit integers because that's the smallest numerical type available in WebAssembly.

A 64-bit float requires 8 bytes to store and a 32-bit integer requires 4 bytes to store.

Given this, for *n* cities, the WASM implementation requires this much memory:

* *n* \* *n* \* 8 bytes for storing the city-to-city distance table, `d`
* 2<sup>*n* - 1</sup> \* (*n* - 1) \* 8 bytes for storing the table of intermediate best TSP distances, `len`
* 2<sup>*n* - 1</sup> \* (*n* - 1) \* 4 bytes for storing the table of intermediate final TSP cities, `prev`

Lastly, WebAssembly memory is allocated in pages of 65,536 bytes. Given all this...

| *n* | size of `d` | size of `len` | size of `prev` | total bytes | WASM pages |
| ---- |
| 1 | 8 | 0 | 0 | 8 | 1 |
| 2 | 32 | 16 | 8 | 56 | 1 |
| 3 | 72 | 64 | 32 | 168 | 1 |
| 4 | 128 | 192 | 96 | 416 | 1 |
| 5 | 200 | 512 | 256 | 968 | 1 |
| 6 | 288 | 1,280 | 640 | 2,208 | 1 |
| 7 | 392 | 3,072 | 1,536 | 5,000 | 1 |
| 8 | 512 | 7,168 | 3,584 | 11,264 | 1 |
| 9 | 648 | 16,384 | 8,192 | 25,224 | 1 |
| 10 | 800 | 36,864 | 18,432 | 56,096 | 1 |
| 11 | 968 | 81,920 | 40,960 | 123,848 | 2 |
| 12 | 1,152 | 180,224 | 90,112 | 271,488 | 5 |
| 13 | 1,352 | 393,216 | 196,608 | 591,176 | 10 |
| 14 | 1,568 | 851,968 | 425,984 | 1,279,520 | 20 |
| 15 | 1,800 | 1,835,008 | 917,504 | 2,754,312 | 43 |
| 16 | 2,048 | 3,932,160 | 1,966,080 | 5,900,288 | 91 |
| 17 | 2,312 | 8,388,608 | 4,194,304 | 12,585,224 | 193 |
| 18 | 2,592 | 17,825,792 | 8,912,896 | 26,741,280 | 409 |
| 19 | 2,888 | 37,748,736 | 18,874,368 | 56,625,992 | 865 |
| 20 | 3,200 | 79,691,776 | 39,845,888 | 119,540,864 | 1,825 |
| 21 | 3,528 | 167,772,160 | 83,886,080 | 251,661,768 | 3,841 |
| 22 | 3,872 | 352,321,536 | 176,160,768 | 528,486,176 | 8,065 |
| 23 | 4,232 | 738,197,504 | 369,098,752 | 1,107,300,488 | 16,897 |
| 24 | 4,608 | 1,543,503,872 | 771,751,936 | 2,315,260,416 | 35,329 |
| 25 | 5,000 | 3,221,225,472 | 1,610,612,736 | 4,831,843,208 | 73,729 |
| 26 | 5,408 | 6,710,886,400 | 3,355,443,200 | 10,066,335,008 | 153,601 |

As you'd expect, memory usage slightly more than doubles with each additional city.

The maximum number of WASM pages is 65,536, for a maximum of 4GiB of memory. So this implementation can manage up to 24 cities.

We could instead use 32-bit integers for the distances; this reduces memory usage by about a third and allows 25 cities (49,153 pages). On top of that, given that the practical maximum number of cities is around 30, we could conceivably store city IDs as some kind of handbuilt 8-bit integer and solve for 26 cities (64,001 pages). But let's leave things as they are for now.









Later on, I decided that this would be a good project to use to teach myself [WebAssembly](https://developer.mozilla.org/en-US/docs/WebAssembly), hence the near-identical WASM implementation which sits alongside the pure JavaScript implementation.
