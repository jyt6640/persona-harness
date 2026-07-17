export function verifyStagedPackageArtifactEvidence(
  input: Readonly<Record<string, unknown>>,
): Promise<{
  readonly channel: string
  readonly sourceHead: string
  readonly subjectDigest: string
  readonly version: string
}>
