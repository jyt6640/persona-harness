export type EvalRun = {
  fixtureId: string
  conditionId: string
  metrics: {
    compileBuildPass: boolean
    gradleTestPass: boolean
    runtimeSmokePass: boolean | null
    stackAlignmentScore: number
    externalFailureModeCount: number
    workflowFinishOutcome: string
    backendShapeWarnCount: number | null
  }
}

export function aggregateRuns(runs: readonly EvalRun[]): {
  byCondition: Array<Record<string, unknown>>
}
export function buildPlan(options: Record<string, unknown>): {
  runs: Array<{ fixtureId: string; conditionId: string; repetition: number }>
}
export function countFailureModes(outcomes: Record<string, unknown>): { count: number; labels: string[] }
export function parseArgs(argv: readonly string[]): Record<string, unknown>
export function parseBackendShapeWarnCount(text: string): number
export function parseCommandOutcome(execution: Record<string, unknown>): string
export function preflight(options: Record<string, unknown>): { ok: boolean; errors: string[] }
export function decideResults(results: { runs?: readonly EvalRun[] }): { verdict: string; reasons: string[] }
