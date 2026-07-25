export type ProjectFinishTrustRootFailureState =
  | "dns-unavailable"
  | "network-unavailable"
  | "trust-root-unavailable"
  | "verification-timeout"

export type ProjectFinishVerificationFailureState =
  | "certificate-invalid"
  | "crypto-failed"
  | "signature-invalid"
  | "transparency-invalid"

export function classifyProjectFinishTrustRootError(
  error: unknown,
): ProjectFinishTrustRootFailureState

export function classifyProjectFinishVerificationError(
  error: unknown,
): ProjectFinishVerificationFailureState
