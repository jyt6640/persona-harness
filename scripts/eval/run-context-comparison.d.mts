export type ContextComparisonRunnerArguments = {
  readonly candidate: {
    readonly commit: string
    readonly packageVersion: string
  }
  readonly manifestPath: string
}

export function parseContextComparisonArguments(argv: readonly string[]): ContextComparisonRunnerArguments
