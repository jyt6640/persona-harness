export const FINAL_OBSERVER_V4_CLEANLINESS_SCHEMA_VERSION: "consumer-authority-final-observer-cleanliness.1"
export const FINAL_OBSERVER_V4_STAGES: readonly [
  "baseline",
  "source-bound-preparation",
  "credential-handoff",
  "observer-child",
  "immediately-pre-push",
]
export const FINAL_OBSERVER_V4_STAGE_RESIDUE_PROJECTION: Readonly<{
  baseline: readonly []
  "source-bound-preparation": readonly [
    ".persona/.ph-init-manifest.json",
    ".persona/workflow",
  ]
  "credential-handoff": readonly [
    ".gradle",
    ".persona/.ph-init-manifest.json",
    ".persona/evidence",
    ".persona/workflow",
    "build",
    "node_modules",
  ]
  "observer-child": readonly [
    ".gradle",
    ".persona/.ph-init-manifest.json",
    ".persona/evidence",
    ".persona/workflow",
    "build",
    "node_modules",
  ]
  "immediately-pre-push": readonly [
    ".gradle",
    ".persona/.ph-init-manifest.json",
    ".persona/evidence",
    ".persona/workflow",
    "build",
    "node_modules",
  ]
}>

export class FinalObserverV4CleanlinessError extends Error {
  readonly code: string
}

export function canonicalFinalObserverV4CleanlinessPolicy(): Readonly<Record<string, unknown>>
export function evaluateFinalObserverV4Cleanliness(input: unknown): Readonly<Record<string, unknown>>
