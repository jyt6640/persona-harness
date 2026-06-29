import { mkdirSync, writeFileSync } from "node:fs"
import { join, relative } from "node:path"

import { loadHarnessConfig, resolveConfiguredPath } from "../config/harness-config.js"
import { warnRuntimeFailure } from "./error-boundary.js"

export type ExecutionEvidenceEvent = {
  readonly command: string
  readonly durationMs: number
  readonly endedAt: string
  readonly status: number
  readonly stderr: string
  readonly stdout: string
}

const MAX_RECORDED_OUTPUT_CHARS = 12_000

export function writeBearshellExecutionEvidence(projectDir: string, event: ExecutionEvidenceEvent): string | null {
  const config = loadHarnessConfig(projectDir)
  const evidenceDir = join(resolveConfiguredPath(projectDir, config.evidenceDir), "phase0")
  const runId = `${event.endedAt.replace(/[:.]/g, "-")}-bearshell-${safeSlug(event.command)}`
  const outputPath = join(evidenceDir, `${runId}.json`)
  const payload = {
    schemaVersion: "phase0.execution.1",
    runId,
    timestamp: event.endedAt,
    tool: "bearshell",
    evidenceKind: "execution",
    command: event.command,
    status: event.status,
    exitCode: event.status,
    durationMs: event.durationMs,
    stdout: boundOutput(event.stdout),
    stderr: boundOutput(event.stderr),
    toolOutput: boundOutput([event.stdout, event.stderr].filter((text) => text.length > 0).join("\n")),
  }

  try {
    mkdirSync(evidenceDir, { recursive: true })
    writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`)
    return relative(projectDir, outputPath).replace(/\\/g, "/")
  } catch (error) {
    warnRuntimeFailure("evidence-write", "bearshell-execution-evidence", outputPath, error instanceof Error ? error : new Error(String(error)))
    return null
  }
}

function boundOutput(text: string): string {
  if (text.length <= MAX_RECORDED_OUTPUT_CHARS) {
    return text
  }
  const headLength = Math.floor(MAX_RECORDED_OUTPUT_CHARS * 0.6)
  const tailLength = MAX_RECORDED_OUTPUT_CHARS - headLength
  const head = text.slice(0, headLength).trimEnd()
  const tail = text.slice(text.length - tailLength).trimStart()
  return `${head}\n[bearshell evidence truncated] original chars: ${text.length}; omitted: ${text.length - head.length - tail.length}\n${tail}`
}

function safeSlug(value: string): string {
  return value
    .replace(/\\/g, "/")
    .split("/")
    .at(-1)
    ?.replace(/[^a-zA-Z0-9._-]+/g, "-")
    .toLowerCase() || "command"
}
