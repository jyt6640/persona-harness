import { spawnSync } from "node:child_process"
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { isDeepStrictEqual } from "node:util"

import { assessObserverGhTool } from "./consumer-authority-observer-gh-tool.mjs"

const COMMAND_PLAN_SCHEMA_VERSION = "consumer-authority-external-attestation-command-plan.1"
const PREFLIGHT_SCHEMA_VERSION = "consumer-authority-external-attestation-preflight.1"
const FIXTURE_REPOSITORY = "jyt6640/persona-harness-attestation-claim-fixture"
const FIXTURE_REPOSITORY_ID = 1304576182
const REUSABLE_REPOSITORY = "jyt6640/persona-harness"
const REUSABLE_WORKFLOW_PATH = ".github/workflows/persona-harness-project-finish.yml"
const CALLER_WORKFLOW_PATH = ".github/workflows/research-attestation.yml"
const PUSH_MAIN_REF = "refs/heads/main"
const OIDC_ISSUER = "https://token.actions.githubusercontent.com"
const PREDICATE_TYPE = "https://github.com/jyt6640/persona-harness/attestations/project-finish-attestation.1"
const SHA = /^[0-9a-f]{40}$/u
const MAX_OUTPUT_BYTES = 64 * 1024
const PREFLIGHT_TIMEOUT_MS = 15_000

const EXPECTED_PLAN = Object.freeze({
  certificateOidcIssuer: OIDC_ISSUER,
  command: ["attestation", "verify"],
  denySelfHostedRunners: true,
  exitClassification: {
    authenticationRequired: 4,
    normalVerificationFailure: 1,
    verified: 0,
  },
  format: "json",
  predicateType: PREDICATE_TYPE,
  repositorySelector: {
    flag: "--repo",
    source: "caller-enrollment.repositorySlug",
  },
  schemaVersion: COMMAND_PLAN_SCHEMA_VERSION,
  signerDigest: {
    flag: "--signer-digest",
    source: "reusable-signer.workflowSha",
  },
  signerSelector: {
    flag: "--signer-workflow",
    source: "reusable-signer.workflowPath",
  },
  sourceDigest: {
    flag: "--source-digest",
    source: "caller-source.sourceSha",
  },
  sourceRef: {
    flag: "--source-ref",
    source: "caller-source.ref",
  },
  tokenIsolation: {
    artifactAccess: "forbidden-during-preflight",
    credential: "absent",
    output: "bounded-classification-only",
  },
})

export const EXTERNAL_ATTESTATION_COMMAND_PLAN_SCHEMA_VERSION = COMMAND_PLAN_SCHEMA_VERSION
export const EXTERNAL_ATTESTATION_PREFLIGHT_SCHEMA_VERSION = PREFLIGHT_SCHEMA_VERSION

export class ExternalAttestationCommandPlanError extends Error {
  constructor(code) {
    super(code)
    this.code = code
  }
}

export function canonicalExternalAttestationCommandPlan() {
  return structuredClone(EXPECTED_PLAN)
}

export function parseExternalAttestationCommandPlan(value) {
  if (!isDeepStrictEqual(value, EXPECTED_PLAN)) fail()
  return value
}

export function renderExternalAttestationVerifyArguments(plan, topology, inputs) {
  parseExternalAttestationCommandPlan(plan)
  const parsedTopology = parseTopology(topology)
  const parsedInputs = parseInputs(inputs)
  return [
    "attestation",
    "verify",
    parsedInputs.subjectPath,
    "--bundle",
    parsedInputs.bundlePath,
    "--repo",
    parsedTopology.callerEnrollment.repositorySlug,
    "--signer-workflow",
    `${parsedTopology.reusableSigner.repositorySlug}/${parsedTopology.reusableSigner.workflowPath}`,
    "--signer-digest",
    parsedTopology.reusableSigner.workflowSha,
    "--cert-oidc-issuer",
    OIDC_ISSUER,
    "--source-ref",
    parsedTopology.callerSource.ref,
    "--source-digest",
    parsedTopology.callerSource.sourceSha,
    "--predicate-type",
    PREDICATE_TYPE,
    "--deny-self-hosted-runners",
    "--format",
    "json",
  ]
}

export function classifyGhAttestationExit(status) {
  if (status === 0) return "verified"
  if (status === 1) return "verification-failed"
  if (status === 4) return "authentication-required"
  return "execution-failed"
}

