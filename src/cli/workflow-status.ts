import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import { join, resolve } from "node:path"
import process from "node:process"

export type WorkflowStatusSummary = {
  readonly projectDir: string
  readonly finding: "PASS" | "WARN"
  readonly plan: string
  readonly implementation: string
  readonly review: string
  readonly evidence: "present" | "missing"
  readonly readCoverage: string
  readonly readCoverageBlocking: boolean
  readonly readCoverageFinding: "PASS" | "WARN"
  readonly commandDiscipline: string
  readonly commandDisciplineBlocking: boolean
  readonly commandDisciplineFinding: "PASS" | "WARN"
  readonly next: string
}

const PLAN_PATH = ".persona/workflow/plan.md"
const IMPLEMENTATION_REPORT_PATH = ".persona/workflow/implementation-report.md"
const REVIEW_REPORT_PATH = ".persona/workflow/review-report.md"
const EVIDENCE_DIR = ".persona/evidence"
const README_PATH = "README.md"

function readStatusLine(filePath: string): string {
  if (!existsSync(filePath)) {
    return "missing"
  }
  const match = /^Status:\s*(.+)$/m.exec(readFileSync(filePath, "utf8"))
  return match?.[1]?.trim() ?? "unknown"
}

function hasFilesDeep(dirPath: string): boolean {
  if (!existsSync(dirPath)) {
    return false
  }
  for (const entry of readdirSync(dirPath)) {
    const entryPath = join(dirPath, entry)
    const stat = statSync(entryPath)
    if (stat.isFile()) {
      return true
    }
    if (stat.isDirectory() && hasFilesDeep(entryPath)) {
      return true
    }
  }
  return false
}

function readExistingFiles(filePaths: readonly string[]): string {
  return filePaths.filter((filePath) => existsSync(filePath)).map((filePath) => readFileSync(filePath, "utf8")).join("\n")
}

const RAW_SHELL_PATTERN = /raw shell|직접\s*썼|직접\s*사용|raw\s+command/i
const DIRECT_RULES_READ_PATTERN = /(?:read|읽)[^\n]*(?:\.persona\/rules|\.persona\\rules)|\.persona\/rules\/|\.persona\\rules\\/i
const FINAL_VERIFICATION_PATTERN = /(?:\.\/)?gradlew?\s+(?:test|build|bootRun)\b|gradle\s+(?:test|build|bootRun)\b|bootRun\b|curl\b/i
const RAW_FINAL_VERIFICATION_PATTERN = /(?:raw shell|직접\s*썼|직접\s*사용|raw\s+command)[^\n]*(?:final verification|최종\s*검증)|(?:final verification|최종\s*검증)[^\n]*(?:raw shell|직접\s*썼|직접\s*사용|raw\s+command)/i
const RAW_WITHOUT_BEARSHELL_PATTERN = /(?:raw shell|직접\s*썼|직접\s*사용|raw\s+command)[^\n]*(?:bearshell)[^\n]*(?:not provided|not used|없|않|못|미사용|제공되지)/i
const FINAL_VERIFICATION_RERUN_PATTERN = /(?:final verification|최종\s*검증)[^\n]*(?:rerun|re-run|다시\s*실행|재실행|다시\s*검증)[^\n]*(?:bearshell|npx\s+ph\s+bearshell)|(?:final verification|최종\s*검증)[^\n]*(?:bearshell|npx\s+ph\s+bearshell)[^\n]*(?:rerun|re-run|다시\s*실행|재실행|다시\s*검증)|(?:bearshell|npx\s+ph\s+bearshell)[^\n]*(?:rerun|re-run|다시\s*실행|재실행|다시\s*검증)[^\n]*(?:final verification|최종\s*검증)/i

type CommandDisciplineSummary = Pick<WorkflowStatusSummary, "commandDiscipline" | "commandDisciplineBlocking" | "commandDisciplineFinding">
type ReadCoverageSummary = Pick<WorkflowStatusSummary, "readCoverage" | "readCoverageBlocking" | "readCoverageFinding">

