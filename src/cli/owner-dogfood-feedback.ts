import {
  closeSync,
  constants,
  fchmodSync,
  fstatSync,
  fsyncSync,
  lstatSync,
  openSync,
  writeSync,
} from "node:fs"
import { homedir } from "node:os"
import { isAbsolute, join, resolve } from "node:path"

import {
  createNoFollowDirectoryChain,
  hasStableNoFollowDirectoryChain,
  noFollowPathIdentityFromStat,
  readNoFollowRegularFile,
  sameNoFollowPathIdentity,
  sameNoFollowPathLocation,
  type NoFollowDirectoryReservation,
  type NoFollowPathIdentity,
} from "../io/no-follow-file.js"
import type { CliRunResult } from "./bearshell.js"

const EVENT_FILE_NAME = "events.jsonl"
const EVENT_SCHEMA_VERSION = "owner-dogfood-feedback.1"
const MAX_EVENT_BYTES = 512
const MAX_STORE_BYTES = 256 * 1024
const MAX_STORED_EVENTS = 512

const OWNER_DOGFOOD_FEEDBACK_CODES = [
  "bootstrap-workspace-intake-failed",
  "interview-repeated-question",
  "project-philosophy-not-injected",
  "shared-skill-routing-unavailable",
  "source-read-runtime-unavailable",
  "unnecessary-interview",
  "workflow-history-missing",
] as const

type OwnerDogfoodFeedbackCode = typeof OWNER_DOGFOOD_FEEDBACK_CODES[number]

type OwnerDogfoodFeedbackEvent = Readonly<{
  readonly code: OwnerDogfoodFeedbackCode
  readonly recordedAt: string
  readonly schemaVersion: typeof EVENT_SCHEMA_VERSION
}>

export type OwnerDogfoodFeedbackOptions = Readonly<{
  readonly env?: Readonly<Record<string, string | undefined>>
  readonly homeDir?: string
  readonly now?: Date
}>

type ExistingEvents =
  | Readonly<{ readonly kind: "absent" }>
  | Readonly<{ readonly count: number; readonly identity: NoFollowPathIdentity; readonly kind: "ready" }>
  | Readonly<{ readonly kind: "blocked" }>

type PreparedPrivateRoot = Readonly<{
  readonly chain: readonly NoFollowDirectoryReservation[]
  readonly path: string
}>

export function ownerDogfoodFeedbackUsage(invocationName: string): string {
  return [
    `Usage: ${invocationName} feedback dogfood <code>`,
    "",
    "Append one bounded, diagnostic-only owner dogfooding observation.",
    "No project files, workflow authority, release authority, or external authority changes.",
    "",
    "Codes:",
    ...OWNER_DOGFOOD_FEEDBACK_CODES.map((code) => `  ${code}`),
    "",
    "State root:",
    "  ~/.local/state/persona-harness/owner-dogfood-feedback/events.jsonl",
    "  Override only with an absolute PH_OWNER_DOGFOOD_FEEDBACK_ROOT.",
  ].join("\n")
}

export function runOwnerDogfoodFeedbackCommand(
  args: readonly string[],
  options: OwnerDogfoodFeedbackOptions = {},
  invocationName = "ph",
): CliRunResult {
  if (args.length === 1 && (args[0] === "--help" || args[0] === "-h" || args[0] === "help")) {
    return { status: 0, stdout: `${ownerDogfoodFeedbackUsage(invocationName)}\n`, stderr: "" }
  }
  const code = args.length === 1 ? parseCode(args[0]) : undefined
  if (code === undefined) {
    return blockedResult("invalid-observation", invocationName)
  }
  const root = resolveRoot(options)
  const privateRoot = root === undefined ? undefined : preparePrivateRoot(root)
  if (privateRoot === undefined) {
    return blockedResult("state-unavailable", invocationName)
  }
  const path = join(privateRoot.path, EVENT_FILE_NAME)
  const existing = readExistingEvents(privateRoot, path)
  if (existing.kind === "blocked" || (existing.kind === "ready" && existing.count >= MAX_STORED_EVENTS)) {
    return blockedResult("state-unavailable", invocationName)
  }
  const event: OwnerDogfoodFeedbackEvent = {
    code,
    recordedAt: (options.now ?? new Date()).toISOString(),
    schemaVersion: EVENT_SCHEMA_VERSION,
  }
  const payload = `${JSON.stringify(event)}\n`
  if (Buffer.byteLength(payload, "utf8") > MAX_EVENT_BYTES || !appendEvent(privateRoot, path, existing, payload)) {
    return blockedResult("state-unavailable", invocationName)
  }
  return { status: 0, stdout: "Owner dogfooding feedback recorded. Diagnostic-only.\n", stderr: "" }
}

function parseCode(value: string | undefined): OwnerDogfoodFeedbackCode | undefined {
  return OWNER_DOGFOOD_FEEDBACK_CODES.includes(value as OwnerDogfoodFeedbackCode)
    ? value as OwnerDogfoodFeedbackCode
    : undefined
}

