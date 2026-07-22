export type ProjectFinishAttestationArtifactHandoffResult =
  | { readonly code: "project-finish-producer-artifact-handoff"; readonly kind: "blocked" }
  | { readonly kind: "ready" }

export function verifyProjectFinishAttestationArtifactHandoff(input?: {
  readonly environment?: NodeJS.ProcessEnv
  readonly phase?: "signed" | "unsigned"
}): ProjectFinishAttestationArtifactHandoffResult

export function collectProjectFinishAttestationBundle(input?: {
  readonly environment?: NodeJS.ProcessEnv
}): ProjectFinishAttestationArtifactHandoffResult
