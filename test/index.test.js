/* global describe, it */

import assert from 'node:assert/strict'

import * as jsImpl from '../src/js-impl/index.js'
import * as wasmImpl from '../src/wasm-impl/index.js'

const implementations = {
  JavaScript: jsImpl,
  WebAssembly: wasmImpl
}

describe('held-karp', () => {
  Object.entries(implementations).forEach(([name, impl]) => {
    describe(`${name} implementation`, () => {
      it('handles a degenerate case with 1 city', async () => {
        assert.deepEqual(await impl.getCycle([
          [0]
        ]), { l: 0, cycle: [0, 0] })
      })

      it('handles a symmetric case with two cities', async () => {
        assert.deepEqual(await impl.getCycle([
          [0, 5],
          [5, 0]
        ]), { l: 10, cycle: [0, 1, 0] })
      })

      it('handles an asymmetric case with two cities', async () => {
        assert.deepEqual(await impl.getCycle([
          [0, 7],
          [6, 0]
        ]), { l: 13, cycle: [0, 1, 0] })
      })

      it('handles a case with two cities disconnected from one another, with no cycle possible', async () => {
        assert.deepEqual(await impl.getCycle([
          [0, Infinity],
          [Infinity, 0]
        ]), { l: Infinity, cycle: [0, 1, 0] })
      })

      it('handles a symmetric case with three cities', async () => {
        assert.deepEqual(await impl.getCycle([
          [0, 1, 65],
          [1, 0, 2],
          [65, 2, 0],
        ]), { l: 68, cycle: [0, 2, 1, 0] })
      })

      it('handles an asymmetric case with three cities', async () => {
        assert.deepEqual(await impl.getCycle([
          [0, 1, 60],
          [60, 0, 1],
          [1, 60, 0],
        ]), { l: 3, cycle: [0, 1, 2, 0] })
        assert.deepEqual(await impl.getCycle([
          [0, 60, 1],
          [1, 0, 60],
          [60, 1, 0],
        ]), { l: 3, cycle: [0, 2, 1, 0] })
      })

      it('example from https://www.geeksforgeeks.org/traveling-salesman-problem-tsp-implementation/', async () => {
        assert.deepEqual(await impl.getCycle([
          [0, 10, 15, 20],
          [10, 0, 35, 25],
          [15, 35, 0, 30],
          [20, 25, 30, 0]
        ]), { l: 80, cycle: [0, 1, 3, 2, 0] })
      })

      it('asymmetric four-city case', async () => {
        assert.deepEqual(await impl.getCycle([
          [0, 1, 60, 60],
          [60, 0, 1, 60],
          [60, 60, 0, 1],
          [1, 60, 60, 0],
        ]), { l: 4, cycle: [0, 1, 2, 3, 0] })
      })

      it('example from https://stackoverflow.com/a/64795748 (n = 6)', async () => {
        assert.deepEqual(await impl.getCycle([
          [0, 64, 378, 519, 434, 200],
          [64, 0, 318, 455, 375, 164],
          [378, 318, 0, 170, 265, 344],
          [519, 455, 170, 0, 223, 428],
          [434, 375, 265, 223, 0, 273],
          [200, 164, 344, 428, 273, 0],
        ]), { l: 1248, cycle: [0, 5, 4, 3, 2, 1, 0] })
      })

      it('example from https://stackoverflow.com/a/27195735 (n = 11)', async () => {
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

        assert.deepEqual(await impl.getCycle(cities), { l: 253, cycle: [0, 7, 4, 3, 9, 5, 2, 6, 1, 10, 8, 0] })
        assert.deepEqual(await impl.getPath(cities), { l: 160, path: [6, 1, 10, 2, 7, 8, 0, 4, 3, 5, 9] })
      })
    })
  })

  it('implementations should have exactly the same behaviour', async () => {
    const n = 16

    // Place some random cities in 2D space
    const xys = Array(n).fill().map(() => [Math.random(), Math.random()])

    // Compute a distance graph, Cartesian metric
    const d = xys.map(([xu, yu]) =>
      xys.map(([xv, yv]) =>
        Math.sqrt((xv - xu) ** 2 + (yv - yu) ** 2)
      )
    )

    assert.deepEqual(await jsImpl.getPath(d), await wasmImpl.getPath(d))
  })
})
