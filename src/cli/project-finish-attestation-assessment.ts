import {
  canonicalProjectFinishAttestationBytes,
} from "./project-finish-attestation-canonical.js"
import type { ProjectFinishAttestationReceipt } from "./project-finish-attestation-types.js"
import type {
  ProjectFinishAttestationVerifierAssessment,
  ProjectFinishAttestationVerifierState,
} from "./project-finish-attestation-verifier-types.js"
import { canonicalJson } from "./workflow-finish-attestation-canonical.js"

const CLOCK_SKEW_MS = 5 * 60 * 1000

const BLOCKED_SUMMARIES = {
  "binding-mismatch": "Project finish attestation bindings do not match the verified evidence.",
  "certificate-invalid": "Sigstore certificate or enrolled signer identity verification rejected the project finish attestation.",
  "crypto-failed": "Product-owned Sigstore verification rejected the project finish attestation.",
  "dns-unavailable": "DNS resolution for live Sigstore trust material is unavailable; project finish authority remains blocked.",
  malformed: "Project finish attestation evidence is malformed.",
  "malformed-bundle": "Project finish attestation Sigstore bundle is malformed.",
  missing: "No safe project finish attestation evidence is present.",
  "network-unavailable": "Online Sigstore trust material is unavailable; project finish authority remains blocked.",
  replayed: "Project finish attestation has already been consumed.",
  "runtime-unsupported": "Node.js does not meet the required Sigstore runtime range; project finish authority remains blocked.",
  "signature-invalid": "Sigstore signature verification rejected the project finish attestation.",
  "source-drift": "Current project source does not match the signed project finish attestation.",
  stale: "Project finish attestation is expired or outside the accepted clock skew.",
  "transparency-invalid": "Sigstore transparency evidence verification rejected the project finish attestation.",
  "trust-root-unavailable": "Live Sigstore trust-root material is unavailable or invalid; project finish authority remains blocked.",
  "verification-timeout": "Sigstore verification exceeded its fixed deadline; project finish authority remains blocked.",
  "wrong-policy": "Project finish attestation does not match the enrolled product policy.",
} as const satisfies Record<Exclude<ProjectFinishAttestationVerifierState, "trusted">, string>

export function blockedProjectFinishAttestation(
  state: Exclude<ProjectFinishAttestationVerifierState, "trusted">,
  path: string,
): ProjectFinishAttestationVerifierAssessment {
  return {
    authorityEligible: false,
    consumptionState: "not-applicable",
    decision: "blocked",
    diagnostics: [{ code: state, path }],
    state,
    summary: BLOCKED_SUMMARIES[state],
  }
}

export function trustedProjectFinishAttestation(
  receipt: ProjectFinishAttestationReceipt,
  consumptionState: "consumed" | "unconsumed",
): ProjectFinishAttestationVerifierAssessment {
  return {
    authorityEligible: true,
    consumptionState,
    decision: "trusted",
    diagnostics: [],
    receipt,
    state: "trusted",
    summary: "Signed enrolled public project finish attestation passed product-owned Sigstore, policy, source, freshness, and replay checks.",
  }
}

export function parseProjectFinishAttestationJson(bytes: Buffer): unknown | undefined {
  try {
    return JSON.parse(bytes.toString("utf8"))
  } catch {
    return undefined
  }
}

export function hasCanonicalProjectFinishAttestationBytes(bytes: Buffer, value: unknown): boolean {
  return bytes.equals(canonicalProjectFinishAttestationBytes(value))
}

export function hasFreshProjectFinishAttestation(
  receipt: ProjectFinishAttestationReceipt,
  now: Date,
): boolean {
  const issuedAt = Date.parse(receipt.lifecycle.issuedAt)
  const expiresAt = Date.parse(receipt.lifecycle.expiresAt)
  const nowMs = now.getTime()
  return Number.isFinite(issuedAt)
    && Number.isFinite(expiresAt)
    && expiresAt > nowMs
    && issuedAt <= nowMs + CLOCK_SKEW_MS
}

export function parsedProjectFinishAttestationState(
  diagnostics: readonly { readonly code: string }[],
): Exclude<ProjectFinishAttestationVerifierState, "trusted"> {
  if (diagnostics.some((diagnostic) => diagnostic.code === "binding-mismatch")) return "binding-mismatch"
  if (diagnostics.some((diagnostic) => diagnostic.code === "wrong-policy")) return "wrong-policy"
  return "malformed"
}

export function matchesCanonicalProjectFinishAttestationJson(
  bytes: Buffer,
  value: unknown,
  signedValue: unknown,
): boolean {
  return hasCanonicalProjectFinishAttestationBytes(bytes, value)
    && canonicalJson(value) === canonicalJson(signedValue)
}
