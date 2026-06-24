import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"

import { loadHarnessConfig, resolveConfiguredPath } from "../config/harness-config.js"
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

function safeSlug(value: string): string {
  return value
    .replace(/\\/g, "/")
    .split("/")
    .at(-1)
    ?.replace(/[^a-zA-Z0-9._-]+/g, "-")
    .toLowerCase() || "target"
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
    injectedPolicyCount: event.injection.policies.length,
  }

  mkdirSync(evidenceDir, { recursive: true })
  writeFileSync(join(evidenceDir, `${runId}.json`), `${JSON.stringify(payload, null, 2)}\n`)
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

  mkdirSync(evidenceDir, { recursive: true })
  writeFileSync(join(evidenceDir, `${runId}.json`), `${JSON.stringify(payload, null, 2)}\n`)
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

  mkdirSync(evidenceDir, { recursive: true })
  writeFileSync(join(evidenceDir, `${runId}.json`), `${JSON.stringify(payload, null, 2)}\n`)
}
