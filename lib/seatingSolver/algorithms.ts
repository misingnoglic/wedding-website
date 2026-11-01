// Every search algorithm the Seating Lab offers: the core solvers in core.ts plus the ones in solvers/.
// Each solver file exports an AlgorithmPlugin; add it to PLUGINS to make it available everywhere.

import { AlgorithmSpec, CORE_ALGORITHMS, CoreAlgorithmId, createCoreSolver, Params, scaleCoreToEvaluations, Solver, specDefaults } from './core'
import { Problem } from './problem'
import { exactTables } from './solvers/exactTables'
import { iteratedLocalSearch } from './solvers/iteratedLocalSearch'
import { kernighanLin } from './solvers/kernighanLin'
import { lns } from './solvers/lns'
import { parallelTempering } from './solvers/parallelTempering'

export { greedyAssignment, polishAssignment, randomAssignment } from './core'
export type { AlgorithmSpec, ParamSpec, ParamValue, Params, Solver, SolverProgress } from './core'

const PLUGINS = [parallelTempering, lns, iteratedLocalSearch, kernighanLin, exactTables] as const

type Plugin = (typeof PLUGINS)[number]
export type AlgorithmId = CoreAlgorithmId | Plugin['spec']['id']

export const ALGORITHMS: AlgorithmSpec<AlgorithmId>[] = [...CORE_ALGORITHMS, ...PLUGINS.map((p) => p.spec)]

const pluginFor = (id: AlgorithmId) => PLUGINS.find((p) => p.spec.id === id)
const isCore = (id: AlgorithmId): id is CoreAlgorithmId => CORE_ALGORITHMS.some((a) => a.id === id)

export function defaultParams(id: AlgorithmId): Params {
  return specDefaults(ALGORITHMS.find((a) => a.id === id)!)
}

/**
 * Loads anything a solver needs before it can be created (e.g. a WebAssembly module).
 */
export async function prepareAlgorithm(id: AlgorithmId): Promise<void> {
  await pluginFor(id)?.prepare?.()
}

/**
 * Params with the length of the run scaled so the whole schedule takes about `evaluations` swap
 * evaluations. Lets time-boxed comparisons be fair to algorithms that need to reach the end of
 * their schedule, like annealing.
 */
export function scaleToEvaluations(algorithm: AlgorithmId, partial: Params, evaluations: number, guestCount: number): Params {
  if (isCore(algorithm)) return scaleCoreToEvaluations(algorithm, partial, evaluations, guestCount)
  return pluginFor(algorithm)!.scale({ ...defaultParams(algorithm), ...partial }, evaluations, guestCount)
}

export function createSolver(algorithm: AlgorithmId, problem: Problem, guestAt: Int32Array, locked: Uint8Array, partial: Params, seed: number): Solver {
  if (isCore(algorithm)) return createCoreSolver(algorithm, problem, guestAt, locked, partial, seed)
  // Missing params take the spec defaults, so the constructors' fallbacks never apply
  return pluginFor(algorithm)!.create(problem, guestAt, locked, { ...defaultParams(algorithm), ...partial }, seed)
}
