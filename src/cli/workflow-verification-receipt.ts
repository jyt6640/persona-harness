import {
  VERIFICATION_ATTEMPT_DIR,
  VERIFICATION_RECEIPT_DIR,
  type ReceiptDiagnostic,
  type LegacyEvidenceSummary,
  type VerificationAuthorityAssessment,
  type VerificationAuthorityState,
  type VerificationAttempt,
  type VerificationReceipt,
} from "./workflow-verification-receipt-types.js"
import {
  VERIFICATION_ATTEMPT_SCHEMA,
  VERIFICATION_ATTEMPT_STATUSES,
  VERIFICATION_AUTHORITY_CLASSES,
  VERIFICATION_RECEIPT_SCHEMA,
  parseVerificationAttempt,
  parseVerificationReceipt,
} from "./workflow-verification-receipt-model.js"
import { loadHarnessConfigResult, resolveConfiguredPathResult } from "../config/harness-config.js"
import { legacyDiagnostic, readJsonDirectoryAt, readLegacyEvidence } from "./workflow-verification-receipt-storage.js"

export {
  VERIFICATION_ATTEMPT_DIR,
  VERIFICATION_ATTEMPT_SCHEMA,
  VERIFICATION_ATTEMPT_STATUSES,
  VERIFICATION_AUTHORITY_CLASSES,
  VERIFICATION_RECEIPT_DIR,
  VERIFICATION_RECEIPT_SCHEMA,
} from "./workflow-verification-receipt-types.js"
export { parseVerificationAttempt, parseVerificationReceipt } from "./workflow-verification-receipt-model.js"
export type {
  LegacyEvidenceSummary,
  ReceiptDiagnostic,
  ReceiptDiagnosticCode,
  ReceiptParseResult,
  VerificationAttempt,
  VerificationAuthorityAssessment,
  VerificationAuthorityState,
  VerificationCommandIdentity,
  VerificationDigest,
  VerificationIssuer,
  VerificationReceipt,
  VerificationResult,
  VerificationWorkspaceIdentity,
} from "./workflow-verification-receipt-types.js"

const CLOCK_SKEW_MS = 5 * 60 * 1000

