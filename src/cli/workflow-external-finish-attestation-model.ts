import { createHash } from "node:crypto"

import { isRecord } from "../config/jsonc.js"
import {
  FINISH_ATTESTATION_SCHEMA,
  CLEAN_CI_ARGV,
  CLEAN_CI_CATALOG_ID,
  CLEAN_CI_REF,
  CLEAN_CI_REPOSITORY,
  CLEAN_CI_WORKFLOW,
  type FinishAttestation,
  type FinishAttestationDiagnostic,
  type FinishAttestationParseResult,
} from "./workflow-external-finish-attestation-types.js"

const EMPTY_DIRTY_DIGEST = `sha256:${createHash("sha256").update("").digest("hex")}`
const RECEIPT_KEYS = [
  "schemaVersion", "sourceMode", "repository", "ref", "workflow", "workflowRef", "workflowSha",
  "runId", "runAttempt", "sourceHead", "dirtyWorktreeDigest", "workspaceIdentity", "command",
  "phVersion", "attemptId", "sessionId", "finishId", "artifactDigests", "test", "result",
  "issuedAt", "expiresAt", "nonce", "replayState",
] as const

export function parseFinishAttestation(text: string, path: string): FinishAttestationParseResult {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return failure("invalid-json", "Attestation receipt is not valid JSON.", path)
  }
  if (!isRecord(raw)) return failure("invalid-shape", "Attestation receipt must be a JSON object.", path)
  const diagnostics: FinishAttestationDiagnostic[] = []
  for (const key of Object.keys(raw)) {
    if (!(RECEIPT_KEYS as readonly string[]).includes(key)) diagnostics.push(diagnostic("unknown-field", `Unknown receipt field ${key}.`, path))
  }
  const values = {
    schemaVersion: textField(raw.schemaVersion, "schemaVersion", path, diagnostics),
    sourceMode: textField(raw.sourceMode, "sourceMode", path, diagnostics),
    repository: textField(raw.repository, "repository", path, diagnostics),
    ref: textField(raw.ref, "ref", path, diagnostics),
    workflow: textField(raw.workflow, "workflow", path, diagnostics),
    workflowRef: textField(raw.workflowRef, "workflowRef", path, diagnostics),
    workflowSha: commitField(raw.workflowSha, "workflowSha", path, diagnostics),
    runId: textField(raw.runId, "runId", path, diagnostics),
    runAttempt: positiveInteger(raw.runAttempt, "runAttempt", path, diagnostics),
    sourceHead: commitField(raw.sourceHead, "sourceHead", path, diagnostics),
    dirtyWorktreeDigest: digest(raw.dirtyWorktreeDigest, "dirtyWorktreeDigest", path, diagnostics),
    phVersion: textField(raw.phVersion, "phVersion", path, diagnostics),
    attemptId: textField(raw.attemptId, "attemptId", path, diagnostics),
    sessionId: textField(raw.sessionId, "sessionId", path, diagnostics),
    finishId: textField(raw.finishId, "finishId", path, diagnostics),
    issuedAt: timestamp(raw.issuedAt, "issuedAt", path, diagnostics),
    expiresAt: timestamp(raw.expiresAt, "expiresAt", path, diagnostics),
    nonce: textField(raw.nonce, "nonce", path, diagnostics),
    replayState: textField(raw.replayState, "replayState", path, diagnostics),
  }
  const workspace = parseWorkspace(raw.workspaceIdentity, path, diagnostics)
  const command = parseCommand(raw.command, path, diagnostics)
  const artifacts = parseArtifacts(raw.artifactDigests, path, diagnostics)
  const test = parseTest(raw.test, path, diagnostics)
  const result = parseResult(raw.result, path, diagnostics)
  if (values.schemaVersion !== FINISH_ATTESTATION_SCHEMA) diagnostics.push(diagnostic("unsupported-schema", "Unsupported attestation schema.", path))
  if (values.sourceMode !== "clean-ci") diagnostics.push(diagnostic("invalid-source-mode", "Only clean-CI attestations are authority candidates.", path))
  if (
    values.repository !== CLEAN_CI_REPOSITORY
    || values.ref !== CLEAN_CI_REF
    || values.workflow !== CLEAN_CI_WORKFLOW
    || values.workflowRef !== `${CLEAN_CI_REPOSITORY}/${CLEAN_CI_WORKFLOW}@${CLEAN_CI_REF}`
  ) {
    diagnostics.push(diagnostic("untrusted-builder", "Attestation builder identity is not the product-owned clean-CI workflow.", path))
  }
  if (command !== undefined && (command.catalogId !== CLEAN_CI_CATALOG_ID || JSON.stringify(command.argv) !== JSON.stringify(CLEAN_CI_ARGV))) {
    diagnostics.push(diagnostic("fixed-command-mismatch", "Attestation command does not match the product-owned clean-CI catalog.", path))
  }
  if (values.dirtyWorktreeDigest !== EMPTY_DIRTY_DIGEST) diagnostics.push(diagnostic("dirty-worktree", "Attestation does not bind an explicitly clean worktree.", path))
  if (values.replayState !== "unconsumed") diagnostics.push(diagnostic("replay-state", "Attestation replay state is not fresh.", path))
  if (test !== undefined && result !== undefined && (test.count < 1 || !test.passed || result.testCount < 1 || result.testCount !== test.count)) {
    diagnostics.push(diagnostic("test-count", "Attestation must bind a nonzero passing test count.", path))
  }
  if (
    diagnostics.length > 0
    || workspace === undefined
    || command === undefined
    || artifacts === undefined
    || test === undefined
    || result === undefined
    || Object.values(values).some((value) => value === undefined)
  ) {
    return { ok: false, diagnostics }
  }
  return {
    ok: true,
    diagnostics: [],
    value: {
      schemaVersion: FINISH_ATTESTATION_SCHEMA,
      sourceMode: "clean-ci",
      repository: values.repository as string,
      ref: values.ref as string,
      workflow: values.workflow as string,
      workflowRef: values.workflowRef as string,
      workflowSha: values.workflowSha as string,
      runId: values.runId as string,
      runAttempt: values.runAttempt as number,
      sourceHead: values.sourceHead as string,
      dirtyWorktreeDigest: values.dirtyWorktreeDigest as string,
      phVersion: values.phVersion as string,
      attemptId: values.attemptId as string,
      sessionId: values.sessionId as string,
      finishId: values.finishId as string,
      issuedAt: values.issuedAt as string,
      expiresAt: values.expiresAt as string,
      nonce: values.nonce as string,
      replayState: "unconsumed",
      workspaceIdentity: workspace,
      command,
      artifactDigests: artifacts,
      test,
      result,
    },
  }
}

