export type EvalRun = {
  fixtureId: string
  fixtureMetadata?: FixtureMetadata
  conditionId: string
  repetition?: number
  workspacePurity?: WorkspacePurity
  toolchain?: GeneratedToolchain
  fixtureStackToolchain?: FixtureStackToolchainScore
  metrics: {
    compileBuildPass: boolean | null
    gradleTestPass: boolean | null
    runtimeSmokePass: boolean | null
    detectedStack?: string
    buildTool?: string
    testTool?: string
    fixtureExpectedStack?: string
    fixtureExpectedFramework?: string
    fixtureExpectedBuildTool?: string
    fixtureStackToolchainExpectation?: string
    stackToolchainMatches?: boolean | null
    stackToolchainMatchReason?: string
    stackAlignmentScore?: number
    stackAlignmentRate?: number
    externalFailureModeCount: number
    workflowFinishOutcome: string
    backendShapeWarnCount: number | null
  }
}

export type WorkspacePurity = {
  status: "PASS" | "FAIL" | "NOT_APPLICABLE"
  violations: string[]
}

export type GeneratedToolchain = {
  detectedStack: "java" | "python" | "unknown"
  buildTool: "gradle" | "maven" | "python-compileall" | "unknown"
  testTool: "gradle" | "maven" | "pytest" | "unknown"
  evidence: string[]
}

export type EvalCommandDescriptor = {
  tool: string
  command: string | null
  skippedReason: string | null
}

export type FixtureMetadata = {
  scopeClass: "single-turn" | "reduced-single-turn" | "stress-continuation"
  singleTurnEligible: boolean
  pairedWith?: string
  stackToolchain: FixtureStackToolchainExpectation
}

export type FixtureStackToolchainExpectation = {
  expectation: "free-stack" | "java-spring-gradle-pinned"
  expectedStack: "any" | "java"
  expectedFramework: "any" | "spring"
  expectedBuildTool: "any" | "gradle"
}

export type FixtureStackToolchainScore = {
  matches: boolean
  reason: string
  expected: FixtureStackToolchainExpectation
  detected: GeneratedToolchain
}

export const FIXTURE_METADATA: Record<string, FixtureMetadata>
export const DEFAULT_OUTPUT_ROOT: string
export const TOOLCHAIN_SCORING_VERSION: "generated-toolchain-v1"
export const SCORER_MARKERS: {
  readonly legacyStackHard: "legacy-stack-hard-v0.4"
  readonly externalPrimaryPreToolchain: "gradle-fixed-v0.4.1"
  readonly externalPrimaryToolchain: "generated-toolchain-v1"
}
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
export function detectGeneratedToolchain(workspaceDir: string): GeneratedToolchain
export function scoreFixtureStackToolchain(
  fixtureMetadata: FixtureMetadata,
  toolchain: GeneratedToolchain,
): FixtureStackToolchainScore
export function buildCommandForToolchain(workspaceDir: string, toolchain?: GeneratedToolchain): EvalCommandDescriptor
export function testCommandForToolchain(workspaceDir: string, toolchain?: GeneratedToolchain): EvalCommandDescriptor
export function measureGradleTestResult(workspaceDir: string, execution: Record<string, unknown>): Record<string, unknown>
export function measureToolchainTestResult(
  workspaceDir: string,
  execution: Record<string, unknown>,
  toolchain?: GeneratedToolchain,
): Record<string, unknown>
export function measureCompileResult(
  workspaceDir: string,
  execution: Record<string, unknown>,
  toolchain?: GeneratedToolchain,
): Record<string, unknown>
export function scoreStackAlignmentFromObserveReport(report: unknown, workspaceDir?: string): Record<string, unknown>
export function preflight(
  options: Record<string, unknown>,
  plan?: { fixtureIds: string[]; conditionIds: string[]; fixtureMetadata: Record<string, unknown>; runs: unknown[] },
): { ok: boolean; errors: string[] }
export function findAmbientInfluencePaths(projectDir: string, outputRoot: string): string[]
export function scanWorkspacePurity(workspaceDir: string, conditionId: string): WorkspacePurity
export const DECISION_POLICIES: {
  readonly legacyStackHard: "legacy-v0.4-stack-hard"
  readonly externalPrimaryPreToolchain: "external-primary-v0.4.1"
  readonly externalPrimary: "external-primary-toolchain-v0.4.2"
}
export function decideResults(
  results: { decisionPolicy?: string | null; toolchainScoringVersion?: string | null; runs?: readonly EvalRun[] },
  options?: { policy?: string },
): { policy: string; scorer: string; verdict: string; reasons: string[] }
