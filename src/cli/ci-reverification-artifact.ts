import { closeSync, fsyncSync, linkSync, mkdirSync, openSync, readFileSync, unlinkSync, writeFileSync } from "node:fs"
import { join } from "node:path"

import { isRecord } from "../config/jsonc.js"
import type { CiReverificationFinalStatus } from "./ci-reverification-model.js"

export const CI_REVERIFICATION_ARTIFACT_MAX_BYTES = 256 * 1024

export type CiReverificationCommandRecord = {
  readonly durationMs: number
  readonly exitCode: number
  readonly fixedArgvId: "gradle-wrapper-build.1" | "gradle-wrapper-test.1"
  readonly junitRefs: readonly string[]
  readonly ordinal: number
  readonly outcome: "failed" | "passed" | "timeout" | "unavailable"
  readonly stderrBytes: number
  readonly stderrSha256: string
  readonly stdoutBytes: number
  readonly stdoutSha256: string
}

export type CiReverificationArtifact = {
  readonly attemptId: string
  readonly commandCatalogId: "java-spring-gradle-wrapper.1"
  readonly commandPlanSha256: string
  readonly commands: readonly CiReverificationCommandRecord[]
  readonly diagnosticCodes: readonly string[]
  readonly finalStatus: CiReverificationFinalStatus
  readonly mode: "ci" | "local"
  readonly mutationSnapshot: Readonly<Record<string, unknown>>
  readonly profileSha256: string
  readonly schemaVersion: "ph-ci-reverification.1"
}

const SHA256_PATTERN = /^[a-f0-9]{64}$/u
const FORBIDDEN_KEYS = new Set(["env", "environment", "stderr", "stdout"])

function isFinalStatus(value: unknown): value is CiReverificationFinalStatus {
  return value === "artifact-invalid"
    || value === "failed"
    || value === "partial"
    || value === "passed"
    || value === "timeout"
    || value === "unavailable"
}

function containsForbiddenKey(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(containsForbiddenKey)
  if (!isRecord(value)) return false
  return Object.entries(value).some(([key, nested]) => FORBIDDEN_KEYS.has(key) || containsForbiddenKey(nested))
}

function isCommandRecord(value: unknown): value is CiReverificationCommandRecord {
  if (!isRecord(value)) return false
  return Number.isInteger(value.ordinal)
    && (value.fixedArgvId === "gradle-wrapper-test.1" || value.fixedArgvId === "gradle-wrapper-build.1")
    && (value.outcome === "passed" || value.outcome === "failed" || value.outcome === "timeout" || value.outcome === "unavailable")
    && typeof value.exitCode === "number"
    && typeof value.durationMs === "number"
    && typeof value.stdoutBytes === "number"
    && typeof value.stderrBytes === "number"
    && typeof value.stdoutSha256 === "string"
    && SHA256_PATTERN.test(value.stdoutSha256)
    && typeof value.stderrSha256 === "string"
    && SHA256_PATTERN.test(value.stderrSha256)
    && Array.isArray(value.junitRefs)
    && value.junitRefs.every((item) => typeof item === "string")
}

export function parseCiReverificationArtifact(source: string): CiReverificationArtifact | undefined {
  if (Buffer.byteLength(source) > CI_REVERIFICATION_ARTIFACT_MAX_BYTES) return undefined
  let parsed: unknown
  try {
    parsed = JSON.parse(source)
  } catch {
    return undefined
  }
  if (!isRecord(parsed) || containsForbiddenKey(parsed)) return undefined
  if (parsed.schemaVersion !== "ph-ci-reverification.1"
    || typeof parsed.attemptId !== "string"
    || parsed.attemptId.trim() === ""
    || (parsed.mode !== "local" && parsed.mode !== "ci")
    || typeof parsed.profileSha256 !== "string"
    || !SHA256_PATTERN.test(parsed.profileSha256)
    || parsed.commandCatalogId !== "java-spring-gradle-wrapper.1"
    || typeof parsed.commandPlanSha256 !== "string"
    || !SHA256_PATTERN.test(parsed.commandPlanSha256)
    || !Array.isArray(parsed.commands)
    || !parsed.commands.every(isCommandRecord)
    || !isFinalStatus(parsed.finalStatus)
    || !Array.isArray(parsed.diagnosticCodes)
    || !parsed.diagnosticCodes.every((item) => typeof item === "string")
    || !isRecord(parsed.mutationSnapshot)) {
    return undefined
  }
  return {
    attemptId: parsed.attemptId,
    commandCatalogId: parsed.commandCatalogId,
    commandPlanSha256: parsed.commandPlanSha256,
    commands: parsed.commands,
    diagnosticCodes: parsed.diagnosticCodes,
    finalStatus: parsed.finalStatus,
    mode: parsed.mode,
    mutationSnapshot: parsed.mutationSnapshot,
    profileSha256: parsed.profileSha256,
    schemaVersion: parsed.schemaVersion,
  }
}

export function serializeCiReverificationArtifact(artifact: CiReverificationArtifact): string | undefined {
  const source = `${JSON.stringify(artifact, null, 2)}\n`
  return Buffer.byteLength(source) <= CI_REVERIFICATION_ARTIFACT_MAX_BYTES ? source : undefined
}

function removeTemporaryArtifact(path: string): boolean {
  try {
    unlinkSync(path)
    return true
  } catch (error) {
    if (error instanceof Error) return false
    throw error
  }
}

export function writeAndRereadCiReverificationArtifact(
  evidenceParent: string,
  attemptId: string,
  source: string,
): { readonly path: string; readonly valid: boolean } {
  const directory = join(evidenceParent, "ci-reverification")
  mkdirSync(directory, { recursive: true })
  const path = join(directory, `${attemptId}.json`)
  const temporaryPath = join(directory, `.${attemptId}.tmp`)
  let descriptor: number | undefined
  try {
    descriptor = openSync(temporaryPath, "wx", 0o600)
    writeFileSync(descriptor, source, "utf8")
    fsyncSync(descriptor)
    closeSync(descriptor)
    descriptor = undefined
    linkSync(temporaryPath, path)
    removeTemporaryArtifact(temporaryPath)
    return { path, valid: parseCiReverificationArtifact(readFileSync(path, "utf8")) !== undefined }
  } catch {
    if (descriptor !== undefined) closeSync(descriptor)
    removeTemporaryArtifact(temporaryPath)
    return { path, valid: false }
  }
}
