export const PROJECT_FINISH_PRODUCER_CONTEXT_FAILURE = "project-finish-producer-context"
export const PROJECT_FINISH_PRODUCER_DIAGNOSTIC_WORKFLOW_PATH =
  ".github/workflows/persona-harness-project-finish-context-diagnostic.yml"

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
  const assessment = analyzeContext(claims, environment, PRODUCER_WORKFLOW_PATH)
  if (assessment.outcome !== "match") {
    throw new ProjectFinishProducerContextError()
  }

  const {
    callerWorkflowRef,
    callerWorkflowSha,
    producerSha,
    repository,
    repositoryId,
    runAttempt,
    runId,
    sourceHead,
  } = assessment.value
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

export function assessProjectFinishProducerContextDiagnosticWorkflow(claims, environment) {
  return analyzeContext(claims, environment, PROJECT_FINISH_PRODUCER_DIAGNOSTIC_WORKFLOW_PATH, true)
}

function analyzeContext(claims, environment, workflowPath, requireDiagnosticForwarding = false) {
  const claimRecord = isRecord(claims) ? claims : {}
  const environmentRecord = isRecord(environment) ? environment : {}
  const repository = boundedValue(claimRecord.repository)
  const repositoryId = boundedValue(claimRecord.repository_id)
  const eventName = boundedValue(claimRecord.event_name)
  const ref = boundedValue(claimRecord.ref)
  const repositoryVisibility = boundedValue(claimRecord.repository_visibility)
  const callerWorkflowRef = boundedValue(claimRecord.workflow_ref)
  const callerWorkflowSha = boundedValue(claimRecord.workflow_sha)
  const reusableWorkflowRef = boundedValue(claimRecord.job_workflow_ref)
  const observedReusableWorkflowSha = boundedValue(claimRecord.job_workflow_sha)
  const claimRunId = boundedValue(claimRecord.run_id)
  const claimRunAttempt = boundedValue(claimRecord.run_attempt)
  const runnerEnvironment = boundedValue(claimRecord.runner_environment)
  const githubEventName = boundedValue(environmentRecord.GITHUB_EVENT_NAME)
  const githubRef = boundedValue(environmentRecord.GITHUB_REF)
  const githubRepository = boundedValue(environmentRecord.GITHUB_REPOSITORY)
  const githubRepositoryId = boundedValue(environmentRecord.GITHUB_REPOSITORY_ID)
  const githubRepositoryVisibility = boundedValue(environmentRecord.GITHUB_REPOSITORY_VISIBILITY)
  const sourceHead = boundedValue(environmentRecord.GITHUB_SHA)
  const observedCallerWorkflowRef = boundedValue(environmentRecord.GITHUB_WORKFLOW_REF)
  const observedCallerWorkflowSha = boundedValue(environmentRecord.GITHUB_WORKFLOW_SHA)
  const producerSha = boundedValue(environmentRecord.PERSONA_HARNESS_PRODUCER_SHA)
  const diagnosticWorkflowRef = boundedValue(environmentRecord.PERSONA_HARNESS_DIAGNOSTIC_WORKFLOW_REF)
  const diagnosticWorkflowSha = boundedValue(environmentRecord.PERSONA_HARNESS_DIAGNOSTIC_WORKFLOW_SHA)
  const runId = boundedValue(environmentRecord.GITHUB_RUN_ID)
  const runAttemptValue = boundedValue(environmentRecord.GITHUB_RUN_ATTEMPT)
  const expectedReusableWorkflowRef = producerSha === undefined
    ? undefined
    : `${PRODUCER_REPOSITORY}/${workflowPath}@${producerSha}`
  const fields = [
    statusForFixedPair("event", eventName, githubEventName, "push"),
    statusForFixedPair("ref", ref, githubRef, "refs/heads/main"),
    statusForEqualPair("repository", repository, githubRepository),
    statusForEqualPair("repository-id", repositoryId, githubRepositoryId, isPositiveInteger),
    statusForFixedPair("repository-visibility", repositoryVisibility, githubRepositoryVisibility, "public"),
    statusForCallerWorkflowSha(
      callerWorkflowSha,
      observedCallerWorkflowSha,
      requireDiagnosticForwarding,
    ),
    statusForSourceHead(callerWorkflowSha, sourceHead),
    statusForCallerWorkflowRef(
      callerWorkflowRef,
      repository,
      observedCallerWorkflowRef,
      requireDiagnosticForwarding,
    ),
    statusForValue("producer-pin", producerSha, isImmutableSha),
    statusForReusableWorkflowRef(
      reusableWorkflowRef,
      expectedReusableWorkflowRef,
      diagnosticWorkflowRef,
      requireDiagnosticForwarding,
    ),
    statusForReusableWorkflowSha(
      observedReusableWorkflowSha,
      producerSha,
      diagnosticWorkflowSha,
      requireDiagnosticForwarding,
    ),
    statusForEqualPair("run-id", claimRunId, runId),
    statusForEqualPair("run-attempt", claimRunAttempt, runAttemptValue, isPositiveInteger),
    statusForFixed("runner-environment", runnerEnvironment, "github-hosted"),
  ]
  const outcome = fields.every((field) => field.status === "match") ? "match" : "blocked"
  return {
    diagnosticCodes: fields
      .filter((field) => field.status !== "match")
      .map((field) => `${PROJECT_FINISH_PRODUCER_CONTEXT_FAILURE}-${field.code}-${field.status}`),
    fields,
    outcome,
    value: outcome === "match"
      ? {
        callerWorkflowRef,
        callerWorkflowSha,
        producerSha,
        repository,
        repositoryId,
        runAttempt: positiveInteger(runAttemptValue),
        runId,
        sourceHead,
      }
      : undefined,
  }
}

