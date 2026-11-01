'use client'

import { Scorer } from '@/lib/seatingSolver/scorer'
import { CONSTRAINT_TEXT, formatScore, happinessColor } from '../format'
import { Help } from './ui'

/**
 * Who's worst off, the happiness distribution, and broken constraints for the seating on screen.
 */
export default function InsightsPanel({ scorer, onSelect }: { scorer: Scorer; onSelect: (guest: number) => void }) {
  const p = scorer.p
  const scores = Array.from(scorer.h, (h, g) => ({ g, h })).sort((a, b) => a.h - b.h)
  const violations = scorer.violations()

  // Histogram buckets: below 0, then one per point up to 10+
  const buckets = [{ label: '<0', from: -Infinity, to: 0 }, ...Array.from({ length: 10 }, (_, i) => ({ label: `${i}`, from: i, to: i + 1 })), { label: '10+', from: 10, to: Infinity }]
  const counts = buckets.map((b) => scores.filter((s) => s.h >= b.from && s.h < b.to).length)
  const maxCount = Math.max(1, ...counts)

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div>
        <div className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold mb-2 flex items-center">
          Happiness distribution
          <Help text="How many guests fall in each happiness range. A long left tail means a few guests are being sacrificed" />
        </div>
        <div className="flex items-end gap-1 h-24">
          {counts.map((count, i) => (
            <div key={buckets[i].label} className="flex-1 flex flex-col items-center gap-1" title={`${count} guests`}>
              <div className="text-[9px] font-mono text-zinc-400">{count || ''}</div>
              <div
                className="w-full rounded-t"
                style={{
                  height: `${(count / maxCount) * 64}px`,
                  backgroundColor: happinessColor(Number.isFinite(buckets[i].from) ? buckets[i].from + 0.5 : -2),
                }}
              />
            </div>
          ))}
        </div>
        <div className="flex gap-1 mt-1">
          {buckets.map((b) => (
            <div key={b.label} className="flex-1 text-center text-[9px] font-mono text-zinc-400">
              {b.label}
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold mb-2 flex items-center">
          Least happy
          <Help text="The guests with the lowest happiness right now. Click one to see who they're near and their best swaps" />
        </div>
        <div className="space-y-0.5">
          {scores.slice(0, 7).map(({ g, h }) => (
            <button
              key={g}
              type="button"
              onClick={() => onSelect(g)}
              className="w-full flex items-center justify-between gap-2 px-1.5 py-0.5 rounded hover:bg-zinc-50 text-xs cursor-pointer"
            >
              <span className="flex items-center gap-2 truncate">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: happinessColor(h) }} />
                <span className="truncate">{p.guestNames[g]}</span>
              </span>
              <span className="font-mono text-zinc-600">{formatScore(h)}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold mb-2 flex items-center gap-1">
          <Help text="Hard rules this seating breaks, each costing the hard constraint penalty. Includes the default that parties of two sit together, when it's on" align="right" />
          Broken constraints {violations.length > 0 && <span className="text-red-600">({violations.length})</span>}
        </div>
        {violations.length === 0 ? (
          <p className="text-xs text-emerald-700">✓ Every hard constraint is satisfied.</p>
        ) : (
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {violations.map((v, i) => (
              <button
                key={i}
                type="button"
                onClick={() => onSelect(v.guests[0])}
                className="w-full text-left text-xs text-red-800 hover:bg-red-50 rounded px-1.5 py-0.5 cursor-pointer"
              >
                {p.guestNames[v.guests[0]]} {CONSTRAINT_TEXT[v.kind]}
                {v.guests[1] !== undefined ? ` ${p.guestNames[v.guests[1]]}` : ''}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
