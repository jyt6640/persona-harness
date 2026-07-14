export type DiagnosticVerificationDecision = {
  readonly code: string
  readonly status: "diagnostic-only"
  readonly summary: string
}

export type BlockedVerificationDecision = {
  readonly code: string
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

type TrustedLocalVerificationDecision = {
  readonly authority: "local-current-process"
  readonly capability: CurrentProcessCapability
  readonly commandCatalogId: string
  readonly commandPlanDigest: string
  readonly decisionId: string
  readonly sourceSnapshotDigest: string
  readonly status: "trusted"
  readonly testCount: number
  readonly verifiedAt: string
}

type TrustedExternalVerificationDecision = {
  readonly attestationId: string
  readonly authority: "external-attested"
  readonly decisionId: string
  readonly sourceSnapshotDigest: string
  readonly status: "trusted"
  readonly verifiedAt: string
}

export type TrustedVerificationDecision =
  | TrustedExternalVerificationDecision
  | TrustedLocalVerificationDecision

export type VerificationDecision =
  | BlockedVerificationDecision
  | DiagnosticVerificationDecision
  | TrustedVerificationDecision

const trustedDecisionObjects = new WeakSet<object>()

export function diagnosticVerificationDecision(
  code: string,
  summary: string,
): DiagnosticVerificationDecision {
  return {
    code,
    status: "diagnostic-only",
    summary,
  }
}

export function blockedVerificationDecision(
  code: string,
  summary: string,
): BlockedVerificationDecision {
  return {
    code,
    status: "blocked",
    summary,
  }
}

export function isTrustedVerificationDecision(value: unknown): value is TrustedVerificationDecision {
  if (typeof value !== "object" || value === null || !("status" in value) || value.status !== "trusted") {
    return false
  }
  return trustedDecisionObjects.has(value)
}

export function verificationDecisionSummary(decision: VerificationDecision): string {
  switch (decision.status) {
    case "blocked":
    case "diagnostic-only":
      return decision.summary
    case "trusted":
      return `Trusted ${decision.authority} decision ${decision.decisionId} verified at ${decision.verifiedAt}.`
    default:
      return assertNever(decision)
  }
}

function createCurrentProcessVerificationDecision(
  input: Omit<TrustedLocalVerificationDecision, "authority" | "capability" | "status">,
): TrustedLocalVerificationDecision {
  const decision: TrustedLocalVerificationDecision = Object.freeze({
    ...input,
    authority: "local-current-process",
    capability: CurrentProcessCapability.create(),
    status: "trusted",
  })
  trustedDecisionObjects.add(decision)
  return decision
}

function assertNever(value: never): never {
  throw new TypeError(`Unknown verification decision status: ${String(value)}`)
}
