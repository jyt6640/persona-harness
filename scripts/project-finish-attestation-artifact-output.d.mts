export type ProjectFinishAttestationArtifactReservation = {
  readonly reservation: "project-finish-attestation-artifact-output.1"
}

export type ProjectFinishAttestationArtifactSet = {
  readonly predicate: Record<string, unknown>
  readonly receiptBytes: Buffer
}

export class ArtifactOutputError extends Error {}

export function reserveProjectFinishAttestationArtifactOutput(
  workspaceRoot: string,
): ProjectFinishAttestationArtifactReservation

export function materializeProjectFinishAttestationArtifactReservation(
  reservation: ProjectFinishAttestationArtifactReservation,
  artifacts: ProjectFinishAttestationArtifactSet,
): void

export function verifyProjectFinishAttestationArtifactReservation(
  reservation: ProjectFinishAttestationArtifactReservation,
): { readonly outputDirectory: string }

export function closeProjectFinishAttestationArtifactReservation(
  reservation: ProjectFinishAttestationArtifactReservation,
): void
