// Seat geometry for long banquet tables: one row of seats along each side and an optional head
// seat at each end. Seat keys match SeatAssignment.seatKey, e.g. 'T1-L-03' or 'T1-HEAD-N'.

export type LayoutConfig = {
  tables: number
  seatsPerSide: number
  heads: boolean
}

// L/R are the two long sides; HN sits at the index-0 end, HS at the far end
export type SeatSide = 'L' | 'R' | 'HN' | 'HS'

export type Seat = {
  key: string
  table: number
  side: SeatSide
  index: number // Position along the table; heads use -1 (HN) and seatsPerSide (HS)
  isHead: boolean
  x: number // Layout units for drawing: one unit per seat along the table
  y: number
}

export type ProximityWeights = {
  side: number // Side-by-side neighbors
  across: number // Directly across the table
  diagonal: number // Across and one seat over
  headCorner: number // Head seat and the two corner seats beside it
  headSecondRow: number // Head seat and the next seat in from each corner
  sameTable: number // Everyone else at the table
}

export const DEFAULT_PROXIMITY: ProximityWeights = {
  side: 1,
  across: 0.7,
  diagonal: 0.4,
  headCorner: 0.8,
  headSecondRow: 0,
  sameTable: 0.1,
}

// Vertical space one table takes when drawn, in layout units
export const TABLE_PITCH = 4

/**
 * Smallest layout of `tables` equal tables that seats everyone.
 */
export function autoLayout(guestCount: number, tables = 2, heads = true): LayoutConfig {
  const perTable = Math.ceil(guestCount / Math.max(1, tables))
  const seatsPerSide = Math.max(1, Math.ceil((perTable - (heads ? 2 : 0)) / 2))
  return { tables, seatsPerSide, heads }
}

export function seatCount(layout: LayoutConfig): number {
  return layout.tables * (layout.seatsPerSide * 2 + (layout.heads ? 2 : 0))
}

export function buildSeats(layout: LayoutConfig): Seat[] {
  const seats: Seat[] = []
  const pad = (i: number) => String(i + 1).padStart(2, '0')
  for (let t = 0; t < layout.tables; t++) {
    const y0 = t * TABLE_PITCH
    const name = `T${t + 1}`
    if (layout.heads) seats.push({ key: `${name}-HEAD-N`, table: t, side: 'HN', index: -1, isHead: true, x: -1, y: y0 + 1 })
    for (let i = 0; i < layout.seatsPerSide; i++) {
      seats.push({ key: `${name}-L-${pad(i)}`, table: t, side: 'L', index: i, isHead: false, x: i, y: y0 })
      seats.push({ key: `${name}-R-${pad(i)}`, table: t, side: 'R', index: i, isHead: false, x: i, y: y0 + 2 })
    }
    if (layout.heads) {
      seats.push({
        key: `${name}-HEAD-S`,
        table: t,
        side: 'HS',
        index: layout.seatsPerSide,
        isHead: true,
        x: layout.seatsPerSide,
        y: y0 + 1,
      })
    }
  }
  return seats
}

// Index of the side seat next to a head (the corner)
const cornerIndex = (head: Seat, seatsPerSide: number) => (head.side === 'HN' ? 0 : seatsPerSide - 1)

export function seatProximity(a: Seat, b: Seat, w: ProximityWeights, seatsPerSide: number): number {
  if (a === b || a.table !== b.table) return 0
  if (a.isHead || b.isHead) {
    if (a.isHead && b.isHead) return w.sameTable
    const [head, seat] = a.isHead ? [a, b] : [b, a]
    const d = Math.abs(seat.index - cornerIndex(head, seatsPerSide))
    if (d === 0) return w.headCorner
    if (d === 1) return Math.max(w.headSecondRow, w.sameTable)
    return w.sameTable
  }
  const d = Math.abs(a.index - b.index)
  if (a.side === b.side) return d === 1 ? w.side : w.sameTable
  if (d === 0) return w.across
  if (d === 1) return w.diagonal
  return w.sameTable
}

/**
 * "Next to" for must-sit-next-to constraints, independent of the weights: side-by-side
 * neighbors, or a head and its corner seats.
 */
export function seatsAdjacent(a: Seat, b: Seat, seatsPerSide: number): boolean {
  if (a === b || a.table !== b.table) return false
  if (a.isHead && b.isHead) return false
  if (a.isHead || b.isHead) {
    const [head, seat] = a.isHead ? [a, b] : [b, a]
    return seat.index === cornerIndex(head, seatsPerSide)
  }
  return a.side === b.side && Math.abs(a.index - b.index) === 1
}
