import { STAGED_PACKAGE_ARTIFACT_RUNNER_LABEL } from "./staged-package-artifact-attestation-core.mjs"
import { assessNativeStagedProducerContext } from "./staged-package-artifact-native-context-diagnostic.mjs"

const result = assessNativeStagedProducerContext({
  contextHead: process.env.GITHUB_SHA,
  event: process.env.GITHUB_EVENT_NAME,
  githubActions: process.env.GITHUB_ACTIONS,
  ref: process.env.GITHUB_REF,
  repository: process.env.GITHUB_REPOSITORY,
  repositoryId: process.env.GITHUB_REPOSITORY_ID,
  runnerEnvironment: process.env.RUNNER_ENVIRONMENT,
  runnerLabel: STAGED_PACKAGE_ARTIFACT_RUNNER_LABEL,
  runnerOs: process.env.RUNNER_OS,
  workflowRef: process.env.GITHUB_WORKFLOW_REF,
  workflowSha: process.env.GITHUB_WORKFLOW_SHA,
})

process.stdout.write(`${JSON.stringify(result)}\n`)
if (result.outcome !== "match") process.exitCode = 1
