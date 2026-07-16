import { parseSourceIdentity } from "./source-identity-types.js"
import { canonicalJson, sha256Digest } from "./workflow-finish-attestation-canonical.js"
import {
  exactKeys,
  isIdentifier,
  isPositiveInteger,
  readCommand,
  readLifecycle,
  readPack,
  readRunner,
  readSource,
  readTest,
  readWorkflow,
} from "./workflow-finish-attestation-receipt-fields.js"
import {
  FINISH_ATTESTATION_COMMAND_CATALOG,
  FINISH_ATTESTATION_POLICY,
  FINISH_ATTESTATION_SCHEMA,
  FINISH_ATTESTATION_PREDICATE_TYPE,
  type FinishAttestationDiagnostic,
  type FinishAttestationReceipt,
} from "./workflow-finish-attestation-types.js"

export function readFinishAttestationReceipt(
  value: unknown,
  diagnostics: FinishAttestationDiagnostic[],
): FinishAttestationReceipt | undefined {
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
  if (!isIdentifier(value.attemptId) || !isIdentifier(value.finishId) || !isIdentifier(value.nonce) || !isIdentifier(value.runId) || !isIdentifier(value.sessionId) || !isIdentifier(value.phVersion) || !isPositiveInteger(value.runAttempt)) {
    diagnostics.push(invalid("predicate.receipt.identity", "Receipt identity, version, or attempt fields are invalid."))
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
  if (lifecycle === undefined) return undefined
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

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function invalid(path: string, message: string): FinishAttestationDiagnostic {
  return { code: "invalid-field", message, path }
}

function wrong(path: string, message: string): FinishAttestationDiagnostic {
  return { code: "wrong-policy", message, path }
}
