export function extractOriginalArtifactMembers(archive: Buffer): {
  readonly bundle: Buffer
  readonly predicate: Buffer
  readonly receipt: Buffer
}