export function assessVerificationAuthority(projectDir: string, now = new Date()): VerificationAuthorityAssessment {
  const configResult = loadHarnessConfigResult(projectDir)
  if (!configResult.safe) {
    const diagnostics: ReceiptDiagnostic[] = configResult.diagnostics.map((configDiagnostic) => ({
      code: "receipt-read-failed",
      message: "Harness configuration is invalid; read-only recovery is required.",
      path: configDiagnostic.path,
    }))
    return assessment(
      "malformed",
      diagnostics,
      { diagnosticOnly: true, diagnostics, files: [] },
      "harness configuration is invalid; verification authority is blocked",
    )
  }
  const evidencePath = resolveConfiguredPathResult(projectDir, configResult.config.evidenceDir)
  if (!evidencePath.ok) {
    const diagnostics: ReceiptDiagnostic[] = [{
      code: "receipt-read-failed",
      message: "Configured evidence path is unsafe; read-only recovery is required.",
      path: ".persona/harness.jsonc",
    }]
    return assessment(
      "malformed",
      diagnostics,
      { diagnosticOnly: true, diagnostics, files: [] },
      "configured evidence path is unsafe; verification authority is blocked",
    )
  }
  const evidenceRoot = evidencePath.path
  const displayEvidenceRoot = evidencePath.relativePath || configResult.config.evidenceDir
  const receiptDirectory = `${displayEvidenceRoot}/${VERIFICATION_RECEIPT_DIR.split("/").at(-1)}`
  const attemptDirectory = `${displayEvidenceRoot}/${VERIFICATION_ATTEMPT_DIR.split("/").at(-1)}`
  const legacyEvidence = readLegacyEvidence(projectDir, evidenceRoot, displayEvidenceRoot)
  const receipts = readJsonDirectoryAt(
    projectDir,
    `${evidenceRoot}/${VERIFICATION_RECEIPT_DIR.split("/").at(-1)}`,
    receiptDirectory,
    parseVerificationReceipt,
  )
  const attempts = readJsonDirectoryAt(
    projectDir,
    `${evidenceRoot}/${VERIFICATION_ATTEMPT_DIR.split("/").at(-1)}`,
    attemptDirectory,
    parseVerificationAttempt,
  )
  const diagnostics = [
    ...(legacyEvidence.diagnostics ?? []),
    ...receipts.diagnostics,
    ...attempts.diagnostics,
  ]
  const parsedReceipts = receipts.files.flatMap((file) => (file.result.ok ? [file.result.value] : []))
  const parsedAttempts = attempts.files.flatMap((file) => (file.result.ok ? [file.result.value] : []))

  if (diagnostics.length > 0) return assessment("malformed", diagnostics, legacyEvidence, "receipt or attempt input is malformed")
  if (!receipts.present && !attempts.present) {
    return assessment(
      "missing",
      [legacyDiagnostic(legacyEvidence, displayEvidenceRoot)],
      legacyEvidence,
      legacyEvidence.files.length === 0
        ? "no verification receipt or attempt was found"
        : "no verification receipt or attempt was found; legacy evidence is diagnostic-only",
    )
  }
  const duplicates = duplicateIdentityDiagnostics(parsedReceipts, parsedAttempts, receiptDirectory, attemptDirectory)
  if (duplicates.length > 0) return assessment("duplicate", duplicates, legacyEvidence, "receipt or attempt identity is duplicated")
  if (parsedReceipts.length === 0 || parsedAttempts.length === 0) {
    return assessment(
      "mismatch",
      [{ code: "binding-mismatch", message: "A receipt and completed attempt must be present together.", path: displayEvidenceRoot }],
      legacyEvidence,
      "receipt and attempt lifecycle records are incomplete",
    )
  }

  const latestAttempt = latestCompletedAttempt(parsedAttempts)
  const matchingReceipts = parsedReceipts.filter((receipt) => receipt.attemptId === latestAttempt.attemptId)
  if (matchingReceipts.length > 1) {
    return assessment(
      "replayed",
      [{ code: "replayed-receipt", message: "More than one receipt claims the same completed attempt.", path: receiptDirectory }],
      legacyEvidence,
      "receipt was replayed for the same attempt",
    )
  }
  const receipt = matchingReceipts[0]
  if (receipt === undefined) {
    const hasOlderReceipt = parsedReceipts.some((candidate) => candidate.attemptId !== latestAttempt.attemptId)
    return assessment(
      hasOlderReceipt ? "stale" : "mismatch",
      [{
        code: hasOlderReceipt ? "replayed-receipt" : "binding-mismatch",
        message: hasOlderReceipt ? "Receipt belongs to an older completed attempt and is stale." : "No receipt binds the latest completed attempt.",
        path: receiptDirectory,
      }],
      legacyEvidence,
      hasOlderReceipt ? "receipt is stale relative to the latest completed attempt" : "latest completed attempt has no matching receipt",
    )
  }

  const attempt = parsedAttempts.find((candidate) => candidate.attemptId === receipt.attemptId)
  if (attempt === undefined) {
    return assessment("mismatch", [bindingDiagnostic("attemptId", displayEvidenceRoot)], legacyEvidence, "receipt attempt binding is missing")
  }
  const bindingDiagnostics = compareBindings(receipt, attempt, displayEvidenceRoot)
  if (bindingDiagnostics.length > 0) return assessment("mismatch", bindingDiagnostics, legacyEvidence, "receipt and attempt bindings do not match")
  if (attempt.status !== "completed") {
    const state = attempt.status === "interrupted" ? "interrupted" : attempt.status === "failed" ? "failed" : "stale"
    return assessment(
      state,
      [{ code: "attempt-not-completed", message: `Attempt lifecycle status is ${attempt.status}.`, path: attemptDirectory }],
      legacyEvidence,
      `attempt is ${attempt.status}, not a completed authority candidate`,
    )
  }
  const nowMs = now.getTime()
  if (Date.parse(receipt.expiresAt) <= nowMs) {
    return assessment("expired", [{ code: "receipt-expired", message: "Receipt expiry is in the past.", path: receiptDirectory }], legacyEvidence, "receipt is expired")
  }
  if (Date.parse(receipt.issuedAt) > nowMs + CLOCK_SKEW_MS) {
    return assessment("stale", [{ code: "receipt-clock-skew", message: "Receipt issuance is too far in the future.", path: receiptDirectory }], legacyEvidence, "receipt clock is outside the accepted skew bound")
  }
  if (receipt.result.status !== "pass") {
    return assessment(
      "failed",
      [{ code: "attempt-not-completed", message: "Receipt result status is not pass.", path: `${receiptDirectory}.result.status` }],
      legacyEvidence,
      "receipt reports a failed verification result",
    )
  }
  return assessment(
    "untrusted",
    [{ code: "legacy-evidence-only", message: "Receipt structure is valid, but P3-3 does not verify issuer attestation or issue finish authority.", path: receiptDirectory }],
    legacyEvidence,
    "receipt is structurally valid but untrusted until a future P3 execution or external attestation path is implemented",
    receipt,
    attempt,
  )
}

