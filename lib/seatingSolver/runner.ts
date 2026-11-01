// Drives a solver in timed ticks and streams progress. Runs inside a Web Worker, or on the main
// thread as a fallback, with the same messages either way.

import { AlgorithmId, createSolver, greedyAssignment, Params, randomAssignment, scaleToEvaluations, Solver, SolverProgress } from './algorithms'
import { Problem } from './problem'

export type RunnerRequest =
  | {
      type: 'start'
      problem: Problem
      algorithm: AlgorithmId
      params: Params
      guestAt: Int32Array
      locked: Uint8Array
      seed: number
      speed: number
    }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'step' }
  | { type: 'stop' }
  | { type: 'speed'; speed: number }
  | {
      type: 'benchmark'
      problem: Problem
      entries: { algorithm: AlgorithmId; params: Params }[]
      runs: number
      timeMs: number
      startFrom: 'current' | 'greedy' | 'random'
      fitToTime: boolean // Scale each algorithm's schedule to finish within timeMs
      guestAt: Int32Array
      locked: Uint8Array
      seed: number
    }
  | { type: 'cancelBenchmark' }

export type HistoryPoint = { evaluations: number; current: number; best: number; temperature?: number }

export type RunnerMessage =
  | {
      type: 'progress'
      progress: SolverProgress
      guestAt: Int32Array // What to draw right now (the current state, or the best at the end)
      bestGuestAt: Int32Array
      history: HistoryPoint[] // Points since the last message
      evaluationsPerSecond: number
      paused: boolean
    }
  | { type: 'error'; message: string }
  | { type: 'benchmarkRow'; row: BenchmarkRow; guestAt: Int32Array }
  | { type: 'benchmarkDone'; cancelled: boolean }

export type BenchmarkRow = {
  algorithm: AlgorithmId
  run: number
  start: number // Score of the starting seating
  best: number
  evaluations: number
  ms: number
  finished: boolean // Reached its own end rather than the time limit
}

// Speed 1 is slow enough to watch individual swaps; 5 runs flat out
export const SPEEDS = [
  { label: 'Watch', budget: 3, delay: 140 },
  { label: 'Slow', budget: 40, delay: 70 },
  { label: 'Medium', budget: 1000, delay: 40 },
  { label: 'Fast', budget: 25_000, delay: 20 },
  { label: 'Max', budget: Infinity, delay: 0 },
]

// Longest a tick may compute before yielding, so the page stays responsive
const TICK_MS = 45

