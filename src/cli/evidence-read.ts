import { createHash, randomUUID } from "node:crypto"
import { join, resolve } from "node:path"

import { evidenceWriteContext, writePrivateEvidenceJson } from "../runtime/evidence-file.js"
import { readNoFollowProjectFile } from "../io/no-follow-file.js"
import type { CliRunResult } from "./bearshell.js"

const MAX_READ_BYTES = 256 * 1024
const UNAVAILABLE_RESULT: CliRunResult = {
  status: 1,
  stdout: "",
  stderr: "Evidence read unavailable.\n",
}

export function runEvidenceReadCommand(
  args: readonly string[],
  projectDirInput: string | undefined,
): CliRunResult {
  if (args.length !== 1) return UNAVAILABLE_RESULT

  const projectDir = resolve(projectDirInput ?? process.cwd())
  const targetFile = args[0]
  if (targetFile === undefined) return UNAVAILABLE_RESULT
  const file = readNoFollowProjectFile(projectDir, targetFile, MAX_READ_BYTES)
  if (file.kind !== "ready") return UNAVAILABLE_RESULT

  const context = evidenceWriteContext(projectDir, {})
  if (context === undefined) return UNAVAILABLE_RESULT
  const outputPath = join(context.evidenceRoot, "phase0", `workflow-read-${randomUUID()}.json`)
  const payload = {
    byteCount: file.value.bytes.byteLength,
    contentDigest: `sha256:${createHash("sha256").update(file.value.bytes).digest("hex")}`,
    evidenceKind: "workflow-read",
    fileRole: "source-read",
    schemaVersion: "workflow-read-evidence.1",
    targetFile,
  } as const
  try {
    writePrivateEvidenceJson(context.evidenceRoot, outputPath, payload, { projectDir })
  } catch {
    return UNAVAILABLE_RESULT
  }
  return { status: 0, stdout: "Evidence read recorded.\n", stderr: "" }
}
