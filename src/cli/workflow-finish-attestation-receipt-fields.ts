import { parseSourceIdentity, type SourceIdentity } from "./source-identity-types.js"
import { canonicalJson, sha256Digest } from "./workflow-finish-attestation-canonical.js"
import {
  FINISH_ATTESTATION_COMMAND_CATALOG,
  FINISH_ATTESTATION_POLICY,
  type FinishAttestationCommand,
  type FinishAttestationCommandResult,
  type FinishAttestationDiagnostic,
  type FinishAttestationReceipt,
} from "./workflow-finish-attestation-types.js"

const EMPTY_DIGEST = sha256Digest(Buffer.alloc(0))
const COMMIT_PATTERN = /^[a-f0-9]{40,64}$/iu
const DIGEST_PATTERN = /^sha256:[a-f0-9]{64}$/u

export function readSource(value: unknown, diagnostics: FinishAttestationDiagnostic[]): FinishAttestationReceipt["source"] | undefined {
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

export function readCommand(value: unknown, diagnostics: FinishAttestationDiagnostic[]): FinishAttestationReceipt["command"] | undefined {
  if (!isRecord(value) || !exactKeys(value, ["argvDigest", "catalogId", "commands", "results"])) {
    diagnostics.push(invalid("predicate.receipt.command", "Command binding has unknown or missing fields."))
    return undefined
  }
  if (
    !isDigest(value.argvDigest)
    || value.catalogId !== "persona-harness-clean-ci-builder.1"
    || value.argvDigest !== sha256Digest(canonicalJson(FINISH_ATTESTATION_COMMAND_CATALOG))
    || !Array.isArray(value.commands)
    || !Array.isArray(value.results)
    || value.commands.length !== FINISH_ATTESTATION_COMMAND_CATALOG.length
  ) {
    diagnostics.push(wrong("predicate.receipt.command", "Command catalog is not the fixed builder catalog."))
    return undefined
  }
  const commands = value.commands.map((entry, index) => readCommandEntry(entry, `predicate.receipt.command.commands[${index}]`, diagnostics))
  const results = value.results.map((entry, index) => readResultEntry(entry, `predicate.receipt.command.results[${index}]`, diagnostics))
  if (
    commands.filter(isCommand).length !== commands.length
    || results.filter(isResult).length !== results.length
  ) {
    return undefined
  }
  const fixedCommands = commands.filter(isCommand)
  const fixedResults = results.filter(isResult)
  if (
    canonicalJson(fixedCommands) !== canonicalJson(FINISH_ATTESTATION_COMMAND_CATALOG)
    || fixedResults.some((entry, index) => canonicalJson(entry.argv) !== canonicalJson(commandArgv(index)))
    || fixedResults.some((entry, index) => entry.id !== FINISH_ATTESTATION_COMMAND_CATALOG[index]?.id)
    || fixedResults.some((entry) => entry.exitCode !== 0)
  ) {
    diagnostics.push(wrong("predicate.receipt.command.results", "Every fixed command must complete successfully."))
    return undefined
  }
  return { argvDigest: value.argvDigest, catalogId: value.catalogId, commands: fixedCommands, results: fixedResults }
}

export function readTest(value: unknown, diagnostics: FinishAttestationDiagnostic[]): FinishAttestationReceipt["test"] | undefined {
  if (
    !isRecord(value)
    || !exactKeys(value, ["artifactDigest", "count", "failed", "identity", "passed", "skipped"])
    || !isDigest(value.artifactDigest)
    || !isPositiveInteger(value.count)
    || !isPositiveInteger(value.passed)
    || !isPositiveOrZeroInteger(value.failed)
    || !isPositiveOrZeroInteger(value.skipped)
    || value.identity !== "vitest:repository"
    || value.failed !== 0
    || value.passed < 1
    || value.count !== value.passed + value.failed + value.skipped
  ) {
    diagnostics.push(wrong("predicate.receipt.test", "Test facts must report at least one passing test and no failures."))
    return undefined
  }
  return {
    artifactDigest: value.artifactDigest,
    count: value.count,
    failed: 0,
    identity: value.identity,
    passed: value.passed,
    skipped: value.skipped,
  }
}

export function readPack(value: unknown, diagnostics: FinishAttestationDiagnostic[]): FinishAttestationReceipt["pack"] | undefined {
  if (
    !isRecord(value)
    || !exactKeys(value, ["fileCount", "name", "version"])
    || !isPositiveInteger(value.fileCount)
    || !isIdentifier(value.name)
    || !isIdentifier(value.version)
  ) {
    diagnostics.push(invalid("predicate.receipt.pack", "Package facts are invalid."))
    return undefined
  }
  return { fileCount: value.fileCount, name: value.name, version: value.version }
}

export function readWorkflow(
  value: unknown,
  sourceHead: string | undefined,
  diagnostics: FinishAttestationDiagnostic[],
): FinishAttestationReceipt["workflow"] | undefined {
  if (
    !isRecord(value)
    || !exactKeys(value, ["path", "ref", "sha"])
    || value.path !== FINISH_ATTESTATION_POLICY.workflowPath
    || value.ref !== FINISH_ATTESTATION_POLICY.workflowRef
    || !isCommit(value.sha)
    || sourceHead === undefined
    || value.sha !== sourceHead
  ) {
    diagnostics.push(wrong("predicate.receipt.workflow", "Workflow path, immutable ref, and workflow SHA do not match protected main."))
    return undefined
  }
  return { path: FINISH_ATTESTATION_POLICY.workflowPath, ref: FINISH_ATTESTATION_POLICY.workflowRef, sha: value.sha }
}

export function readRunner(value: unknown, diagnostics: FinishAttestationDiagnostic[]): FinishAttestationReceipt["runner"] | undefined {
  if (
    !isRecord(value)
    || !exactKeys(value, ["environment", "label", "os"])
    || value.environment !== FINISH_ATTESTATION_POLICY.runnerEnvironment
    || value.label !== FINISH_ATTESTATION_POLICY.runnerLabel
    || value.os !== FINISH_ATTESTATION_POLICY.runnerOs
  ) {
    diagnostics.push(wrong("predicate.receipt.runner", "Runner identity is not the fixed GitHub-hosted ubuntu-latest runner."))
    return undefined
  }
  return {
    environment: FINISH_ATTESTATION_POLICY.runnerEnvironment,
    label: FINISH_ATTESTATION_POLICY.runnerLabel,
    os: FINISH_ATTESTATION_POLICY.runnerOs,
  }
}

export function readLifecycle(
  issuedAt: unknown,
  expiresAt: unknown,
  diagnostics: FinishAttestationDiagnostic[],
): { readonly expiresAt: string; readonly issuedAt: string } | undefined {
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

function commandArgv(index: number): readonly string[] {
  const command = FINISH_ATTESTATION_COMMAND_CATALOG[index]
  return command === undefined ? [] : [command.executable, ...command.args]
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
  return {
    argv: value.argv,
    exitCode: value.exitCode,
    id: value.id,
    stderrDigest: value.stderrDigest,
    stdoutDigest: value.stdoutDigest,
  }
}

function isCommand(
  value: ReturnType<typeof readCommandEntry>,
): value is NonNullable<ReturnType<typeof readCommandEntry>> {
  return value !== undefined
}

function isResult(
  value: ReturnType<typeof readResultEntry>,
): value is NonNullable<ReturnType<typeof readResultEntry>> {
  return value !== undefined
}

export function exactKeys(value: Readonly<Record<string, unknown>>, keys: readonly string[]): boolean {
  const expected = new Set(keys)
  return Object.keys(value).length === keys.length && Object.keys(value).every((key) => expected.has(key))
}

export function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

export function isDigest(value: unknown): value is string {
  return isString(value) && DIGEST_PATTERN.test(value)
}

export function isCommit(value: unknown): value is string {
  return isString(value) && COMMIT_PATTERN.test(value)
}

export function isIdentifier(value: unknown): value is string {
  return isString(value) && value.length > 0 && value.length <= 256 && !/[\u0000\r\n]/u.test(value)
}

export function isPositiveInteger(value: unknown): value is number {
  return isPositiveOrZeroInteger(value) && value > 0
}

export function isPositiveOrZeroInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
}

export function isString(value: unknown): value is string {
  return typeof value === "string"
}

function isTimestamp(value: unknown): value is string {
  return isString(value) && Number.isFinite(Date.parse(value))
}

function invalid(path: string, message: string): FinishAttestationDiagnostic {
  return { code: "invalid-field", message, path }
}

function wrong(path: string, message: string): FinishAttestationDiagnostic {
  return { code: "wrong-policy", message, path }
}
