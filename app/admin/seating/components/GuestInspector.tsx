'use client'

import { useMemo } from 'react'
import { moveGuest } from '@/lib/seatingSolver/moveGuest'
import { Scorer } from '@/lib/seatingSolver/scorer'
import { formatScore, formatShare, formatSigned, happinessColor } from '../format'
import { Help } from './ui'

interface GuestInspectorProps {
  scorer: Scorer
  guest: number
  potential: number // Best possible happiness for this guest (happinessPotential)
  familyName: string
  isLocked: boolean
  lockedSeats: Set<number>
  interactive: boolean
  onToggleLock: () => void
  onSelect: (guest: number) => void
  onSwap: (seatA: number, seatB: number) => void
  onClose: () => void
}

export default function GuestInspector({
  scorer,
  guest,
  potential,
  familyName,
  isLocked,
  lockedSeats,
  interactive,
  onToggleLock,
  onSelect,
  onSwap,
  onClose,
}: GuestInspectorProps) {
  const p = scorer.p
  const seat = scorer.seatOf[guest]
  const h = scorer.h[guest]
  const contributions = useMemo(() => scorer.contributions(guest), [scorer, guest])

  // Every move of this guest to another seat, best first; half of a couple brings their partner
  // (cheap: a few O(n) deltas per seat)
  const bestSwaps = useMemo(() => {
    if (!interactive || isLocked) return []
    const blocked = (s: number) => lockedSeats.has(s)
    const options: { seat: number; delta: number; swaps: [number, number][] }[] = []
    for (let s = 0; s < p.S; s++) {
      if (s === seat || lockedSeats.has(s)) continue
      options.push({ seat: s, ...moveGuest(scorer, seat, s, blocked) })
    }
    return options.sort((a, b) => b.delta - a.delta).slice(0, 3)
  }, [scorer, seat, p.S, lockedSeats, interactive, isLocked])

  const occupant = (s: number) => {
    const token = scorer.guestAt[s]
    return token < p.n ? p.guestNames[token] : 'an empty seat'
  }

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <span className="w-9 h-9 rounded-full shrink-0 border-2 border-white shadow" style={{ backgroundColor: happinessColor(h) }} />
          <div className="min-w-0">
            <div className="font-semibold text-black truncate">{p.guestNames[guest]}</div>
            <div className="text-[11px] text-zinc-500 truncate">
              {familyName} · {p.seats[seat].key}
              {p.mustHead[guest] ? ' · ♛ must sit at a head' : ''}
            </div>
          </div>
        </div>
        <button type="button" onClick={onClose} className="text-zinc-400 hover:text-black cursor-pointer" aria-label="Close">
          ×
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-zinc-50 py-2">
          <div className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold inline-flex items-center">
            Happiness
            <Help text="Sum of rating × proximity weight over everyone they have a rating with. The breakdown is below" />
          </div>
          <div className="font-mono font-semibold">{formatScore(h)}</div>
        </div>
        <div className="rounded-xl bg-zinc-50 py-2">
          <div className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold inline-flex items-center">
            Score
            <Help text="Their contribution to the objective: happiness after the fairness rule, plus any head bonus, minus any missing-acquaintance penalty" align="center" />
          </div>
          <div className="font-mono font-semibold">{formatScore(scorer.utility(guest, h, scorer.known[guest], seat))}</div>
        </div>
        <div className="rounded-xl bg-zinc-50 py-2">
          <div className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold inline-flex items-center">
            Knows here
            <Help text="People at their table they rate +1 or better" align="right" />
          </div>
          <div className="font-mono font-semibold">{scorer.known[guest]}</div>
        </div>
      </div>
      <div className="text-[11px] text-zinc-500 flex items-center">
        {potential > 0 ? (
          <span>
            <span className="font-mono font-semibold text-zinc-900">{formatShare(h / potential)}</span> of their best possible happiness (
            {formatScore(potential)})
          </span>
        ) : (
          <span>Nobody they rated positively is coming, so there&apos;s nothing to aim for</span>
        )}
        <Help text="Best possible: their favorite people in the closest seats around them, under the current proximity weights. This is what the “% of best” coloring shows" align="right" />
      </div>

      <button
        type="button"
        onClick={onToggleLock}
        disabled={!interactive}
        title="Locked guests stay in their seat during runs, random starts and swaps"
        className={`w-full px-3 py-1.5 rounded-lg text-xs font-medium border cursor-pointer disabled:opacity-40 ${
          isLocked ? 'bg-black text-white border-black' : 'bg-white text-zinc-600 border-zinc-200 hover:border-black'
        }`}
      >
        {isLocked ? '🔒 Locked to this seat · Unlock' : 'Lock to this seat'}
      </button>

      {bestSwaps.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold mb-1 flex items-center">
            {bestSwaps[0].delta > 1e-9 ? 'Best swaps' : 'No swap helps · least costly options'}
            <Help text="The swaps of this guest that raise the objective most, counting everyone affected, not just them. Someone who must sit next to a partner moves together with them. Click one to make it" />
          </div>
          <div className="space-y-1">
            {bestSwaps.map((option) => (
              <button
                key={option.seat}
                type="button"
                onClick={() => onSwap(seat, option.seat)}
                className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg border border-zinc-100 hover:border-black text-xs cursor-pointer"
              >
                <span className="truncate text-left">
                  {option.swaps.length > 1
                    ? `With ${occupant(option.swaps[1][0])}, swap with ${occupant(option.seat)} and ${occupant(option.swaps[1][1])}`
                    : `Swap with ${occupant(option.seat)}`}{' '}
                  <span className="text-zinc-400">({p.seats[option.seat].key})</span>
                </span>
                <span className={`font-mono font-semibold ${option.delta >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{formatSigned(option.delta)}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold mb-1 flex items-center">
          Where their happiness comes from
          <Help text="Everyone they have a rating with: rating × proximity weight for where that person sits. Faded rows are too far away to count. Click a name to inspect them" />
        </div>
        {contributions.length === 0 ? (
          <p className="text-xs text-zinc-400">No ties to anyone. Add them to a group or rate them on the admin Seating tab.</p>
        ) : (
          <div className="max-h-64 overflow-y-auto -mx-1">
            {contributions.map((c) => (
              <button
                key={c.guest}
                type="button"
                onClick={() => onSelect(c.guest)}
                className={`w-full flex items-center justify-between gap-2 px-1 py-1 rounded hover:bg-zinc-50 text-xs cursor-pointer ${
                  c.proximity === 0 ? 'opacity-50' : ''
                }`}
                title={`Affinity ${formatSigned(c.affinity, 0)} × proximity ${c.proximity.toFixed(2)}`}
              >
                <span className="truncate text-left">{p.guestNames[c.guest]}</span>
                <span className="flex items-center gap-2 shrink-0 font-mono">
                  <span className="text-zinc-400">
                    {formatSigned(c.affinity, 0)} × {c.proximity.toFixed(2)}
                  </span>
                  <span className={`w-10 text-right font-semibold ${c.value > 0 ? 'text-emerald-700' : c.value < 0 ? 'text-rose-700' : 'text-zinc-400'}`}>
                    {formatSigned(c.value)}
                  </span>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
