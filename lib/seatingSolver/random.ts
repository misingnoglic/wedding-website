// Small seeded PRNG so runs are reproducible
export type Rng = () => number

export function mulberry32(seed: number): Rng {
  let s = seed | 0
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const randInt = (rng: Rng, n: number) => Math.floor(rng() * n)

/**
 * Shuffles the tokens sitting in `positions` among those positions, in place.
 */
export function shuffleAt(guestAt: Int32Array, positions: ArrayLike<number>, rng: Rng) {
  for (let i = positions.length - 1; i > 0; i--) {
    const j = randInt(rng, i + 1)
    const a = positions[i]
    const b = positions[j]
    const t = guestAt[a]
    guestAt[a] = guestAt[b]
    guestAt[b] = t
  }
}
