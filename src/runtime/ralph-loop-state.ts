import { existsSync, mkdirSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"

import { isRecord } from "../config/jsonc.js"
import { writeFileAtomic } from "../io/atomic-file.js"
import { warnRuntimeFailure } from "./error-boundary.js"

export type RalphLoopStopReason = "finish-passed" | "max-attempts" | "no-blockers" | "unmapped-blocker"

export type RalphLoopBlockerAttemptState = {
  readonly attempts: number
  readonly capped: boolean
  readonly lastUtteranceAt: string | null
}

export type RalphLoopSessionState = {
  readonly attemptsUsed: number
  readonly blockerAttempts: Readonly<Record<string, RalphLoopBlockerAttemptState>>
  readonly capped: boolean
  readonly capSummaryNotified: boolean
  readonly lastBlockerId: string | null
  readonly lastStopReason: RalphLoopStopReason | null
  readonly lastUtteranceAt: string | null
}

export type RalphLoopStateFile = {
  readonly schemaVersion: "workflow-ralph-loop-state.1"
  readonly sessions: Readonly<Record<string, RalphLoopSessionState>>
  readonly updatedAt: string
}

export const EMPTY_RALPH_LOOP_SESSION_STATE: RalphLoopSessionState = {
  attemptsUsed: 0,
  blockerAttempts: {},
  capped: false,
  capSummaryNotified: false,
  lastBlockerId: null,
  lastStopReason: null,
  lastUtteranceAt: null,
}

const SCHEMA_VERSION = "workflow-ralph-loop-state.1"

export function ralphLoopStatePath(projectDir: string): string {
  return join(projectDir, ".persona", "workflow", "ralph-loop-state.json")
}

export function emptyRalphLoopState(now: string): RalphLoopStateFile {
  return {
    schemaVersion: SCHEMA_VERSION,
    sessions: {},
    updatedAt: now,
  }
}

function readPositiveNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : fallback
}

function readNullableString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null
}

function readStopReason(value: unknown): RalphLoopStopReason | null {
  return value === "finish-passed" || value === "max-attempts" || value === "no-blockers" || value === "unmapped-blocker"
    ? value
    : null
}

function readBlockerAttemptState(value: unknown): RalphLoopBlockerAttemptState {
  if (!isRecord(value)) {
    return { attempts: 0, capped: false, lastUtteranceAt: null }
  }
  return {
    attempts: readPositiveNumber(value.attempts, 0),
    capped: value.capped === true,
    lastUtteranceAt: readNullableString(value.lastUtteranceAt),
  }
}

function readBlockerAttempts(value: unknown): Record<string, RalphLoopBlockerAttemptState> {
  const attempts: Record<string, RalphLoopBlockerAttemptState> = {}
  if (!isRecord(value)) {
    return attempts
  }
  for (const [blockerId, rawState] of Object.entries(value)) {
    if (blockerId.trim() !== "") {
      attempts[blockerId] = readBlockerAttemptState(rawState)
    }
  }
  return attempts
}

function readSessionState(value: unknown): RalphLoopSessionState {
  if (!isRecord(value)) {
    return EMPTY_RALPH_LOOP_SESSION_STATE
  }
  return {
    attemptsUsed: readPositiveNumber(value.attemptsUsed, 0),
    blockerAttempts: readBlockerAttempts(value.blockerAttempts),
    capped: value.capped === true,
    capSummaryNotified: value.capSummaryNotified === true,
    lastBlockerId: readNullableString(value.lastBlockerId),
    lastStopReason: readStopReason(value.lastStopReason),
    lastUtteranceAt: readNullableString(value.lastUtteranceAt),
  }
}

function readSessions(value: unknown): Record<string, RalphLoopSessionState> {
  const sessions: Record<string, RalphLoopSessionState> = {}
  if (!isRecord(value)) {
    return sessions
  }
  for (const [sessionID, rawState] of Object.entries(value)) {
    if (sessionID.trim() !== "") {
      sessions[sessionID] = readSessionState(rawState)
    }
  }
  return sessions
}

export function readRalphLoopState(projectDir: string, now = new Date().toISOString()): RalphLoopStateFile {
  const outputPath = ralphLoopStatePath(projectDir)
  if (!existsSync(outputPath)) {
    return emptyRalphLoopState(now)
  }
  try {
    const parsed: unknown = JSON.parse(readFileSync(outputPath, "utf8"))
    if (!isRecord(parsed) || parsed.schemaVersion !== SCHEMA_VERSION) {
      return emptyRalphLoopState(now)
    }
    return {
      schemaVersion: SCHEMA_VERSION,
      sessions: readSessions(parsed.sessions),
      updatedAt: readNullableString(parsed.updatedAt) ?? now,
    }
  } catch (error) {
    if (error instanceof Error) {
      warnRuntimeFailure("evidence-write", "ralph-loop-state-read", outputPath, error)
      return emptyRalphLoopState(now)
    }
    warnRuntimeFailure("evidence-write", "ralph-loop-state-read", outputPath, new Error(String(error)))
    return emptyRalphLoopState(now)
  }
}

export function writeRalphLoopState(projectDir: string, state: RalphLoopStateFile): boolean {
  const outputPath = ralphLoopStatePath(projectDir)
  try {
    mkdirSync(dirname(outputPath), { recursive: true })
    writeFileAtomic(outputPath, `${JSON.stringify(state, null, 2)}\n`)
    return true
  } catch (error) {
    if (error instanceof Error) {
      warnRuntimeFailure("evidence-write", "ralph-loop-state-write", outputPath, error)
      return false
    }
    warnRuntimeFailure("evidence-write", "ralph-loop-state-write", outputPath, new Error(String(error)))
    return false
  }
}

export function sessionRalphLoopState(state: RalphLoopStateFile, sessionID: string): RalphLoopSessionState {
  return state.sessions[sessionID] ?? EMPTY_RALPH_LOOP_SESSION_STATE
}

export function withRalphLoopSessionState(
  state: RalphLoopStateFile,
  sessionID: string,
  sessionState: RalphLoopSessionState,
  now: string,
): RalphLoopStateFile {
  return {
    schemaVersion: SCHEMA_VERSION,
    sessions: {
      ...state.sessions,
      [sessionID]: sessionState,
    },
    updatedAt: now,
  }
}
