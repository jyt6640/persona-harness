import { closeSync, lstatSync, mkdirSync, openSync, writeFileSync } from "node:fs"
import { join } from "node:path"

import { FINISH_ATTESTATION_CONSUMPTION_PATH } from "./workflow-finish-attestation-types.js"

export type FinishAttestationConsumption =
  | { readonly ok: true }
  | {
      readonly code: "consumption-failed" | "replayed-attestation"
      readonly message: string
      readonly ok: false
    }

export function hasConsumedFinishAttestation(projectDir: string): boolean {
  try {
    lstatSync(join(projectDir, FINISH_ATTESTATION_CONSUMPTION_PATH))
    return true
  } catch (error) {
    return isNodeError(error, "ENOENT") ? false : true
  }
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

export function consumeFinishAttestation(
  projectDir: string,
  attestationId: string,
  nonce: string,
  requestId: string,
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
          attestationId,
          consumedAt: new Date().toISOString(),
          nonce,
          requestId,
        })}\n`,
      )
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
