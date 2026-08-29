export type ContextComparisonCandidate = {
  readonly commit: string
  readonly packageVersion: string
}

export type ContextComparisonRunnerArguments =
  | {
      readonly candidate: ContextComparisonCandidate
      readonly candidateSource: "explicit"
      readonly manifestPath: string
    }
  | {
      readonly candidateSource: "current-checkout"
      readonly manifestPath: string
    }

export function parseContextComparisonArguments(argv: readonly string[]): ContextComparisonRunnerArguments

export function assertContextComparisonCandidate(
  candidate: ContextComparisonCandidate,
  checkoutCandidate: ContextComparisonCandidate,
): void
