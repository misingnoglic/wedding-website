'use client'

import { useState } from 'react'
import { ALGORITHMS, AlgorithmId } from '@/lib/seatingSolver/algorithms'
import { BenchmarkRow } from '@/lib/seatingSolver/runner'
import { formatCount, formatScore } from '../format'
import { Label, NumberField, Segmented } from './ui'

export type BenchmarkResult = BenchmarkRow & { guestAt: Int32Array }

interface BenchmarkPanelProps {
  results: BenchmarkResult[]
  running: boolean
  disabled: boolean // A regular run is in progress
  onStart: (config: { algorithms: AlgorithmId[]; runs: number; seconds: number; startFrom: 'current' | 'greedy' | 'random'; fitToTime: boolean }) => void
  onCancel: () => void
  onLoad: (result: BenchmarkResult) => void
}

/**
 * Races the algorithms (with their current settings) for the same time on the same seating and
 * ranks them, like the benchmark in the n-queens visualizer.
 */
export default function BenchmarkPanel({ results, running, disabled, onStart, onCancel, onLoad }: BenchmarkPanelProps) {
  const [selected, setSelected] = useState<Set<AlgorithmId>>(() => new Set(ALGORITHMS.map((a) => a.id)))
  const [runs, setRuns] = useState(2)
  const [seconds, setSeconds] = useState(4)
  const [startFrom, setStartFrom] = useState<'current' | 'greedy' | 'random'>('random')
  const [fitToTime, setFitToTime] = useState(true)

  const byAlgorithm = ALGORITHMS.filter((a) => results.some((r) => r.algorithm === a.id)).map((a) => {
    const rows = results.filter((r) => r.algorithm === a.id)
    const best = rows.reduce((top, r) => (r.best > top.best ? r : top))
    const mean = rows.reduce((sum, r) => sum + r.best, 0) / rows.length
    const worst = Math.min(...rows.map((r) => r.best))
    const evaluations = rows.reduce((sum, r) => sum + r.evaluations, 0) / rows.length
    return { spec: a, rows, best, mean, worst, evaluations }
  })
  byAlgorithm.sort((a, b) => b.mean - a.mean)
  const top = Math.max(...byAlgorithm.map((r) => r.best.best), 0)
  const floor = Math.min(...byAlgorithm.map((r) => r.worst), top)
  const barWidth = (v: number) => `${Math.max(4, ((v - floor) / (top - floor || 1)) * 100)}%`
  const expected = selected.size * runs
  const totalSeconds = expected * seconds

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[260px_minmax(0,1fr)] gap-5">
      <div className="space-y-2.5">
        <div className="flex flex-wrap gap-1.5">
          {ALGORITHMS.map((a) => (
            <button
              key={a.id}
              type="button"
              disabled={running}
              onClick={() =>
                setSelected((prev) => {
                  const next = new Set(prev)
                  if (next.has(a.id)) next.delete(a.id)
                  else next.add(a.id)
                  return next
                })
              }
              className={`px-2.5 py-1 rounded-full text-[11px] border cursor-pointer disabled:cursor-not-allowed ${
                selected.has(a.id) ? 'bg-black text-white border-black' : 'bg-white text-zinc-500 border-zinc-200'
              }`}
            >
              {a.name}
            </button>
          ))}
        </div>
        <NumberField label="Seconds per run" help="Wall-clock time each algorithm gets per run" value={seconds} min={1} max={60} step={1} onChange={setSeconds} disabled={running} />
        <NumberField label="Runs each (different seeds)" help="Repeat each algorithm with different seeds; more runs show how consistent it is, not just how lucky" value={runs} min={1} max={10} step={1} onChange={setRuns} disabled={running} />
        <Label className="text-xs text-zinc-600" text="Each run starts from" help="The same start for every algorithm. Random uses a different shuffle per seed, which tests how well each algorithm recovers from a bad seating" />
        <Segmented
          value={startFrom}
          onChange={setStartFrom}
          disabled={running}
          options={[
            { value: 'current', label: 'Current', title: 'The seating on screen' },
            { value: 'greedy', label: 'Greedy', title: 'Tables built outward from their most connected guests' },
            { value: 'random', label: 'Random', title: 'A fresh shuffle per seed' },
          ]}
        />
        <label className="flex items-start gap-2 text-xs text-zinc-600 cursor-pointer">
          <input type="checkbox" checked={fitToTime} disabled={running} onChange={(e) => setFitToTime(e.target.checked)} className="accent-black mt-0.5" />
          <Label
            text="Fit each schedule to the time limit"
            help="Measures each algorithm's speed, then sizes its iterations so its whole schedule (e.g. annealing's cooling) fits the time limit. Without it, long schedules get cut off mid-run and look worse than they are"
          />
        </label>
        {running ? (
          <button type="button" onClick={onCancel} className="w-full px-3 py-2 rounded-xl border border-zinc-200 text-sm cursor-pointer hover:border-black">
            Cancel ({results.length} / {expected} runs)
          </button>
        ) : (
          <button
            type="button"
            disabled={disabled || selected.size === 0}
            onClick={() => onStart({ algorithms: ALGORITHMS.filter((a) => selected.has(a.id)).map((a) => a.id), runs, seconds, startFrom, fitToTime })}
            className="w-full px-3 py-2 rounded-xl bg-black text-white text-sm font-medium cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Race {selected.size} algorithm{selected.size === 1 ? '' : 's'} · ~{totalSeconds}s
          </button>
        )}
        <p className="text-[11px] text-zinc-400 font-karla leading-relaxed">
          Uses each algorithm&apos;s current settings from the panel on the left. Unless fitted, long schedules are simply cut off at the time limit.
        </p>
      </div>

      <div className="min-w-0">
        {byAlgorithm.length === 0 ? (
          <div className="h-full min-h-32 flex items-center justify-center text-xs text-zinc-400 font-karla text-center px-4">
            {running ? 'Racing… results appear as each run finishes.' : 'Race the algorithms to see which finds the best seating for your guests.'}
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead className="text-[10px] uppercase tracking-wider text-zinc-400">
              <tr>
                <th className="text-left font-semibold pb-2">Algorithm</th>
                <th className="text-left font-semibold pb-2 w-[35%]">Best run</th>
                <th className="text-right font-semibold pb-2" title="Average score across runs; the ranking uses this">
                  Mean
                </th>
                <th className="text-right font-semibold pb-2" title="The lowest score of any run">
                  Worst
                </th>
                <th className="text-right font-semibold pb-2" title="Swaps evaluated per run, a measure of how much work it did">
                  Evals / run
                </th>
                <th />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {byAlgorithm.map((r, i) => (
                <tr key={r.spec.id}>
                  <td className="py-2 pr-2">
                    <div className="font-medium text-black">
                      {i === 0 && byAlgorithm.length > 1 ? '🏆 ' : ''}
                      {r.spec.name}
                    </div>
                    <div className="text-[10px] text-zinc-400">
                      {r.rows.length} run{r.rows.length === 1 ? '' : 's'}
                      {r.rows.every((row) => row.finished) ? ' · finished early' : ''}
                    </div>
                  </td>
                  <td className="py-2 pr-3">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-zinc-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${i === 0 ? 'bg-black' : 'bg-zinc-400'}`} style={{ width: barWidth(r.best.best) }} />
                      </div>
                      <span className="font-mono font-semibold w-12 text-right">{formatScore(r.best.best)}</span>
                    </div>
                  </td>
                  <td className="py-2 text-right font-mono">{formatScore(r.mean)}</td>
                  <td className="py-2 text-right font-mono text-zinc-500">{formatScore(r.worst)}</td>
                  <td className="py-2 text-right font-mono text-zinc-500">{formatCount(r.evaluations)}</td>
                  <td className="py-2 pl-3 text-right">
                    <button type="button" onClick={() => onLoad(r.best)} className="text-zinc-500 hover:text-black cursor-pointer whitespace-nowrap">
                      Show seating
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
