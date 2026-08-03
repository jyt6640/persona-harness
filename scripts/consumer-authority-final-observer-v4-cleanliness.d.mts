export const FINAL_OBSERVER_V4_CLEANLINESS_SCHEMA_VERSION: "consumer-authority-final-observer-cleanliness.1"
export const FINAL_OBSERVER_V4_STAGES: readonly [
  "baseline",
  "source-bound-preparation",
  "credential-handoff",
  "observer-child",
  "immediately-pre-push",
]
export const FINAL_OBSERVER_V4_STAGE_RESIDUE_PROJECTION: Readonly<Record<string, readonly string[]>>

export class FinalObserverV4CleanlinessError extends Error {
  readonly code: string
}

export function canonicalFinalObserverV4CleanlinessPolicy(): Readonly<Record<string, unknown>>
export function evaluateFinalObserverV4Cleanliness(input: unknown): Readonly<Record<string, unknown>>
