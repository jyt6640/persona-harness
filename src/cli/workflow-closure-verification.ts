import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"

import type { WorkflowStatusSummary } from "./workflow-status.js"

export type ClosureVerification = "failed" | "not-run" | "passed" | "unknown"

export type ClosureVerificationSummary = {
  readonly evidenceRef?: string
  readonly reason: string
  readonly verification: ClosureVerification
}

const IMPLEMENTATION_REPORT_PATH = ".persona/workflow/implementation-report.md"
const REVIEW_REPORT_PATH = ".persona/workflow/review-report.md"
const EVIDENCE_DIR = ".persona/evidence"
const SUCCESS_PATTERNS = [
  /BUILD SUCCESSFUL/i,
  /(?:test|build|runtime smoke|bootRun)\s+PASS/i,
  /Tomcat started/i,
  /Started\s+\w*Application/i,
] as const
const FAILURE_PATTERNS = [
  /BUILD FAILED/i,
  /Could not resolve/i,
  /exit\s+1/i,
  /(?:compile|compilation|test|build|runtime smoke|bootRun)\s+failed/i,
] as const
const COMMAND_MENTION_PATTERN = /\b(?:\.\/)?gradlew(?:\.bat)?\s+(?:test|build|bootRun)\b|\bbootRun\b|\bcurl\b/i

export function readClosureVerification(projectDir: string, summary: WorkflowStatusSummary): ClosureVerificationSummary {
  if (summary.verificationFailureBlocking) {
    return { reason: summary.verificationFailure, verification: "failed" }
  }
  if (
    summary.implementation === "filled"
    && summary.review === "filled"
    && !summary.commandDisciplineBlocking
    && /\bbearshell observed\b/iu.test(summary.commandDiscipline)
  ) {
    return { reason: summary.commandDiscipline, verification: "passed" }
  }
  const evidence = verificationCorpus(projectDir)
  if (evidence.text.length === 0) {
    return { reason: "no verification evidence observed", verification: "not-run" }
  }
  if (FAILURE_PATTERNS.some((pattern) => pattern.test(evidence.text))) {
    return { evidenceRef: evidence.ref, reason: "explicit verification failure evidence observed", verification: "failed" }
  }
  if (SUCCESS_PATTERNS.some((pattern) => pattern.test(evidence.text))) {
    return { evidenceRef: evidence.ref, reason: "verification success evidence observed", verification: "passed" }
  }
  if (COMMAND_MENTION_PATTERN.test(evidence.text)) {
    return { evidenceRef: evidence.ref, reason: "verification commands mentioned without success/failure output", verification: "unknown" }
  }
  return { evidenceRef: evidence.ref, reason: "verification evidence is present but inconclusive", verification: "unknown" }
}

function verificationCorpus(projectDir: string): { readonly ref?: string; readonly text: string } {
  const reportText = [IMPLEMENTATION_REPORT_PATH, REVIEW_REPORT_PATH]
    .map((path) => join(projectDir, path))
    .filter((path) => existsSync(path))
    .map((path) => readFileSync(path, "utf8"))
    .join("\n")
  const evidenceText = readFilesDeep(join(projectDir, EVIDENCE_DIR))
  return {
    ref: evidenceText.length > 0 ? EVIDENCE_DIR : undefined,
    text: [reportText, evidenceText].filter((text) => text.length > 0).join("\n"),
  }
}

function readFilesDeep(dirPath: string): string {
  if (!existsSync(dirPath)) {
    return ""
  }
  return readdirSync(dirPath)
    .map((entry) => {
      const entryPath = join(dirPath, entry)
      const stat = statSync(entryPath)
      if (stat.isDirectory()) {
        return readFilesDeep(entryPath)
      }
      return stat.isFile() ? readFileSync(entryPath, "utf8") : ""
    })
    .filter((text) => text.length > 0)
    .join("\n")
}
