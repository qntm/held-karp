/*
  Some stylistic or structural choices in this implementation might seem
  a bit odd because it is intended to closely mirror the WASM implementation
  (q.v.).
*/

export const getCycle = async d => {
  const n = d.length

  /*
    For a set of cities `S` not including city `n - 1`, and for
    each `u` in `S`, `len[S][u]` is the length of the shortest
    one-way path which starts at city `n - 1` and passes through
    every city in `S` in some order, finishing at city `u`.

    `S` is expressed as a bitfield, with one bit set for each city in `S`.
    `S` may therefore take any value from 1 to 2 ^ (n - 1) - 1 inclusive.

    `len[S]` is a sparse array, only containing entries for each city `u` in `S`.

    If `S` contains only a single city, `u`, then `len[S][u]` is `d[n - 1][u]`.
  */
  const len = []

  /*
    `prev[S][u]` is the previous city in that path (the city before before `u`).
    This allows us to unwind the optimal path.

    If `S` contains only a single city, `u`, then `prev[S][u]` is `n - 1`.
  */
  const prev = []

  const all = (1 << (n - 1)) - 1

  for (let S = 1; S <= all; S++) {
    prev[S] = Array(n - 1)
    len[S] = Array(n - 1)

    for (let v = 0; v < n - 1; v++) {
      const S2 = S ^ (1 << v)
      // Is v in S?
      if (S2 < S) {
        let bestL
        let bestU
        if (S2) {
          // no need to initialise `bestL`
          bestU = -1
          for (let u = 0; u < n - 1; u++) {
            // Is u in S2?
            if (S2 & (1 << u)) {
              const l = len[S2][u] + d[u][v]
              if (bestU === -1 || l < bestL) {
                bestL = l
                bestU = u
              }
            }
          }
        } else {
          // If no `u` distinct from `v` can be found,
          // `S` has only a single element, `v`. So: base case
          bestL = d[n - 1][v]
          bestU = n - 1
        }

        len[S][v] = bestL
        prev[S][v] = bestU
      }
    }
  }

  // Close the loop
  let bestL
  let bestU
  if (n - 1) {
    // no need to initialise `bestL`
    bestU = -1
    for (let u = 0; u < n - 1; u++) {
      const l = len[all][u] + d[u][n - 1]
      if (bestU === -1 || l < bestL) {
        bestL = l
        bestU = u
      }
    }
  } else {
    bestL = 0
    bestU = n - 1
  }

  // Trace backwards through the optimal path
  let cycle = [n - 1]
  let u = bestU
  let S = all
  while (u !== n - 1) {
    cycle.unshift(u)
    const S2 = S ^ (1 << u)
    u = prev[S][u]
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
  const path = cycle.slice(1, cycle.length - 1).map(u => u - 1)

  return { l, path }
}
