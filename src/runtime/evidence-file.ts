import { createHash, randomUUID } from "node:crypto"
import { join } from "node:path"

import {
  loadHarnessConfigResult,
  resolveSafeEvidenceRootResult,
  type EvidenceMode,
} from "../config/harness-config.js"
import { ensurePrivateDirectory, writePrivateFileAtomic } from "../io/atomic-file.js"
import { warnRuntimeFailure } from "./error-boundary.js"
import { sanitizeEvidenceValue } from "./evidence-redaction.js"

export type EvidenceWriteOptions = {
  readonly evidenceDir?: string
}

export type EvidenceWriteContext = {
  readonly evidenceRoot: string
  readonly mode: EvidenceMode
}

export function opaqueEvidenceKey(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex")
}

export function evidenceWriteContext(
  projectDir: string,
  options: EvidenceWriteOptions,
): EvidenceWriteContext | undefined {
  const configResult = loadHarnessConfigResult(projectDir)
  if (!configResult.safe) {
    return undefined
  }
  const evidenceRoot = resolveSafeEvidenceRootResult(projectDir, options.evidenceDir)
  return evidenceRoot.ok
    ? { evidenceRoot: evidenceRoot.path, mode: configResult.config.evidenceMode }
    : undefined
}

export function evidenceRunId(): string {
  return randomUUID()
}

export function writePrivateEvidenceJson(
  evidenceRoot: string,
  outputPath: string,
  payload: unknown,
): void {
  ensurePrivateDirectory(evidenceRoot)
  const sanitized = sanitizeEvidenceValue(payload)
  writePrivateFileAtomic(outputPath, `${JSON.stringify(sanitized, null, 2)}\n`)
}

export function writeEvidenceRecord(
  context: EvidenceWriteContext,
  category: string,
  runId: string,
  payload: unknown,
): void {
  const outputPath = join(context.evidenceRoot, "phase0", `${category}-${runId}.json`)
  try {
    writePrivateEvidenceJson(context.evidenceRoot, outputPath, payload)
  } catch (error) {
    warnRuntimeFailure(
      "evidence-write",
      "evidence-write",
      outputPath,
      error instanceof Error ? error : new Error(String(error)),
    )
  }
}
