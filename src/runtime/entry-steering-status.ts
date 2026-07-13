import { createHash } from "node:crypto"
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync } from "node:fs"
import { dirname, join } from "node:path"

import type { HarnessConfig } from "../config/harness-config.js"
import { resolveSafeEvidenceRootResult } from "../config/harness-config.js"
import { isRecord } from "../config/jsonc.js"
import { writeFileAtomic } from "../io/atomic-file.js"
import { detectEntryIntent, type EntryIntentRationale } from "./entry-intent-detector.js"
import type { TransformMessagesOutput } from "./types.js"

const STATUS_DIRECTORY = "entry-steering"
const STATUS_MAX_BYTES = 4096
const ADVISORY = "[Persona Harness Entry Steering] Implementation intent detected — enter the rail with `npx ph go \"<goal>\"`. Advisory only; do not auto-run, force, or auto-finish."

type EntrySteeringStatusPayload = {
  readonly decision: "detected" | "not-detected"
  readonly fired: boolean
  readonly rationale: EntryIntentRationale
  readonly sessionKey: string
}

export type EntrySteeringStatusSummary = {
  readonly decisions: number
  readonly fired: number
  readonly invalidRecords: number
}

function sessionKey(sessionID: string): string {
  return createHash("sha256").update(sessionID).digest("hex").slice(0, 16)
}

function statusDirectory(projectDir: string, config: HarnessConfig): string | undefined {
  const evidenceRoot = resolveSafeEvidenceRootResult(projectDir, config.evidenceDir)
  return evidenceRoot.ok ? join(evidenceRoot.path, STATUS_DIRECTORY) : undefined
}

function statusPath(projectDir: string, config: HarnessConfig, sessionID: string): string | undefined {
  const directory = statusDirectory(projectDir, config)
  return directory === undefined ? undefined : join(directory, `${sessionKey(sessionID)}.json`)
}

function firstUserText(output: TransformMessagesOutput, sessionID: string): string | undefined {
  const message = output.messages.find(
    (candidate) => candidate.info.role === "user" && candidate.info.sessionID === sessionID,
  )
  const part = message?.parts.find((candidate) => candidate.type === "text")
  return part?.type === "text" ? part.text : undefined
}

function injectFirstUserMessage(output: TransformMessagesOutput, sessionID: string): boolean {
  const message = output.messages.find(
    (candidate) => candidate.info.role === "user" && candidate.info.sessionID === sessionID,
  )
  if (message === undefined) {
    return false
  }
  const part = message.parts.find((candidate) => candidate.type === "text")
  if (part?.type === "text") {
    if (part.text.includes("[Persona Harness Entry Steering]")) {
      return false
    }
    part.text = `${ADVISORY}\n\n---\n\n${part.text}`
    return true
  }
  message.parts.unshift({
    id: "persona-harness-entry-steering",
    messageID: message.info.id,
    sessionID: message.info.sessionID,
    synthetic: true,
    text: ADVISORY,
    type: "text",
  })
  return true
}

function isStatusPayload(value: unknown): value is EntrySteeringStatusPayload {
  return isRecord(value)
    && (value.decision === "detected" || value.decision === "not-detected")
    && typeof value.fired === "boolean"
    && typeof value.sessionKey === "string"
    && isRecord(value.rationale)
}

export class EntrySteeringTracker {
  private readonly decidedSessions = new Set<string>()

  constructor(
    private readonly projectDir: string,
    private readonly config: HarnessConfig,
  ) {}

  apply(sessionID: string, output: TransformMessagesOutput): void {
    if (!this.config.enabled || !this.config.features.entrySteering || this.decidedSessions.has(sessionID)) {
      return
    }
    const path = statusPath(this.projectDir, this.config, sessionID)
    if (path === undefined) {
      return
    }
    this.decidedSessions.add(sessionID)
    if (existsSync(path)) {
      return
    }
    const prompt = firstUserText(output, sessionID) ?? ""
    const result = detectEntryIntent(prompt, { projectAttached: existsSync(join(this.projectDir, ".persona")) })
    const fired = result.detected && injectFirstUserMessage(output, sessionID)
    const payload: EntrySteeringStatusPayload = {
      decision: result.detected ? "detected" : "not-detected",
      fired,
      rationale: result.rationale,
      sessionKey: sessionKey(sessionID),
    }
    mkdirSync(dirname(path), { recursive: true })
    writeFileAtomic(path, `${JSON.stringify(payload, null, 2)}\n`)
  }
}

export function readEntrySteeringStatusSummary(projectDir: string, config: HarnessConfig): EntrySteeringStatusSummary {
  const directory = statusDirectory(projectDir, config)
  if (directory === undefined || !existsSync(directory)) {
    return { decisions: 0, fired: 0, invalidRecords: 0 }
  }
  let decisions = 0
  let fired = 0
  let invalidRecords = 0
  for (const fileName of readdirSync(directory).filter((name) => name.endsWith(".json"))) {
    const path = join(directory, fileName)
    try {
      if (statSync(path).size > STATUS_MAX_BYTES) {
        invalidRecords += 1
        continue
      }
      const parsed: unknown = JSON.parse(readFileSync(path, "utf8"))
      if (!isStatusPayload(parsed)) {
        invalidRecords += 1
        continue
      }
      decisions += 1
      if (parsed.fired) fired += 1
    } catch (error) {
      if (error instanceof Error) {
        invalidRecords += 1
        continue
      }
      throw error
    }
  }
  return { decisions, fired, invalidRecords }
}
