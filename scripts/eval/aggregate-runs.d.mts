export type AggregateOptions = {
  evalRoot?: string
  signalRoot?: string
  preserveSignal?: boolean
  pruneCaptures?: boolean
  projectDir?: string
  help?: boolean
}

export type AggregateSignal = {
  resultCounts: Record<string, number>
  historicalToolchainConfounded: { resultCount: number; runCount: number }
  byCondition: readonly Record<string, unknown>[]
  deconfounded: Record<string, { phOn: number | null; plain: number | null; strongestBaseline: number | null; phMinusPlain: number | null; phMinusStrongest: number | null }>
}

export function parseAggregateArgs(argv: readonly string[]): AggregateOptions
export function findResultFiles(evalRoot: string): string[]
export function aggregateEvalRuns(options: AggregateOptions): {
  aggregate: AggregateSignal
  originals: readonly unknown[]
  loaded: readonly unknown[]
  signalRoot: string
}
export function formatAggregateTable(aggregate: AggregateSignal): string
