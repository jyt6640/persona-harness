export type BuilderFailure = {
  readonly commandId: string
  readonly exitCode: number | null
  readonly exitState: string
}

export type CanonicalRunnerContext = {
  readonly environment: "github-hosted"
  readonly label: "ubuntu-latest"
  readonly os: "Linux"
}

export type FailureReportSummary = {
  readonly available: boolean
  readonly digest: string | null
  readonly failedTestFiles: readonly string[]
  readonly path: string
  readonly summary: {
    readonly failed: number
    readonly passed: number
    readonly skipped: number
    readonly total: number
  } | null
}

export type FailureDiagnostic = {
  readonly authorityBoundary: "builder-output-is-non-authoritative"
  readonly authorityEligible: false
  readonly commandId: string
  readonly diagnosticCodes: readonly ["fixed-command-failed"]
  readonly exitCode: number | null
  readonly exitState: string
  readonly rawOutputIncluded: false
  readonly report: FailureReportSummary
  readonly schemaVersion: "clean-ci-builder-failure.1"
}

export const FIXED_COMMANDS: readonly {
  readonly id: string
  readonly executable: string
  readonly args: readonly string[]
}[]

export const CANONICAL_RUNNER_LABEL: "ubuntu-latest"

export const FAILURE_DIAGNOSTIC_SCHEMA: "clean-ci-builder-failure.1"

export function createFailureDiagnostic(failure: BuilderFailure, reportPath: string, workspaceRoot: string): FailureDiagnostic

export function readCanonicalRunnerContext(
  env?: Readonly<Record<string, string | undefined>>,
): CanonicalRunnerContext
