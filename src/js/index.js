/*
  Some stylistic or structural choices in this implementation might seem
  a bit odd because it is intended to closely mirror the WASM implementation
  (q.v.)
*/

export const getCycle = d => {
  const n = d.length

  /*
    For a set of cities `S` not including city `n - 1`, and for
    each `k` in `S`, `len[S][k]` is the length of the shortest
    one-way path which starts at city `n - 1` and passes through
    every city in `S` in some order, finishing at city `k`.

    `S` is expressed as a bitfield, with one bit set for each city in `S`.
    `S` may therefore take any value from 1 to 2 ^ (n - 1) - 1 inclusive.

    `len[S]` is a sparse array, only containing entries for each city `k` in `S`.

    If `S` contains only a single city, `k`, then `len[S][k]` is `d[n - 1][k]`.
  */
  const len = []

  /*
    `prev[S][k]` is the previous city in that path (the city before before `k`).
    This allows us to unwind the optimal path.

    `prev[S][k]` is `undefined` if the previous city is `n - 1`.
    This happens if `S` contains only a single city, `k`.
  */
  const prev = []

  const all = (1 << (n - 1)) - 1

  for (let S = 1; S <= all; S++) {
    prev[S] = Array(n - 1)
    len[S] = Array(n - 1)

    for (let k = 0; k < n - 1; k++) {
      const S2 = S ^ (1 << k)

      // Was k in S?
      if (S2 < S) {
        let bestL
        let bestM = -1
        if (S2) {
          for (let m = 0; m < n - 1; m++) {
            // Was m in S2?
            if (S2 & (1 << m)) {
              const l = len[S2][m] + d[m][k]

              if (bestM === -1 || l < bestL) {
                bestL = l
                bestM = m
              }
            }
          }
        } else {
          // If no `m` distinct from `k` can be found,
          // `S` has only a single element, `k`. So: base case
          bestL = d[n - 1][k]
        }

        len[S][k] = bestL
        prev[S][k] = bestM // can be -1
      }
    }
  }

  // Close the loop
  let bestL
  let bestK = -1
  for (let k = 0; k < n - 1; k++) {
    const l = len[all][k] + d[k][n - 1]

    if (k === 0 || l < bestL) {
      bestL = l
      bestK = k
    }
  }

  // Trace backwards through the optimal path
  let cycle = [n - 1]
  let k = bestK
  let S = all
  while (k !== -1) {
    cycle.unshift(k)
    const S2 = S ^ (1 << k)
    k = prev[S][k]
    S = S2
  }

  // Could just use `bestL` but this approach mirrors the WASM implementation
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

export const getPath = d => {
  /*
    The solution to TSP is a Hamiltonian cycle. If all we want is
    a Hamiltonian path, we can add a "universal vertex" city which is
    connected to all other cities with a distance of 0.
    We then break the cycle at this city to form our path.
  */

  // new city is 0, all other cities increase by 1
  const { l, cycle } = getCycle([
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
