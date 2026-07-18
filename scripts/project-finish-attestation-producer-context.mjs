export const PROJECT_FINISH_PRODUCER_CONTEXT_FAILURE = "project-finish-producer-context"

const CALLER_WORKFLOW_PATH = /^\.github\/workflows\/[A-Za-z0-9][A-Za-z0-9._-]{0,127}\.ya?ml$/u
const IMMUTABLE_SHA = /^[a-f0-9]{40}$/u
const POSITIVE_INTEGER = /^[1-9][0-9]*$/u
const PRODUCER_REPOSITORY = "jyt6640/persona-harness"
const PRODUCER_WORKFLOW_PATH = ".github/workflows/persona-harness-project-finish.yml"
const SECRET_SHAPED_VALUE = /(?:api[_-]?key|bearer|password|sk-[A-Za-z0-9_-]{16,}|jdbc:[^/\s]+\/\/[^/\s]+:[^@\s]+@|-----BEGIN [A-Z ]+-----)/iu

export class ProjectFinishProducerContextError extends Error {
  constructor() {
    super(PROJECT_FINISH_PRODUCER_CONTEXT_FAILURE)
  }
}

export function deriveProjectFinishProducerContext(claims, environment) {
  const repository = requiredClaim(claims, "repository")
  const repositoryId = requiredClaim(claims, "repository_id")
  const eventName = requiredClaim(claims, "event_name")
  const ref = requiredClaim(claims, "ref")
  const repositoryVisibility = requiredClaim(claims, "repository_visibility")
  const callerWorkflowRef = requiredClaim(claims, "workflow_ref")
  const callerWorkflowSha = requiredClaim(claims, "workflow_sha")
  const reusableWorkflowRef = requiredClaim(claims, "job_workflow_ref")
  const observedReusableWorkflowSha = requiredClaim(claims, "job_workflow_sha")
  const claimRunId = requiredClaim(claims, "run_id")
  const claimRunAttempt = requiredClaim(claims, "run_attempt")
  const runnerEnvironment = requiredClaim(claims, "runner_environment")
  const githubEventName = requiredEnvironment(environment, "GITHUB_EVENT_NAME")
  const githubRef = requiredEnvironment(environment, "GITHUB_REF")
  const githubRepository = requiredEnvironment(environment, "GITHUB_REPOSITORY")
  const githubRepositoryId = requiredEnvironment(environment, "GITHUB_REPOSITORY_ID")
  const githubRepositoryVisibility = requiredEnvironment(environment, "GITHUB_REPOSITORY_VISIBILITY")
  const sourceHead = requiredEnvironment(environment, "GITHUB_SHA")
  const producerSha = requiredEnvironment(environment, "PERSONA_HARNESS_PRODUCER_SHA")
  const runId = requiredEnvironment(environment, "GITHUB_RUN_ID")
  const runAttemptValue = requiredEnvironment(environment, "GITHUB_RUN_ATTEMPT")
  const runAttempt = positiveInteger(runAttemptValue)

  if (
    githubEventName !== "push"
    || eventName !== githubEventName
    || githubRef !== "refs/heads/main"
    || ref !== githubRef
    || githubRepository !== repository
    || githubRepositoryId !== repositoryId
    || githubRepositoryVisibility !== "public"
    || repositoryVisibility !== githubRepositoryVisibility
    || !IMMUTABLE_SHA.test(sourceHead)
    || sourceHead !== callerWorkflowSha
    || !isCallerWorkflowRef(callerWorkflowRef, repository)
    || !IMMUTABLE_SHA.test(producerSha)
    || !isReusableWorkflowRef(reusableWorkflowRef)
    || observedReusableWorkflowSha !== producerSha
    || claimRunId !== runId
    || claimRunAttempt !== runAttemptValue
    || runnerEnvironment !== "github-hosted"
  ) {
    throw new ProjectFinishProducerContextError()
  }

  return {
    callerWorkflowRef,
    callerWorkflowSha,
    issuedAt: new Date().toISOString(),
    repository: {
      id: positiveInteger(repositoryId),
      slug: repository,
      visibility: "public",
    },
    reusableWorkflowSha: producerSha,
    runAttempt,
    runId,
    sourceHead,
  }
}

function isCallerWorkflowRef(value, repository) {
  const prefix = `${repository}/`
  if (
    SECRET_SHAPED_VALUE.test(value)
    || !value.startsWith(prefix)
    || !value.endsWith("@refs/heads/main")
  ) {
    return false
  }
  const path = value.slice(prefix.length, -"@refs/heads/main".length)
  return CALLER_WORKFLOW_PATH.test(path)
}

function isReusableWorkflowRef(value) {
  const target = `${PRODUCER_REPOSITORY}/${PRODUCER_WORKFLOW_PATH}`
  return value === `${target}@refs/heads/main`
}

function positiveInteger(value) {
  if (!POSITIVE_INTEGER.test(value)) throw new ProjectFinishProducerContextError()
  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed)) throw new ProjectFinishProducerContextError()
  return parsed
}

function requiredClaim(claims, key) {
  if (!isRecord(claims)) throw new ProjectFinishProducerContextError()
  const value = claims[key]
  if (typeof value !== "string" || value.length === 0 || value.length > 512 || /[\u0000\r\n]/u.test(value)) {
    throw new ProjectFinishProducerContextError()
  }
  return value
}

function requiredEnvironment(environment, key) {
  if (!isRecord(environment)) throw new ProjectFinishProducerContextError()
  const value = environment[key]
  if (typeof value !== "string" || value.length === 0 || value.length > 512 || /[\u0000\r\n]/u.test(value)) {
    throw new ProjectFinishProducerContextError()
  }
  return value
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
