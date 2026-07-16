import { join } from "node:path"

import { loadHarnessConfigResult, resolveConfiguredPathResult } from "../config/harness-config.js"
import {
  readSemanticTddSourceSnapshots,
  type SourceSnapshotRead,
} from "./workflow-semantic-tdd-source-snapshot.js"
import { diagnosticVerificationDecision } from "./workflow-verification-decision.js"
import { parseVerificationAttempt, parseVerificationReceipt } from "./workflow-verification-receipt-model.js"
import {
  VERIFICATION_ATTEMPT_DIR,
  VERIFICATION_RECEIPT_DIR,
} from "./workflow-verification-receipt-types.js"
import { readJsonDirectoryAt } from "./workflow-verification-receipt-storage.js"
import { parseSemanticTddTransition } from "./workflow-semantic-tdd-transition-parser.js"
import {
  buildEnvelope,
  compareSnapshots,
  sourceDelta,
} from "./workflow-semantic-tdd-source-delta.js"
import {
  compareTransitionBindings,
  readTransitionPhase,
} from "./workflow-semantic-tdd-transition-validation.js"
import {
  type SemanticTddTransitionAssessment,
  type SemanticTddTransitionDiagnosticCode,
} from "./workflow-semantic-tdd-transition-types.js"

export { parseSemanticTddTransition } from "./workflow-semantic-tdd-transition-parser.js"
export type {
  SemanticTddTransitionAssessment,
  SemanticTddTransitionDiagnosticCode,
  SemanticTddTransitionEnvelope,
  SemanticTddTransitionPhase,
} from "./workflow-semantic-tdd-transition-types.js"

