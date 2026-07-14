export const EVIDENCE_PRIVACY_CLASS = {
  metadataSafe: "metadata-safe",
  promptDiagnostics: "redacted-prompt-diagnostics",
  redactedExecutionDiagnostics: "redacted-execution-diagnostics",
  trustedAttestationMetadata: "trusted-attestation-metadata",
} as const

export type EvidencePrivacyClass =
  (typeof EVIDENCE_PRIVACY_CLASS)[keyof typeof EVIDENCE_PRIVACY_CLASS]

export const EVIDENCE_MODE = {
  promptDiagnostics: "prompt_diagnostics",
  redactedDiagnostics: "redacted_diagnostics",
  safeMetadata: "safe_metadata",
} as const

export type EvidenceMode = (typeof EVIDENCE_MODE)[keyof typeof EVIDENCE_MODE]

/**
 * @deprecated Use `safe_metadata`. This alias remains accepted at the config
 * boundary and is normalized before runtime code observes it.
 */
export const LEGACY_METADATA_ONLY_EVIDENCE_MODE = "metadata_only"

export type EvidenceModeInput = EvidenceMode | typeof LEGACY_METADATA_ONLY_EVIDENCE_MODE

export const DEFAULT_EVIDENCE_MODE: EvidenceMode = EVIDENCE_MODE.safeMetadata

export function isEvidenceModeInput(value: unknown): value is EvidenceModeInput {
  return value === EVIDENCE_MODE.safeMetadata
    || value === EVIDENCE_MODE.redactedDiagnostics
    || value === EVIDENCE_MODE.promptDiagnostics
    || value === LEGACY_METADATA_ONLY_EVIDENCE_MODE
}

export function normalizeEvidenceMode(value: unknown): EvidenceMode {
  if (value === EVIDENCE_MODE.redactedDiagnostics || value === EVIDENCE_MODE.promptDiagnostics) {
    return value
  }
  return DEFAULT_EVIDENCE_MODE
}

export function allowsExecutionDiagnostics(mode: EvidenceMode): boolean {
  return mode === EVIDENCE_MODE.redactedDiagnostics || mode === EVIDENCE_MODE.promptDiagnostics
}

export function allowsPromptDiagnostics(mode: EvidenceMode): boolean {
  return mode === EVIDENCE_MODE.promptDiagnostics
}
