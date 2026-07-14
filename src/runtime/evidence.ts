import {
  allowsPromptDiagnostics,
  EVIDENCE_PRIVACY_CLASS,
  type EvidencePrivacyClass,
} from "../config/evidence-privacy.js"
import { summarizeEvidenceText, type EvidenceTextSummary } from "./evidence-redaction.js"
import {
  evidenceRunId,
  evidenceWriteContext,
  writeEvidenceRecord,
  type EvidenceWriteContext,
  type EvidenceWriteOptions,
} from "./evidence-file.js"
import type { TopLevelIntent } from "./top-level-intent-router.js"
import type { PendingInjection } from "./types.js"

export type RailComplianceFindingCode =
  | "review-rail-file-modification"
  | "requirements-rail-direct-implementation"
  | "debug-rail-edit-without-reproduction"
  | "git-rail-mutation-without-status-diff"
  | "raw-final-verification-without-bearshell"
  | "workflow-report-missing"

export type EvidenceEvent = {
  hook: "tool.execute.before" | "tool.execute.after" | "experimental.chat.messages.transform"
  sessionID: string
  callID?: string
  injectedInto: "pending-store" | "tool-output" | "model-input" | "role-discovery"
  injection: PendingInjection
}

export type IntentEvidenceEvent = {
  hook: "experimental.chat.messages.transform"
  sessionID: string
  injectedInto: "intent-workflow"
  userPrompt: string
  intent: TopLevelIntent
  railMarker: string
}

export type RailComplianceEvidenceEvent = {
  hook: "tool.execute.after"
  sessionID: string
  callID?: string
  userPrompt: string
  primaryIntent: TopLevelIntent["primary"]
  secondaryIntents: TopLevelIntent["secondary"]
  railMarker: string
  finding: "WARN"
  confidence: "HIGH" | "MEDIUM" | "LOW"
  code: RailComplianceFindingCode
  message: string
  observedAction: string
  expectedAction: string
}

export type ContinuationEvidenceEvent = {
  hook: "experimental.text.complete"
  sessionID: string
  finding: "INFO" | "WARN"
  reason: string
  nextAction: string
  pendingTicket?: string
  pendingTicketPath?: string
  remainingReadRange?: string
  remainingScope?: string
  nextPromptHint?: string
}

export type ObserverReportOnlyFinding = {
  readonly ruleId: string
  readonly result: "PASS" | "WARN" | "UNKNOWN"
  readonly evidence: unknown
  readonly confidence: "HIGH" | "MEDIUM" | "LOW" | "NONE"
  readonly source: "live-hook/text"
  readonly limitations: readonly string[]
  readonly filePath: string
}

export type ObserverReportOnlyEvidenceEvent = {
  readonly hook: "tool.execute.after"
  readonly sessionID: string
  readonly callID?: string
  readonly targetFile: string
  readonly inspectedFile: string
  readonly findings: readonly ObserverReportOnlyFinding[]
  readonly limitations: readonly string[]
}

function promptDiagnostic(
  context: EvidenceWriteContext,
  prompt: string | undefined,
): EvidenceTextSummary | undefined {
  return prompt !== undefined && allowsPromptDiagnostics(context.mode)
    ? summarizeEvidenceText(prompt, { includePreview: true, maxPreviewChars: 2_048 })
    : undefined
}

function privacyClassForPrompt(diagnostic: EvidenceTextSummary | undefined): EvidencePrivacyClass {
  return diagnostic === undefined
    ? EVIDENCE_PRIVACY_CLASS.metadataSafe
    : EVIDENCE_PRIVACY_CLASS.promptDiagnostics
}

export function writePhase0Evidence(projectDir: string, event: EvidenceEvent, options: EvidenceWriteOptions = {}): void {
  const context = evidenceWriteContext(projectDir, options)
  if (context === undefined) {
    return
  }
  const now = new Date()
  const runId = evidenceRunId()
  const payload = {
    schemaVersion: "phase0.1",
    runId,
    timestamp: now.toISOString(),
    privacyClass: EVIDENCE_PRIVACY_CLASS.metadataSafe,
    hook: event.hook,
    sessionID: event.sessionID,
    callID: event.callID,
    injectedInto: event.injectedInto,
    targetFile: event.injection.targetFile,
    fileRole: event.injection.fileRole,
    selectedHarnessConfigDiagnostics: event.injection.selectedHarnessConfigDiagnostics,
    selectedRules: event.injection.selectedRules,
    selectedRuleMetadata: event.injection.selectedRuleMetadata,
    selectedSharedSkills: event.injection.selectedSharedSkills,
    selectedPolicyOverlay: event.injection.selectedPolicyOverlay,
    profileSummaryInjected: event.injection.block.includes("Project profile summary:"),
    injectedPolicyCount: event.injection.policies.length,
  }

  writeEvidenceRecord(context, "injection", runId, payload)
}

