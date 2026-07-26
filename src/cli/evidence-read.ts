import { createHash, randomUUID } from "node:crypto"
import { isAbsolute, join, relative, resolve } from "node:path"

import { reserveBootstrapWriteBoundary } from "../io/bootstrap-write-boundary.js"
import { sanitizeEvidenceValue } from "../runtime/evidence-redaction.js"
import { evidenceWriteContext } from "../runtime/evidence-file.js"
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
    const relativeOutputPath = relative(projectDir, outputPath)
    if (!safeProjectRelativePath(relativeOutputPath)) return UNAVAILABLE_RESULT
    const boundary = reserveBootstrapWriteBoundary(projectDir)
    try {
      boundary.writeProjectFileAtomically(
        relativeOutputPath,
        `${JSON.stringify(sanitizeEvidenceValue(payload, 4_096, { projectDir }), null, 2)}\n`,
      )
    } finally {
      boundary.close()
    }
  } catch {
    return UNAVAILABLE_RESULT
  }
  return { status: 0, stdout: "Evidence read recorded.\n", stderr: "" }
}

function safeProjectRelativePath(value: string): boolean {
  return value.length > 0
    && !isAbsolute(value)
    && !value.includes("\\")
    && value.split("/").every((segment) => segment.length > 0 && segment !== "." && segment !== "..")
}
