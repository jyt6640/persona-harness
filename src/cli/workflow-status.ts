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
  readonly commandDiscipline: string
  readonly commandDisciplineFinding: "PASS" | "WARN"
  readonly next: string
}

const PLAN_PATH = ".persona/workflow/plan.md"
const IMPLEMENTATION_REPORT_PATH = ".persona/workflow/implementation-report.md"
const REVIEW_REPORT_PATH = ".persona/workflow/review-report.md"
const EVIDENCE_DIR = ".persona/evidence"

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

function commandDiscipline(projectDir: string, implementationStatus: string, reviewStatus: string): Pick<WorkflowStatusSummary, "commandDiscipline" | "commandDisciplineFinding"> {
  if (implementationStatus !== "filled") {
    return {
      commandDiscipline: "not checked until implementation report is filled",
      commandDisciplineFinding: "PASS",
    }
  }
  const reportText = readExistingFiles([
    join(projectDir, IMPLEMENTATION_REPORT_PATH),
    join(projectDir, REVIEW_REPORT_PATH),
  ])
  if (/raw shell|직접\s*썼|직접\s*사용|raw\s+command/i.test(reportText)) {
    return {
      commandDiscipline: "raw shell observed; prefer `npx ph bearshell` for verification",
      commandDisciplineFinding: "WARN",
    }
  }
  if (reportText.includes("npx ph bearshell")) {
    return {
      commandDiscipline: "bearshell observed",
      commandDisciplineFinding: "PASS",
    }
  }
  if (reviewStatus === "filled") {
    return {
      commandDiscipline: "`npx ph bearshell` not observed in filled workflow reports",
      commandDisciplineFinding: "WARN",
    }
  }
  return {
    commandDiscipline: "not checked until review report is filled",
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
    return "run `npx ph plan --implement`, implement, fill implementation report, then run `npx ph plan --report-filled implementation`"
  }
  if (summary.review !== "filled") {
    return "fill review report and run `npx ph plan --report-filled review`"
  }
  if (summary.commandDisciplineFinding === "WARN") {
    return "review command discipline and prefer `npx ph bearshell` for verification"
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
  const command = commandDiscipline(projectDir, summary.implementation, summary.review)
  const next = nextAction({ ...summary, ...command })
  const finding =
    summary.plan === "accepted" && summary.implementation === "filled" && summary.review === "filled" && command.commandDisciplineFinding === "PASS" ? "PASS" : "WARN"
  return { ...summary, ...command, finding, next }
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
    `- command discipline: ${summary.commandDiscipline}`,
    "",
    `Next: ${summary.next}`,
    "",
    "Scope:",
    "- report-only workflow status",
    "- not generated app product-quality certification",
  ].join("\n")
}
