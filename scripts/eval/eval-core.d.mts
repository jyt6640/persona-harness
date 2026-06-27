export type EvalRun = {
  fixtureId: string
  fixtureMetadata?: FixtureMetadata
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

export type FixtureMetadata = {
  scopeClass: "single-turn" | "reduced-single-turn" | "stress-continuation"
  singleTurnEligible: boolean
  pairedWith?: string
}

export const FIXTURE_METADATA: Record<string, FixtureMetadata>
export function aggregateRuns(runs: readonly EvalRun[]): {
  byCondition: Array<Record<string, unknown>>
  singleTurnEligibleByCondition: Array<Record<string, unknown>>
}
export function buildPlan(options: Record<string, unknown>): {
  fixtureIds: string[]
  conditionIds: string[]
  fixtureMetadata: Record<string, FixtureMetadata>
  runs: Array<{ fixtureId: string; conditionId: string; repetition: number }>
}
export function countFailureModes(outcomes: Record<string, unknown>): { count: number; labels: string[] }
export function parseArgs(argv: readonly string[]): Record<string, unknown> & {
  model: string
  opencodeCommand: string
}
export function parseBackendShapeWarnCount(text: string): number
export function parseCommandOutcome(execution: Record<string, unknown>): string
export function runShellAsync(
  command: string,
  cwd: string,
  timeoutMs: number,
  options?: { cleanupProcessGroup?: boolean },
): Promise<{ status: number | null; signal: NodeJS.Signals | null; stdout: string; stderr: string; timedOut: boolean }>
export function formatCommand(template: string, values: Record<string, unknown>): string
export function parseJUnitXmlText(xmlText: string): { tests: number; failures: number; errors: number; skipped: number }
export function collectJUnitResults(workspaceDir: string): Record<string, unknown>
export function measureGradleTestResult(workspaceDir: string, execution: Record<string, unknown>): Record<string, unknown>
export function measureCompileResult(workspaceDir: string, execution: Record<string, unknown>): Record<string, unknown>
export function scoreStackAlignmentFromObserveReport(report: unknown, workspaceDir?: string): Record<string, unknown>
export function preflight(options: Record<string, unknown>): { ok: boolean; errors: string[] }
export const DECISION_POLICIES: {
  readonly legacyStackHard: "legacy-v0.4-stack-hard"
  readonly externalPrimary: "external-primary-v0.4.1"
}
export function decideResults(
  results: { decisionPolicy?: string | null; runs?: readonly EvalRun[] },
  options?: { policy?: string },
): { policy: string; verdict: string; reasons: string[] }
