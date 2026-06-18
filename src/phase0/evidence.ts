import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"

import type { PendingInjection } from "./types.js"

export type EvidenceEvent = {
  hook: "tool.execute.before" | "tool.execute.after" | "experimental.chat.messages.transform"
  sessionID: string
  callID?: string
  injectedInto: "pending-store" | "tool-output" | "model-input"
  injection: PendingInjection
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
  const evidenceDir = join(projectDir, ".persona", "evidence", "phase0")
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
    selectedRules: event.injection.selectedRules,
    injectedPolicyCount: event.injection.policies.length,
  }

  mkdirSync(evidenceDir, { recursive: true })
  writeFileSync(join(evidenceDir, `${runId}.json`), `${JSON.stringify(payload, null, 2)}\n`)
}
