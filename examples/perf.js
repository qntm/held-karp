// e.g. `npm run perf -- 20`

import { getCycle as getCycleJs } from '../src/js-impl/index.js'
import { getCycle as getCycleWasm } from '../src/wasm-impl/index.js'

const argv = process.argv
argv.shift()
argv.shift()

const n = Number(argv.shift()) || 24

// Place some random cities in 2D space
const xys = Array(n).fill().map(() => [Math.random(), Math.random()])

// Compute a distance graph, Cartesian metric
const d = xys.map(([xu, yu]) =>
  xys.map(([xv, yv]) =>
    Math.sqrt((xv - xu) ** 2 + (yv - yu) ** 2)
  )
)

console.log(`n = ${n}`)
console.log(`d = [\n  ${d.map(d2 => `[${d2.join(', ')}]`).join(',\n  ')}\n]`)
console.log()

console.time('HK/JS')
console.log(getCycleJs(d))
console.timeEnd('HK/JS')
console.log()

console.time('HK/WASM')
console.log(await getCycleWasm(d))
console.timeEnd('HK/WASM')
console.log()
