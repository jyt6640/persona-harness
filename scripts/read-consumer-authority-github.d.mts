export class ConsumerAuthorityGithubReadbackError extends Error {
  readonly code: string
}

export function readConsumerAuthorityGithubEnrollment(
  input: {
    readonly repositorySlug: string
    readonly workflowPath: string
  },
  request?: (url: URL) => Promise<unknown>,
): Promise<{
  readonly callerWorkflowPath: string
  readonly repositoryId: number
  readonly repositorySlug: string
  readonly reusableWorkflowSha: string
}>