export function createRunner(post: (message: RunnerMessage, transfer?: Transferable[]) => void) {
  let solver: Solver | null = null
  let speed = 3
  let paused = false
  let timer: ReturnType<typeof setTimeout> | null = null
  let history: HistoryPoint[] = []
  let rateWindow = { at: 0, evaluations: 0, rate: 0 }

  const send = () => {
    if (!solver) return
    const progress = solver.progress()
    const now = performance.now()
    if (now - rateWindow.at > 500) {
      rateWindow = {
        at: now,
        evaluations: progress.evaluations,
        rate: rateWindow.at ? ((progress.evaluations - rateWindow.evaluations) / (now - rateWindow.at)) * 1000 : 0,
      }
    }
    const temperature = typeof progress.metrics.Temperature === 'number' ? progress.metrics.Temperature : undefined
    history.push({ evaluations: progress.evaluations, current: progress.current, best: progress.best, temperature })
    const guestAt = Int32Array.from(progress.done ? solver.best() : solver.current())
    const bestGuestAt = Int32Array.from(solver.best())
    post(
      { type: 'progress', progress, guestAt, bestGuestAt, history, evaluationsPerSecond: rateWindow.rate, paused },
      [guestAt.buffer, bestGuestAt.buffer]
    )
    history = []
  }

  const tick = () => {
    timer = null
    if (!solver || paused) return
    try {
      const { budget, delay } = SPEEDS[speed - 1]
      const started = performance.now()
      const chunk = Math.min(budget, 4000)
      let used = 0
      do {
        solver.step(chunk)
        used += chunk
      } while (used < budget && performance.now() - started < TICK_MS && !solver.progress().done)
      send()
      if (!solver.progress().done) timer = setTimeout(tick, delay)
    } catch (error) {
      post({ type: 'error', message: error instanceof Error ? error.message : String(error) })
    }
  }

  const stopTimer = () => {
    if (timer) clearTimeout(timer)
    timer = null
  }

  // Races each algorithm for a fixed time per run. Yields between slices so it can be cancelled.
  let benchmarkId = 0
  const benchmark = async (request: Extract<RunnerRequest, { type: 'benchmark' }>) => {
    const id = ++benchmarkId
    const { problem, locked } = request
    for (const entry of request.entries) {
      for (let run = 0; run < request.runs; run++) {
        const seed = request.seed + run
        const start =
          request.startFrom === 'greedy'
            ? greedyAssignment(problem, request.guestAt, locked)
            : request.startFrom === 'random'
              ? randomAssignment(problem, request.guestAt, locked, seed)
              : Int32Array.from(request.guestAt)
        let params = entry.params
        if (request.fitToTime) {
          // Measure this algorithm's speed briefly, then size its schedule to the time limit
          const probe = createSolver(entry.algorithm, problem, start, locked, params, seed)
          const probeStart = performance.now()
          while (performance.now() - probeStart < 150 && !probe.progress().done) probe.step(500)
          const rate = probe.progress().evaluations / Math.max(1, performance.now() - probeStart)
          params = scaleToEvaluations(entry.algorithm, params, rate * request.timeMs * 0.9, problem.n)
        }
        const solver = createSolver(entry.algorithm, problem, start, locked, params, seed)
        const startScore = solver.progress().current
        const began = performance.now()
        let sliceStart = began
        while (!solver.progress().done && performance.now() - began < request.timeMs) {
          solver.step(2000)
          if (performance.now() - sliceStart > 50) {
            await new Promise((resolve) => setTimeout(resolve, 0))
            if (id !== benchmarkId) return post({ type: 'benchmarkDone', cancelled: true })
            sliceStart = performance.now()
          }
        }
        const progress = solver.progress()
        const guestAt = Int32Array.from(solver.best())
        post(
          {
            type: 'benchmarkRow',
            row: {
              algorithm: entry.algorithm,
              run,
              start: startScore,
              best: progress.best,
              evaluations: progress.evaluations,
              ms: performance.now() - began,
              finished: progress.done,
            },
            guestAt,
          },
          [guestAt.buffer]
        )
      }
    }
    if (id === benchmarkId) post({ type: 'benchmarkDone', cancelled: false })
  }

  return {
    handle(request: RunnerRequest) {
      switch (request.type) {
        case 'benchmark':
          benchmark(request).catch((error) => post({ type: 'error', message: error instanceof Error ? error.message : String(error) }))
          break
        case 'cancelBenchmark':
          benchmarkId++
          break
        case 'start':
          stopTimer()
          try {
            solver = createSolver(request.algorithm, request.problem, request.guestAt, request.locked, request.params, request.seed)
          } catch (error) {
            post({ type: 'error', message: error instanceof Error ? error.message : String(error) })
            return
          }
          speed = request.speed
          paused = false
          history = []
          rateWindow = { at: 0, evaluations: 0, rate: 0 }
          send()
          timer = setTimeout(tick, 0)
          break
        case 'pause':
          paused = true
          stopTimer()
          send()
          break
        case 'resume':
          if (!solver) return
          paused = false
          if (!timer) timer = setTimeout(tick, 0)
          break
        case 'step':
          if (!solver || solver.progress().done) return
          solver.step(Math.min(SPEEDS[speed - 1].budget, 4000))
          send()
          break
        case 'stop':
          stopTimer()
          if (solver) {
            paused = true
            send()
          }
          solver = null
          break
        case 'speed':
          speed = request.speed
          break
      }
    },
  }
}
