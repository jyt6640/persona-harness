export class StagedPackageArtifactProvenanceError extends Error {
  readonly code: string
}

export function verifyStagedPackageArtifactStatement(
  input: Readonly<Record<string, unknown>>,
): {
  readonly sourceHead: string
  readonly subjectDigest: string
}
