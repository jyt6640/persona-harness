import {
  error,
  isRecord,
  parseJson,
  readJson,
  readText,
  readTextAt,
  resolveSafe,
  sameJson,
  sha256,
} from "./io.mjs"

export const EXPECTED_LOCK_SHA256 = "sha256:dd94b6128192c926a625ba59597b93253b3f3711cb614f56e65896fe7f31798a"

const FACTS = {
  artifactsCreated: 0,
  authorityEligible: false,
  childProcessInvocations: 0,
  commandsExecuted: 0,
  enforcement: false,
  executionAllowed: false,
  networkAccess: false,
  productCliInvocations: 0,
  qualificationAllowed: false,
  qualificationOperationAllowed: false,
  realProjectAccess: false,
  reportOnly: true,
  telemetryEvents: 0,
  writeOperations: 0,
}

export function validateAuthorization(root) {
  const errors = []
  const lockText = readText(root, "canonical-lock.json", errors, "canonical-lock.json")
  const lock = lockText === undefined ? undefined : parseJson(lockText, "canonical-lock.json", errors)
  if (lockText !== undefined && sha256(lockText) !== EXPECTED_LOCK_SHA256) {
    error(errors, "CANONICAL_LOCK_DRIFT", "canonical-lock.json", "canonical lock bytes differ from the immutable reference")
  }
  if (!isRecord(lock) || lock.schemaVersion !== "fixture-qualification-canonical-lock.1" || lock.corpusId !== "fixture-qualification-authorization") {
    error(errors, "LOCK_SHAPE", "canonical-lock.json", "canonical lock shape is invalid")
    return result(errors)
  }

  const authorizationText = readText(root, "authorization.json", errors, "authorization.json")
  const authorization = authorizationText === undefined ? undefined : parseJson(authorizationText, "authorization.json", errors)
  if (!isRecord(authorization)) return result(errors)

  validateAuthorizationFlags(authorization, errors)
  validateSourceFacts(authorization, errors)
  validateIds(authorization, errors)
  validateFutureRoots(authorization, errors)
  validateCandidate(root, authorization, lock, errors)
  validatePolicy(root, authorization, lock, errors)
  validateNegativeStates(root, authorization, lock, errors)
  validateTranscript(root, authorization, lock, errors)

  if (sha256(JSON.stringify(authorization)) !== lock.authorizationSemanticSha256 || !sameJson(authorization, lock.authorization)) {
    error(errors, "CANONICAL_SEMANTICS_MISMATCH", "authorization.json", "authorization semantics differ from the immutable canonical lock")
  }
  return result(errors)
}

export function evaluateAuthorization(root) {
  const validation = validateAuthorization(root)
  if (!validation.ok) return { ...validation, decision: "invalid-authorization" }
  return {
    ...validation,
    decision: "authorization-only-not-executed",
    negativeCaseCount: 7,
    sourceInspectionExecuted: false,
  }
}

function validateAuthorizationFlags(authorization, errors) {
  if (authorization.authorizationStatus !== "authorization-only-not-executed" || authorization.qualificationOperationAllowed !== false || authorization.qualificationAllowed !== false || authorization.executionAllowed !== false || authorization.authorityEligible !== false || authorization.finishAuthority !== "trusted-authority-required") {
    error(errors, "AUTHORIZATION_ENABLES_OPERATION", "authorization.json", "authorization must remain non-executing and non-authoritative")
  }
  const zeroFields = ["commandsExecuted", "childProcessInvocations", "productCliInvocations", "artifactsCreated", "telemetryEvents", "writeOperations", "ticketOperations", "workflowOperations", "verificationOperations"]
  if (zeroFields.some((field) => authorization[field] !== 0) || authorization.networkAccess !== false || authorization.realProjectAccess !== false || authorization.sourceInspectionExecuted !== false || authorization.mirrorCreated !== false) {
    error(errors, "EXECUTION_FACTS_NONZERO", "authorization.json", "authorization contains an execution or side-effect fact")
  }
}

