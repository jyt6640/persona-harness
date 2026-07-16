import type { StagedPackageVerificationResult } from "./staged-package-verification-core.mjs"

type CommandResult = {
  readonly output: string
  readonly status: number
}

type ProvenanceInput = {
  readonly consumerDir: string
  readonly packageName: unknown
  readonly packageRoot: string
  readonly packageVersion: unknown
}

export type StagedPackageVerificationOptions = {
  readonly planPath: string
  readonly preflightPath: string
  readonly provenanceRunner?: (input: ProvenanceInput) => CommandResult
  readonly registryFactsPath: string
  readonly tarballPath: string
}

export function stagedPackageVerificationUsage(invocation?: string): string

export function runStagedPackageVerification(
  options: StagedPackageVerificationOptions,
): StagedPackageVerificationResult