function resolveRoot(options: OwnerDogfoodFeedbackOptions): string | undefined {
  const env = options.env ?? process.env
  const override = env.PH_OWNER_DOGFOOD_FEEDBACK_ROOT
  if (override !== undefined) {
    return isSafeAbsolutePath(override) ? resolve(override) : undefined
  }
  const home = firstNonEmpty(env.HOME) ?? firstNonEmpty(env.USERPROFILE) ?? options.homeDir ?? homedir()
  if (!isSafeAbsolutePath(home)) return undefined
  return join(resolve(home), ".local", "state", "persona-harness", "owner-dogfood-feedback")
}

function firstNonEmpty(value: string | undefined): string | undefined {
  return value !== undefined && value.trim().length > 0 ? value : undefined
}

function isSafeAbsolutePath(path: string): boolean {
  return isAbsolute(path) && path.trim() === path && path.length > 0 && !path.includes("\0")
}

function preparePrivateRoot(path: string): PreparedPrivateRoot | undefined {
  const chain = createNoFollowDirectoryChain(path, 0o700)
  if (chain === undefined) return undefined
  const root = chain.at(-1)
  return root !== undefined && isPrivateMode(root.identity.mode, "0700") ? { chain, path } : undefined
}

function readExistingEvents(root: PreparedPrivateRoot, path: string): ExistingEvents {
  if (!hasStableNoFollowDirectoryChain(root.chain)) return { kind: "blocked" }
  const source = readNoFollowRegularFile(path, MAX_STORE_BYTES, root.path)
  if (source.kind === "absent") return { kind: "absent" }
  if (source.kind !== "ready") return { kind: "blocked" }
  const count = countEventLines(source.value.bytes.toString("utf8"))
  if (!isPrivateMode(source.value.identity.mode, "0600") || count === undefined || !hasStableNoFollowDirectoryChain(root.chain)) {
    return { kind: "blocked" }
  }
  return { count, identity: source.value.identity, kind: "ready" }
}

function countEventLines(text: string): number | undefined {
  if (text.length === 0 || !text.endsWith("\n")) return undefined
  const lines = text.slice(0, -1).split("\n")
  if (lines.length > MAX_STORED_EVENTS || lines.some((line) => line.length === 0)) return undefined
  const valid = lines.every((line) => {
    try {
      return isOwnerDogfoodFeedbackEvent(JSON.parse(line))
    } catch {
      return false
    }
  })
  return valid ? lines.length : undefined
}

function isOwnerDogfoodFeedbackEvent(value: unknown): value is OwnerDogfoodFeedbackEvent {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false
  const record = value as Record<string, unknown>
  return Object.keys(record).length === 3
    && parseCode(typeof record.code === "string" ? record.code : undefined) !== undefined
    && typeof record.recordedAt === "string"
    && Number.isFinite(Date.parse(record.recordedAt))
    && record.schemaVersion === EVENT_SCHEMA_VERSION
}

function appendEvent(root: PreparedPrivateRoot, path: string, existing: ExistingEvents, payload: string): boolean {
  if (!hasStableNoFollowDirectoryChain(root.chain)) return false
  let descriptor: number | undefined
  try {
    const flags = existing.kind === "absent"
      ? constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW | constants.O_WRONLY
      : constants.O_APPEND | constants.O_NOFOLLOW | constants.O_WRONLY
    descriptor = openSync(path, flags, 0o600)
    const before = fstatSync(descriptor, { bigint: true })
    if (!before.isFile()) return false
    const beforeIdentity = noFollowPathIdentityFromStat(before)
    if (existing.kind === "ready" && !sameNoFollowPathIdentity(existing.identity, beforeIdentity)) return false
    fchmodSync(descriptor, 0o600)
    const afterMode = fstatSync(descriptor, { bigint: true })
    if (!afterMode.isFile() || !isPrivateMode(noFollowPathIdentityFromStat(afterMode).mode, "0600")) return false
    writeAll(descriptor, payload)
    fsyncSync(descriptor)
    const after = fstatSync(descriptor, { bigint: true })
    const current = lstatSync(path, { bigint: true })
    return after.isFile()
      && current.isFile()
      && !current.isSymbolicLink()
      && hasStableNoFollowDirectoryChain(root.chain)
      && sameNoFollowPathLocation(noFollowPathIdentityFromStat(after), noFollowPathIdentityFromStat(current))
      && isPrivateMode(noFollowPathIdentityFromStat(after).mode, "0600")
  } catch {
    return false
  } finally {
    if (descriptor !== undefined) closeSync(descriptor)
  }
}

function writeAll(descriptor: number, payload: string): void {
  const bytes = Buffer.from(payload, "utf8")
  let offset = 0
  while (offset < bytes.byteLength) {
    const written = writeSync(descriptor, bytes, offset, bytes.byteLength - offset)
    if (written <= 0) throw new Error("owner-dogfood-feedback-write-failed")
    offset += written
  }
}

function isPrivateMode(mode: string, expected: "0600" | "0700"): boolean {
  return process.platform === "win32" || mode === expected
}

function blockedResult(reason: "invalid-observation" | "state-unavailable", invocationName: string): CliRunResult {
  return {
    status: 1,
    stdout: "",
    stderr: `Owner dogfooding feedback was not recorded (${reason}).\n\n${ownerDogfoodFeedbackUsage(invocationName)}\n`,
  }
}