const README_RANGES_FIELD_PATTERN = /^-\s*README ranges read:\s*(.*)$/i
const README_RANGES_HEADING_PATTERN = /^##+\s*README ranges read:?\s*$/i
const READ_COVERAGE_STOP_PATTERN = /^-\s*(?:Plan read method|Plan ranges read|Unread ranges|Read evidence notes):/i
const RANGE_COVERAGE_PATTERN = /\b\d+\s*[-–]\s*\d+\b|\ball\b|\bcomplete\b|전체|끝까지|완독/i

function hasReadmeRangeCoverage(reportText: string): boolean {
  const lines = reportText.split(/\r?\n/)
  const fieldIndex = lines.findIndex((line) => README_RANGES_FIELD_PATTERN.test(line))
  if (fieldIndex !== -1) {
    const fieldMatch = README_RANGES_FIELD_PATTERN.exec(lines[fieldIndex])
    if (fieldMatch?.[1] !== undefined && RANGE_COVERAGE_PATTERN.test(fieldMatch[1])) {
      return true
    }

    for (const line of lines.slice(fieldIndex + 1)) {
      if (/^##\s+/.test(line) || READ_COVERAGE_STOP_PATTERN.test(line)) {
        return false
      }
      if (RANGE_COVERAGE_PATTERN.test(line)) {
        return true
      }
    }
  }

  const headingIndex = lines.findIndex((line) => README_RANGES_HEADING_PATTERN.test(line))
  if (headingIndex === -1) {
    return false
  }
  for (const line of lines.slice(headingIndex + 1)) {
    if (/^##\s+/.test(line)) {
      return false
    }
    if (RANGE_COVERAGE_PATTERN.test(line)) {
      return true
    }
  }
  return false
}

function readCoverage(projectDir: string, implementationStatus: string): ReadCoverageSummary {
  if (implementationStatus !== "filled") {
    return {
      readCoverage: "not checked until implementation report is filled",
      readCoverageBlocking: false,
      readCoverageFinding: "PASS",
    }
  }
  if (!existsSync(join(projectDir, README_PATH))) {
    return {
      readCoverage: "README.md missing; range coverage not required",
      readCoverageBlocking: false,
      readCoverageFinding: "PASS",
    }
  }

  const implementationReportPath = join(projectDir, IMPLEMENTATION_REPORT_PATH)
  const reportText = existsSync(implementationReportPath) ? readFileSync(implementationReportPath, "utf8") : ""
  if (hasReadmeRangeCoverage(reportText)) {
    return {
      readCoverage: "README ranges observed",
      readCoverageBlocking: false,
      readCoverageFinding: "PASS",
    }
  }
  return {
    readCoverage: "README.md exists but README ranges read is empty",
    readCoverageBlocking: true,
    readCoverageFinding: "WARN",
  }
}

function commandDiscipline(projectDir: string, implementationStatus: string, reviewStatus: string): CommandDisciplineSummary {
  if (implementationStatus !== "filled") {
    return {
      commandDiscipline: "not checked until implementation report is filled",
      commandDisciplineBlocking: false,
      commandDisciplineFinding: "PASS",
    }
  }
  const reportText = readExistingFiles([
    join(projectDir, IMPLEMENTATION_REPORT_PATH),
    join(projectDir, REVIEW_REPORT_PATH),
  ])
  const hasBearshell = reportText.includes("npx ph bearshell")
  const hasRawShell = RAW_SHELL_PATTERN.test(reportText)
  const hasDirectRulesRead = DIRECT_RULES_READ_PATTERN.test(reportText)
  const hasFinalVerification = reportText.split(/\r?\n/).some((line) => FINAL_VERIFICATION_PATTERN.test(line))
  const hasRawWithoutBearshell = reportText.split(/\r?\n/).some((line) =>
    !FINAL_VERIFICATION_RERUN_PATTERN.test(line) && RAW_WITHOUT_BEARSHELL_PATTERN.test(line)
  )
  const hasRawFinalVerification = reportText.split(/\r?\n/).some((line) =>
    !FINAL_VERIFICATION_RERUN_PATTERN.test(line)
    && (
      RAW_FINAL_VERIFICATION_PATTERN.test(line)
      || (!line.includes("npx ph bearshell") && RAW_SHELL_PATTERN.test(line) && FINAL_VERIFICATION_PATTERN.test(line))
    )
  ) || (hasRawWithoutBearshell && hasFinalVerification)
  if (hasRawFinalVerification) {
    return {
      commandDiscipline: "raw shell used for final verification; rerun test/build/bootRun through `npx ph bearshell`",
      commandDisciplineBlocking: true,
      commandDisciplineFinding: "WARN",
    }
  }
  if (hasBearshell) {
    const warnings = [
      ...(hasRawShell ? ["raw shell environment probe observed"] : []),
    ]
    const notes = [
      ...(hasDirectRulesRead ? ["direct `.persona/rules` read observed"] : []),
    ]
    const details = [
      ...warnings.map((warning) => `warning: ${warning}`),
      ...notes.map((note) => `note: ${note}`),
    ]
    return {
      commandDiscipline: details.length > 0 ? `bearshell observed; ${details.join("; ")}` : "bearshell observed",
      commandDisciplineBlocking: false,
      commandDisciplineFinding: warnings.length > 0 ? "WARN" : "PASS",
    }
  }
  if (reviewStatus === "filled") {
    return {
      commandDiscipline: "final verification through `npx ph bearshell` not observed in filled workflow reports",
      commandDisciplineBlocking: true,
      commandDisciplineFinding: "WARN",
    }
  }
  return {
    commandDiscipline: "not checked until review report is filled",
    commandDisciplineBlocking: false,
    commandDisciplineFinding: "PASS",
  }
}

