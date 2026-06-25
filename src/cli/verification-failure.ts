import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"

export type VerificationFailureSummary = {
  readonly verificationFailure: string
  readonly verificationFailureBlocking: boolean
  readonly verificationFailureFinding: "PASS" | "WARN"
}

const IMPLEMENTATION_REPORT_PATH = ".persona/workflow/implementation-report.md"
const REVIEW_REPORT_PATH = ".persona/workflow/review-report.md"
const FAILURE_LINE_PATTERNS = [
  /\bverification failed\b/i,
  /\b(?:\.\/)?gradlew(?:\.bat)?\s+(?:test|build|bootRun)\s+failed\b/i,
  /\b(?:gradle|test|build|compile|compilation)\s+failed\b/i,
  /\bcompile failure\b/i,
  />\s*Task\s+:[^\n]+?\bFAILED\b/i,
  /\bcannot find symbol\b/i,
  /\bmissing symbol\b/i,
  /\bBUILD FAILED\b/i,
] as const
const MAX_FAILURE_DETAILS = 4

function readExistingFiles(filePaths: readonly string[]): string {
  return filePaths.filter((filePath) => existsSync(filePath)).map((filePath) => readFileSync(filePath, "utf8")).join("\n")
}

function normalizeEvidenceLine(line: string): string {
  return line
    .trim()
    .replace(/^[-*]\s*/, "")
    .replace(/^>\s*/, "")
    .replace(/^`+|`+$/g, "")
    .trim()
}

function failureEvidenceLines(reportText: string): readonly string[] {
  const evidence: string[] = []
  const seen = new Set<string>()
  for (const line of reportText.split(/\r?\n/)) {
    if (!FAILURE_LINE_PATTERNS.some((pattern) => pattern.test(line))) {
      continue
    }
    const normalized = normalizeEvidenceLine(line)
    if (normalized.length === 0 || seen.has(normalized)) {
      continue
    }
    evidence.push(normalized)
    seen.add(normalized)
    if (evidence.length >= MAX_FAILURE_DETAILS) {
      break
    }
  }
  return evidence
}

export function readVerificationFailure(projectDir: string, implementationStatus: string): VerificationFailureSummary {
  if (implementationStatus !== "filled") {
    return {
      verificationFailure: "not checked until implementation report is filled",
      verificationFailureBlocking: false,
      verificationFailureFinding: "PASS",
    }
  }

  const reportText = readExistingFiles([
    join(projectDir, IMPLEMENTATION_REPORT_PATH),
    join(projectDir, REVIEW_REPORT_PATH),
  ])
  const evidence = failureEvidenceLines(reportText)
  if (evidence.length === 0) {
    return {
      verificationFailure: "no failed verification recorded",
      verificationFailureBlocking: false,
      verificationFailureFinding: "PASS",
    }
  }

  return {
    verificationFailure: `compile/test verification failed: ${evidence.join("; ")}`,
    verificationFailureBlocking: true,
    verificationFailureFinding: "WARN",
  }
}
