'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { buildAffinityMap, isInSeatingPool, partyPairConstraints } from '@/lib/seating'
import {
  ALGORITHMS,
  AlgorithmId,
  defaultParams,
  greedyAssignment,
  Params,
  polishAssignment,
  randomAssignment,
  SolverProgress,
} from '@/lib/seatingSolver/algorithms'
import { autoLayout, DEFAULT_PROXIMITY, LayoutConfig, seatCount } from '@/lib/seatingSolver/layout'
import { assignmentFromSeatKeys, buildProblem, DEFAULT_OBJECTIVE, happinessPotential, ObjectiveConfig, Problem } from '@/lib/seatingSolver/problem'
import { HistoryPoint, RunnerMessage, SPEEDS } from '@/lib/seatingSolver/runner'
import { Scorer } from '@/lib/seatingSolver/scorer'
import { deleteSeatingPlan, saveSeatingPlan, saveSeatingSettings } from '../../actions/seating'
import AlgorithmPanel, { RunStatus, StartFrom } from './components/AlgorithmPanel'
import BenchmarkPanel, { BenchmarkResult } from './components/BenchmarkPanel'
import GuestInspector from './components/GuestInspector'
import InsightsPanel from './components/InsightsPanel'
import ObjectivePanel from './components/ObjectivePanel'
import PlansPanel from './components/PlansPanel'
import ScoreChart from './components/ScoreChart'
import TableView, { TieMode } from './components/TableView'
import { Card, Segmented, Stat, Tip } from './components/ui'
import { formatCount, formatMetric, formatScore, happinessColor, shareColor, shortNames } from './format'
import { LabData, LabPlan } from './types'
import { useSolverEngine } from './useSolverEngine'

const HISTORY_LIMIT = 600
const ANIMATION_MS = [380, 320, 220, 90, 0] // By speed

function mergeObjective(saved: Partial<ObjectiveConfig> | undefined): ObjectiveConfig {
  return { ...DEFAULT_OBJECTIVE, ...saved, proximity: { ...DEFAULT_PROXIMITY, ...saved?.proximity } }
}

// A layout that fits everyone, keeping the saved shape where possible
function fitLayout(layout: Partial<LayoutConfig> | undefined, guestCount: number): LayoutConfig {
  const tables = layout?.tables ?? 2
  const heads = layout?.heads ?? true
  const candidate = { ...autoLayout(guestCount, tables, heads), ...layout }
  return seatCount(candidate) >= guestCount ? candidate : autoLayout(guestCount, tables, heads)
}

function toSeatMap(problem: Problem, guestAt: Int32Array): Map<string, string> {
  const map = new Map<string, string>()
  guestAt.forEach((token, s) => {
    if (token < problem.n) map.set(problem.guestIds[token], problem.seats[s].key)
  })
  return map
}

// Keep long runs' charts light: drop every other point once over the limit
function appendHistory(history: HistoryPoint[], points: HistoryPoint[]): HistoryPoint[] {
  let next = history.concat(points)
  while (next.length > HISTORY_LIMIT) next = next.filter((_, i) => i % 2 === 0 || i === next.length - 1)
  return next
}

