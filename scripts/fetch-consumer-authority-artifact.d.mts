export class ConsumerAuthorityArtifactFetchError extends Error {
  readonly code: string
}

export function authorityGithubRequestHeaders(
  url: URL,
  token: string | undefined,
): Readonly<Record<string, string>>

export function extractOriginalArtifactMembers(archive: Buffer): {
  readonly bundle: Buffer
  readonly predicate: Buffer
  readonly receipt: Buffer
}

export function fetchConsumerAuthorityArtifact(
  input: {
    readonly callerWorkflowPath: string
    readonly expected: {
      readonly artifactDigest: string
      readonly artifactId: number
      readonly runId: string
      readonly sourceHead: string
    }
    readonly repositoryId: number
    readonly repositorySlug: string
    readonly sourceHead: string
  },
  transport?: {
    readonly archive: (url: URL) => Promise<Buffer>
    readonly json: (url: URL) => Promise<unknown>
  },
): Promise<{
  readonly artifactId: number
  readonly artifactDigest: string
  readonly archive: Buffer
  readonly bundle: Buffer
  readonly predicate: Buffer
  readonly receipt: Buffer
  readonly runId: string
}>