export function runExternalAttestationGrammarPreflight(plan, topology, options = {}) {
  parseExternalAttestationCommandPlan(plan)
  parseTopology(topology)
  const execute = typeof options.execute === "function" ? options.execute : spawnSync
  const ghPath = options.ghPath
  const root = mkdtempSync(join(tmpdir(), "persona-external-attestation-preflight-"))
  try {
    const home = join(root, "home")
    mkdirSync(home, { recursive: true, mode: 0o700 })
    const tool = assessObserverGhTool(ghPath, { execute, stateRoot: home })
    if (tool.state !== "ready") return blocked(tool.code, "execution-failed")
    const bundlePath = join(root, "invalid-bundle.json")
    writeFileSync(bundlePath, "{\"format\":\"preflight\"}\n", { mode: 0o600 })
    const argumentsList = renderExternalAttestationVerifyArguments(plan, topology, {
      bundlePath,
      subjectPath: "/dev/null",
    })
    const result = execute(ghPath, argumentsList, {
      encoding: "utf8",
      env: noTokenEnvironment(home),
      maxBuffer: MAX_OUTPUT_BYTES,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
      timeout: PREFLIGHT_TIMEOUT_MS,
    })
    return classifyPreflightResult(result)
  } catch (error) {
    if (error instanceof ExternalAttestationCommandPlanError) throw error
    return blocked("gh-command-unavailable", "execution-failed")
  } finally {
    rmSync(root, { force: true, recursive: true })
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
    || callerEnrollment.repositoryId !== FIXTURE_REPOSITORY_ID
    || callerEnrollment.repositorySlug !== FIXTURE_REPOSITORY
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

function parseInputs(value) {
  if (!isRecord(value) || !sameKeys(value, ["bundlePath", "subjectPath"])) fail()
  if (!isSafeLocalPath(value.bundlePath) || !isSafeLocalPath(value.subjectPath)) fail()
  return value
}

function classifyPreflightResult(result) {
  const exit = classifyGhAttestationExit(result?.status)
  if (result?.error !== undefined) return blocked("gh-command-unavailable", exit)
  if (result?.status === 1 && isExpectedInvalidBundleDiagnostic(result?.stderr)) {
    return {
      artifactAccess: false,
      authorityEligible: false,
      code: "gh-command-parser-accepted",
      credential: "absent",
      exit,
      networkAccess: false,
      schemaVersion: PREFLIGHT_SCHEMA_VERSION,
      state: "ready",
    }
  }
  if (result?.status === 4) return blocked("gh-authentication-required", exit)
  if (result?.status === 1) return blocked("gh-command-parser-rejected", exit)
  return blocked("gh-command-unavailable", exit)
}

function noTokenEnvironment(home) {
  if (!isSafeLocalPath(home)) fail()
  return {
    GH_CONFIG_DIR: join(home, "gh-config"),
    GH_PROMPT_DISABLED: "1",
    HOME: home,
    LANG: "C",
    LC_ALL: "C",
    NO_COLOR: "1",
    XDG_CACHE_HOME: join(home, "cache"),
    XDG_CONFIG_HOME: join(home, "config"),
    XDG_STATE_HOME: join(home, "state"),
  }
}

function blocked(code, exit) {
  return {
    artifactAccess: false,
    authorityEligible: false,
    code,
    credential: "absent",
    exit,
    networkAccess: false,
    schemaVersion: PREFLIGHT_SCHEMA_VERSION,
    state: "blocked",
  }
}

function isExpectedInvalidBundleDiagnostic(value) {
  return typeof value === "string" && /bundle content could not be parsed/u.test(value)
}

function isSha(value) {
  return typeof value === "string" && SHA.test(value)
}

function isSafeLocalPath(value) {
  return typeof value === "string" && value.startsWith("/") && isSafePathValue(value)
}

function isSafePathValue(value) {
  return typeof value === "string" && value.length > 0 && value.length <= 4096 && !value.includes("\u0000")
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function sameKeys(value, expected) {
  const actual = Object.keys(value).sort()
  const sortedExpected = [...expected].sort()
  return actual.length === sortedExpected.length && actual.every((key, index) => key === sortedExpected[index])
}

function fail() {
  throw new ExternalAttestationCommandPlanError("external-attestation-command-plan")
}
