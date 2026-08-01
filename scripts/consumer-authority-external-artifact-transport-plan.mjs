import { isDeepStrictEqual } from "node:util"

const PLAN_SCHEMA_VERSION = "consumer-authority-external-artifact-transport-plan.1"
const PREFLIGHT_SCHEMA_VERSION = "consumer-authority-external-artifact-transport-preflight.1"
const API_ORIGIN = "https://api.github.com"
const CALLER_REPOSITORY = "jyt6640/persona-harness-attestation-claim-fixture"
const CALLER_REPOSITORY_ID = 1304576182
const CALLER_WORKFLOW_PATH = ".github/workflows/research-attestation.yml"
const MAX_ARCHIVE_BYTES = 8 * 1024 * 1024
const PUSH_MAIN_REF = "refs/heads/main"
const REUSABLE_REPOSITORY = "jyt6640/persona-harness"
const REUSABLE_WORKFLOW_PATH = ".github/workflows/persona-harness-project-finish.yml"
const SHA = /^[0-9a-f]{40}$/u
const SHA256 = /^sha256:[0-9a-f]{64}$/u

const EXPECTED_PLAN = Object.freeze({
  api: {
    accept: "application/vnd.github+json, application/octet-stream",
    origin: API_ORIGIN,
    version: "2022-11-28",
  },
  artifact: {
    maximumBytes: MAX_ARCHIVE_BYTES,
    source: "validated-actions-artifact-metadata",
  },
  endpoint: {
    method: "GET",
    path: "/repos/{caller-enrollment.repositorySlug}/actions/artifacts/{artifact.id}/zip",
  },
  output: {
    files: ["original.zip", "bundle.json"],
    root: "private-observer-mkdtemp",
    write: "no-follow-reserved-and-promote-after-validation",
  },
  redirect: {
    authorization: "api-origin-only",
    maximum: 1,
    permittedHosts: [
      "pipelines.actions.githubusercontent.com",
      "results-receiver.actions.githubusercontent.com",
      "*.blob.core.windows.net",
    ],
  },
  response: {
    contentTypes: ["application/octet-stream", "application/zip"],
    status: 200,
    timeoutMs: 15_000,
  },
  schemaVersion: PLAN_SCHEMA_VERSION,
})

export const EXTERNAL_ARTIFACT_TRANSPORT_PLAN_SCHEMA_VERSION = PLAN_SCHEMA_VERSION
export const EXTERNAL_ARTIFACT_TRANSPORT_PREFLIGHT_SCHEMA_VERSION = PREFLIGHT_SCHEMA_VERSION

export class ExternalArtifactTransportPlanError extends Error {
  constructor(code) {
    super(code)
    this.code = code
  }
}

export function canonicalExternalArtifactTransportPlan() {
  return structuredClone(EXPECTED_PLAN)
}

export function parseExternalArtifactTransportPlan(value) {
  if (!isDeepStrictEqual(value, EXPECTED_PLAN)) fail()
  return value
}

export function renderExternalArtifactTransportRequest(plan, topology, artifact) {
  parseExternalArtifactTransportPlan(plan)
  const parsedTopology = parseTopology(topology)
  const parsedArtifact = parseArtifact(artifact)
  const url = new URL(
    `/repos/${parsedTopology.callerEnrollment.repositorySlug}/actions/artifacts/${parsedArtifact.artifactId}/zip`,
    API_ORIGIN,
  )
  if (url.origin !== API_ORIGIN || url.pathname !== `/repos/${CALLER_REPOSITORY}/actions/artifacts/${parsedArtifact.artifactId}/zip`) fail()
  return {
    artifact: parsedArtifact,
    headers: {
      Accept: EXPECTED_PLAN.api.accept,
      "User-Agent": "persona-harness-external-observer",
      "X-GitHub-Api-Version": EXPECTED_PLAN.api.version,
    },
    topology: parsedTopology,
    url,
  }
}

