import { getCycle, getPath } from 'held-karp/wasm'

const cities = [
  [0, 50],
  [50, 0]
]
await getCycle(cities)
await getPath(cities)