export default function SeatingLab({ data }: { data: LabData }) {
  // ---- Inputs --------------------------------------------------------------------------------
  const poolGuests = useMemo(
    () => data.guests.filter(isInSeatingPool).sort((a, b) => a.familyName.localeCompare(b.familyName) || a.name.localeCompare(b.name)),
    [data.guests]
  )
  const affinityMap = useMemo(() => buildAffinityMap(poolGuests, data.groups, data.relationships, data.links), [poolGuests, data.groups, data.relationships, data.links])
  const headIds = useMemo(() => new Set(poolGuests.filter((g) => g.seatRequirement === 'HEAD').map((g) => g.id)), [poolGuests])
  const familyNames = useMemo(() => new Map(poolGuests.map((g) => [g.id, g.familyName])), [poolGuests])

  const [objective, setObjective] = useState<ObjectiveConfig>(() => mergeObjective(data.settings?.objective))
  const [layout, setLayout] = useState<LayoutConfig>(() => fitLayout(data.plans[0]?.config?.layout ?? data.settings?.layout, poolGuests.length))
  const relationships = useMemo(
    () => (objective.partyPairsAdjacent ? [...data.relationships, ...partyPairConstraints(poolGuests, data.relationships)] : data.relationships),
    [objective.partyPairsAdjacent, data.relationships, poolGuests]
  )
  const problem = useMemo(
    () => buildProblem({ guests: poolGuests, affinityMap, relationships, headIds, layout, objective }),
    [poolGuests, affinityMap, relationships, headIds, layout, objective]
  )

  // ---- Seating on screen ---------------------------------------------------------------------
  // Stored by seat key so it survives layout and weight changes. Opens on the latest saved plan,
  // or a polished greedy seating if there isn't one.
  const latestPlan = data.plans[0] ?? null
  const [seatByGuest, setSeatByGuest] = useState<Map<string, string>>(() => {
    if (latestPlan) return new Map(latestPlan.assignments.map((a) => [a.guestId, a.seatKey]))
    const none = new Uint8Array(problem.S)
    const greedy = greedyAssignment(problem, Int32Array.from({ length: problem.S }, (_, i) => i), none)
    return toSeatMap(problem, polishAssignment(problem, greedy, none, 40_000, 1))
  })
  const [lockedGuests, setLockedGuests] = useState<Set<string>>(
    () => new Set(latestPlan?.assignments.filter((a) => a.isLocked).map((a) => a.guestId) ?? [])
  )
  const guestAt = useMemo(() => assignmentFromSeatKeys(problem, seatByGuest), [problem, seatByGuest])
  const labels = useMemo(() => shortNames(problem.guestNames), [problem.guestNames])
  const potential = useMemo(() => happinessPotential(problem), [problem])
  const scorer = useMemo(() => new Scorer(problem, guestAt), [problem, guestAt])
  const lockedSeats = useMemo(() => {
    const seats = new Set<number>()
    problem.guestIds.forEach((id, g) => lockedGuests.has(id) && seats.add(scorer.seatOf[g]))
    return seats
  }, [problem, lockedGuests, scorer])
  const lockedArray = () => {
    const locked = new Uint8Array(problem.S)
    lockedSeats.forEach((s) => (locked[s] = 1))
    return locked
  }
  const violations = useMemo(() => scorer.violations(), [scorer])
  const violatingGuests = useMemo(() => new Set(violations.flatMap((v) => v.guests)), [violations])

  // ---- UI state ------------------------------------------------------------------------------
  const [selectedGuest, setSelectedGuest] = useState<number | null>(null)
  const [tieMode, setTieMode] = useState<TieMode>('selected')
  const [colorBy, setColorBy] = useState<'raw' | 'share'>('raw') // Display only; scoring always uses raw happiness
  const [highlight, setHighlight] = useState('') // 'group:<id>' or 'family:<id>'
  const [algorithm, setAlgorithm] = useState<AlgorithmId>('kernighanLin') // Best and fastest in tuning on the real guest list
  const [paramsById, setParamsById] = useState<Record<string, Params>>(() =>
    Object.fromEntries(ALGORITHMS.map((a) => [a.id, defaultParams(a.id)]))
  )
  const [startFrom, setStartFrom] = useState<StartFrom>('random')
  const [seed, setSeed] = useState(1)
  const [speed, setSpeed] = useState(SPEEDS.length) // Max
  const [loadedPlanId, setLoadedPlanId] = useState<string | null>(latestPlan?.id ?? null)
  const [source, setSource] = useState<string>(latestPlan?.source ?? 'MANUAL')
  const [flash, setFlash] = useState<{ tone: 'good' | 'bad'; text: string } | null>(null)
  const [isSaving, startSaving] = useTransition()
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const notify = useCallback((tone: 'good' | 'bad', text: string) => {
    if (flashTimer.current) clearTimeout(flashTimer.current)
    setFlash({ tone, text })
    flashTimer.current = setTimeout(() => setFlash(null), 4000)
  }, [])

  // ---- Solver runs ---------------------------------------------------------------------------
  const [status, setStatus] = useState<RunStatus>('idle')
  const [progress, setProgress] = useState<SolverProgress | null>(null)
  const [history, setHistory] = useState<HistoryPoint[]>([])
  const [rate, setRate] = useState(0)
  const runProblem = useRef<Problem | null>(null)
  const bestAt = useRef<Int32Array | null>(null)
  const accepting = useRef(false)

  // ---- Algorithm comparison -----------------------------------------------------------------
  const [benchResults, setBenchResults] = useState<BenchmarkResult[]>([])
  const [benchRunning, setBenchRunning] = useState(false)
  const benchProblem = useRef<Problem | null>(null)

  const engine = useSolverEngine((message: RunnerMessage) => {
    if (message.type === 'benchmarkRow') {
      setBenchResults((rows) => [...rows, { ...message.row, guestAt: message.guestAt }])
      return
    }
    if (message.type === 'benchmarkDone') {
      setBenchRunning(false)
      return
    }
    if (message.type === 'error' && benchRunning) {
      setBenchRunning(false)
      notify('bad', `Comparison failed: ${message.message}`)
      return
    }
    if (!accepting.current) return
    if (message.type === 'error') {
      accepting.current = false
      setStatus('idle')
      notify('bad', `Solver error: ${message.message}`)
      return
    }
    const p = runProblem.current!
    bestAt.current = message.bestGuestAt
    setSeatByGuest(toSeatMap(p, message.guestAt))
    setProgress(message.progress)
    setRate(message.evaluationsPerSecond)
    setHistory((h) => appendHistory(h, message.history))
    if (message.progress.done) {
      accepting.current = false
      setStatus('done')
    } else {
      setStatus(message.paused ? 'paused' : 'running')
    }
  })
  const busy = status === 'running' || status === 'paused'

  const startBenchmark = (config: { algorithms: AlgorithmId[]; runs: number; seconds: number; startFrom: StartFrom; fitToTime: boolean }) => {
    benchProblem.current = problem
    setBenchResults([])
    setBenchRunning(true)
    engine.post({
      type: 'benchmark',
      problem,
      entries: config.algorithms.map((id) => ({ algorithm: id, params: paramsById[id] })),
      runs: config.runs,
      timeMs: config.seconds * 1000,
      startFrom: config.startFrom,
      fitToTime: config.fitToTime,
      guestAt,
      locked: lockedArray(),
      seed,
    })
  }
  // The Run card describes the last run; clear it when the seating comes from somewhere else
  const clearRun = () => {
    setProgress(null)
    setHistory([])
    setStatus('idle')
  }

  const showBenchmarkResult = (result: BenchmarkResult) => {
    const p = benchProblem.current
    if (!p) return
    if (busy) stop()
    clearRun()
    setSeatByGuest(toSeatMap(p, result.guestAt))
    setSource(result.algorithm)
    notify('good', `Showing the best ${ALGORITHMS.find((a) => a.id === result.algorithm)?.name.toLowerCase()} seating (${formatScore(result.best)})`)
  }

  const run = () => {
    const locked = lockedArray()
    const start =
      startFrom === 'greedy' ? greedyAssignment(problem, guestAt, locked) : startFrom === 'random' ? randomAssignment(problem, guestAt, locked, seed) : Int32Array.from(guestAt)
    runProblem.current = problem
    bestAt.current = start
    accepting.current = true
    setHistory([])
    setProgress(null)
    setStatus('running')
    setSource(algorithm)
    engine.post({ type: 'start', problem, algorithm, params: paramsById[algorithm], guestAt: start, locked, seed, speed })
  }
  const stop = () => {
    accepting.current = false
    engine.post({ type: 'stop' })
    if (runProblem.current && bestAt.current) setSeatByGuest(toSeatMap(runProblem.current, bestAt.current))
    setStatus('idle')
  }

  // Changing the tables mid-run would scramble seat keys, so stop first
  const changeLayout = (next: LayoutConfig) => {
    if (busy) stop()
    setLayout(seatCount(next) >= poolGuests.length ? next : fitLayout(next, poolGuests.length))
  }

  // ---- Manual edits --------------------------------------------------------------------------
  const swapSeats = (a: number, b: number) => {
    if (busy || lockedSeats.has(a) || lockedSeats.has(b)) return
    const next = Int32Array.from(guestAt)
    const t = next[a]
    next[a] = next[b]
    next[b] = t
    setSeatByGuest(toSeatMap(problem, next))
  }
  const toggleLock = (g: number) => {
    const id = problem.guestIds[g]
    setLockedGuests((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedGuest(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // ---- Plans & settings ----------------------------------------------------------------------
  const planScores = useMemo(() => {
    const scores = new Map<string, number>()
    for (const plan of data.plans) {
      const seats = new Map(plan.assignments.map((a) => [a.guestId, a.seatKey]))
      scores.set(plan.id, new Scorer(problem, assignmentFromSeatKeys(problem, seats)).total)
    }
    return scores
  }, [data.plans, problem])

  const loadPlan = (plan: LabPlan) => {
    if (busy) stop()
    clearRun()
    if (plan.config?.layout) setLayout(fitLayout(plan.config.layout, poolGuests.length))
    setSeatByGuest(new Map(plan.assignments.map((a) => [a.guestId, a.seatKey])))
    setLockedGuests(new Set(plan.assignments.filter((a) => a.isLocked).map((a) => a.guestId)))
    setLoadedPlanId(plan.id)
    setSource(plan.source)
    notify('good', `Loaded “${plan.name}”`)
  }

  const savePlan = (name: string, overwriteId: string | null) => {
    const assignments = problem.seats.flatMap((seat, s) => {
      const token = guestAt[s]
      if (token >= problem.n) return []
      const guestId = problem.guestIds[token]
      return [{ seatKey: seat.key, guestId, isLocked: lockedGuests.has(guestId) }]
    })
    startSaving(async () => {
      const result = await saveSeatingPlan({
        id: overwriteId ?? undefined,
        name,
        source,
        config: { objective, layout },
        params: { algorithm, params: paramsById[algorithm], seed },
        score: scorer.total,
        assignments,
      })
      if ('error' in result) return notify('bad', result.error)
      setLoadedPlanId(result.id)
      notify('good', overwriteId ? `Updated “${name}”` : `Saved “${name}”`)
    })
  }

  const deletePlan = (plan: LabPlan) =>
    startSaving(async () => {
      const result = await deleteSeatingPlan(plan.id)
      if ('error' in result) return notify('bad', result.error)
      if (loadedPlanId === plan.id) setLoadedPlanId(null)
      notify('good', `Deleted “${plan.name}”`)
    })

  const saveDefaults = () =>
    startSaving(async () => {
      const result = await saveSeatingSettings({ objective, layout })
      notify('error' in result ? 'bad' : 'good', 'error' in result ? result.error : 'Saved as the defaults for next time')
    })

  // ---- Summary -------------------------------------------------------------------------------
  const happiness = scorer.h
  let total = 0
  let min = Infinity
  let belowFloor = 0
  happiness.forEach((h) => {
    total += h
    min = Math.min(min, h)
    if (h < objective.minHappiness) belowFloor++
  })
  const excludedCount = data.guests.length - poolGuests.length

  const highlightOptions = useMemo(() => {
    const parties = new Map<string, string>()
    poolGuests.forEach((g) => parties.set(g.familyId, g.familyName))
    return {
      groups: data.groups.filter((g) => g.memberIds.length > 0),
      parties: [...parties.entries()].sort((a, b) => a[1].localeCompare(b[1])),
    }
  }, [data.groups, poolGuests])
  const highlighted = useMemo(() => {
    if (!highlight) return null
    const [kind, id] = highlight.split(':')
    const ids = new Set(
      kind === 'group' ? data.groups.find((g) => g.id === id)?.memberIds ?? [] : poolGuests.filter((g) => g.familyId === id).map((g) => g.id)
    )
    return new Set(problem.guestIds.flatMap((guestId, g) => (ids.has(guestId) ? [g] : [])))
  }, [highlight, data.groups, poolGuests, problem])

  return (
    <div className="w-full max-w-[2000px] mx-auto px-4 py-6 space-y-4 bg-sand/20 min-h-screen">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <Link href="/admin?tab=seating" className="text-xs text-zinc-500 hover:text-black">
            ← Seating ratings
          </Link>
          <h1 className="text-2xl font-semibold text-black tracking-tight">Seating Lab</h1>
          <p className="text-xs text-zinc-500 font-karla">
            {poolGuests.length} guests across {layout.tables} tables · {excludedCount} not seated (excluded or declined). Drag a guest onto any seat to
            swap; click to inspect.
          </p>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-2 bg-white rounded-2xl border border-zinc-200/80 shadow-sm px-5 py-3">
          <Stat
            label="Objective"
            value={formatScore(scorer.total)}
            hint="What the algorithms maximize: everyone's happiness after the fairness rule, plus head bonuses, minus penalties for broken rules and missing acquaintances"
            side="bottom"
            align="right"
          />
          <Stat
            label="Total happiness"
            value={formatScore(total)}
            hint="Sum of every guest's happiness: rating × proximity weight, over everyone they have a rating with"
            side="bottom"
            align="right"
          />
          <Stat
            label="Least happy"
            value={formatScore(min)}
            tone={min < objective.minHappiness ? 'warn' : 'good'}
            hint="The lowest happiness of any guest. Click their name under Insights to see why"
            side="bottom"
            align="right"
          />
          <Stat
            label={`Below ${objective.minHappiness}`}
            value={belowFloor}
            tone={belowFloor ? 'warn' : 'good'}
            hint="Guests under the minimum happiness set in Fairness & modifiers"
            side="bottom"
            align="right"
          />
          <Stat
            label="Broken rules"
            value={violations.length}
            tone={violations.length ? 'bad' : 'good'}
            hint="Hard constraints the seating breaks: must (not) sit next to, same or different table, must sit at a head. Listed under Insights"
            side="bottom"
            align="right"
          />
        </div>
      </div>

      {flash && (
        <div className={`px-4 py-2.5 rounded-xl text-sm border ${flash.tone === 'good' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
          {flash.text}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)] 2xl:grid-cols-[300px_minmax(0,1fr)_330px] gap-4 items-start">
        {/* Controls */}
        <aside className="space-y-3 lg:row-span-2">
          <AlgorithmPanel
            algorithm={algorithm}
            onAlgorithmChange={setAlgorithm}
            params={paramsById[algorithm]}
            onParamsChange={(params) => setParamsById((prev) => ({ ...prev, [algorithm]: params }))}
            startFrom={startFrom}
            onStartFromChange={setStartFrom}
            seed={seed}
            onSeedChange={setSeed}
            speed={speed}
            onSpeedChange={(s) => {
              setSpeed(s)
              if (busy) engine.post({ type: 'speed', speed: s })
            }}
            status={status}
            runDisabled={benchRunning}
            onRun={run}
            onPause={() => engine.post({ type: 'pause' })}
            onResume={() => {
              engine.post({ type: 'resume' })
              setStatus('running')
            }}
            onStep={() => engine.post({ type: 'step' })}
            onStop={stop}
          />
          <ObjectivePanel
            objective={objective}
            onObjectiveChange={setObjective}
            layout={layout}
            onLayoutChange={changeLayout}
            guestCount={poolGuests.length}
            onSaveDefaults={saveDefaults}
            savingDefaults={isSaving}
          />
        </aside>

        {/* Tables + run */}
        <div className="space-y-4 min-w-0">
          <Card
            title="Tables"
            help="Each circle is a guest, colored by happiness. Drag a guest onto another seat to swap them; the badge previews the change in objective. Click a guest to inspect them."
            actions={
              <div className="flex flex-wrap items-center justify-end gap-3">
                <div className="hidden md:flex items-center gap-1.5 text-[10px] text-zinc-500 font-mono">
                  {colorBy === 'raw'
                    ? [-2, 0, 2, 5, 10].map((h) => (
                        <span key={h} className="flex items-center gap-1">
                          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: happinessColor(h) }} />
                          {h}
                        </span>
                      ))
                    : [0, 0.25, 0.5, 0.75, 1].map((share) => (
                        <span key={share} className="flex items-center gap-1">
                          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: shareColor(share) }} />
                          {share * 100}%
                        </span>
                      ))}
                  <span className="ml-2">♛ head · 🔒 locked · <span className="text-red-600">◯</span> broken rule</span>
                </div>
                <div className="w-44 whitespace-nowrap">
                  <Segmented<'raw' | 'share'>
                    value={colorBy}
                    onChange={setColorBy}
                    options={[
                      { value: 'raw', label: 'Raw', title: 'Color and number show each guest’s happiness' },
                      {
                        value: 'share',
                        label: '% of best',
                        title:
                          'Normalize for how many friends each guest has here: show happiness as a share of the best they could possibly get (their favorite people in the closest seats). Gray means nobody they rated positively is coming. Display only; scoring is unchanged',
                      },
                    ]}
                  />
                </div>
                <Tip text="Ring the members of a group or party and fade everyone else, to see where they ended up" align="right">
                  <select
                    value={highlight}
                    onChange={(e) => setHighlight(e.target.value)}
                    className="border border-zinc-200 rounded-lg px-2 py-1 text-xs bg-white max-w-44"
                    aria-label="Highlight a group or party"
                  >
                    <option value="">Highlight…</option>
                    <optgroup label="Groups">
                      {highlightOptions.groups.map((g) => (
                        <option key={g.id} value={`group:${g.id}`}>
                          {g.name}
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="Parties">
                      {highlightOptions.parties.map(([id, name]) => (
                        <option key={id} value={`family:${id}`}>
                          {name}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </Tip>
                <div className="w-48">
                  <Segmented<TieMode>
                    value={tieMode}
                    onChange={setTieMode}
                    options={[
                      { value: 'off', label: 'No ties', title: 'Hide the lines between guests' },
                      { value: 'selected', label: 'Selected', title: 'Lines from the selected (or dragged) guest to everyone they have a rating with; green is positive, dashed red is negative' },
                      { value: 'strong', label: 'All +2', title: 'With nobody selected, lines between every pair rated +2 or more who share a table' },
                    ]}
                  />
                </div>
              </div>
            }
          >
            <TableView
              problem={problem}
              guestAt={guestAt}
              happiness={happiness}
              potential={colorBy === 'share' ? potential : null}
              labels={labels}
              selectedGuest={selectedGuest}
              lockedSeats={lockedSeats}
              violatingGuests={violatingGuests}
              highlighted={highlighted}
              tieMode={tieMode}
              animationMs={busy || status === 'done' ? ANIMATION_MS[speed - 1] : 380}
              canEdit={!busy}
              deltaFor={(a, b) => scorer.swapDelta(a, b)}
              onSelectGuest={setSelectedGuest}
              onSwapSeats={(a, b) => {
                swapSeats(a, b)
                setSource((s) => (s === 'MANUAL' || s.endsWith('+MANUAL') ? s : `${s}+MANUAL`))
              }}
            />
          </Card>

          <Card
            title="Run"
            help="Progress of the current or last run. The chart plots the score of the seating being explored and the best found so far; for annealing, the shaded area is the temperature."
            actions={
              progress && (
                <span className="text-[11px] text-zinc-500 font-mono">
                  {formatCount(progress.evaluations)} evaluations
                  {rate > 0 && status === 'running' ? ` · ${formatCount(rate)}/s` : ''}
                  {status === 'done' ? ' · done' : status === 'paused' ? ' · paused' : ''}
                </span>
              )
            }
          >
            <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_240px] gap-4">
              <ScoreChart history={history} />
              <div className="space-y-2">
                {progress ? (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <Stat label="Current" value={formatScore(progress.current)} />
                      <Stat label="Best" value={formatScore(progress.best)} tone="good" />
                    </div>
                    <dl className="text-xs space-y-1">
                      {Object.entries(progress.metrics).map(([k, v]) => (
                        <div key={k} className="flex justify-between gap-2">
                          <dt className="text-zinc-500">{k}</dt>
                          <dd className="font-mono text-zinc-900">{k === 'Acceptance rate' && typeof v === 'number' ? `${(v * 100).toFixed(1)}%` : formatMetric(v)}</dd>
                        </div>
                      ))}
                    </dl>
                    <div className="flex items-center gap-3 text-[10px] text-zinc-400">
                      <span className="flex items-center gap-1">
                        <span className="w-3 h-0.5 bg-black" /> best
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="w-3 h-0.5 bg-zinc-300" /> current
                      </span>
                      {history.some((p) => p.temperature !== undefined) && (
                        <span className="flex items-center gap-1">
                          <span className="w-3 h-2 bg-sky-100" /> temperature
                        </span>
                      )}
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-zinc-500 font-karla leading-relaxed">
                    Pick an algorithm on the left and press Run. At the slower speeds you can watch guests trade seats; the chart tracks the
                    current and best score.
                  </p>
                )}
              </div>
            </div>
          </Card>

          <Card title="Insights" help="How happiness is spread across guests, who is least happy, and which hard rules are broken. Click a name to inspect that guest.">
            <InsightsPanel scorer={scorer} onSelect={setSelectedGuest} />
          </Card>

          <Card
            title="Compare algorithms"
            help="Runs each selected algorithm for the same time from the same start and ranks them by score. Doesn't change the seating on screen until you press Show seating."
          >
            <BenchmarkPanel
              results={benchResults}
              running={benchRunning}
              disabled={busy}
              onStart={startBenchmark}
              onCancel={() => engine.post({ type: 'cancelBenchmark' })}
              onLoad={showBenchmarkResult}
            />
          </Card>
        </div>

        {/* Inspector + plans */}
        <div className="space-y-4 lg:col-start-2 2xl:col-start-3 2xl:row-start-1">
          <Card title="Guest" help="Why the selected guest is as happy as they are, the swaps that would help them most, and a lock to pin them to their seat during runs.">
            {selectedGuest === null ? (
              <p className="text-xs text-zinc-500 font-karla">Click a guest to see who makes them happy, their best swaps, and to lock their seat.</p>
            ) : (
              <GuestInspector
                scorer={scorer}
                guest={selectedGuest}
                potential={potential[selectedGuest]}
                familyName={familyNames.get(problem.guestIds[selectedGuest]) ?? ''}
                isLocked={lockedGuests.has(problem.guestIds[selectedGuest])}
                lockedSeats={lockedSeats}
                interactive={!busy}
                onToggleLock={() => toggleLock(selectedGuest)}
                onSelect={setSelectedGuest}
                onSwap={(a, b) => {
                  swapSeats(a, b)
                  setSource((s) => (s === 'MANUAL' || s.endsWith('+MANUAL') ? s : `${s}+MANUAL`))
                }}
                onClose={() => setSelectedGuest(null)}
              />
            )}
          </Card>
          <Card
            title="Saved seatings"
            help="Seatings saved to the database, with their locks. Scores are recomputed under the current weights so plans stay comparable after you change settings."
          >
            <PlansPanel
              plans={data.plans}
              loadedPlanId={loadedPlanId}
              currentScore={scorer.total}
              scoreUnderCurrent={(plan) => planScores.get(plan.id) ?? null}
              saving={isSaving}
              onSave={savePlan}
              onLoad={loadPlan}
              onDelete={deletePlan}
            />
          </Card>
        </div>
      </div>
    </div>
  )
}
