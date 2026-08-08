import { createHash, randomUUID } from "node:crypto"
import { isAbsolute, resolve } from "node:path"

import { loadHarnessConfigResult } from "../config/harness-config.js"
import {
  reserveExistingBootstrapWriteBoundary,
  reserveProjectReadBoundary,
} from "../io/bootstrap-write-boundary.js"
import { nativeProjectReadPlatformSupported } from "../io/native-project-read.js"
import { sanitizeEvidenceValue } from "../runtime/evidence-redaction.js"
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
  // `reserveProjectReadBoundary` loads a native addon that is built for darwin
  // and linux only, so on any other platform this command could not record a
  // read at all — and it is the only producer of the `fileRole` evidence that
  // `java-role-read-coverage` accepts, which put a cooperative PASS out of
  // reach there entirely.
  //
  // The bootstrap write boundary reads project files without the addon and
  // already works on those platforms, since `init` and `bootstrap` run there.
  if (!nativeProjectReadPlatformSupported()) {
    return recordEvidenceReadWithoutNativeBoundary(projectDir, targetFile)
  }
  try {
    const readBoundary = reserveProjectReadBoundary(projectDir)
    try {
      const file = readBoundary.readProjectFile(targetFile, MAX_READ_BYTES)
      if (file === undefined || file.byteLength > MAX_READ_BYTES) return UNAVAILABLE_RESULT
      const config = loadHarnessConfigResult(projectDir, readBoundary)
      if (!config.safe || !safeProjectRelativePath(config.config.evidenceDir)) return UNAVAILABLE_RESULT
      const relativeOutputPath = `${config.config.evidenceDir}/phase0/workflow-read-${randomUUID()}.json`
      if (!safeProjectRelativePath(relativeOutputPath)) return UNAVAILABLE_RESULT
      const payload = {
        byteCount: file.byteLength,
        contentDigest: `sha256:${createHash("sha256").update(file).digest("hex")}`,
        evidenceKind: "workflow-read",
        fileRole: "source-read",
        schemaVersion: "workflow-read-evidence.1",
        targetFile,
      } as const
      readBoundary.assert()
      const writeBoundary = reserveExistingBootstrapWriteBoundary(projectDir)
      try {
        writeBoundary.writeProjectFileAtomically(
          relativeOutputPath,
          `${JSON.stringify(sanitizeEvidenceValue(payload, 4_096, { projectDir }), null, 2)}\n`,
        )
      } finally {
        writeBoundary.close()
      }
      readBoundary.assert()
    } finally {
      readBoundary.close()
    }
  } catch {
    return UNAVAILABLE_RESULT
  }
  return { status: 0, stdout: "Evidence read recorded.\n", stderr: "" }
}

/**
 * The same record, taken through the bootstrap write boundary alone.
 *
 * The evidence written is byte-identical to the native path — same schema, same
 * digest, same `fileRole` — because what it attests is the content of the file
 * that was read. What is missing is the project read boundary's guarantee that
 * the surrounding tree did not change underneath the read, which is why the
 * finish that consumes this evidence also states that it ran unsnapshotted.
 */
function recordEvidenceReadWithoutNativeBoundary(projectDir: string, targetFile: string): CliRunResult {
  try {
    const boundary = reserveExistingBootstrapWriteBoundary(projectDir)
    try {
      const file = boundary.readProjectFile(targetFile)
      if (file === undefined || file.byteLength > MAX_READ_BYTES) return UNAVAILABLE_RESULT
      const config = loadHarnessConfigResult(projectDir, boundary)
      if (!config.safe || !safeProjectRelativePath(config.config.evidenceDir)) return UNAVAILABLE_RESULT
      const relativeOutputPath = `${config.config.evidenceDir}/phase0/workflow-read-${randomUUID()}.json`
      if (!safeProjectRelativePath(relativeOutputPath)) return UNAVAILABLE_RESULT
      const payload = {
        byteCount: file.byteLength,
        contentDigest: `sha256:${createHash("sha256").update(file).digest("hex")}`,
        evidenceKind: "workflow-read",
        fileRole: "source-read",
        schemaVersion: "workflow-read-evidence.1",
        targetFile,
      } as const
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
