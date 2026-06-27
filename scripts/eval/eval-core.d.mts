export type EvalRun = {
  fixtureId: string
  conditionId: string
  metrics: {
    compileBuildPass: boolean | null
    gradleTestPass: boolean | null
    runtimeSmokePass: boolean | null
    stackAlignmentScore?: number
    stackAlignmentRate?: number
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
export function parseJUnitXmlText(xmlText: string): { tests: number; failures: number; errors: number; skipped: number }
export function collectJUnitResults(workspaceDir: string): Record<string, unknown>
export function measureGradleTestResult(workspaceDir: string, execution: Record<string, unknown>): Record<string, unknown>
export function measureCompileResult(workspaceDir: string, execution: Record<string, unknown>): Record<string, unknown>
export function scoreStackAlignmentFromObserveReport(report: unknown, workspaceDir?: string): Record<string, unknown>
export function preflight(options: Record<string, unknown>): { ok: boolean; errors: string[] }
export function decideResults(results: { runs?: readonly EvalRun[] }): { verdict: string; reasons: string[] }
