import {
  parsePersonalizationCandidate,
  proposePersonalizationCandidate,
  type PersonalizationCandidate,
  type PersonalizationStoreOptions,
} from "./personalization-profile-store.js"

export const PERSONALIZATION_REFINEMENT_SCHEMA = "personalization-refinement.v1" as const

export type PhilosophyRefinementTrigger = "design-critique" | "implementation-critique" | "explicit-refinement"
export type PhilosophyRefinementClassification = "implementation-mistake" | "project-decision" | "personal-philosophy"
export type PhilosophyRefinementBlockReason = "explicit-trigger-required" | "incomplete" | "ambiguous" | "scope-mismatch" | "unsafe"

export type PhilosophyRefinementInput = {
  readonly schemaVersion: typeof PERSONALIZATION_REFINEMENT_SCHEMA
  readonly trigger: PhilosophyRefinementTrigger
  readonly classification: PhilosophyRefinementClassification
  readonly currentRationale: string
  readonly preferredAlternative: string
  readonly candidate: PersonalizationCandidate
}

export type PhilosophyRefinementResult =
  | {
      readonly status: "blocked"
      readonly reason: PhilosophyRefinementBlockReason
    }
  | {
      readonly status: "no-profile-change"
      readonly classification: "implementation-mistake"
    }
  | {
      readonly status: "activated" | "pending" | "conflict"
      readonly classification: "project-decision" | "personal-philosophy"
      readonly candidateId: string
    }

type PhilosophyRefinementParseResult =
  | { readonly ok: true; readonly value: PhilosophyRefinementInput }
  | { readonly ok: false; readonly reason: PhilosophyRefinementBlockReason }

const REFINEMENT_KEYS = ["candidate", "classification", "currentRationale", "preferredAlternative", "schemaVersion", "trigger"] as const

export function parsePhilosophyRefinement(value: unknown): PhilosophyRefinementParseResult {
  if (!isRecord(value) || !hasExactKeys(value, REFINEMENT_KEYS)) return { ok: false, reason: "incomplete" }
  if (value.schemaVersion !== PERSONALIZATION_REFINEMENT_SCHEMA) return { ok: false, reason: "unsafe" }
  if (!isTrigger(value.trigger)) return { ok: false, reason: "explicit-trigger-required" }
  if (!isClassification(value.classification)) return { ok: false, reason: "ambiguous" }
  if (!isPresentText(value.currentRationale) || !isPresentText(value.preferredAlternative)) return { ok: false, reason: "incomplete" }
  if (!isSafeRefinementText(value.currentRationale) || !isSafeRefinementText(value.preferredAlternative)) return { ok: false, reason: "unsafe" }

  let candidate: PersonalizationCandidate
  try {
    candidate = parsePersonalizationCandidate(value.candidate)
  } catch {
    return { ok: false, reason: "incomplete" }
  }
  return {
    ok: true,
    value: {
      candidate,
      classification: value.classification,
      currentRationale: value.currentRationale,
      preferredAlternative: value.preferredAlternative,
      schemaVersion: PERSONALIZATION_REFINEMENT_SCHEMA,
      trigger: value.trigger,
    },
  }
}

export function refinePersonalization(
  value: unknown,
  options: PersonalizationStoreOptions = {},
): PhilosophyRefinementResult {
  const parsed = parsePhilosophyRefinement(value)
  if (!parsed.ok) return { reason: parsed.reason, status: "blocked" }
  const { candidate, classification } = parsed.value
  if (classification === "implementation-mistake") return { classification, status: "no-profile-change" }
  if (classification === "personal-philosophy" && candidate.scope.kind !== "personal") return { reason: "scope-mismatch", status: "blocked" }
  if (classification === "project-decision" && candidate.scope.kind === "personal") return { reason: "scope-mismatch", status: "blocked" }

  const result = proposePersonalizationCandidate(candidate, options)
  if (result.status === "activated" || result.status === "pending" || result.status === "conflict") {
    return { candidateId: candidate.candidateId, classification, status: result.status }
  }
  return { reason: "ambiguous", status: "blocked" }
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value).sort()
  const expected = [...keys].sort()
  return actual.length === expected.length && actual.every((key, index) => key === expected[index])
}

function isTrigger(value: unknown): value is PhilosophyRefinementTrigger {
  return value === "design-critique" || value === "implementation-critique" || value === "explicit-refinement"
}

function isClassification(value: unknown): value is PhilosophyRefinementClassification {
  return value === "implementation-mistake" || value === "project-decision" || value === "personal-philosophy"
}

function isSafeRefinementText(value: unknown): value is string {
  return typeof value === "string"
    && value.length > 0
    && value.length <= 600
    && !/[\u0000-\u0008\u000B\u000C\u000E-\u001F\r\n]/u.test(value)
    && !/```|(?:^|[\s("'])~[\\/]|(?:^|[\s("'])[A-Za-z]:[\\/]|(?:^|[\s("'])\/(?:[^/]|$)/u.test(value)
    && !/(?:^|[\s("'`])(?:sk-[A-Za-z0-9]|gh[pousr]_[A-Za-z0-9]|xox[baprs]-|AKIA[A-Z0-9]{12,})/u.test(value)
    && !/\b(?:password|passwd|api[ _-]?key|access[ _-]?token|token|secret)\s*[:=]/iu.test(value)
    && !/(?:https?|file):\/\//iu.test(value)
    && !/\b(?:function|class|interface|import|export|const|let|var)\s+[A-Za-z_$]/u.test(value)
    && !/[{};]|=>/u.test(value)
}

function isPresentText(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== ""
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
