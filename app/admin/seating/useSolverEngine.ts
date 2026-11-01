'use client'

import { useEffect, useRef } from 'react'
import { createRunner, RunnerMessage, RunnerRequest } from '@/lib/seatingSolver/runner'

/**
 * Runs solvers in a Web Worker so the page stays smooth, falling back to the main thread if the
 * worker can't start. Returns a stable `post` for runner requests.
 */
export function useSolverEngine(onMessage: (message: RunnerMessage) => void) {
  const handlerRef = useRef(onMessage)
  const postRef = useRef<(request: RunnerRequest) => void>(() => {})
  const usingWorkerRef = useRef(false)

  useEffect(() => {
    handlerRef.current = onMessage
  })

  useEffect(() => {
    let worker: Worker | null = null
    try {
      worker = new Worker(new URL('./solver.worker.ts', import.meta.url), { type: 'module' })
      worker.onmessage = (event: MessageEvent<RunnerMessage>) => handlerRef.current(event.data)
      worker.onerror = (event) => handlerRef.current({ type: 'error', message: event.message || 'Solver worker crashed' })
      postRef.current = (request) => worker!.postMessage(request)
      usingWorkerRef.current = true
    } catch {
      const runner = createRunner((message) => handlerRef.current(message))
      postRef.current = (request) => runner.handle(request)
      usingWorkerRef.current = false
    }
    const post = postRef.current
    return () => {
      if (worker) worker.terminate()
      else post({ type: 'stop' })
      postRef.current = () => {}
    }
  }, [])

  return {
    post: (request: RunnerRequest) => postRef.current(request),
    usingWorker: () => usingWorkerRef.current,
  }
}
