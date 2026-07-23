import { existsSync, mkdirSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"

import { isRecord } from "../config/jsonc.js"
import {
  fileChangeToken,
  writeFileAtomic,
  writeFileAtomicIfTokenUnchanged,
  type FileChangeToken,
} from "../io/atomic-file.js"
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

export type RalphLoopStateSnapshot = {
  readonly integrity: "absent" | "malformed" | "valid"
  readonly state: RalphLoopStateFile
  readonly token: FileChangeToken | null
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

function isRalphLoopStateFile(value: unknown): value is Record<string, unknown> {
  if (!isRecord(value) || value.schemaVersion !== SCHEMA_VERSION || !isNonEmptyString(value.updatedAt) || !isRecord(value.sessions)) {
    return false
  }
  return Object.entries(value.sessions).every(([sessionID, state]) =>
    sessionID.trim() !== "" && isRalphLoopSessionState(state),
  )
}

function isRalphLoopSessionState(value: unknown): value is Record<string, unknown> {
  if (
    !isRecord(value)
    || !isNonnegativeNumber(value.attemptsUsed)
    || !isRecord(value.blockerAttempts)
    || typeof value.capped !== "boolean"
    || typeof value.capSummaryNotified !== "boolean"
    || !isNullableNonEmptyString(value.lastBlockerId)
    || !isNullableStopReason(value.lastStopReason)
    || !isNullableNonEmptyString(value.lastUtteranceAt)
  ) {
    return false
  }
  return Object.entries(value.blockerAttempts).every(([blockerId, attempt]) =>
    blockerId.trim() !== "" && isRalphLoopBlockerAttemptState(attempt),
  )
}

function isRalphLoopBlockerAttemptState(value: unknown): value is Record<string, unknown> {
  return isRecord(value)
    && isNonnegativeNumber(value.attempts)
    && typeof value.capped === "boolean"
    && isNullableNonEmptyString(value.lastUtteranceAt)
}

function isNonnegativeNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== ""
}

function isNullableNonEmptyString(value: unknown): value is string | null {
  return value === null || isNonEmptyString(value)
}

function isNullableStopReason(value: unknown): value is RalphLoopStopReason | null {
  return value === null || readStopReason(value) !== null
}

export function readRalphLoopStateSnapshot(projectDir: string, now = new Date().toISOString()): RalphLoopStateSnapshot {
  const outputPath = ralphLoopStatePath(projectDir)
  if (!existsSync(outputPath)) {
    return { integrity: "absent", state: emptyRalphLoopState(now), token: null }
  }
  try {
    const parsed: unknown = JSON.parse(readFileSync(outputPath, "utf8"))
    if (!isRalphLoopStateFile(parsed)) {
      return { integrity: "malformed", state: emptyRalphLoopState(now), token: fileChangeToken(outputPath) }
    }
    return {
      integrity: "valid",
      state: {
        schemaVersion: SCHEMA_VERSION,
        sessions: readSessions(parsed.sessions),
        updatedAt: readNullableString(parsed.updatedAt) ?? now,
      },
      token: fileChangeToken(outputPath),
    }
  } catch (error) {
    if (error instanceof Error) {
      warnRuntimeFailure("evidence-write", "ralph-loop-state-read", outputPath, error)
      return { integrity: "malformed", state: emptyRalphLoopState(now), token: fileChangeToken(outputPath) }
    }
    warnRuntimeFailure("evidence-write", "ralph-loop-state-read", outputPath, new Error(String(error)))
    return { integrity: "malformed", state: emptyRalphLoopState(now), token: fileChangeToken(outputPath) }
  }
}

export function readRalphLoopState(projectDir: string, now = new Date().toISOString()): RalphLoopStateFile {
  return readRalphLoopStateSnapshot(projectDir, now).state
}

export function writeRalphLoopState(
  projectDir: string,
  state: RalphLoopStateFile,
  expectedToken?: FileChangeToken | null,
): boolean {
  const outputPath = ralphLoopStatePath(projectDir)
  try {
    mkdirSync(dirname(outputPath), { recursive: true })
    if (expectedToken === undefined) {
      writeFileAtomic(outputPath, `${JSON.stringify(state, null, 2)}\n`)
      return true
    }
    writeFileAtomicIfTokenUnchanged(outputPath, expectedToken, `${JSON.stringify(state, null, 2)}\n`)
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