function validateSourceFacts(authorization, errors) {
  for (const field of ["sourceEvidenceBefore", "sourceEvidenceAfter"]) {
    const evidence = authorization[field]
    if (!isRecord(evidence) || evidence.status !== "deferred" || evidence.observed !== false || evidence.value !== null || evidence.reason !== "qualification operation not executed") {
      error(errors, "SOURCE_FACTS_INVALID", field, "missing or inferred source before/after facts cannot authorize qualification")
    }
  }
}

function validateIds(authorization, errors) {
  const ids = ["authorizationId", "operationId", "attemptId"].map((field) => authorization[field])
  if (ids.some((value) => typeof value !== "string" || value.length === 0) || new Set(ids).size !== ids.length) {
    error(errors, "DUPLICATE_AUTH_ID", "authorization.json", "authorization, operation, and attempt IDs must be unique")
  }
}

function validateFutureRoots(authorization, errors) {
  const roots = authorization.roots
  if (!isRecord(roots) || roots.ownership !== "invocation-owned-absent" || roots.pathPolicy !== "relative-no-follow") {
    error(errors, "ROOT_POLICY_INVALID", "authorization.roots", "future roots must be invocation-owned, absent, and no-follow")
    return
  }
  for (const field of ["journalRoot", "mirrorRoot", "resultRoot"]) {
    validateManifestPath(roots[field], `authorization.roots.${field}`, errors)
  }
}

function validateCandidate(root, authorization, lock, errors) {
  const candidate = authorization.candidate
  if (!isRecord(candidate)) {
    error(errors, "CANDIDATE_BINDING_INVALID", "authorization.candidate", "candidate binding is missing")
    return
  }
  const absolute = resolveSafe(root, candidate.fixturePath, errors, "authorization.candidate.fixturePath")
  if (absolute === undefined) return
  const text = readTextAt(absolute, candidate.fixturePath, errors)
  const fixture = text === undefined ? undefined : parseJson(text, candidate.fixturePath, errors)
  if (!isRecord(fixture) || fixture.fixtureId !== "synthetic-candidate-source" || fixture.candidatePath !== "synthetic/candidate/bus-be" || fixture.candidateState !== "unattached" || fixture.attachmentState !== "unattached" || fixture.clean !== true || fixture.symlinkCount !== 0 || fixture.metadataAuthority !== "synthetic-only-record") {
    error(errors, "CANDIDATE_BINDING_INVALID", candidate.fixturePath, "candidate snapshot does not match the synthetic contract")
  }
  if (!sameJson(candidate, lock.authorization?.candidate)) {
    error(errors, "CANDIDATE_BINDING_INVALID", "authorization.candidate", "candidate metadata differs from the canonical lock")
  }
}

function validatePolicy(root, authorization, lock, errors) {
  const text = readText(root, authorization.policyFixturePath, errors, "authorization.policyFixturePath")
  const fixture = text === undefined ? undefined : parseJson(text, authorization.policyFixturePath, errors)
  if (!isRecord(fixture) || fixture.schemaVersion !== "fixture-qualification-policy.1" || fixture.fixtureId !== "synthetic-qualification-policy" || fixture.projectWritesAllowed !== false || fixture.ticketOperationsAllowed !== false || fixture.workflowOperationsAllowed !== false || fixture.telemetryAllowed !== false || fixture.finishAuthority !== "trusted-authority-required") {
    error(errors, "POLICY_BINDING_INVALID", authorization.policyFixturePath, "policy metadata is not the no-write deferred contract")
  }
  if (!sameJson(authorization.policyFixturePath, lock.authorization.policyFixturePath)) {
    error(errors, "POLICY_BINDING_INVALID", "authorization.policyFixturePath", "policy fixture path differs from the canonical lock")
  }
}

