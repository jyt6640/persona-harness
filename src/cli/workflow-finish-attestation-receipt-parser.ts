import { isRecord } from "../config/jsonc.js"
import { parseSourceIdentity } from "./source-identity-types.js"
import { canonicalJson, sha256Digest } from "./workflow-finish-attestation-canonical.js"
import {
  FINISH_ATTESTATION_COMMAND_CATALOG,
  FINISH_ATTESTATION_POLICY,
  FINISH_ATTESTATION_SCHEMA,
  FINISH_ATTESTATION_PREDICATE_TYPE,
  FINISH_ATTESTATION_WORKFLOW_PATH,
  FINISH_ATTESTATION_WORKFLOW_REF,
  type FinishAttestationCommand,
  type FinishAttestationCommandResult,
  type FinishAttestationDiagnostic,
  type FinishAttestationReceipt,
} from "./workflow-finish-attestation-types.js"

const EMPTY_DIGEST = sha256Digest(Buffer.alloc(0))
const COMMIT_PATTERN = /^[a-f0-9]{40,64}$/iu
const DIGEST_PATTERN = /^sha256:[a-f0-9]{64}$/u

export function readFinishAttestationReceipt(value: unknown, diagnostics: FinishAttestationDiagnostic[]): FinishAttestationReceipt | undefined {
  if (!isRecord(value)) {
    diagnostics.push(invalid("predicate.receipt", "Receipt must be an object."))
    return undefined
  }
  const expectedKeys = [
    "authorityBoundary", "authorityEligible", "command", "event", "expiresAt", "finishId",
    "issuedAt", "nonce", "pack", "phVersion", "predicateType", "ref", "repository",
    "repositoryId", "replayState", "runAttempt", "runId", "attemptId", "schemaVersion",
    "sessionId", "source", "test", "workflow", "runner",
  ] as const
  if (!exactKeys(value, expectedKeys)) {
    diagnostics.push(invalid("predicate.receipt", "Receipt has unknown or missing fields."))
    return undefined
  }
  if (
    value.authorityBoundary !== "external-attested"
    || value.authorityEligible !== true
    || value.event !== FINISH_ATTESTATION_POLICY.event
    || value.predicateType !== FINISH_ATTESTATION_POLICY.predicateType
    || value.ref !== FINISH_ATTESTATION_POLICY.ref
    || value.repository !== FINISH_ATTESTATION_POLICY.repository
    || value.repositoryId !== FINISH_ATTESTATION_POLICY.repositoryId
    || value.replayState !== "unconsumed"
    || value.schemaVersion !== FINISH_ATTESTATION_SCHEMA
  ) {
    diagnostics.push(wrong("predicate.receipt", "Receipt does not match immutable repository, event, ref, or schema policy."))
    return undefined
  }
  if (!isIdentifier(value.attemptId) || !isIdentifier(value.finishId) || !isIdentifier(value.nonce) || !isIdentifier(value.runId) || !isIdentifier(value.sessionId)) {
    diagnostics.push(invalid("predicate.receipt.identity", "Receipt request identity fields must be non-empty identifiers."))
    return undefined
  }
  if (!isVersion(value.phVersion) || !isPositiveInteger(value.runAttempt)) {
    diagnostics.push(invalid("predicate.receipt.identity", "Receipt version, run attempt, or source identity is invalid."))
    return undefined
  }
  const source = readSource(value.source, diagnostics)
  const command = readCommand(value.command, diagnostics)
  const test = readTest(value.test, diagnostics)
  const pack = readPack(value.pack, diagnostics)
  const workflow = readWorkflow(value.workflow, source?.head, diagnostics)
  const runner = readRunner(value.runner, diagnostics)
  if (source === undefined || command === undefined || test === undefined || pack === undefined || workflow === undefined || runner === undefined) {
    return undefined
  }
  if (
    value.attemptId !== `clean-ci-builder-attempt-${value.runId}-${value.runAttempt}`
    || value.finishId !== `clean-ci-builder-finish-${value.runId}-${value.runAttempt}`
    || value.nonce !== `clean-ci-builder-${value.runId}-${value.runAttempt}-${source.head}`
    || value.sessionId !== `clean-ci-builder-session-${value.runId}-${value.runAttempt}`
    || pack.name !== "persona-harness"
    || pack.version !== value.phVersion
  ) {
    diagnostics.push(wrong("predicate.receipt.identity", "Receipt request, nonce, package, or session bindings do not match the fixed builder contract."))
    return undefined
  }
  const lifecycle = readLifecycle(value.issuedAt, value.expiresAt, diagnostics)
  if (!lifecycle) return undefined
  return {
    authorityBoundary: "external-attested",
    authorityEligible: true,
    command,
    event: "push",
    expiresAt: lifecycle.expiresAt,
    finishId: value.finishId,
    issuedAt: lifecycle.issuedAt,
    nonce: value.nonce,
    pack,
    phVersion: value.phVersion,
    predicateType: FINISH_ATTESTATION_PREDICATE_TYPE,
    ref: "refs/heads/main",
    repository: "jyt6640/persona-harness",
    repositoryId: 1272008570,
    replayState: "unconsumed",
    runAttempt: value.runAttempt,
    runId: value.runId,
    attemptId: value.attemptId,
    schemaVersion: FINISH_ATTESTATION_SCHEMA,
    sessionId: value.sessionId,
    source,
    test,
    workflow,
    runner,
  }
}

