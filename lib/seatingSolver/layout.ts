// Seat geometry for long banquet tables: one row of seats along each side and an optional head
// seat at each end. Seat keys match SeatAssignment.seatKey, e.g. 'T1-L-03' or 'T1-HEAD-N'.

export type LayoutConfig = {
  tables: number
  seatsPerSide: number
  heads: boolean
  extraSeats?: number // The first this many tables squeeze one more seat onto their left side
}

// L/R are the two long sides; HN sits at the index-0 end, HS at the far end
export type SeatSide = 'L' | 'R' | 'HN' | 'HS'

export type Seat = {
  key: string
  table: number
  side: SeatSide
  index: number // Position along its side; heads use -1 (HN) and the side's length (HS)
  sideSeats: number // Seats along this seat's side; 1 for heads
  isHead: boolean
  x: number // Position along the table, one unit per seat; a squeezed side's seats sit closer together
  y: number
}

export type ProximityWeights = {
  side: number // Side-by-side neighbors
  across: number // Directly across the table
  diagonal: number // Across and one seat over
  headCorner: number // Head seat and the two corner seats beside it
  headSecondRow: number // Head seat and the next seat in from each corner
  twoAway: number // Two seats along the table, on either side
  falloff: number // Each seat further multiplies by this, from two away (or a head's second row) on
}

export const DEFAULT_PROXIMITY: ProximityWeights = {
  side: 1,
  across: 0.9,
  diagonal: 0.8,
  headCorner: 1,
  headSecondRow: 0.1,
  twoAway: 0.4,
  falloff: 0.5,
}

// Vertical space one table takes when drawn, in layout units
export const TABLE_PITCH = 4

/**
 * Smallest layout of `tables` equal tables that seats everyone, squeezing an extra seat onto some
 * tables when that fits everyone exactly: 69 guests get tables of 35 and 34 rather than two of 36.
 */
export function autoLayout(guestCount: number, tables = 2, heads = true): LayoutConfig {
  const T = Math.max(1, tables)
  const perTable = Math.ceil(guestCount / T)
  const seatsPerSide = Math.max(1, Math.ceil((perTable - (heads ? 2 : 0)) / 2))
  const squeezed = { tables, seatsPerSide: seatsPerSide - 1, heads, extraSeats: 0 }
  squeezed.extraSeats = guestCount - seatCount(squeezed)
  const exact = seatCount({ tables, seatsPerSide, heads }) === guestCount
  if (!exact && squeezed.seatsPerSide >= 1 && squeezed.extraSeats >= 0 && squeezed.extraSeats <= T) return squeezed
  return { tables, seatsPerSide, heads, extraSeats: 0 }
}

// Seats along one long side of table t
export function sideLength(layout: LayoutConfig, table: number, side: 'L' | 'R'): number {
  return layout.seatsPerSide + (side === 'L' && table < (layout.extraSeats ?? 0) ? 1 : 0)
}

export function seatCount(layout: LayoutConfig): number {
  return layout.tables * (layout.seatsPerSide * 2 + (layout.heads ? 2 : 0)) + Math.min(layout.extraSeats ?? 0, layout.tables)
}

export function buildSeats(layout: LayoutConfig): Seat[] {
  const seats: Seat[] = []
  const pad = (i: number) => String(i + 1).padStart(2, '0')
  for (let t = 0; t < layout.tables; t++) {
    const y0 = t * TABLE_PITCH
    const name = `T${t + 1}`
    const length = { L: sideLength(layout, t, 'L'), R: sideLength(layout, t, 'R') }
    // Every table is as long as an unsqueezed one, so extra seats sit a little closer together
    const span = Math.max(layout.seatsPerSide - 1, (Math.max(length.L, length.R) - 1) * 0.75)
    const xOf = (i: number, n: number) => (n > 1 ? (i * span) / (n - 1) : 0)
    if (layout.heads) seats.push({ key: `${name}-HEAD-N`, table: t, side: 'HN', index: -1, sideSeats: 1, isHead: true, x: -1, y: y0 + 1 })
    for (let i = 0; i < Math.max(length.L, length.R); i++) {
      for (const side of ['L', 'R'] as const) {
        if (i < length[side]) {
          const y = side === 'L' ? y0 : y0 + 2
          seats.push({ key: `${name}-${side}-${pad(i)}`, table: t, side, index: i, sideSeats: length[side], isHead: false, x: xOf(i, length[side]), y })
        }
      }
    }
    if (layout.heads) {
      seats.push({
        key: `${name}-HEAD-S`,
        table: t,
        side: 'HS',
        index: Math.max(length.L, length.R),
        sideSeats: 1,
        isHead: true,
        x: span + 1,
        y: y0 + 1,
      })
    }
  }
  return seats
}

export type SeatRelation = 'side' | 'across' | 'diagonal' | 'headCorner' | 'headSecondRow' | 'farther'

/**
 * How two seats sit relative to each other, or null for the same seat or different tables. Across
 * the table goes by position, so on a squeezed side the middle seat is diagonal to two seats.
 */
export function seatRelation(a: Seat, b: Seat): SeatRelation | null {
  if (a === b || a.table !== b.table) return null
  if (a.isHead || b.isHead) {
    if (a.isHead && b.isHead) return 'farther'
    const [head, seat] = a.isHead ? [a, b] : [b, a]
    const d = Math.abs(seat.index - (head.side === 'HN' ? 0 : seat.sideSeats - 1))
    return d === 0 ? 'headCorner' : d === 1 ? 'headSecondRow' : 'farther'
  }
  if (a.side === b.side) return Math.abs(a.index - b.index) === 1 ? 'side' : 'farther'
  const d = Math.round(Math.abs(a.x - b.x))
  return d === 0 ? 'across' : d === 1 ? 'diagonal' : 'farther'
}

/**
 * How much two seats count for each other. Close seats take their weight; farther along the same
 * table it decays: two seats away counts twoAway, and each seat beyond multiplies by falloff. A
 * head's reach decays the same way from its second row. Other tables never count.
 */
export function seatProximity(a: Seat, b: Seat, w: ProximityWeights): number {
  const relation = seatRelation(a, b)
  if (relation === null) return 0
  if (relation !== 'farther') return w[relation]
  if (a.isHead !== b.isHead) {
    const [head, seat] = a.isHead ? [a, b] : [b, a]
    const d = Math.abs(seat.index - (head.side === 'HN' ? 0 : seat.sideSeats - 1))
    return w.headSecondRow * Math.pow(w.falloff, d - 1)
  }
  const along = a.side === b.side ? Math.abs(a.index - b.index) : Math.round(Math.abs(a.x - b.x))
  return w.twoAway * Math.pow(w.falloff, along - 2)
}

/**
 * "Next to" for must-sit-next-to constraints, independent of the weights: side-by-side
 * neighbors, or a head and its corner seats.
 */
export function seatsAdjacent(a: Seat, b: Seat): boolean {
  const relation = seatRelation(a, b)
  return relation === 'side' || relation === 'headCorner'
}

// For NEAR rules: next to (as above), directly across, or diagonal
export function seatsNear(a: Seat, b: Seat): boolean {
  const relation = seatRelation(a, b)
  return relation === 'side' || relation === 'headCorner' || relation === 'across' || relation === 'diagonal'
}
