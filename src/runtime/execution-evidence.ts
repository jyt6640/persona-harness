import { randomUUID } from "node:crypto"
import { join, relative } from "node:path"

import {
  allowsExecutionDiagnostics,
  EVIDENCE_PRIVACY_CLASS,
} from "../config/evidence-privacy.js"
import { loadHarnessConfigResult, resolveSafeEvidenceRootResult } from "../config/harness-config.js"
import { warnRuntimeFailure } from "./error-boundary.js"
import { summarizeEvidenceText } from "./evidence-redaction.js"
import { writePrivateEvidenceJson } from "./evidence-file.js"

export type ExecutionEvidenceEvent = {
  readonly command: string
  readonly durationMs: number
  readonly endedAt: string
  readonly status: number
  readonly stderr: string
  readonly stdout: string
}

const COMMAND_PREVIEW_CHARS = 1_024
const OUTPUT_PREVIEW_CHARS = 2_048

export function writeBearshellExecutionEvidence(projectDir: string, event: ExecutionEvidenceEvent): string | null {
  const configResult = loadHarnessConfigResult(projectDir)
  if (!configResult.safe) {
    return null
  }
  const evidencePath = resolveSafeEvidenceRootResult(projectDir)
  if (!evidencePath.ok) {
    return null
  }
  const evidenceDir = join(evidencePath.path, "phase0")
  const runId = randomUUID()
  const outputPath = join(evidenceDir, `bearshell-${runId}.json`)
  const includeDiagnostics = allowsExecutionDiagnostics(configResult.config.evidenceMode)
  const payload = {
    schemaVersion: "phase0.execution.2",
    runId,
    timestamp: event.endedAt,
    tool: "bearshell",
    evidenceKind: "execution",
    privacyClass: includeDiagnostics
      ? EVIDENCE_PRIVACY_CLASS.redactedExecutionDiagnostics
      : EVIDENCE_PRIVACY_CLASS.metadataSafe,
    status: event.status,
    exitCode: event.status,
    durationMs: event.durationMs,
    commandSummary: summarizeEvidenceText(event.command, {
      includePreview: includeDiagnostics,
      maxPreviewChars: COMMAND_PREVIEW_CHARS,
    }),
    stdoutSummary: summarizeEvidenceText(event.stdout, {
      includePreview: includeDiagnostics,
      maxPreviewChars: OUTPUT_PREVIEW_CHARS,
    }),
    stderrSummary: summarizeEvidenceText(event.stderr, {
      includePreview: includeDiagnostics,
      maxPreviewChars: OUTPUT_PREVIEW_CHARS,
    }),
    diagnosticSignals: diagnosticSignals(event.stdout, event.stderr),
    verificationCommand: verificationCommandSignal(event.command),
  }

  try {
    writePrivateEvidenceJson(evidencePath.path, outputPath, payload)
    return relative(projectDir, outputPath).replace(/\\/g, "/")
  } catch (error) {
    warnRuntimeFailure("evidence-write", "bearshell-execution-evidence", outputPath, error instanceof Error ? error : new Error(String(error)))
    return null
  }
}

function verificationCommandSignal(command: string): string | undefined {
  if (/\b(?:\.\/)?gradlew(?:\.bat)?\s+test\b/iu.test(command)) {
    return "gradlew test"
  }
  if (/\b(?:\.\/)?gradlew(?:\.bat)?\s+build\b/iu.test(command)) {
    return "gradlew build"
  }
  if (/\b(?:\.\/)?gradlew(?:\.bat)?\s+bootRun\b/iu.test(command)) {
    return "gradlew bootRun"
  }
  return /\bcurl\b/iu.test(command) ? "curl" : undefined
}

function diagnosticSignals(stdout: string, stderr: string): readonly string[] {
  const text = `${stdout}\n${stderr}`
  const signals: string[] = []
  if (/BUILD SUCCESSFUL/iu.test(text)) {
    signals.push("BUILD SUCCESSFUL")
  }
  if (/BUILD FAILED/iu.test(text)) {
    signals.push("BUILD FAILED")
  }
  if (/(?:test|build|runtime smoke|bootRun)\s+PASS/iu.test(text)) {
    signals.push("verification PASS")
  }
  if (/(?:compile|compilation|test|build|runtime smoke|bootRun)\s+failed/iu.test(text)) {
    signals.push("verification failed")
  }
  return signals
}