function latestCompletedAttempt(attempts: readonly VerificationAttempt[]): VerificationAttempt {
  const candidates = attempts.filter((attempt) => attempt.status === "completed")
  const ordered = [...(candidates.length > 0 ? candidates : attempts)].sort((left, right) => {
    const leftTime = Date.parse(left.completedAt ?? left.startedAt)
    const rightTime = Date.parse(right.completedAt ?? right.startedAt)
    return leftTime - rightTime || left.attemptId.localeCompare(right.attemptId)
  })
  const latest = ordered.at(-1)
  if (latest === undefined) throw new Error("Verification authority assessment requires an attempt.")
  return latest
}

function compareBindings(
  receipt: VerificationReceipt,
  attempt: VerificationAttempt,
  evidenceRoot: string,
): readonly ReceiptDiagnostic[] {
  const diagnostics: ReceiptDiagnostic[] = []
  const values: readonly [string, boolean][] = [
    ["attemptId", receipt.attemptId === attempt.attemptId],
    ["sessionId", receipt.sessionId === attempt.sessionId],
    ["finishId", receipt.finishId === attempt.finishId],
    ["sourceHead", receipt.sourceHead === attempt.sourceHead],
    ["dirtyWorktreeDigest", receipt.dirtyWorktreeDigest === attempt.dirtyWorktreeDigest],
    ["provenanceDigest", receipt.provenanceDigest === attempt.provenanceDigest],
    ["phVersion", receipt.phVersion === attempt.phVersion],
    ["command.catalogId", receipt.command.catalogId === attempt.command.catalogId],
    ["command.argvDigest", receipt.command.argvDigest === attempt.command.argvDigest],
    ["workspaceIdentity", sameWorkspace(receipt, attempt)],
    ["receiptId", attempt.status !== "completed" || attempt.receiptId === receipt.receiptId],
  ]
  for (const [field, matches] of values) {
    if (!matches) diagnostics.push(bindingDiagnostic(field, evidenceRoot))
  }
  return diagnostics
}

function sameWorkspace(receipt: VerificationReceipt, attempt: VerificationAttempt): boolean {
  return receipt.workspaceIdentity.rootDigest === attempt.workspaceIdentity.rootDigest
    && receipt.workspaceIdentity.deviceIdentity === attempt.workspaceIdentity.deviceIdentity
    && receipt.workspaceIdentity.platform === attempt.workspaceIdentity.platform
}

function duplicateIdentityDiagnostics(
  receipts: readonly VerificationReceipt[],
  attempts: readonly VerificationAttempt[],
  receiptDirectory: string,
  attemptDirectory: string,
): readonly ReceiptDiagnostic[] {
  const diagnostics: ReceiptDiagnostic[] = []
  for (const [id, count] of counts(receipts.map((receipt) => receipt.receiptId))) {
    if (count > 1) diagnostics.push({ code: "duplicate-receipt-id", message: `Receipt id ${id} appears more than once.`, path: receiptDirectory })
  }
  for (const [id, count] of counts(attempts.map((attempt) => attempt.attemptId))) {
    if (count > 1) diagnostics.push({ code: "duplicate-attempt-id", message: `Attempt id ${id} appears more than once.`, path: attemptDirectory })
  }
  return diagnostics
}

function counts(values: readonly string[]): ReadonlyMap<string, number> {
  const result = new Map<string, number>()
  for (const value of values) result.set(value, (result.get(value) ?? 0) + 1)
  return result
}

function bindingDiagnostic(field: string, evidenceRoot: string): ReceiptDiagnostic {
  return { code: "binding-mismatch", message: `Receipt and attempt ${field} values differ.`, path: `${evidenceRoot}/${field}` }
}

function assessment(
  state: VerificationAuthorityState,
  diagnostics: readonly ReceiptDiagnostic[],
  legacyEvidence: LegacyEvidenceSummary,
  summary: string,
  receipt?: VerificationReceipt,
  attempt?: VerificationAttempt,
): VerificationAuthorityAssessment {
  return {
    ...(attempt === undefined ? {} : { attempt }),
    authorityEligible: false,
    diagnostics,
    legacyEvidence,
    ...(receipt === undefined ? {} : { receipt }),
    state,
    summary,
  }
}
