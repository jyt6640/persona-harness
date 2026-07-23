export const SIGSTORE_NODE_ENGINE_RANGE: "^20.17.0 || >=22.9.0"

export type SigstoreNodeRuntimeAssessment = {
  readonly requiredRange: typeof SIGSTORE_NODE_ENGINE_RANGE
  readonly status: "supported" | "unsupported"
}

export function assessSigstoreNodeRuntime(version: string): SigstoreNodeRuntimeAssessment
