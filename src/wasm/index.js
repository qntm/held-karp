/*
  The non-performance-intensive parts of this implementation remain as JavaScript,
  mirroring the pure JavaScript implementation. The core is WebAssembly.
*/

import fs from 'node:fs/promises'

const BYTES_PER_INT32 = 4
const BYTES_PER_FLOAT64 = 8
const BYTES_PER_PAGE = 65_536

const wasmBuffer = await fs.readFile('./held-karp.wasm')

export const getCycle = async d => {
  const n = d.length

  const dSize = n * n * BYTES_PER_FLOAT64 // for `d[u][v]`
  const lenSize = 2 ** (n - 1) * (n - 1) * BYTES_PER_FLOAT64 // for `len[S][k]`
  const prevSize = 2 ** (n - 1) * (n - 1) * BYTES_PER_INT32 // for `prev[S][k]`

  const bytes = dSize + lenSize + prevSize
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
    console,
  })

  const dPtr = 0
  const lenPtr = dPtr + dSize
  const prevPtr = lenPtr + lenSize

  for (let u = 0; u < n; u++) {
    for (let v = 0; v < n; v++) {
      // `d[u][v]`
      dataView.setFloat64(dPtr + (u * n + v) * BYTES_PER_FLOAT64, d[u][v], true)
    }
  }

  let k = wasmModule.instance.exports.getCycle()

  // Read the cycle out of `prev` in memory, the easy way...
  let cycle = [n - 1]
  let S = 2 ** (n - 1) - 1
  while (k !== -1) {
    cycle.unshift(k)
    const S2 = S ^ (1 << k)
    // `prev[S][k]`
    k = dataView.getInt32(prevPtr + ((n - 1) * S + k) * BYTES_PER_INT32, true)
    S = S2
  }

  const l = cycle
    .reduce((acc, u, i, cycle) => acc + d[u][cycle[i + 1 in cycle ? i + 1 : 0]], 0)

  // Rotate so that we start and end at city 0
  const i = cycle.indexOf(0)
  cycle = [
    ...cycle.slice(i, cycle.length),
    ...cycle.slice(0, i),
    0
  ]

  return { l, cycle }
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

  // Eliminate new city 0 from the start and end of the cycle
  // and bump the rest back down
  const path = cycle.slice(1, cycle.length - 1).map(k => k - 1)

  return { l, path }
}