function nextAction(summary: Omit<WorkflowStatusSummary, "finding" | "next">): string {
  if (summary.plan === "missing") {
    return "run `npx ph plan`"
  }
  if (summary.plan !== "accepted") {
    return "review plan, then run `npx ph plan --accept` or `npx ph plan --revise`"
  }
  if (summary.implementation !== "filled") {
    return "run `npx ph workflow implement`, implement, fill implementation report, then run `npx ph plan --report-filled implementation`"
  }
  if (summary.review !== "filled") {
    return "fill review report and run `npx ph plan --report-filled review`"
  }
  if (summary.commandDisciplineBlocking) {
    return "rerun final verification through `npx ph bearshell`"
  }
  if (summary.readCoverageBlocking) {
    return "record README ranges read in `.persona/workflow/implementation-report.md`"
  }
  if (summary.commandDisciplineFinding === "WARN") {
    return "review workflow noise, then archive completed workflow if acceptable"
  }
  return "archive completed workflow with `npx ph history --id <run-id>`"
}

export function readWorkflowStatus(projectDirInput?: string): WorkflowStatusSummary {
  const projectDir = resolve(projectDirInput ?? process.cwd())
  const summary = {
    projectDir,
    plan: readStatusLine(join(projectDir, PLAN_PATH)),
    implementation: readStatusLine(join(projectDir, IMPLEMENTATION_REPORT_PATH)),
    review: readStatusLine(join(projectDir, REVIEW_REPORT_PATH)),
    evidence: hasFilesDeep(join(projectDir, EVIDENCE_DIR)) ? "present" : "missing",
  } as const
  const coverage = readCoverage(projectDir, summary.implementation)
  const command = commandDiscipline(projectDir, summary.implementation, summary.review)
  const next = nextAction({ ...summary, ...coverage, ...command })
  const finding =
    summary.plan === "accepted"
    && summary.implementation === "filled"
    && summary.review === "filled"
    && coverage.readCoverageFinding === "PASS"
    && command.commandDisciplineFinding === "PASS"
      ? "PASS"
      : "WARN"
  return { ...summary, ...coverage, ...command, finding, next }
}

export function formatWorkflowStatus(summary: WorkflowStatusSummary): string {
  return [
    "Persona Harness Workflow Check",
    "",
    `Workflow status: ${summary.finding}`,
    `Project: ${summary.projectDir}`,
    "",
    "Artifacts:",
    `- .persona/workflow/plan.md: ${summary.plan}`,
    `- .persona/workflow/implementation-report.md: ${summary.implementation}`,
    `- .persona/workflow/review-report.md: ${summary.review}`,
    `- .persona/evidence: ${summary.evidence}`,
    `- read coverage: ${summary.readCoverage}`,
    `- command discipline: ${summary.commandDiscipline}`,
    "",
    `Next: ${summary.next}`,
    "",
    "Scope:",
    "- report-only workflow status",
    "- not generated app product-quality certification",
  ].join("\n")
}
