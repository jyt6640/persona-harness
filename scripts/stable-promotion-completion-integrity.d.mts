import type {
  StablePromotionCompletionIntegrityResult,
} from "./stable-promotion-completion-integrity-core.mjs"

type GateCommandResult = {
  readonly output: string
  readonly status: number
}

type StablePromotionConsumer = {
  readonly cliPath: string
  readonly consumerDir: string
  readonly consumerRoot: string
  readonly packageName: unknown
  readonly packageRoot: string
  readonly version: unknown
}

export function stablePromotionCompletionIntegrityUsage(invocation?: string): string

export function createStablePromotionConsumer(
  tempRoot: string,
  tarballPath: string,
): StablePromotionConsumer | undefined

export function writeStablePromotionWorkflowFixture(
  projectDir: string,
  cliPath: string,
  commandRunner?: (
    command: string,
    args: readonly string[],
    cwd: string,
  ) => GateCommandResult,
): boolean

export function runInstalledCompletionIntegrityMatrix(
  consumer: StablePromotionConsumer,
  tempRoot: string,
): {
  readonly closureBlocked: boolean
  readonly forgedEvidenceBlocked: boolean
  readonly malformedConfigBlocked: boolean
  readonly noSensitiveOutput: boolean
  readonly sourceCheckoutIndependent: boolean
  readonly symlinkEvidenceBlocked: boolean
  readonly workflowFinishBlocked: boolean
}

export function runStablePromotionCompletionIntegrity(options: {
  readonly approvalPath: string
  readonly candidateTag: string
  readonly registryFactsPath: string
  readonly sourceHead: string
  readonly tarballPath: string
}): StablePromotionCompletionIntegrityResult
