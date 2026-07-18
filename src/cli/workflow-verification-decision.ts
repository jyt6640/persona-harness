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

export type FinishAssuranceRequirement = "cooperative" | "external"

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

class CurrentProcessCapability {
  readonly #brand = true

  private constructor() {}

  static create(): CurrentProcessCapability {
    return new CurrentProcessCapability()
  }
}

type CooperativeCurrentProcessVerificationDecision = {
  readonly assurance: "cooperative"
  readonly authorityProvider: "cooperative-current-process"
  readonly commandCatalogId: string
  readonly commandPlanDigest: string
  readonly completionEligible: true
  readonly consumptionState: "unconsumed"
  readonly decisionId: string
  readonly kind: "cooperative-current-process"
  readonly sourceSnapshotDigest: string
  readonly status: "trusted"
  readonly testCount: number
  readonly verifiedAt: string
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

const completionEligibleDecisionObjects = new WeakSet<object>()
const currentProcessCapabilities = new WeakMap<object, CurrentProcessCapability>()
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
  completionEligibleDecisionObjects.add(decision)
  externalAttestedDecisionObjects.add(decision)
  return decision
}

export function isCompletionEligibleVerificationDecision(
  value: unknown,
): value is CompletionEligibleVerificationDecision {
  return typeof value === "object" && value !== null && completionEligibleDecisionObjects.has(value)
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
  switch (requirement) {
    case "cooperative":
      return typeof value === "object" && value !== null && currentProcessCapabilities.has(value)
    case "external":
      return isExternalAttestedVerificationDecision(value)
    default:
      return assertNever(requirement)
  }
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

function createCurrentProcessVerificationDecision(
  input: Omit<CooperativeCurrentProcessVerificationDecision, "assurance" | "authorityProvider" | "completionEligible" | "consumptionState" | "kind" | "status">,
): CooperativeCurrentProcessVerificationDecision {
  const decision: CooperativeCurrentProcessVerificationDecision = Object.freeze({
    ...input,
    assurance: "cooperative",
    authorityProvider: "cooperative-current-process",
    completionEligible: true,
    consumptionState: "unconsumed",
    kind: "cooperative-current-process",
    status: "trusted",
  })
  completionEligibleDecisionObjects.add(decision)
  currentProcessCapabilities.set(decision, CurrentProcessCapability.create())
  return decision
}

function assertNever(value: never): never {
  throw new TypeError(`Unknown verification decision status: ${String(value)}`)
}
