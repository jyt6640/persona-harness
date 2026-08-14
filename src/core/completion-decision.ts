export const COMPLETION_ASSURANCE_REQUIREMENTS = {
  COOPERATIVE: "cooperative",
  EXTERNAL: "external",
} as const

export type CompletionAssuranceRequirement =
  (typeof COMPLETION_ASSURANCE_REQUIREMENTS)[keyof typeof COMPLETION_ASSURANCE_REQUIREMENTS]

export type CompletionState = "blocked" | "externally-attested" | "locally-verified"

export type CompletionBlocker = {
  readonly code: string
  readonly summary: string
}

export type CompletionAuthorityEvidence =
  | {
      readonly code: string
      readonly kind: "blocked"
      readonly summary: string
    }
  | {
      readonly assurance: CompletionAssuranceRequirement
      readonly kind: "trusted"
    }

export type CompletionDecisionInput = {
  readonly authority: CompletionAuthorityEvidence
  readonly policyBlocker: CompletionBlocker
  readonly requirement: CompletionAssuranceRequirement
}

export type CompletionDecision = {
  readonly blockers: readonly CompletionBlocker[]
  readonly passed: boolean
  readonly state: CompletionState
}

export function resolveCompletionDecision(input: CompletionDecisionInput): CompletionDecision {
  switch (input.authority.kind) {
    case "blocked":
      return {
        blockers: [{ code: input.authority.code, summary: input.authority.summary }],
        passed: false,
        state: "blocked",
      }
    case "trusted":
      switch (input.requirement) {
        case "cooperative":
          return input.authority.assurance === "cooperative"
            ? { blockers: [], passed: true, state: "locally-verified" }
            : blockedByPolicy(input.policyBlocker)
        case "external":
          return input.authority.assurance === "external"
            ? { blockers: [], passed: true, state: "externally-attested" }
            : blockedByPolicy(input.policyBlocker)
        default:
          return assertNever(input.requirement)
      }
    default:
      return assertNever(input.authority)
  }
}

function blockedByPolicy(blocker: CompletionBlocker): CompletionDecision {
  return {
    blockers: [blocker],
    passed: false,
    state: "blocked",
  }
}

function assertNever(value: never): never {
  throw new TypeError(`Unknown completion decision value: ${String(value)}`)
}
