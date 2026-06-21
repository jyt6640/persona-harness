import { existsSync, readFileSync } from "node:fs"
import { join, resolve } from "node:path"
import process from "node:process"

import type { CliRunResult } from "./bearshell.js"
import { IMPLEMENTATION_REPORT_PATH, PLAN_PATH, REVIEW_REPORT_PATH, type PlanOptions } from "./plan.js"
import { PlanStatusError, readWorkflowPlanStatus } from "./plan-status.js"
import { createImplementationPrompt } from "./plan-prompts.js"

type ReportStatus = "missing" | "template" | "filled" | "unknown"

type WorkflowSnapshot = {
  readonly projectDir: string
  readonly planStatus: string | undefined
  readonly implementationStatus: ReportStatus
  readonly reviewStatus: ReportStatus
}

const READ_COVERAGE_LABELS = [
  "README read method",
  "README ranges read",
  "Plan read method",
  "Plan ranges read",
  "Unread ranges",
  "Read evidence notes",
] as const

const CONTINUATION_LABELS = [
  "마지막으로 완료한 요구사항/파일",
  "남은 README/plan 범위",
  "남은 구현 범위",
  "다음에 이어서 실행할 명령/작업",
] as const

function projectDirFor(options: PlanOptions): string {
  return resolve(options.projectDir ?? process.cwd())
}

function reportStatus(projectDir: string, relativePath: string): ReportStatus {
  const reportPath = join(projectDir, relativePath)
  if (!existsSync(reportPath)) {
    return "missing"
  }

  const reportText = readFileSync(reportPath, "utf8")
  const match = reportText.match(/^Status:\s*(.+?)\s*$/m)
  if (match?.[1] === "template") {
    return "template"
  }
  if (match?.[1] === "filled") {
    return "filled"
  }
  return "unknown"
}

function workflowSnapshot(options: PlanOptions): WorkflowSnapshot {
  const projectDir = projectDirFor(options)
  let planStatus: string | undefined
  try {
    planStatus = readWorkflowPlanStatus(options).status
  } catch (error) {
    if (!(error instanceof PlanStatusError)) {
      throw error
    }
  }

  return {
    projectDir,
    planStatus,
    implementationStatus: reportStatus(projectDir, IMPLEMENTATION_REPORT_PATH),
    reviewStatus: reportStatus(projectDir, REVIEW_REPORT_PATH),
  }
}

function nextActionLines(snapshot: WorkflowSnapshot): readonly string[] {
  if (snapshot.planStatus === undefined) {
    return ["No workflow plan found.", "Next command: npx ph plan"]
  }

  if (snapshot.planStatus === "draft") {
    return [
      "Review .persona/workflow/plan.md before implementation.",
      "If the plan is acceptable: npx ph plan --accept",
      "If the plan needs changes: npx ph plan --revise",
    ]
  }

  if (snapshot.planStatus === "needs-revision") {
    return [
      "Revise .persona/workflow/plan.md before implementation.",
      "Suggested planning prompt: npx ph plan --prompt",
      "After revision: npx ph plan --accept",
    ]
  }

  if (snapshot.planStatus !== "accepted") {
    return ["Unknown plan status.", "Inspect .persona/workflow/plan.md and set a known Status value."]
  }

  if (snapshot.implementationStatus === "missing" || snapshot.reviewStatus === "missing") {
    return ["Workflow report template is missing.", "Restore templates with npx ph plan --force after preserving existing plan content."]
  }

  if (snapshot.implementationStatus !== "filled") {
    return ["Implementation is next.", "Next command: npx ph plan --implement"]
  }

  if (snapshot.reviewStatus !== "filled") {
    return [
      "Review is next.",
      "Fill .persona/workflow/review-report.md after review/manual QA.",
      "Then run: npx ph plan --report-filled review",
    ]
  }

  return [
    "Workflow reports are filled.",
    "Archive this workflow run when ready.",
    "Suggested command: npx ph history --id <run-id>",
  ]
}

export function runNextCommand(options: PlanOptions = {}): CliRunResult {
  const snapshot = workflowSnapshot(options)
  const stdout = [
    "Persona Harness next action",
    "",
    `Plan: ${PLAN_PATH}`,
    `Plan status: ${snapshot.planStatus ?? "missing"}`,
    `Implementation report status: ${snapshot.implementationStatus}`,
    `Review report status: ${snapshot.reviewStatus}`,
    "",
    "Next:",
    ...nextActionLines(snapshot).map((line) => `- ${line}`),
  ].join("\n") + "\n"

  return { status: 0, stdout, stderr: "" }
}

function readImplementationReport(projectDir: string): string {
  const reportPath = join(projectDir, IMPLEMENTATION_REPORT_PATH)
  if (!existsSync(reportPath)) {
    throw new PlanStatusError(`No implementation report found. Run npx ph plan first.`)
  }
  return readFileSync(reportPath, "utf8")
}

function valueForLabel(reportText: string, label: string): string | undefined {
  const prefix = `- ${label}:`
  for (const line of reportText.split(/\r?\n/)) {
    if (line.startsWith(prefix)) {
      const value = line.slice(prefix.length).trim()
      return value.length > 0 ? value : undefined
    }
  }
  return undefined
}

function evidenceLines(reportText: string): readonly string[] {
  const lines = [...READ_COVERAGE_LABELS, ...CONTINUATION_LABELS].flatMap((label) => {
    const value = valueForLabel(reportText, label)
    return value === undefined ? [] : [`- ${label}: ${value}`]
  })
  return lines.length > 0 ? lines : ["- No filled continuation evidence found."]
}

function resumePrompt(snapshot: WorkflowSnapshot, reportText: string): string {
  const hasEvidence = evidenceLines(reportText).some((line) => !line.includes("No filled continuation evidence found."))
  return [
    "Persona Harness resume prompt",
    "",
    `Plan: ${PLAN_PATH}`,
    `Plan status: ${snapshot.planStatus ?? "missing"}`,
    `Implementation report: ${IMPLEMENTATION_REPORT_PATH}`,
    `Implementation report status: ${snapshot.implementationStatus}`,
    `Review report status: ${snapshot.reviewStatus}`,
    "",
    hasEvidence ? "Continue from this recorded state:" : "No filled continuation evidence found.",
    ...evidenceLines(reportText),
    "",
    "Required action:",
    "- Read README.md, .persona/project-profile.jsonc, .persona/policies, and .persona/workflow/plan.md.",
    "- Use the Read Coverage fields to avoid claiming unread ranges as complete.",
    "- Continue only the remaining implementation scope.",
    "- Fill .persona/workflow/implementation-report.md with actual Read Coverage and Continuation evidence.",
    "- When implementation is complete, run npx ph plan --report-filled implementation.",
    "",
    "Fallback implementation gate:",
    "npx ph plan --implement",
    "",
    "Implementation prompt:",
    createImplementationPrompt(),
  ].join("\n") + "\n"
}

export function runResumeCommand(options: PlanOptions = {}): CliRunResult {
  const snapshot = workflowSnapshot(options)
  if (snapshot.planStatus !== "accepted") {
    return {
      status: 1,
      stdout: "",
      stderr: [
        "Workflow plan is not accepted.",
        `Current status: ${snapshot.planStatus ?? "missing"}`,
        "Run npx ph plan --accept after review, or npx ph plan --revise if the plan needs changes.",
      ].join("\n") + "\n",
    }
  }

  const reportText = readImplementationReport(snapshot.projectDir)
  return { status: 0, stdout: resumePrompt(snapshot, reportText), stderr: "" }
}