function parseWorkspace(value: unknown, path: string, diagnostics: FinishAttestationDiagnostic[]): FinishAttestation["workspaceIdentity"] | undefined {
  if (!isRecord(value)) {
    diagnostics.push(diagnostic("invalid-workspace", "workspaceIdentity is required.", path))
    return undefined
  }
  const kind = textField(value.kind, "workspaceIdentity.kind", path, diagnostics)
  const runnerEnvironment = textField(value.runnerEnvironment, "workspaceIdentity.runnerEnvironment", path, diagnostics)
  const identity = textField(value.identity, "workspaceIdentity.identity", path, diagnostics)
  if (kind !== "github-hosted-runner" || runnerEnvironment !== "github-hosted" || identity === undefined) {
    diagnostics.push(diagnostic("invalid-workspace", "workspaceIdentity must describe a GitHub-hosted runner.", path))
    return undefined
  }
  return { kind: "github-hosted-runner", runnerEnvironment: "github-hosted", identity }
}

function parseCommand(value: unknown, path: string, diagnostics: FinishAttestationDiagnostic[]): FinishAttestation["command"] | undefined {
  if (!isRecord(value) || !Array.isArray(value.argv) || value.argv.some((item) => typeof item !== "string")) {
    diagnostics.push(diagnostic("invalid-command", "command must bind a fixed argv.", path))
    return undefined
  }
  const catalogId = textField(value.catalogId, "command.catalogId", path, diagnostics)
  const argvDigest = digest(value.argvDigest, "command.argvDigest", path, diagnostics)
  if (catalogId === undefined || argvDigest === undefined) return undefined
  return { catalogId, argv: value.argv, argvDigest }
}