function validateNegativeStates(root, authorization, lock, errors) {
  const text = readText(root, authorization.negativeStatesPath, errors, "authorization.negativeStatesPath")
  const states = text === undefined ? undefined : parseJson(text, authorization.negativeStatesPath, errors)
  const cases = isRecord(states) && Array.isArray(states.cases) ? states.cases : undefined
  if (cases === undefined) {
    error(errors, "NEGATIVE_MATRIX_SHAPE", authorization.negativeStatesPath, "negative state matrix is malformed")
    return
  }
  const ids = cases.map((item) => isRecord(item) ? item.id : undefined)
  if (ids.some((id) => typeof id !== "string") || new Set(ids).size !== ids.length) {
    error(errors, "DUPLICATE_NEGATIVE_CASE", authorization.negativeStatesPath, "negative state IDs must be unique")
  }
  if (!sameJson(cases, lock.negativeCases) || !sameJson(states.negativePaths, lock.authorization.negativeCaseIds)) {
    error(errors, "NEGATIVE_MATRIX_DRIFT", authorization.negativeStatesPath, "foreign, corrupt, absent, or unsafe states must remain rejection cases")
  }
}

function validateTranscript(root, authorization, lock, errors) {
  const text = readText(root, authorization.transcriptPath, errors, "authorization.transcriptPath")
  const transcript = text === undefined ? undefined : parseJson(text, authorization.transcriptPath, errors)
  if (!isRecord(transcript)) {
    error(errors, "TRANSCRIPT_SHAPE", authorization.transcriptPath, "authorization transcript is malformed")
    return
  }
  if (transcript.commandsExecuted !== false || transcript.childProcessInvocations !== 0 || transcript.productCliInvocations !== 0 || transcript.networkAccess !== false || transcript.realProjectAccess !== false || transcript.artifactsCreated !== 0 || transcript.telemetryEvents !== 0) {
    error(errors, "EXECUTION_FACTS_NONZERO", authorization.transcriptPath, "transcript contains execution or artifact facts")
  }
  const steps = Array.isArray(transcript.steps) ? transcript.steps : []
  const expectedStepIds = lock.transcript?.orderedStepIds ?? []
  if (steps.length !== expectedStepIds.length || steps.some((step, index) => !isRecord(step) || step.id !== expectedStepIds[index] || step.executed !== false || !Array.isArray(step.argv) || step.argv.length !== 0)) {
    error(errors, "TRANSCRIPT_DRIFT", authorization.transcriptPath, "planned read-only steps differ from the canonical transcript")
  }
  for (const step of steps) {
    if (!isRecord(step)) continue
    resolveSafe(root, step.fixturePath, errors, `${authorization.transcriptPath}.${step.id}.fixturePath`)
  }
  const expectedPayloadFiles = Array.isArray(lock.payloadFiles) ? lock.payloadFiles.filter((payload) => isRecord(payload) && payload.path !== authorization.transcriptPath) : []
  if (!sameJson(transcript.payloadFiles, expectedPayloadFiles) || !sameJson(transcript.negativePaths, lock.transcript?.negativePaths)) {
    error(errors, "TRANSCRIPT_DRIFT", authorization.transcriptPath, "payload or negative path order differs from the canonical transcript")
  }
  for (const payload of Array.isArray(transcript.payloadFiles) ? transcript.payloadFiles : []) {
    if (!isRecord(payload)) continue
    const payloadText = readText(root, payload.path, errors, `payload.${payload.path}`)
    if (payloadText !== undefined && payload.sha256 !== sha256(payloadText)) {
      error(errors, "PAYLOAD_HASH", payload.path, "payload bytes differ from the canonical hash")
    }
  }
  const transcriptHash = lock.payloadFiles?.find((payload) => isRecord(payload) && payload.path === authorization.transcriptPath)?.sha256
  if (transcriptHash !== sha256(text)) error(errors, "PAYLOAD_HASH", authorization.transcriptPath, "transcript bytes differ from the canonical hash")
}

function validateManifestPath(value, field, errors) {
  if (typeof value !== "string" || value.length === 0 || value.includes("\0") || value.includes("\\") || value.startsWith("/") || value.split("/").some((segment) => segment.length === 0 || segment === "." || segment === "..")) {
    error(errors, "UNSAFE_PATH", field, "future path must be a relative POSIX path without traversal")
  }
}

function result(errors) {
  return {
    schemaVersion: "fixture-qualification-validation.1",
    authorizationStatus: "authorization-only-not-executed",
    ...FACTS,
    errors,
    ok: errors.length === 0,
  }
}