function statusForCallerWorkflowSha(value, observed, requireDiagnosticForwarding) {
  if (
    value === undefined
    || (requireDiagnosticForwarding && observed === undefined)
  ) {
    return field("caller-workflow-sha", "missing")
  }
  return field(
    "caller-workflow-sha",
    isImmutableSha(value)
      && (!requireDiagnosticForwarding || value === observed)
      ? "match"
      : "mismatch",
  )
}

function statusForSourceHead(value, sourceHead) {
  if (value === undefined || sourceHead === undefined) return field("source-head", "missing")
  return field(
    "source-head",
    isImmutableSha(value) && value === sourceHead ? "match" : "mismatch",
  )
}

function statusForCallerWorkflowRef(value, repository, observed, requireDiagnosticForwarding) {
  if (
    value === undefined
    || repository === undefined
    || (requireDiagnosticForwarding && observed === undefined)
  ) {
    return field("caller-workflow-ref", "missing")
  }
  return field(
    "caller-workflow-ref",
    isCallerWorkflowRef(value, repository)
      && (!requireDiagnosticForwarding || value === observed)
      ? "match"
      : "mismatch",
  )
}

function statusForReusableWorkflowRef(value, expected, observed, requireDiagnosticForwarding) {
  if (value === undefined || expected === undefined || (requireDiagnosticForwarding && observed === undefined)) {
    return field("reusable-workflow-ref", "missing")
  }
  return field(
    "reusable-workflow-ref",
    value === expected
      && (!requireDiagnosticForwarding || observed === expected)
      ? "match"
      : "mismatch",
  )
}

function statusForReusableWorkflowSha(value, producerSha, observed, requireDiagnosticForwarding) {
  if (
    value === undefined
    || producerSha === undefined
    || (requireDiagnosticForwarding && observed === undefined)
  ) {
    return field("reusable-workflow-sha", "missing")
  }
  return field(
    "reusable-workflow-sha",
    isImmutableSha(value)
      && value === producerSha
      && (!requireDiagnosticForwarding || value === observed)
      ? "match"
      : "mismatch",
  )
}

function statusForFixed(code, value, expected) {
  if (value === undefined) return field(code, "missing")
  return field(code, value === expected ? "match" : "mismatch")
}

function statusForFixedPair(code, left, right, expected) {
  if (left === undefined || right === undefined) return field(code, "missing")
  return field(code, left === expected && right === expected ? "match" : "mismatch")
}

function statusForValue(code, value, validator) {
  if (value === undefined) return field(code, "missing")
  return field(code, validator(value) ? "match" : "mismatch")
}

function statusForEqualPair(code, left, right, validator = () => true) {
  if (left === undefined || right === undefined) return field(code, "missing")
  return field(code, validator(left) && validator(right) && left === right ? "match" : "mismatch")
}

function field(code, status) {
  return { code, status }
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

function boundedValue(value) {
  return typeof value === "string" && value.length > 0 && value.length <= 512 && !/[\u0000\r\n]/u.test(value)
    ? value
    : undefined
}

function positiveInteger(value) {
  if (!POSITIVE_INTEGER.test(value)) throw new ProjectFinishProducerContextError()
  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed)) throw new ProjectFinishProducerContextError()
  return parsed
}

function isImmutableSha(value) {
  return IMMUTABLE_SHA.test(value)
}

function isPositiveInteger(value) {
  return POSITIVE_INTEGER.test(value) && Number.isSafeInteger(Number(value))
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