export async function runExternalArtifactTransportPreflight() {
  try {
    renderExternalArtifactTransportRequest(
      canonicalExternalArtifactTransportPlan(),
      preflightTopology(),
      {
        artifactId: 710000017,
        expectedByteLength: 256,
        expectedSha256: `sha256:${"0".repeat(64)}`,
        runId: "30460000000",
      },
    )
    return {
      artifactAccess: false,
      authorityEligible: false,
      code: "external-artifact-transport-parser-accepted",
      credential: "absent",
      crypto: "not-run",
      networkAccess: false,
      schemaVersion: PREFLIGHT_SCHEMA_VERSION,
      state: "ready",
    }
  } catch {
    return blocked("external-artifact-transport-plan-unavailable")
  }
}

function parseTopology(value) {
  if (!isRecord(value) || !sameKeys(value, ["callerEnrollment", "callerSource", "reusableSigner"])) fail()
  const callerEnrollment = value.callerEnrollment
  const callerSource = value.callerSource
  const reusableSigner = value.reusableSigner
  if (
    !isRecord(callerEnrollment)
    || !sameKeys(callerEnrollment, ["repositoryId", "repositorySlug", "workflowPath", "workflowRef", "workflowSha"])
    || callerEnrollment.repositoryId !== CALLER_REPOSITORY_ID
    || callerEnrollment.repositorySlug !== CALLER_REPOSITORY
    || callerEnrollment.workflowPath !== CALLER_WORKFLOW_PATH
    || callerEnrollment.workflowRef !== PUSH_MAIN_REF
    || !isSha(callerEnrollment.workflowSha)
  ) fail()
  if (
    !isRecord(callerSource)
    || !sameKeys(callerSource, ["ref", "sourceSha"])
    || callerSource.ref !== PUSH_MAIN_REF
    || !isSha(callerSource.sourceSha)
  ) fail()
  if (
    !isRecord(reusableSigner)
    || !sameKeys(reusableSigner, ["repositorySlug", "workflowPath", "workflowSha"])
    || reusableSigner.repositorySlug !== REUSABLE_REPOSITORY
    || reusableSigner.workflowPath !== REUSABLE_WORKFLOW_PATH
    || !isSha(reusableSigner.workflowSha)
  ) fail()
  return { callerEnrollment, callerSource, reusableSigner }
}

function parseArtifact(value) {
  if (
    !isRecord(value)
    || !sameKeys(value, ["artifactId", "expectedByteLength", "expectedSha256", "runId"])
    || !isPositiveInteger(value.artifactId)
    || !isPositiveInteger(value.expectedByteLength)
    || value.expectedByteLength > MAX_ARCHIVE_BYTES
    || !isDigest(value.expectedSha256)
    || !isRunId(value.runId)
  ) fail()
  return value
}

function preflightTopology() {
  return {
    callerEnrollment: {
      repositoryId: CALLER_REPOSITORY_ID,
      repositorySlug: CALLER_REPOSITORY,
      workflowPath: CALLER_WORKFLOW_PATH,
      workflowRef: PUSH_MAIN_REF,
      workflowSha: "a".repeat(40),
    },
    callerSource: { ref: PUSH_MAIN_REF, sourceSha: "b".repeat(40) },
    reusableSigner: {
      repositorySlug: REUSABLE_REPOSITORY,
      workflowPath: REUSABLE_WORKFLOW_PATH,
      workflowSha: "c".repeat(40),
    },
  }
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isSha(value) {
  return typeof value === "string" && SHA.test(value)
}

function isDigest(value) {
  return typeof value === "string" && SHA256.test(value)
}

function isPositiveInteger(value) {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0
}

function isRunId(value) {
  return typeof value === "string" && /^[1-9][0-9]{0,18}$/u.test(value)
}

function sameKeys(value, expected) {
  const actual = Object.keys(value).sort()
  const sortedExpected = [...expected].sort()
  return actual.length === sortedExpected.length && actual.every((key, index) => key === sortedExpected[index])
}

function fail() {
  throw new ExternalArtifactTransportPlanError("external-artifact-transport-plan")
}
