import { createRunner, RunnerRequest } from '@/lib/seatingSolver/runner'

const scope = self as unknown as Worker
const runner = createRunner((message, transfer) => scope.postMessage(message, transfer ?? []))

scope.onmessage = (event: MessageEvent<RunnerRequest>) => runner.handle(event.data)