export function writeIntentEvidence(
  projectDir: string,
  event: IntentEvidenceEvent,
  options: EvidenceWriteOptions = {},
): void {
  const context = evidenceWriteContext(projectDir, options)
  if (context === undefined) {
    return
  }
  const now = new Date()
  const runId = evidenceRunId()
  const diagnostic = promptDiagnostic(context, event.userPrompt)
  const payload = {
    schemaVersion: "phase0.intent.1",
    runId,
    timestamp: now.toISOString(),
    privacyClass: privacyClassForPrompt(diagnostic),
    hook: event.hook,
    sessionID: event.sessionID,
    injectedInto: event.injectedInto,
    ...(diagnostic === undefined ? {} : { promptDiagnostic: diagnostic }),
    primaryIntent: event.intent.primary,
    secondaryIntents: event.intent.secondary,
    reason: event.intent.reason,
    requirementsIntent: event.intent.requirementsIntent,
    railMarker: event.railMarker,
  }

  writeEvidenceRecord(context, "intent", runId, payload)
}

export function writeRailComplianceEvidence(
  projectDir: string,
  event: RailComplianceEvidenceEvent,
  options: EvidenceWriteOptions = {},
): void {
  const context = evidenceWriteContext(projectDir, options)
  if (context === undefined) {
    return
  }
  const now = new Date()
  const runId = evidenceRunId()
  const diagnostic = promptDiagnostic(context, event.userPrompt)
  const payload = {
    schemaVersion: "phase0.rail-compliance.1",
    runId,
    timestamp: now.toISOString(),
    privacyClass: privacyClassForPrompt(diagnostic),
    hook: event.hook,
    sessionID: event.sessionID,
    callID: event.callID,
    injectedInto: "rail-compliance",
    ...(diagnostic === undefined ? {} : { promptDiagnostic: diagnostic }),
    primaryIntent: event.primaryIntent,
    secondaryIntents: event.secondaryIntents,
    railMarker: event.railMarker,
    finding: event.finding,
    confidence: event.confidence,
    code: event.code,
    message: event.message,
    observedAction: event.observedAction,
    expectedAction: event.expectedAction,
    reportOnly: true,
  }

  writeEvidenceRecord(context, "rail-compliance", runId, payload)
}

export function writeContinuationEvidence(
  projectDir: string,
  event: ContinuationEvidenceEvent,
  options: EvidenceWriteOptions = {},
): void {
  const context = evidenceWriteContext(projectDir, options)
  if (context === undefined) {
    return
  }
  const now = new Date()
  const runId = evidenceRunId()
  const diagnostic = promptDiagnostic(context, event.nextPromptHint)
  const payload = {
    schemaVersion: "phase0.continuation.1",
    runId,
    timestamp: now.toISOString(),
    privacyClass: privacyClassForPrompt(diagnostic),
    hook: event.hook,
    sessionID: event.sessionID,
    injectedInto: "continuation",
    finding: event.finding,
    reason: event.reason,
    nextAction: event.nextAction,
    pendingTicket: event.pendingTicket,
    pendingTicketPath: event.pendingTicketPath,
    remainingReadRange: event.remainingReadRange,
    remainingScope: event.remainingScope,
    ...(diagnostic === undefined ? {} : { nextPromptDiagnostic: diagnostic }),
    reportOnly: true,
  }

  writeEvidenceRecord(context, "continuation", runId, payload)
}

export function writeObserverReportOnlyEvidence(
  projectDir: string,
  event: ObserverReportOnlyEvidenceEvent,
  options: EvidenceWriteOptions = {},
): void {
  const context = evidenceWriteContext(projectDir, options)
  if (context === undefined) {
    return
  }
  const now = new Date()
  const runId = evidenceRunId()
  const payload = {
    schemaVersion: "phase0.observer-report-only.1",
    runId,
    timestamp: now.toISOString(),
    privacyClass: EVIDENCE_PRIVACY_CLASS.metadataSafe,
    hook: event.hook,
    sessionID: event.sessionID,
    callID: event.callID,
    injectedInto: "observer-report-only",
    evidenceKind: "observer-report-only",
    targetFile: event.targetFile,
    inspectedFile: event.inspectedFile,
    findings: event.findings,
    limitations: event.limitations,
    reportOnly: true,
    enforcement: false,
  }

  writeEvidenceRecord(context, "observer-report-only", runId, payload)
}
