// Hand edits in the Seating Lab: moving one guest onto another seat. Half of a must-sit-next-to
// couple brings their partner along, so a drag doesn't break the couple's rule.

import { Scorer } from './scorer'

export type GuestMove = {
  swaps: [number, number][] // Seat swaps to make, in order
  delta: number // Change in objective
}

/**
 * A guest's must-sit-next-to partner, or -1 if they have none or more than one (moving two
 * neighbors along would need more than a pair move).
 */
export function partnerOf(scorer: Scorer, g: number): number {
  let partner = -1
  for (const c of scorer.p.pairs) {
    if (c.kind !== 'ADJACENT' || (c.x !== g && c.y !== g)) continue
    if (partner !== -1) return -1
    partner = c.x === g ? c.y : c.x
  }
  return partner
}

/**
 * What moving the guest at `from` onto `to` does. Usually a swap with whoever sits there. If the
 * guest sits next to their only must-sit-next-to partner, the partner moves to the seat beside `to`
 * that scores best, swapping with its occupant, so the couple stays together. `blocked` seats
 * (locked guests) never move. Measures by making the swaps and undoing them, like swapDelta.
 */
export function moveGuest(scorer: Scorer, from: number, to: number, blocked: (seat: number) => boolean): GuestMove {
  const swap: GuestMove = { swaps: [[from, to]], delta: scorer.swapDelta(from, to) }
  const { p } = scorer
  const g = scorer.guestAt[from]
  const partner = g < p.n ? partnerOf(scorer, g) : -1
  if (partner === -1) return swap
  const partnerSeat = scorer.seatOf[partner]
  // Trading places with the partner, or a couple that's already apart: just the swap
  if (partnerSeat === to || !p.adjacent[from * p.S + partnerSeat] || blocked(partnerSeat)) return swap

  let best: GuestMove | null = null
  for (let s = 0; s < p.S; s++) {
    if (!p.adjacent[to * p.S + s] || s === from || s === partnerSeat || blocked(s)) continue
    const delta = scorer.applySwap(from, to) + scorer.applySwap(partnerSeat, s)
    scorer.applySwap(partnerSeat, s)
    scorer.applySwap(from, to)
    if (!best || delta > best.delta) best = { swaps: [[from, to], [partnerSeat, s]], delta }
  }
  return best ?? swap
}
