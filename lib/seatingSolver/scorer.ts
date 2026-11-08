// Objective for a full seating, kept up to date incrementally as seats are swapped.
//
// For each guest g:  happiness h(g) = Σ_k affinity(g, k) × proximity(seat g, seat k)
// utility(g) = weight(g) · (fairness(h) + head bonus − missing-acquaintance penalty)
// objective  = Σ utility − constraintPenalty × broken hard constraints

import { KNOWS_THRESHOLD, PairConstraint, Problem } from './problem'

export type GuestScore = {
  guest: number
  seat: number
  happiness: number
  utility: number
  known: number
}

export type Violation = { kind: string; guests: number[] }

export class Scorer {
  readonly p: Problem
  readonly guestAt: Int32Array // seat -> token
  readonly seatOf: Int32Array // token -> seat
  readonly h: Float64Array
  readonly known: Int32Array // Exact after load/recompute; kept current by swaps only when minKnownAtTable > 0
  total = 0
  private readonly constraintsOf: number[][]

  constructor(problem: Problem, guestAt: Int32Array) {
    this.p = problem
    this.guestAt = new Int32Array(problem.S)
    this.seatOf = new Int32Array(problem.S)
    this.h = new Float64Array(problem.n)
    this.known = new Int32Array(problem.n)
    this.constraintsOf = Array.from({ length: problem.n }, () => [])
    problem.pairs.forEach((c, i) => {
      this.constraintsOf[c.x].push(i)
      this.constraintsOf[c.y].push(i)
    })
    this.load(guestAt)
  }

  load(guestAt: Int32Array) {
    this.guestAt.set(guestAt)
    for (let s = 0; s < this.p.S; s++) this.seatOf[this.guestAt[s]] = s
    this.recompute()
  }

  recompute() {
    const { n, pairs, mustHead, objective } = this.p
    let total = 0
    for (let g = 0; g < n; g++) {
      this.h[g] = this.happinessOf(g)
      this.known[g] = this.knownOf(g)
      total += this.utility(g, this.h[g], this.known[g], this.seatOf[g])
    }
    let violations = 0
    for (const c of pairs) if (this.violated(c)) violations++
    for (let g = 0; g < n; g++) if (mustHead[g] && !this.p.isHead[this.seatOf[g]]) violations++
    this.total = total - objective.constraintPenalty * violations
  }

  happinessOf(g: number): number {
    const { n, S, A, P } = this.p
    const row = this.seatOf[g] * S
    let h = 0
    for (let k = 0; k < n; k++) {
      const a = A[g * n + k]
      if (a !== 0 && k !== g) h += a * P[row + this.seatOf[k]]
    }
    return h
  }

  knownOf(g: number): number {
    const { n, A, tableOf } = this.p
    const seatOf = this.seatOf
    const t = tableOf[seatOf[g]]
    const row = g * n
    const threshold = KNOWS_THRESHOLD // A local copy: module bindings can be slow in hot loops
    let count = 0
    for (let k = 0; k < n; k++) {
      if (A[row + k] >= threshold && k !== g && tableOf[seatOf[k]] === t) count++
    }
    return count
  }

  utility(g: number, h: number, known: number, seat: number): number {
    const o = this.p.objective
    let u: number
    if (o.fairness === 'floor') u = h - o.floorPenalty * Math.max(0, o.minHappiness - h)
    else if (o.fairness === 'concave') u = h >= 0 ? 4 * (Math.sqrt(1 + h) - 1) : 2 * h
    else u = h
    if (o.headBonus !== 0 && this.p.isHead[seat]) u += o.headBonus * this.p.central[g]
    if (o.minKnownAtTable > 0 && known < o.minKnownAtTable) u -= o.minKnownPenalty * (o.minKnownAtTable - known)
    return u * this.p.weight[g]
  }

  violated(c: PairConstraint): boolean {
    const { S, adjacent, near, tableOf } = this.p
    const a = this.seatOf[c.x]
    const b = this.seatOf[c.y]
    switch (c.kind) {
      case 'ADJACENT':
        return !adjacent[a * S + b]
      case 'NEAR':
        return !near[a * S + b]
      case 'NOT_ADJACENT':
        return !!adjacent[a * S + b]
      case 'SAME_TABLE':
        return tableOf[a] !== tableOf[b]
      case 'DIFFERENT_TABLE':
        return tableOf[a] === tableOf[b]
    }
  }

  // Broken constraints involving x or y (tokens), each counted once
  private violationsTouching(x: number, y: number): number {
    const { n, pairs, mustHead, isHead } = this.p
    let count = 0
    if (x < n) {
      for (const i of this.constraintsOf[x]) if (this.violated(pairs[i])) count++
      if (mustHead[x] && !isHead[this.seatOf[x]]) count++
    }
    if (y < n) {
      for (const i of this.constraintsOf[y]) {
        const c = pairs[i]
        if (c.x === x || c.y === x) continue
        if (this.violated(c)) count++
      }
      if (mustHead[y] && !isHead[this.seatOf[y]]) count++
    }
    return count
  }

