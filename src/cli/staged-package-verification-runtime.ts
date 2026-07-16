import { createHash } from "node:crypto"
import { lstatSync, readFileSync } from "node:fs"

import { runBoundedProcess } from "./bounded-process.js"
import type { JsonRecord } from "./staged-package-verification-types.js"

const MAX_FACT_BYTES = 64 * 1024
const MAX_TARBALL_BYTES = 64 * 1024 * 1024
const COMMAND_TIMEOUT_MS = 120_000
const COMMAND_GRACE_MS = 5_000
const COMMAND_OUTPUT_BYTES = 128 * 1024

export type CommandResult = {
  readonly output: string
  readonly status: number
}

export type CommandRunner = (command: string, args: readonly string[], cwd: string) => CommandResult

export type TarballFacts = {
  readonly integrity: string
  readonly sha1: string
  readonly sha256: string
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

export function runStagedPackageCommand(command: string, args: readonly string[], cwd: string): CommandResult {
  const result = runBoundedProcess({
    args,
    command,
    cwd,
    graceMs: COMMAND_GRACE_MS,
    maxStderrBytes: COMMAND_OUTPUT_BYTES / 2,
    maxStdoutBytes: COMMAND_OUTPUT_BYTES / 2,
    maxTotalBytes: COMMAND_OUTPUT_BYTES,
    timeoutMs: COMMAND_TIMEOUT_MS,
  })
  return {
    output: `${result.stdout}\n${result.stderr}`,
    status: result.outcome === "passed" ? 0 : result.status === 0 ? 1 : result.status,
  }
}

export function isRegularBoundedFile(filePath: string, maxBytes: number): boolean {
  try {
    const stat = lstatSync(filePath)
    return stat.isFile() && !stat.isSymbolicLink() && stat.size > 0 && stat.size <= maxBytes
  } catch {
    return false
  }
}

export function parseJsonRecord(text: string): JsonRecord | undefined {
  try {
    const value: unknown = JSON.parse(text)
    return isRecord(value) ? value : undefined
  } catch {
    return undefined
  }
}

export function readJsonFact(filePath: string, schemaVersion: string): JsonRecord {
  if (!isRegularBoundedFile(filePath, MAX_FACT_BYTES)) return {}
  try {
    const value = parseJsonRecord(readFileSync(filePath, "utf8"))
    return value?.["schemaVersion"] === schemaVersion ? value : {}
  } catch {
    return {}
  }
}

export function readTarballFacts(tarballPath: string): TarballFacts | undefined {
  if (!isRegularBoundedFile(tarballPath, MAX_TARBALL_BYTES)) return undefined
  try {
    const bytes = readFileSync(tarballPath)
    return {
      integrity: `sha512-${createHash("sha512").update(bytes).digest("base64")}`,
      sha1: createHash("sha1").update(bytes).digest("hex"),
      sha256: createHash("sha256").update(bytes).digest("hex"),
    }
  } catch {
    return undefined
  }
}
