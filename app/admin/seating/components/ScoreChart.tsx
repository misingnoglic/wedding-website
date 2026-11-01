'use client'

import { HistoryPoint } from '@/lib/seatingSolver/runner'
import { formatCount, formatScore } from '../format'

const W = 600
const H = 180
const PAD = { left: 48, right: 12, top: 12, bottom: 24 }

/**
 * Current and best score over the run, with temperature (when the algorithm has one) as a faint
 * area on its own scale.
 */
export default function ScoreChart({ history }: { history: HistoryPoint[] }) {
  if (history.length < 2) {
    return (
      <div className="h-[180px] flex items-center justify-center text-xs text-zinc-400 font-karla">
        Run an algorithm to watch the score climb.
      </div>
    )
  }

  const maxX = history[history.length - 1].evaluations || 1
  const values = history.flatMap((p) => [p.current, p.best])
  // Early random seatings can be hugely negative; clip the axis so the interesting part is visible
  const best = Math.max(...values)
  const sorted = [...values].sort((a, b) => a - b)
  const low = Math.min(sorted[Math.floor(sorted.length * 0.05)], best - 1)
  const range = best - low || 1
  const minY = low - range * 0.05
  const maxY = best + range * 0.08
  const temps = history.map((p) => p.temperature).filter((t): t is number => t !== undefined)
  const maxT = temps.length ? Math.max(...temps) : 0

  const x = (v: number) => PAD.left + (v / maxX) * (W - PAD.left - PAD.right)
  const y = (v: number) => PAD.top + (1 - (Math.max(minY, v) - minY) / (maxY - minY)) * (H - PAD.top - PAD.bottom)
  const path = (key: 'current' | 'best') => history.map((p, i) => `${i ? 'L' : 'M'}${x(p.evaluations).toFixed(1)},${y(p[key]).toFixed(1)}`).join('')
  const tempArea =
    maxT > 0
      ? `M${x(history[0].evaluations)},${H - PAD.bottom}` +
        history.map((p) => `L${x(p.evaluations).toFixed(1)},${(H - PAD.bottom - ((p.temperature ?? 0) / maxT) * (H - PAD.top - PAD.bottom) * 0.9).toFixed(1)}`).join('') +
        `L${x(maxX)},${H - PAD.bottom}Z`
      : null
  const ticks = [minY + (maxY - minY) * 0.1, (minY + maxY) / 2, maxY - (maxY - minY) * 0.1]

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Score over time">
      {tempArea && <path d={tempArea} className="fill-sky-100" />}
      {ticks.map((t) => (
        <g key={t}>
          <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} className="stroke-zinc-100" />
          <text x={PAD.left - 6} y={y(t) + 4} textAnchor="end" className="fill-zinc-400 text-[10px] font-mono">
            {formatScore(t, 0)}
          </text>
        </g>
      ))}
      <path d={path('current')} fill="none" className="stroke-zinc-300" strokeWidth={1.25} vectorEffect="non-scaling-stroke" />
      <path d={path('best')} fill="none" className="stroke-black" strokeWidth={2} vectorEffect="non-scaling-stroke" />
      <text x={W - PAD.right} y={H - 6} textAnchor="end" className="fill-zinc-400 text-[10px] font-mono">
        {formatCount(maxX)} evaluations
      </text>
    </svg>
  )
}