export function assessSemanticTddTransition(projectDir: string): SemanticTddTransitionAssessment {
  const config = loadHarnessConfigResult(projectDir)
  if (!config.safe) return invalid(["semantic-transition-artifact-invalid"], "harness configuration is invalid")
  const evidence = resolveConfiguredPathResult(projectDir, config.config.evidenceDir)
  if (!evidence.ok) return invalid(["semantic-transition-artifact-invalid"], "configured evidence path is unsafe")
  const attempts = readJsonDirectoryAt(
    projectDir,
    join(evidence.path, VERIFICATION_ATTEMPT_DIR.split("/").at(-1) ?? "verification-attempts"),
    `${evidence.relativePath}/verification-attempts`,
    parseVerificationAttempt,
  )
  const receipts = readJsonDirectoryAt(
    projectDir,
    join(evidence.path, VERIFICATION_RECEIPT_DIR.split("/").at(-1) ?? "verification-receipts"),
    `${evidence.relativePath}/verification-receipts`,
    parseVerificationReceipt,
  )
  const snapshots = readSemanticTddSourceSnapshots(projectDir)
  if (attempts.diagnostics.length > 0 || receipts.diagnostics.length > 0 || snapshots.diagnostics.length > 0) {
    return invalid(["source-snapshot-invalid"], "semantic transition records are malformed")
  }
  const parsedAttempts = attempts.files.flatMap((file) => (file.result.ok ? [file.result.value] : []))
  const parsedReceipts = receipts.files.flatMap((file) => (file.result.ok ? [file.result.value] : []))
  const red = parsedAttempts.filter((attempt) => attempt.status === "failed")
  const green = parsedAttempts.filter((attempt) => attempt.status === "completed")
  if (red.length === 0) return invalid(["semantic-transition-red-required"], "a fresh red attempt is required")
  if (green.length === 0 || parsedReceipts.length === 0) {
    return invalid(["semantic-transition-green-required"], "a fresh green attempt and receipt are required")
  }
  if (parsedAttempts.length !== 2 || red.length !== 1 || green.length !== 1 || parsedReceipts.length !== 1) {
    return invalid(["semantic-transition-replayed"], "exactly one red attempt and one green receipt are required")
  }
  const redAttempt = red[0]
  const greenAttempt = green[0]
  const receipt = parsedReceipts[0]
  if (redAttempt === undefined || greenAttempt === undefined || receipt === undefined) {
    return invalid(["semantic-transition-artifact-invalid"], "transition records could not be selected")
  }
  if (
    redAttempt.receiptId !== null
    || greenAttempt.receiptId !== receipt.receiptId
    || receipt.attemptId !== greenAttempt.attemptId
  ) return invalid(["semantic-transition-binding-mismatch"], "attempt and receipt bindings do not match")
  const redSnapshot = selectSnapshot(snapshots, redAttempt.attemptId, "red")
  const greenSnapshot = selectSnapshot(snapshots, greenAttempt.attemptId, "green")
  if (redSnapshot === undefined) return invalid(["semantic-transition-red-required"], "the red source snapshot is missing")
  if (greenSnapshot === undefined) return invalid(["semantic-transition-green-required"], "the pre-green source snapshot is missing")
  const redPhase = readTransitionPhase(projectDir, evidence.path, redAttempt, undefined, "red")
  if (!redPhase.ok) return invalid(redPhase.codes, "the red transition phase is invalid")
  const greenPhase = readTransitionPhase(projectDir, evidence.path, greenAttempt, receipt, "green", redPhase.phase.testcaseId)
  if (!greenPhase.ok) return invalid(greenPhase.codes, "the green transition phase is invalid")
  const bindingCodes = compareTransitionBindings(redPhase.phase, greenPhase.phase)
  if (bindingCodes.length > 0) return invalid(bindingCodes, "red and green bindings are incompatible")
  const snapshotCodes = compareSnapshots(redSnapshot, greenSnapshot, redPhase.phase, greenPhase.phase)
  if (snapshotCodes.length > 0) return invalid(snapshotCodes, "source snapshots do not prove a bounded transition")
  if (redSnapshot.sourceIdentity.contentDigest === greenSnapshot.sourceIdentity.contentDigest) {
    return invalid(["source-transition-required"], "red and green source identities must differ")
  }
  const delta = sourceDelta(redSnapshot, greenSnapshot)
  if (delta.kind === "none") return invalid(["source-transition-required"], "source transition is missing")
  if (delta.kind === "structural") return invalid(["source-delta-structural"], "structural source changes are not accepted")
  if (delta.kind === "unrelated") return invalid(["source-delta-unrelated"], "unrelated source changes are not accepted")
  if (delta.kind !== "valid") return invalid(["semantic-transition-artifact-invalid"], "source delta is invalid")
  const envelope = buildEnvelope(redPhase.phase, greenPhase.phase, greenSnapshot, delta)
  if (!parseSemanticTddTransition(JSON.stringify(envelope)).ok) {
    return invalid(["semantic-transition-artifact-invalid"], "generated transition envelope is invalid")
  }
  return {
    authorityEligible: false,
    decision: diagnosticVerificationDecision(
      "semantic-valid-untrusted",
      "source-aware semantic TDD transition is structurally valid but diagnostic-only",
    ),
    diagnosticCodes: [],
    envelope,
    state: "valid-untrusted",
    summary: "source-aware red-to-green transition is valid-untrusted",
  }
}

function selectSnapshot(
  source: SourceSnapshotRead,
  attemptId: string,
  phase: "green" | "red",
): SourceSnapshotRead["files"][number] | undefined {
  const matches = source.files.filter((file) => file.attemptId === attemptId && file.phase === phase)
  return matches.length === 1 ? matches[0] : undefined
}

function invalid(
  codes: readonly SemanticTddTransitionDiagnosticCode[],
  summary: string,
): SemanticTddTransitionAssessment {
  const unique = [...new Set(codes)]
  return {
    authorityEligible: false,
    decision: diagnosticVerificationDecision(`semantic-transition-${unique[0] ?? "invalid"}`, summary),
    diagnosticCodes: unique,
    state: unique.includes("semantic-transition-red-required")
      ? "missing-red"
      : unique.includes("semantic-transition-green-required")
        ? "missing-green"
        : unique.includes("semantic-transition-replayed")
          ? "replayed"
          : "invalid",
    summary,
  }
}
