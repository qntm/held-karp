/*
  The non-performance-intensive parts of this implementation remain as JavaScript,
  mirroring the pure JavaScript implementation. The core is WebAssembly.
*/

import fs from 'node:fs/promises'

const BYTES_PER_INT32 = 4
const BYTES_PER_FLOAT64 = 8
const BYTES_PER_PAGE = 65_536

const wasmBuffer = await fs.readFile(new URL('hk-opt.wasm', import.meta.url))

export const getCycle = async d => {
  const n = d.length

  if (n === 1) {
    // ignore `d[0][0]`
    return { l: 0, cycle: [0, 0] }
  }

  /*
    The algorithm below generates a cycle which starts and ends with city n - 1.
    We would prefer a cycle which starts and ends with city 0.
    So, rotate `d` so that city 0 is now at position n - 1:
  */
  d = [...d.slice(1), d[0]]
  d = d.map(d2 => [...d2.slice(1), d2[0]])

  const lenSize = 2 ** (n - 1) * (n - 1) * BYTES_PER_FLOAT64 // for `len[S][k]`
  const dSize = n * n * BYTES_PER_FLOAT64 // for `d[u][v]`
  const prevSize = 2 ** (n - 1) * (n - 1) * BYTES_PER_INT32 // for `prev[S][k]`

  const bytes = lenSize + dSize + prevSize
  const pages = Math.ceil(bytes / BYTES_PER_PAGE)

  const memory = new WebAssembly.Memory({
    initial: pages
  })
  const dataView = new DataView(memory.buffer)

  const wasmModule = await WebAssembly.instantiate(wasmBuffer, {
    js: {
      n,
      memory
    },
    console
  })

  const lenPtr = 0
  const dPtr = lenPtr + lenSize
  const prevPtr = dPtr + dSize

  const all = 2 ** (n - 1) - 1

  // OK LET'S RIDE

  for (let u = 0; u < n; u++) {
    for (let v = 0; v < n; v++) {
      // `d[u][v]`
      dataView.setFloat64(dPtr + (n * u + v) * BYTES_PER_FLOAT64, d[u][v], true)
    }
  }

  wasmModule.instance.exports.doHK()
  const bestU = wasmModule.instance.exports.getLastBestU()
  const bestL = wasmModule.instance.exports.getLastBestL()

  // Read the cycle out of `prev` in memory
  let cycle = [n - 1]
  let u = bestU
  let S = all
  while (u !== n - 1) {
    cycle.unshift(u)
    const S2 = S ^ (1 << u)
    // `prev[S][u]`
    u = dataView.getInt32(prevPtr + ((n - 1) * S + u) * BYTES_PER_INT32, true)
    S = S2
  }

  cycle.unshift(n - 1)

  // Finally, rotate city n - 1 back to position 0...
  cycle = cycle.map(u => (u + 1) % n)

  return { l: bestL, cycle }
}

export const getPath = async d => {
  /*
    The solution to TSP is a Hamiltonian cycle. If all we want is
    a Hamiltonian path, we can add a "universal vertex" city which is
    connected to all other cities with a distance of 0.
    We then break the cycle at this city to form our path.
  */

  // new city is 0, all other cities increase by 1
  const { l, cycle } = await getCycle([
    [0, ...Array(d.length).fill(0)],
    ...d.map(d2 =>
      [0, ...d2]
    )
  ])

  const i = cycle.indexOf(0)
  const path = [
    ...cycle.slice(i + 1, cycle.length - 1), // ignore redundant final element in cycle
    ...cycle.slice(0, i)
  ].map(u => u - 1)

  return { l, path }
}