function readSource(value: unknown, diagnostics: FinishAttestationDiagnostic[]): FinishAttestationReceipt["source"] | undefined {
  if (!isRecord(value) || !exactKeys(value, ["clean", "dirtyWorktreeDigest", "head", "identity"])) {
    diagnostics.push(invalid("predicate.receipt.source", "Source binding has unknown or missing fields."))
    return undefined
  }
  const identity = parseSourceIdentity(value.identity)
  if (value.clean !== true || !isDigest(value.dirtyWorktreeDigest) || !isCommit(value.head) || identity === undefined) {
    diagnostics.push(wrong("predicate.receipt.source", "Source must be a clean source-identity.1 snapshot."))
    return undefined
  }
  if (value.dirtyWorktreeDigest !== EMPTY_DIGEST || identity.repositoryHead !== value.head) {
    diagnostics.push(wrong("predicate.receipt.source", "Source clean digest or source head binding is invalid."))
    return undefined
  }
  return { clean: true, dirtyWorktreeDigest: value.dirtyWorktreeDigest, head: value.head, identity }
}

function readCommand(value: unknown, diagnostics: FinishAttestationDiagnostic[]): FinishAttestationReceipt["command"] | undefined {
  if (!isRecord(value) || !exactKeys(value, ["argvDigest", "catalogId", "commands", "results"])) {
    diagnostics.push(invalid("predicate.receipt.command", "Command binding has unknown or missing fields."))
    return undefined
  }
  if (!isDigest(value.argvDigest) || value.catalogId !== "persona-harness-clean-ci-builder.1" || value.argvDigest !== sha256Digest(canonicalJson(FINISH_ATTESTATION_COMMAND_CATALOG)) || !Array.isArray(value.commands) || !Array.isArray(value.results) || value.commands.length !== FINISH_ATTESTATION_COMMAND_CATALOG.length) {
    diagnostics.push(wrong("predicate.receipt.command", "Command catalog is not the fixed builder catalog."))
    return undefined
  }
  const commands = value.commands.map((entry, index) => readCommandEntry(entry, `predicate.receipt.command.commands[${index}]`, diagnostics)).filter(isCommand)
  const results = value.results.map((entry, index) => readResultEntry(entry, `predicate.receipt.command.results[${index}]`, diagnostics)).filter(isResult)
  if (
    commands.length !== value.commands.length
    || results.length !== value.results.length
    || results.some((entry) => entry.exitCode !== 0)
    || canonicalJson(commands) !== canonicalJson(FINISH_ATTESTATION_COMMAND_CATALOG)
    || results.some((entry, index) => canonicalJson(entry.argv) !== canonicalJson(FINISH_ATTESTATION_COMMAND_CATALOG[index]?.args === undefined ? [] : [FINISH_ATTESTATION_COMMAND_CATALOG[index]?.executable, ...FINISH_ATTESTATION_COMMAND_CATALOG[index]?.args]))
  ) {
    diagnostics.push(wrong("predicate.receipt.command.results", "Every fixed command must complete successfully."))
    return undefined
  }
  return { argvDigest: value.argvDigest, catalogId: value.catalogId, commands, results }
}

function readCommandEntry(value: unknown, path: string, diagnostics: FinishAttestationDiagnostic[]): FinishAttestationCommand | undefined {
  if (!isRecord(value) || !exactKeys(value, ["args", "executable", "id"]) || !Array.isArray(value.args) || !value.args.every(isString) || !isString(value.executable) || !isString(value.id)) {
    diagnostics.push(invalid(path, "Command catalog entry is invalid."))
    return undefined
  }
  return { args: value.args, executable: value.executable, id: value.id }
}

function readResultEntry(value: unknown, path: string, diagnostics: FinishAttestationDiagnostic[]): FinishAttestationCommandResult | undefined {
  if (!isRecord(value) || !exactKeys(value, ["argv", "exitCode", "id", "stderrDigest", "stdoutDigest"]) || !Array.isArray(value.argv) || !value.argv.every(isString) || !isPositiveOrZeroInteger(value.exitCode) || !isString(value.id) || !isDigest(value.stderrDigest) || !isDigest(value.stdoutDigest)) {
    diagnostics.push(invalid(path, "Command result entry is invalid."))
    return undefined
  }
  return { argv: value.argv, exitCode: value.exitCode, id: value.id, stderrDigest: value.stderrDigest, stdoutDigest: value.stdoutDigest }
}

