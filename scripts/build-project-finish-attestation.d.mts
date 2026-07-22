export type ProjectFinishAttestationBuilderResult =
  | { readonly code: string; readonly kind: "blocked" }
  | { readonly kind: "passed" }

export type ProjectFinishAttestationProducerContextResult =
  | { readonly code: string; readonly kind: "blocked" }
  | {
      readonly kind: "ready"
      readonly value: {
        readonly callerWorkflowRef: string
        readonly callerWorkflowSha: string
        readonly issuedAt: string
        readonly repository: {
          readonly id: number
          readonly slug: string
          readonly visibility: "public"
        }
        readonly reusableWorkflowSha: string
        readonly runAttempt: number
        readonly runId: string
        readonly sourceHead: string
      }
    }

export function runProjectFinishAttestationBuilder(input?: {
  readonly environment?: NodeJS.ProcessEnv
  readonly oidcToken?: unknown
  readonly producerRoot?: string
}): Promise<ProjectFinishAttestationBuilderResult>

export function readProjectFinishAttestationProducerContextFromToken(
  oidcToken: unknown,
  environment?: NodeJS.ProcessEnv,
): ProjectFinishAttestationProducerContextResult
