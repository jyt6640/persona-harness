import { assessVerificationAuthority } from "./workflow-verification-receipt.js"
import { resolveConfiguredPathResult, loadHarnessConfigResult } from "../config/harness-config.js"
import { diagnosticVerificationDecision } from "./workflow-verification-decision.js"
import {
  VERIFICATION_ATTEMPT_DIR,
  VERIFICATION_RECEIPT_DIR,
} from "./workflow-verification-receipt-types.js"
import { parseVerificationAttempt, parseVerificationReceipt } from "./workflow-verification-receipt-model.js"
import { readJsonDirectoryAt, readLegacyEvidence } from "./workflow-verification-receipt-storage.js"
import {
  compareSemanticTddLineage,
  readSemanticTddPhase,
  semanticTddPublicPhase,
} from "./workflow-semantic-tdd-phase.js"
import type {
  SemanticTddAssessment,
  SemanticTddDiagnosticCode,
  SemanticTddPhase,
  SemanticTddState,
} from "./workflow-semantic-tdd-types.js"

export type {
  SemanticTddAssessment,
  SemanticTddDiagnostic,
  SemanticTddDiagnosticCode,
  SemanticTddPhase,
  SemanticTddState,
} from "./workflow-semantic-tdd-types.js"

export function assessSemanticTddChain(projectDir: string, now = new Date()): SemanticTddAssessment {
  const configResult = loadHarnessConfigResult(projectDir)
  if (!configResult.safe) {
    return result("malformed", ["semantic-artifact-invalid"], "harness configuration is invalid; semantic verification is blocked", undefined, undefined, ".persona/harness.jsonc")
  }
  const evidencePath = resolveConfiguredPathResult(projectDir, configResult.config.evidenceDir)
  if (!evidencePath.ok) {
    return result("malformed", ["semantic-artifact-invalid"], "configured evidence path is unsafe; semantic verification is blocked", undefined, undefined, ".persona/harness.jsonc")
  }
  const evidenceRoot = evidencePath.path
  const displayEvidenceRoot = evidencePath.relativePath || configResult.config.evidenceDir
  const makeResult = (
    state: SemanticTddState,
    codes: readonly SemanticTddDiagnosticCode[],
    summary: string,
    red?: SemanticTddPhase,
    green?: SemanticTddPhase,
  ): SemanticTddAssessment => result(state, codes, summary, red, green, displayEvidenceRoot)
  const legacy = readLegacyEvidence(projectDir, evidenceRoot, displayEvidenceRoot)
  const attempts = readJsonDirectoryAt(
    projectDir,
    `${evidenceRoot}/${VERIFICATION_ATTEMPT_DIR.split("/").at(-1)}`,
    `${displayEvidenceRoot}/${VERIFICATION_ATTEMPT_DIR.split("/").at(-1)}`,
    parseVerificationAttempt,
  )
  const receipts = readJsonDirectoryAt(
    projectDir,
    `${evidenceRoot}/${VERIFICATION_RECEIPT_DIR.split("/").at(-1)}`,
    `${displayEvidenceRoot}/${VERIFICATION_RECEIPT_DIR.split("/").at(-1)}`,
    parseVerificationReceipt,
  )
  const directoryDiagnostics = [...attempts.diagnostics, ...receipts.diagnostics]
  if (directoryDiagnostics.length > 0) {
    return makeResult("malformed", ["semantic-artifact-invalid"], "semantic receipt or attempt input is malformed")
  }

  const parsedAttempts = attempts.files.flatMap((file) => (file.result.ok ? [file.result.value] : []))
  const parsedReceipts = receipts.files.flatMap((file) => (file.result.ok ? [file.result.value] : []))
  const failedAttempts = parsedAttempts.filter((attempt) => attempt.status === "failed")
  const completedAttempts = parsedAttempts.filter((attempt) => attempt.status === "completed")
  if (failedAttempts.length === 0) {
    if (completedAttempts.length > 0 || parsedReceipts.length > 0) {
      return makeResult("missing-red", ["semantic-red-required"], "a fresh nonzero red phase is required before green")
    }
    return legacy.files.length > 0
      ? makeResult("legacy-only", ["semantic-legacy-only"], "legacy evidence is diagnostic-only; a fresh red phase is missing")
      : makeResult("missing-red", ["semantic-red-required"], "a fresh nonzero red phase is required before green")
  }
  if (completedAttempts.length === 0 || parsedReceipts.length === 0) {
    return makeResult("missing-green", ["semantic-green-required"], "a later fresh passing green phase is missing")
  }
  if (parsedAttempts.length !== 2 || failedAttempts.length !== 1 || completedAttempts.length !== 1 || parsedReceipts.length !== 1) {
    return makeResult("replayed", ["semantic-replayed"], "semantic TDD requires exactly one red attempt and one green receipt")
  }

  const redAttempt = failedAttempts[0]
  const greenAttempt = completedAttempts[0]
  const receipt = parsedReceipts[0]
  if (redAttempt === undefined || greenAttempt === undefined || receipt === undefined) {
    return makeResult("invalid", ["semantic-artifact-invalid"], "semantic TDD records could not be selected")
  }
  if (redAttempt.receiptId !== null
    || greenAttempt.receiptId !== receipt.receiptId
    || receipt.attemptId !== greenAttempt.attemptId) {
    return makeResult("mismatch", ["semantic-binding-mismatch"], "receipt and attempt lifecycle ownership do not match")
  }
  const red = readSemanticTddPhase(projectDir, redAttempt, undefined, "red")
  if (!red.ok) {
    const mismatch = red.diagnosticCodes.includes("semantic-binding-mismatch")
      || red.diagnosticCodes.includes("semantic-testcase-mismatch")
    return makeResult(
      mismatch ? "mismatch" : "invalid",
      red.diagnosticCodes,
      "fresh P3-4 artifact or JUnit evidence is incomplete",
      semanticTddPublicPhase(red),
    )
  }
  const green = readSemanticTddPhase(projectDir, greenAttempt, receipt, "green", red.phase.testcase.identity)
  if (!green.ok) {
    const mismatch = green.diagnosticCodes.includes("semantic-binding-mismatch")
      || green.diagnosticCodes.includes("semantic-testcase-mismatch")
    return makeResult(
      mismatch ? "mismatch" : "invalid",
      green.diagnosticCodes,
      "fresh P3-4 artifact or JUnit evidence is incomplete",
      red.phase.public,
    )
  }
  const bindingDiagnostics = compareSemanticTddLineage(
    red.phase.binding,
    green.phase.binding,
    red.phase.public,
    green.phase.public,
    red.phase.testcase,
    green.phase.testcase,
  )
  if (bindingDiagnostics.length > 0) {
    return makeResult("mismatch", bindingDiagnostics, "red and green phases do not share compatible lineage", red.phase.public, green.phase.public)
  }
  if (Date.parse(redAttempt.startedAt) >= Date.parse(greenAttempt.startedAt)) {
    return makeResult("ordering-invalid", ["semantic-order-invalid"], "the red phase must precede the green phase", red.phase.public, green.phase.public)
  }
  const authority = assessVerificationAuthority(projectDir, now)
  if (authority.state !== "untrusted") {
    return makeResult("invalid", ["semantic-artifact-invalid"], `P3-2 receipt authority assessment is ${authority.state}`, red.phase.public, green.phase.public)
  }
  return {
    authorityEligible: false,
    decision: diagnosticVerificationDecision(
      "semantic-valid-untrusted",
      "fresh semantic TDD evidence is diagnostic-only without trusted authority",
    ),
    diagnosticCodes: [],
    diagnostics: [],
    green: green.phase.public,
    red: red.phase.public,
    state: "valid-untrusted",
    summary: "fresh red-to-green JUnit chain is structurally valid but remains untrusted without external authority",
  }
}

function result(
  state: SemanticTddState,
  codes: readonly SemanticTddDiagnosticCode[],
  summary: string,
  red?: SemanticTddPhase,
  green?: SemanticTddPhase,
  diagnosticPath = ".persona/evidence",
): SemanticTddAssessment {
  return {
    authorityEligible: false,
    decision: diagnosticVerificationDecision(`semantic-${state}`, summary),
    diagnosticCodes: codes,
    diagnostics: codes.map((code) => ({ code, message: summary, path: diagnosticPath })),
    ...(green === undefined ? {} : { green }),
    ...(red === undefined ? {} : { red }),
    state,
    summary,
  }
}
