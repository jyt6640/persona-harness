import { assessStagedProducerContextDiagnostic } from "./staged-package-artifact-context-diagnostic-core.mjs"

const result = assessStagedProducerContextDiagnostic({
  event: process.env.GITHUB_EVENT_NAME,
  githubActions: process.env.GITHUB_ACTIONS,
  ref: process.env.GITHUB_REF,
  repository: process.env.GITHUB_REPOSITORY,
  repositoryId: process.env.GITHUB_REPOSITORY_ID,
  runnerEnvironment: process.env.RUNNER_ENVIRONMENT,
  runnerOs: process.env.RUNNER_OS,
  workflowRef: process.env.GITHUB_WORKFLOW_REF,
})

process.stdout.write(`${JSON.stringify(result)}\n`)
if (result.outcome !== "match") process.exitCode = 1
