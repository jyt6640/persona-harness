import { closeSync, fsyncSync, lstatSync, mkdirSync, openSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"

import { captureWorkspaceIdentity } from "./ci-reverification-identity.js"
import { canonicalJson, sha256Digest } from "./workflow-finish-attestation-canonical.js"
import {
  FINISH_ATTESTATION_CONSUMPTION_PATH,
  FINISH_ATTESTATION_TERMINAL_SCHEMA,
} from "./workflow-finish-attestation-types.js"
import {
  isCommit,
  isDigest,
  isIdentifier,
  isPositiveInteger,
  isRecord,
} from "./workflow-finish-attestation-receipt-fields.js"

const TERMINAL_RECORD_KEYS = [
  "attestationId",
  "bundleDigest",
  "consumedAt",
  "decision",
  "expiresAt",
  "finishId",
  "issuedAt",
  "nonce",
  "phVersion",
  "receiptDigest",
  "requestId",
  "runAttempt",
  "runId",
  "schemaVersion",
  "sessionId",
  "sourceHead",
  "sourceIdentityDigest",
  "workspaceIdentityDigest",
] as const

const TERMINAL_BINDING_KEYS = [
  "attestationId",
  "bundleDigest",
  "expiresAt",
  "finishId",
  "issuedAt",
  "nonce",
  "phVersion",
  "receiptDigest",
  "requestId",
  "runAttempt",
  "runId",
  "sessionId",
  "sourceHead",
  "sourceIdentityDigest",
  "workspaceIdentityDigest",
] as const

export type FinishAttestationTerminalBinding = {
  readonly attestationId: string
  readonly bundleDigest: string
  readonly expiresAt: string
  readonly finishId: string
  readonly issuedAt: string
  readonly nonce: string
  readonly phVersion: string
  readonly receiptDigest: string
  readonly requestId: string
  readonly runAttempt: number
  readonly runId: string
  readonly sessionId: string
  readonly sourceHead: string
  readonly sourceIdentityDigest: string
  readonly workspaceIdentityDigest: string
}

export type FinishAttestationTerminalRecord = FinishAttestationTerminalBinding & {
  readonly consumedAt: string
  readonly decision: "trusted"
  readonly schemaVersion: typeof FINISH_ATTESTATION_TERMINAL_SCHEMA
}

export type FinishAttestationTerminalRead =
  | { readonly state: "missing" }
  | { readonly message: string; readonly state: "invalid" }
  | { readonly state: "present"; readonly value: FinishAttestationTerminalRecord }

export type FinishAttestationConsumption =
  | { readonly ok: true }
  | {
      readonly code: "consumption-failed" | "replayed-attestation"
      readonly message: string
      readonly ok: false
    }

export function hasConsumedFinishAttestation(projectDir: string): boolean {
  return readFinishAttestationTerminalRecord(projectDir).state !== "missing"
}

export function isSafeFinishAttestationDirectory(projectDir: string): boolean {
  const directories = finishAttestationDirectories(projectDir)
  try {
    return directories.every((directory) => {
      const stat = lstatSync(directory)
      return stat.isDirectory() && !stat.isSymbolicLink()
    })
  } catch {
    return false
  }
}

export function captureFinishAttestationWorkspaceDigest(projectDir: string): string | undefined {
  const workspace = captureWorkspaceIdentity(projectDir)
  return workspace.status === "available" ? sha256Digest(canonicalJson(workspace.value)) : undefined
}

export function readFinishAttestationTerminalRecord(projectDir: string): FinishAttestationTerminalRead {
  const path = join(projectDir, FINISH_ATTESTATION_CONSUMPTION_PATH)
  try {
    const stat = lstatSync(path)
    if (!stat.isFile() || stat.isSymbolicLink()) {
      return { message: "Finish attestation terminal record is not a regular file.", state: "invalid" }
    }
    const parsed: unknown = JSON.parse(readFileSync(path, "utf8"))
    if (!isRecord(parsed) || !hasExactKeys(parsed, TERMINAL_RECORD_KEYS)) {
      return { message: "Finish attestation terminal record is malformed.", state: "invalid" }
    }
    if (
      parsed.schemaVersion !== FINISH_ATTESTATION_TERMINAL_SCHEMA
      || parsed.decision !== "trusted"
      || !isIdentifier(parsed.attestationId)
      || !isDigest(parsed.bundleDigest)
      || !isTimestamp(parsed.consumedAt)
      || !isTimestamp(parsed.expiresAt)
      || !isIdentifier(parsed.finishId)
      || !isTimestamp(parsed.issuedAt)
      || !isIdentifier(parsed.nonce)
      || !isIdentifier(parsed.phVersion)
      || !isDigest(parsed.receiptDigest)
      || !isIdentifier(parsed.requestId)
      || !isPositiveInteger(parsed.runAttempt)
      || !isIdentifier(parsed.runId)
      || !isIdentifier(parsed.sessionId)
      || !isCommit(parsed.sourceHead)
      || !isDigest(parsed.sourceIdentityDigest)
      || !isDigest(parsed.workspaceIdentityDigest)
      || Date.parse(parsed.expiresAt) <= Date.parse(parsed.issuedAt)
      || Date.parse(parsed.consumedAt) < Date.parse(parsed.issuedAt)
    ) {
      return { message: "Finish attestation terminal record bindings are invalid.", state: "invalid" }
    }
    return {
      state: "present",
      value: {
        attestationId: parsed.attestationId,
        bundleDigest: parsed.bundleDigest,
        consumedAt: parsed.consumedAt,
        decision: "trusted",
        expiresAt: parsed.expiresAt,
        finishId: parsed.finishId,
        issuedAt: parsed.issuedAt,
        nonce: parsed.nonce,
        phVersion: parsed.phVersion,
        receiptDigest: parsed.receiptDigest,
        requestId: parsed.requestId,
        runAttempt: parsed.runAttempt,
        runId: parsed.runId,
        schemaVersion: FINISH_ATTESTATION_TERMINAL_SCHEMA,
        sessionId: parsed.sessionId,
        sourceHead: parsed.sourceHead,
        sourceIdentityDigest: parsed.sourceIdentityDigest,
        workspaceIdentityDigest: parsed.workspaceIdentityDigest,
      },
    }
  } catch (error) {
    return isNodeError(error, "ENOENT")
      ? { state: "missing" }
      : { message: "Finish attestation terminal record could not be read safely.", state: "invalid" }
  }
}

export function matchesFinishAttestationTerminalRecord(
  record: FinishAttestationTerminalRecord,
  binding: FinishAttestationTerminalBinding,
): { readonly message: string; readonly ok: false } | { readonly ok: true } {
  for (const key of TERMINAL_BINDING_KEYS) {
    if (record[key] !== binding[key]) {
      return { message: `Finish attestation terminal record ${key} binding does not match.`, ok: false }
    }
  }
  return { ok: true }
}

export function consumeFinishAttestation(
  projectDir: string,
  binding: FinishAttestationTerminalBinding,
): FinishAttestationConsumption {
  const directory = join(projectDir, ".persona", "evidence", "finish-attestation")
  const path = join(projectDir, FINISH_ATTESTATION_CONSUMPTION_PATH)
  try {
    ensureFinishAttestationDirectories(projectDir)
    const descriptor = openSync(path, "wx", 0o600)
    try {
      writeFileSync(
        descriptor,
        `${JSON.stringify({
          ...binding,
          consumedAt: new Date().toISOString(),
          decision: "trusted",
          schemaVersion: FINISH_ATTESTATION_TERMINAL_SCHEMA,
        })}\n`,
      )
      fsyncSync(descriptor)
    } finally {
      closeSync(descriptor)
    }
    return { ok: true }
  } catch (error) {
    if (isNodeError(error, "EEXIST")) {
      return {
        code: "replayed-attestation",
        message: "External finish attestation has already been consumed.",
        ok: false,
      }
    }
    return {
      code: "consumption-failed",
      message: "External finish attestation consumption could not be committed; finish remains blocked.",
      ok: false,
    }
  }
}

function isNodeError(error: unknown, code: string): boolean {
  return typeof error === "object"
    && error !== null
    && "code" in error
    && error.code === code
}

function hasExactKeys(value: Readonly<Record<string, unknown>>, keys: readonly string[]): boolean {
  const expected = new Set(keys)
  return Object.keys(value).length === keys.length && Object.keys(value).every((key) => expected.has(key))
}

function isTimestamp(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value))
}

function ensureFinishAttestationDirectories(projectDir: string): void {
  const directories = finishAttestationDirectories(projectDir)
  for (const directory of directories) {
    mkdirSync(directory, { recursive: true })
    const stat = lstatSync(directory)
    if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error("finish attestation path is unsafe")
  }
}

function finishAttestationDirectories(projectDir: string): readonly string[] {
  return [
    join(projectDir, ".persona"),
    join(projectDir, ".persona", "evidence"),
    join(projectDir, ".persona", "evidence", "finish-attestation"),
  ]
}
