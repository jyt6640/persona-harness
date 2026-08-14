import { isLiveCooperativeDecision } from "./cooperative-finish-authority.js"
import type { CooperativeCurrentProcessVerificationDecision } from "./cooperative-finish-authority.js"
import {
  resolveCompletionDecision,
  type CompletionAuthorityEvidence,
  type CompletionDecision,
} from "../core/completion-decision.js"
import type { CompletionAssuranceRequirement } from "../core/completion-decision.js"

export type VerificationAssurance =
  | "diagnostic-only"
  | "none"
  | "cooperative"
  | "external"

export type VerificationAuthorityProvider =
  | "none"
  | "cooperative-current-process"
  | "external-attested"

export type VerificationConsumptionState =
  | "not-applicable"
  | "unconsumed"
  | "consumed"

export type FinishAssuranceRequirement = CompletionAssuranceRequirement

export const DEFAULT_FINISH_ASSURANCE_REQUIREMENT = "external" as const

export type DiagnosticVerificationDecision = {
  readonly assurance: "diagnostic-only"
  readonly authorityProvider: "none"
  readonly code: string
  readonly completionEligible: false
  readonly consumptionState: "not-applicable"
  readonly kind: "diagnostic-only"
  readonly status: "diagnostic-only"
  readonly summary: string
}

export type BlockedVerificationDecision = {
  readonly assurance: "none"
  readonly authorityProvider: "none"
  readonly code: string
  readonly completionEligible: false
  readonly consumptionState: "not-applicable"
  readonly kind: "blocked"
  readonly status: "blocked"
  readonly summary: string
}

export type ExternalAttestedVerificationDecision = {
  readonly assurance: "external"
  readonly attestationId: string
  readonly authorityProvider: "external-attested"
  readonly completionEligible: true
  readonly consumptionState: "unconsumed" | "consumed"
  readonly decisionId: string
  readonly kind: "external-attested"
  readonly sourceSnapshotDigest: string
  readonly status: "trusted"
  readonly verifiedAt: string
}

export type CompletionEligibleVerificationDecision =
  | CooperativeCurrentProcessVerificationDecision
  | ExternalAttestedVerificationDecision

export type VerificationDecision =
  | BlockedVerificationDecision
  | DiagnosticVerificationDecision
  | CompletionEligibleVerificationDecision

type ExternalAttestedDecisionInput = {
  readonly attestationId: string
  readonly consumptionState?: ExternalAttestedVerificationDecision["consumptionState"]
  readonly decisionId: string
  readonly sourceSnapshotDigest: string
  readonly verifiedAt: string
}

const externalAttestedDecisionObjects = new WeakSet<object>()

export function diagnosticVerificationDecision(
  code: string,
  summary: string,
): DiagnosticVerificationDecision {
  return {
    assurance: "diagnostic-only",
    authorityProvider: "none",
    code,
    completionEligible: false,
    consumptionState: "not-applicable",
    kind: "diagnostic-only",
    status: "diagnostic-only",
    summary,
  }
}

export function blockedVerificationDecision(
  code: string,
  summary: string,
): BlockedVerificationDecision {
  return {
    assurance: "none",
    authorityProvider: "none",
    code,
    completionEligible: false,
    consumptionState: "not-applicable",
    kind: "blocked",
    status: "blocked",
    summary,
  }
}

export function externalAttestedVerificationDecision(
  input: ExternalAttestedDecisionInput,
): ExternalAttestedVerificationDecision {
  const decision: ExternalAttestedVerificationDecision = Object.freeze({
    ...input,
    assurance: "external",
    authorityProvider: "external-attested",
    completionEligible: true,
    consumptionState: input.consumptionState ?? "unconsumed",
    kind: "external-attested",
    status: "trusted",
  })
  externalAttestedDecisionObjects.add(decision)
  return decision
}

export function isCompletionEligibleVerificationDecision(
  value: unknown,
): value is CompletionEligibleVerificationDecision {
  return isLiveCooperativeDecision(value) || isExternalAttestedVerificationDecision(value)
}

export function isExternalAttestedVerificationDecision(
  value: unknown,
): value is ExternalAttestedVerificationDecision {
  return typeof value === "object" && value !== null && externalAttestedDecisionObjects.has(value)
}

export function isTrustedVerificationDecision(
  value: unknown,
): value is ExternalAttestedVerificationDecision {
  return isExternalAttestedVerificationDecision(value)
}

export function completionEligibleForAssurance(
  value: unknown,
  requirement: FinishAssuranceRequirement = DEFAULT_FINISH_ASSURANCE_REQUIREMENT,
): boolean {
  return completionDecisionForVerification(value, requirement).passed
}

export function completionDecisionForVerification(
  value: unknown,
  requirement: FinishAssuranceRequirement = DEFAULT_FINISH_ASSURANCE_REQUIREMENT,
): CompletionDecision {
  return resolveCompletionDecision({
    authority: authorityEvidenceForVerification(value),
    policyBlocker: policyBlockerForRequirement(requirement),
    requirement,
  })
}

export function verificationDecisionSummary(decision: VerificationDecision): string {
  switch (decision.kind) {
    case "blocked":
    case "diagnostic-only":
      return decision.summary
    case "cooperative-current-process":
      return `Cooperative current-process decision ${decision.decisionId} is eligible only for explicit cooperative assurance.`
    case "external-attested":
      return `External attested decision ${decision.decisionId} verified at ${decision.verifiedAt}.`
    default:
      return assertNever(decision)
  }
}

function assertNever(value: never): never {
  throw new TypeError(`Unknown verification decision status: ${String(value)}`)
}

function authorityEvidenceForVerification(value: unknown): CompletionAuthorityEvidence {
  if (isExternalAttestedVerificationDecision(value)) {
    return { assurance: "external", kind: "trusted" }
  }
  if (isLiveCooperativeDecision(value)) {
    return { assurance: "cooperative", kind: "trusted" }
  }
  if (isDescriptiveNonEligibleVerificationDecision(value)) {
    return { code: value.code, kind: "blocked", summary: value.summary }
  }
  return {
    code: "verification-authority-unavailable",
    kind: "blocked",
    summary: "No live verification authority is available for completion.",
  }
}

function isDescriptiveNonEligibleVerificationDecision(
  value: unknown,
): value is BlockedVerificationDecision | DiagnosticVerificationDecision {
  if (!isRecord(value)) {
    return false
  }
  return (value["kind"] === "blocked" || value["kind"] === "diagnostic-only")
    && typeof value["code"] === "string"
    && typeof value["summary"] === "string"
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function policyBlockerForRequirement(requirement: FinishAssuranceRequirement): CompletionDecision["blockers"][number] {
  switch (requirement) {
    case "cooperative":
      return {
        code: "cooperative-authority-required",
        summary: "A live cooperative verification result is required before completion can pass.",
      }
    case "external":
      return {
        code: "trusted-authority-required",
        summary: "A trusted external authority is required before completion can pass.",
      }
    default:
      return assertNever(requirement)
  }
}