  /**
   * Swaps whoever sits in seats a and b, updates every score, and returns the change in the
   * objective. Calling it again with the same seats undoes it.
   */
  applySwap(a: number, b: number): number {
    if (a === b) return 0
    const { n, S, A, P, tableOf, objective } = this.p
    const x = this.guestAt[a]
    const y = this.guestAt[b]
    const xReal = x < n
    const yReal = y < n
    if (!xReal && !yReal) {
      this.guestAt[a] = y
      this.guestAt[b] = x
      this.seatOf[x] = b
      this.seatOf[y] = a
      return 0
    }

    const before = this.violationsTouching(x, y)
    const ta = tableOf[a]
    const tb = tableOf[b]
    const trackKnown = objective.minKnownAtTable > 0 && ta !== tb
    const threshold = KNOWS_THRESHOLD
    let delta = 0

    // Everyone else: only their terms with x and y change
    for (let k = 0; k < n; k++) {
      if (k === x || k === y) continue
      const sk = this.seatOf[k]
      const row = sk * S
      let dh = 0
      let dk = 0
      const ax = xReal ? A[k * n + x] : 0
      const ay = yReal ? A[k * n + y] : 0
      if (ax !== 0) dh += ax * (P[row + b] - P[row + a])
      if (ay !== 0) dh += ay * (P[row + a] - P[row + b])
      if (trackKnown) {
        const tk = tableOf[sk]
        if (ax >= threshold) dk += tk === tb ? 1 : tk === ta ? -1 : 0
        if (ay >= threshold) dk += tk === ta ? 1 : tk === tb ? -1 : 0
      }
      if (dh === 0 && dk === 0) continue
      const old = this.utility(k, this.h[k], this.known[k], sk)
      this.h[k] += dh
      this.known[k] += dk
      delta += this.utility(k, this.h[k], this.known[k], sk) - old
    }

    const oldX = xReal ? this.utility(x, this.h[x], this.known[x], a) : 0
    const oldY = yReal ? this.utility(y, this.h[y], this.known[y], b) : 0
    this.guestAt[a] = y
    this.guestAt[b] = x
    this.seatOf[x] = b
    this.seatOf[y] = a
    // Acquaintance counts only matter (and only cost time) when minKnownAtTable is on
    const countKnown = objective.minKnownAtTable > 0
    if (xReal) {
      this.h[x] = this.happinessOf(x)
      if (countKnown) this.known[x] = this.knownOf(x)
      delta += this.utility(x, this.h[x], this.known[x], b) - oldX
    }
    if (yReal) {
      this.h[y] = this.happinessOf(y)
      if (countKnown) this.known[y] = this.knownOf(y)
      delta += this.utility(y, this.h[y], this.known[y], a) - oldY
    }

    delta -= objective.constraintPenalty * (this.violationsTouching(x, y) - before)
    this.total += delta
    return delta
  }

  /**
   * Objective change if seats a and b were swapped, leaving the seating as it was.
   */
  swapDelta(a: number, b: number): number {
    const d = this.applySwap(a, b)
    this.applySwap(a, b)
    return d
  }

  guestScores(): GuestScore[] {
    return Array.from({ length: this.p.n }, (_, g) => ({
      guest: g,
      seat: this.seatOf[g],
      happiness: this.h[g],
      utility: this.utility(g, this.h[g], this.known[g], this.seatOf[g]),
      known: this.known[g],
    }))
  }

  violations(): Violation[] {
    const list: Violation[] = this.p.pairs.filter((c) => this.violated(c)).map((c) => ({ kind: c.kind, guests: [c.x, c.y] }))
    for (let g = 0; g < this.p.n; g++) {
      if (this.p.mustHead[g] && !this.p.isHead[this.seatOf[g]]) list.push({ kind: 'HEAD', guests: [g] })
    }
    return list
  }

  /**
   * Who contributes to g's happiness from where they sit now, largest first.
   */
  contributions(g: number): { guest: number; affinity: number; proximity: number; value: number }[] {
    const { n, S, A, P } = this.p
    const row = this.seatOf[g] * S
    const list = []
    for (let k = 0; k < n; k++) {
      const affinity = A[g * n + k]
      if (k === g || affinity === 0) continue
      const proximity = P[row + this.seatOf[k]]
      list.push({ guest: k, affinity, proximity, value: affinity * proximity })
    }
    return list.sort((p, q) => Math.abs(q.value) - Math.abs(p.value) || q.affinity - p.affinity)
  }
}
