'use client'

import { ALGORITHMS, AlgorithmId, ParamValue, Params } from '@/lib/seatingSolver/algorithms'
import { SPEEDS } from '@/lib/seatingSolver/runner'
import { Help, Label, NumberField, Segmented } from './ui'

export type RunStatus = 'idle' | 'running' | 'paused' | 'done'
export type StartFrom = 'current' | 'greedy' | 'random'

interface AlgorithmPanelProps {
  algorithm: AlgorithmId
  onAlgorithmChange: (id: AlgorithmId) => void
  params: Params
  onParamsChange: (params: Params) => void
  startFrom: StartFrom
  onStartFromChange: (value: StartFrom) => void
  seed: number
  onSeedChange: (seed: number) => void
  speed: number
  onSpeedChange: (speed: number) => void
  status: RunStatus
  runDisabled?: boolean // e.g. while an algorithm comparison is using the worker
  onRun: () => void
  onPause: () => void
  onResume: () => void
  onStep: () => void
  onStop: () => void
}

export default function AlgorithmPanel({
  algorithm,
  onAlgorithmChange,
  params,
  onParamsChange,
  startFrom,
  onStartFromChange,
  seed,
  onSeedChange,
  speed,
  onSpeedChange,
  status,
  runDisabled,
  onRun,
  onPause,
  onResume,
  onStep,
  onStop,
}: AlgorithmPanelProps) {
  const spec = ALGORITHMS.find((a) => a.id === algorithm)!
  const busy = status === 'running' || status === 'paused'
  const setParam = (key: string, value: ParamValue) => onParamsChange({ ...params, [key]: value })

  return (
    <section className="bg-white rounded-2xl border border-zinc-200/80 shadow-sm p-4 space-y-3">
      <div className="text-[11px] uppercase tracking-wider font-semibold text-zinc-500 inline-flex items-center">
        Algorithm
        <Help text="The search strategy. Each one tries swapping guests and keeps changes that raise the objective. They differ in when they accept a worse seating to escape a dead end." />
      </div>
      <select
        value={algorithm}
        disabled={busy}
        onChange={(e) => onAlgorithmChange(e.target.value as AlgorithmId)}
        className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm bg-white disabled:opacity-50"
      >
        {ALGORITHMS.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
          </option>
        ))}
      </select>
      <p className="text-xs text-zinc-500 font-karla leading-relaxed">{spec.description}</p>

      <div className="space-y-2">
        {spec.params.map((p) => {
          const value = params[p.key] ?? p.default
          if (p.type === 'number') {
            return (
              <NumberField
                key={p.key}
                label={p.label}
                help={p.help}
                value={Number(value)}
                min={p.min}
                max={p.max}
                step={p.step}
                disabled={busy}
                onChange={(v) => setParam(p.key, v)}
              />
            )
          }
          if (p.type === 'select') {
            return (
              <label key={p.key} className="flex items-center justify-between gap-3 text-xs">
                <Label text={p.label} help={p.help} />
                <select
                  value={String(value)}
                  disabled={busy}
                  onChange={(e) => setParam(p.key, e.target.value)}
                  className="border border-zinc-200 rounded-lg px-2 py-1 text-xs bg-white disabled:opacity-50"
                >
                  {p.options.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
            )
          }
          return (
            <label key={p.key} className="flex items-center justify-between gap-3 text-xs">
              <Label text={p.label} help={p.help} />
              <input type="checkbox" checked={Boolean(value)} disabled={busy} onChange={(e) => setParam(p.key, e.target.checked)} className="accent-black" />
            </label>
          )
        })}
      </div>

      <div className="border-t border-zinc-100 pt-3 space-y-2">
        <Label
          className="text-xs text-zinc-600"
          text="Start from"
          help="The seating the run begins with. Random gives a fresh shuffle for each seed, so different seeds explore differently. Locked guests always stay put."
        />
        <Segmented<StartFrom>
          value={startFrom}
          disabled={busy}
          onChange={onStartFromChange}
          options={[
            { value: 'current', label: 'Current', title: 'Improve the seating on screen' },
            { value: 'greedy', label: 'Greedy', title: 'Build tables outward from their most connected guests, honoring hard rules' },
            { value: 'random', label: 'Random', title: 'A fresh shuffle from the seed (locked guests stay put)' },
          ]}
        />
        <div className="flex items-center justify-between gap-2 text-xs">
          <Label text="Random seed" help="Drives every random choice. The same seed, settings and start give the same result; roll the die for a new one." />
          <div className="flex items-center gap-1">
            <input
              type="number"
              value={seed}
              disabled={busy}
              onChange={(e) => onSeedChange(Number(e.target.value) || 0)}
              className="w-24 border border-zinc-200 rounded-lg px-2 py-1 text-right font-mono text-xs disabled:opacity-40"
            />
            <button
              type="button"
              title="New seed"
              disabled={busy}
              onClick={() => onSeedChange(Math.floor(Math.random() * 1_000_000))}
              className="px-2 py-1 rounded-lg border border-zinc-200 hover:border-black cursor-pointer disabled:opacity-40"
            >
              🎲
            </button>
          </div>
        </div>
      </div>

      <div className="border-t border-zinc-100 pt-3 space-y-1">
        <div className="flex items-center justify-between text-xs">
          <Label
            text="Speed"
            help="How fast the run plays. Watch and Slow animate individual swaps; Max runs flat out and updates the tables a few times a second. Can change mid-run."
          />
          <span className="font-medium text-zinc-900">{SPEEDS[speed - 1].label}</span>
        </div>
        <input
          type="range"
          min={1}
          max={SPEEDS.length}
          step={1}
          value={speed}
          onChange={(e) => onSpeedChange(Number(e.target.value))}
          className="w-full accent-black"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        {!busy ? (
          <button
            type="button"
            onClick={onRun}
            disabled={runDisabled}
            className="col-span-2 px-4 py-2.5 rounded-xl bg-black text-white text-sm font-medium cursor-pointer hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {runDisabled ? 'Comparison running…' : `▶ Run ${spec.name.toLowerCase()}`}
          </button>
        ) : (
          <>
            {status === 'running' ? (
              <button type="button" onClick={onPause} title="Pause the run; Step then advances it a little at a time" className="px-3 py-2 rounded-xl bg-black text-white text-sm font-medium cursor-pointer">
                ❚❚ Pause
              </button>
            ) : (
              <button type="button" onClick={onResume} className="px-3 py-2 rounded-xl bg-black text-white text-sm font-medium cursor-pointer">
                ▶ Resume
              </button>
            )}
            <button
              type="button"
              onClick={onStep}
              title="Advance the paused run by one update"
              disabled={status !== 'paused'}
              className="px-3 py-2 rounded-xl border border-zinc-200 text-sm cursor-pointer hover:border-black disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Step
            </button>
            <button
              type="button"
              onClick={onStop}
              className="col-span-2 px-3 py-2 rounded-xl border border-zinc-200 text-sm cursor-pointer hover:border-black"
              title="Stop and keep the best seating found so far"
            >
              ■ Stop &amp; keep best
            </button>
          </>
        )}
      </div>
    </section>
  )
}