function readTest(value: unknown, diagnostics: FinishAttestationDiagnostic[]): FinishAttestationReceipt["test"] | undefined {
  if (!isRecord(value) || !exactKeys(value, ["artifactDigest", "count", "failed", "identity", "passed", "skipped"]) || !isDigest(value.artifactDigest) || !isPositiveInteger(value.count) || !isPositiveInteger(value.passed) || !isPositiveOrZeroInteger(value.failed) || !isPositiveOrZeroInteger(value.skipped) || !isString(value.identity) || value.failed !== 0 || value.passed < 1) {
    diagnostics.push(wrong("predicate.receipt.test", "Test facts must report at least one passing test and no failures."))
    return undefined
  }
  return { artifactDigest: value.artifactDigest, count: value.count, failed: value.failed, identity: value.identity, passed: value.passed, skipped: value.skipped }
}

function readPack(value: unknown, diagnostics: FinishAttestationDiagnostic[]): FinishAttestationReceipt["pack"] | undefined {
  if (!isRecord(value) || !exactKeys(value, ["fileCount", "name", "version"]) || !isPositiveInteger(value.fileCount) || !isIdentifier(value.name) || !isIdentifier(value.version)) {
    diagnostics.push(invalid("predicate.receipt.pack", "Package facts are invalid."))
    return undefined
  }
  return { fileCount: value.fileCount, name: value.name, version: value.version }
}

function readWorkflow(value: unknown, sourceHead: string | undefined, diagnostics: FinishAttestationDiagnostic[]): FinishAttestationReceipt["workflow"] | undefined {
  if (!isRecord(value) || !exactKeys(value, ["path", "ref", "sha"]) || value.path !== FINISH_ATTESTATION_POLICY.workflowPath || value.ref !== FINISH_ATTESTATION_POLICY.workflowRef || !isCommit(value.sha) || sourceHead === undefined || value.sha !== sourceHead) {
    diagnostics.push(wrong("predicate.receipt.workflow", "Workflow path, immutable ref, and workflow SHA do not match protected main."))
    return undefined
  }
  return { path: FINISH_ATTESTATION_WORKFLOW_PATH, ref: FINISH_ATTESTATION_WORKFLOW_REF, sha: value.sha }
}

function readRunner(value: unknown, diagnostics: FinishAttestationDiagnostic[]): FinishAttestationReceipt["runner"] | undefined {
  if (!isRecord(value) || !exactKeys(value, ["environment", "label", "os"]) || value.environment !== FINISH_ATTESTATION_POLICY.runnerEnvironment || value.label !== FINISH_ATTESTATION_POLICY.runnerLabel || value.os !== FINISH_ATTESTATION_POLICY.runnerOs) {
    diagnostics.push(wrong("predicate.receipt.runner", "Runner identity is not the fixed GitHub-hosted ubuntu-latest runner."))
    return undefined
  }
  return { environment: "github-hosted", label: "ubuntu-latest", os: "Linux" }
}

function readLifecycle(issuedAt: unknown, expiresAt: unknown, diagnostics: FinishAttestationDiagnostic[]): { readonly expiresAt: string; readonly issuedAt: string } | undefined {
  if (!isTimestamp(issuedAt) || !isTimestamp(expiresAt)) {
    diagnostics.push(invalid("predicate.receipt.lifecycle", "Issuance and expiry must be ISO timestamps."))
    return undefined
  }
  const issuedMs = Date.parse(issuedAt)
  const expiresMs = Date.parse(expiresAt)
  if (expiresMs <= issuedMs || expiresMs - issuedMs > FINISH_ATTESTATION_POLICY.maxFreshnessMs) {
    diagnostics.push(wrong("predicate.receipt.lifecycle", "Attestation freshness window is invalid."))
    return undefined
  }
  return { expiresAt, issuedAt }
}

function exactKeys(value: Readonly<Record<string, unknown>>, keys: readonly string[]): boolean {
  const expected = new Set(keys)
  return Object.keys(value).length === keys.length && Object.keys(value).every((key) => expected.has(key))
}

function isCommand(value: FinishAttestationCommand | undefined): value is FinishAttestationCommand {
  return value !== undefined
}

function isResult(value: FinishAttestationCommandResult | undefined): value is FinishAttestationCommandResult {
  return value !== undefined
}

function isCommit(value: unknown): value is string {
  return isString(value) && COMMIT_PATTERN.test(value)
}

function isDigest(value: unknown): value is string {
  return isString(value) && DIGEST_PATTERN.test(value)
}

function isHexDigest(value: unknown): value is string {
  return isString(value) && /^[a-f0-9]{64}$/u.test(value)
}

function isIdentifier(value: unknown): value is string {
  return isString(value) && value.length > 0 && value.length <= 256 && !/[\u0000\r\n]/u.test(value)
}

function isPositiveInteger(value: unknown): value is number {
  return isPositiveOrZeroInteger(value) && value > 0
}

function isPositiveOrZeroInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
}

function isString(value: unknown): value is string {
  return typeof value === "string"
}

function isTimestamp(value: unknown): value is string {
  return isString(value) && Number.isFinite(Date.parse(value))
}

function isVersion(value: unknown): value is string {
  return isIdentifier(value)
}

function invalid(path: string, message: string): FinishAttestationDiagnostic {
  return { code: "invalid-field", message, path }
}

function wrong(path: string, message: string): FinishAttestationDiagnostic {
  return { code: "wrong-policy", message, path }
}
