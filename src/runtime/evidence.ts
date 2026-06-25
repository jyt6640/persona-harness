import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"

import { loadHarnessConfig, resolveConfiguredPath } from "../config/harness-config.js"
import { warnRuntimeFailure } from "./error-boundary.js"
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

function safeSlug(value: string): string {
  return value
    .replace(/\\/g, "/")
    .split("/")
    .at(-1)
    ?.replace(/[^a-zA-Z0-9._-]+/g, "-")
    .toLowerCase() || "target"
}

function writeEvidenceJson(evidenceDir: string, runId: string, payload: unknown): void {
  const outputPath = join(evidenceDir, `${runId}.json`)
  try {
    mkdirSync(evidenceDir, { recursive: true })
    writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`)
  } catch (error) {
    if (error instanceof Error) {
      warnRuntimeFailure("evidence-write", "evidence-write", outputPath, error)
      return
    }
    warnRuntimeFailure("evidence-write", "evidence-write", outputPath, new Error(String(error)))
  }
}

export function writePhase0Evidence(projectDir: string, event: EvidenceEvent): void {
  const now = new Date()
  const config = loadHarnessConfig(projectDir)
  const evidenceDir = join(resolveConfiguredPath(projectDir, config.evidenceDir), "phase0")
  const runId = `${now.toISOString().replace(/[:.]/g, "-")}-${safeSlug(event.injection.targetFile)}`
  const payload = {
    schemaVersion: "phase0.1",
    runId,
    timestamp: now.toISOString(),
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
    profileSummaryInjected: event.injection.block.includes("프로젝트 프로필 요약:"),
    injectedPolicyCount: event.injection.policies.length,
  }

  writeEvidenceJson(evidenceDir, runId, payload)
}

export function writeIntentEvidence(projectDir: string, event: IntentEvidenceEvent): void {
  const now = new Date()
  const config = loadHarnessConfig(projectDir)
  const evidenceDir = join(resolveConfiguredPath(projectDir, config.evidenceDir), "phase0")
  const runId = `${now.toISOString().replace(/[:.]/g, "-")}-intent-${safeSlug(event.intent.primary)}`
  const payload = {
    schemaVersion: "phase0.intent.1",
    runId,
    timestamp: now.toISOString(),
    hook: event.hook,
    sessionID: event.sessionID,
    injectedInto: event.injectedInto,
    userPrompt: event.userPrompt,
    primaryIntent: event.intent.primary,
    secondaryIntents: event.intent.secondary,
    reason: event.intent.reason,
    requirementsIntent: event.intent.requirementsIntent,
    railMarker: event.railMarker,
  }

  writeEvidenceJson(evidenceDir, runId, payload)
}

export function writeRailComplianceEvidence(projectDir: string, event: RailComplianceEvidenceEvent): void {
  const now = new Date()
  const config = loadHarnessConfig(projectDir)
  const evidenceDir = join(resolveConfiguredPath(projectDir, config.evidenceDir), "phase0")
  const runId = `${now.toISOString().replace(/[:.]/g, "-")}-rail-compliance-${safeSlug(event.code)}`
  const payload = {
    schemaVersion: "phase0.rail-compliance.1",
    runId,
    timestamp: now.toISOString(),
    hook: event.hook,
    sessionID: event.sessionID,
    callID: event.callID,
    injectedInto: "rail-compliance",
    userPrompt: event.userPrompt,
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

  writeEvidenceJson(evidenceDir, runId, payload)
}

export function writeContinuationEvidence(projectDir: string, event: ContinuationEvidenceEvent): void {
  const now = new Date()
  const config = loadHarnessConfig(projectDir)
  const evidenceDir = join(resolveConfiguredPath(projectDir, config.evidenceDir), "phase0")
  const runId = `${now.toISOString().replace(/[:.]/g, "-")}-continuation-${safeSlug(event.sessionID)}`
  const payload = {
    schemaVersion: "phase0.continuation.1",
    runId,
    timestamp: now.toISOString(),
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
    nextPromptHint: event.nextPromptHint,
    reportOnly: true,
  }

  writeEvidenceJson(evidenceDir, runId, payload)
}
