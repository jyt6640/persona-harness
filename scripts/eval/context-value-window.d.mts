type WindowMedians = {
  readonly harnessA: number
  readonly harnessB: number
  readonly taskA: number
  readonly taskB: number
}

export type ContextValueWindowResult =
  | {
      readonly status: "inconclusive"
      readonly numericalVerdict: "INCONCLUSIVE"
      readonly productVerdict: "UNVERIFIED"
      readonly pairs: number
      readonly reasons: readonly string[]
    }
  | {
      readonly status: "ready"
      readonly host: "codex" | "claude"
      readonly registrationDigest: string
      readonly numericalVerdict: "MEETS_CRITERIA" | "NOT_IMPROVED"
      readonly productVerdict: "UNVERIFIED"
      readonly pairs: 6
      readonly medians: WindowMedians
      readonly nonIncreasingPairs: number
      readonly harnessReductionPercent: number
    }

export function evaluateContextValueWindow(input: unknown): ContextValueWindowResult
