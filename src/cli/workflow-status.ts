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
  const next = nextAction(summary)
  const finding =
    summary.plan === "accepted" && summary.implementation === "filled" && summary.review === "filled" ? "PASS" : "WARN"
  return { ...summary, finding, next }
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
    "",
    `Next: ${summary.next}`,
    "",
    "Scope:",
    "- report-only workflow status",
    "- not generated app product-quality certification",
  ].join("\n")
}