function parseArtifacts(value: unknown, path: string, diagnostics: FinishAttestationDiagnostic[]): FinishAttestation["artifactDigests"] | undefined {
  if (!Array.isArray(value)) {
    diagnostics.push(diagnostic("invalid-artifacts", "artifactDigests must be an array.", path))
    return undefined
  }
  const result: { name: string; digest: string }[] = []
  for (const item of value) {
    if (!isRecord(item)) {
      diagnostics.push(diagnostic("invalid-artifacts", "artifactDigests contains a non-object.", path))
      continue
    }
    const name = textField(item.name, "artifact.name", path, diagnostics)
    const itemDigest = digest(item.digest, "artifact.digest", path, diagnostics)
    if (name !== undefined && itemDigest !== undefined) result.push({ name, digest: itemDigest })
  }
  return result
}

function parseTest(value: unknown, path: string, diagnostics: FinishAttestationDiagnostic[]): FinishAttestation["test"] | undefined {
  if (!isRecord(value)) {
    diagnostics.push(diagnostic("invalid-test", "test is required.", path))
    return undefined
  }
  const identity = textField(value.identity, "test.identity", path, diagnostics)
  const count = positiveInteger(value.count, "test.count", path, diagnostics)
  if (identity === undefined || count === undefined || value.passed !== true) {
    diagnostics.push(diagnostic("invalid-test", "test must contain a passing nonzero result.", path))
    return undefined
  }
  return { identity, count, passed: true }
}

function parseResult(value: unknown, path: string, diagnostics: FinishAttestationDiagnostic[]): FinishAttestation["result"] | undefined {
  if (!isRecord(value) || value.status !== "pass") {
    diagnostics.push(diagnostic("invalid-result", "result.status must be pass.", path))
    return undefined
  }
  const testCount = positiveInteger(value.testCount, "result.testCount", path, diagnostics)
  return testCount === undefined ? undefined : { status: "pass", testCount }
}

function textField(value: unknown, field: string, path: string, diagnostics: FinishAttestationDiagnostic[]): string | undefined {
  if (typeof value !== "string" || value.length === 0 || value.length > 512) {
    diagnostics.push(diagnostic("invalid-field", `${field} must be a bounded string.`, path))
    return undefined
  }
  return value
}

function digest(value: unknown, field: string, path: string, diagnostics: FinishAttestationDiagnostic[]): string | undefined {
  if (typeof value !== "string" || !/^sha256:[0-9a-f]{64}$/u.test(value)) {
    diagnostics.push(diagnostic("invalid-digest", `${field} must be a sha256 digest.`, path))
    return undefined
  }
  return value
}

function commitField(value: unknown, field: string, path: string, diagnostics: FinishAttestationDiagnostic[]): string | undefined {
  if (typeof value !== "string" || !/^[a-f0-9]{40}$/u.test(value)) {
    diagnostics.push(diagnostic("invalid-commit", `${field} must be a commit identity.`, path))
    return undefined
  }
  return value
}

function positiveInteger(value: unknown, field: string, path: string, diagnostics: FinishAttestationDiagnostic[]): number | undefined {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1) {
    diagnostics.push(diagnostic("invalid-number", `${field} must be a positive integer.`, path))
    return undefined
  }
  return value
}

function timestamp(value: unknown, field: string, path: string, diagnostics: FinishAttestationDiagnostic[]): string | undefined {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) {
    diagnostics.push(diagnostic("invalid-timestamp", `${field} must be an ISO timestamp.`, path))
    return undefined
  }
  return value
}

function diagnostic(code: string, message: string, path: string): FinishAttestationDiagnostic {
  return { code, message, path }
}

function failure(code: string, message: string, path: string): FinishAttestationParseResult {
  return { ok: false, diagnostics: [diagnostic(code, message, path)] }
}
