import { mkdirSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import process from "node:process"

import { writeFileAtomic } from "../io/atomic-file.js"
import type { CliRunResult } from "./bearshell.js"
import { readWorkflowStatus } from "./workflow-status.js"

type FeedbackOptions = {
  readonly projectDir?: string
}

const FEEDBACK_REPORT_PATH = ".persona/workflow/feedback-report.md"

function feedbackUsage(invocationName: string): string {
  return [
    `Usage: ${invocationName} feedback`,
    "",
    "Write a tester feedback template to .persona/workflow/feedback-report.md.",
    "",
    "Useful first checks:",
    "- npx ph doctor",
    "- npx ph workflow check",
    "- npx ph smoke",
    "",
    "Scope:",
    "- report-only tester feedback template",
    "- not generated app product-quality certification",
  ].join("\n")
}

function createFeedbackTemplate(projectDir: string): string {
  const status = readWorkflowStatus(projectDir)
  return [
    "# Persona Harness Tester Feedback",
    "",
    `Project: \`${projectDir}\``,
    `Workflow status: ${status.finding}`,
    "",
    "## 설치/연동",
    "",
    "- OS:",
    "- Node/npm:",
    "- OpenCode:",
    "- `npx ph doctor` result:",
    "",
    "## 생성 코드 구조",
    "",
    "- Gradle only:",
    "- package/layer structure:",
    "- Controller/Service/Repository boundary:",
    "- domain behavior:",
    "- DTO boundary:",
    "",
    "## 검증",
    "",
    "- `npx ph bearshell gradle test`: ",
    "- `npx ph bearshell gradle build`: ",
    "- `npx ph bearshell --shell 'gradle bootRun ...'`: ",
    "- HTTP happy/failure smoke:",
    "",
    "## 불만족 포인트",
    "",
    "- ",
    "",
    "## 실제 프로젝트에 쓸 수 있나?",
    "",
    "- yes/no:",
    "- reason:",
    "",
  ].join("\n")
}

export function runFeedbackCommand(args: readonly string[], options: FeedbackOptions = {}, invocationName = "ph"): CliRunResult {
  if (args[0] === "--help" || args[0] === "-h" || args[0] === "help") {
    return { status: 0, stdout: `${feedbackUsage(invocationName)}\n`, stderr: "" }
  }
  const projectDir = resolve(options.projectDir ?? process.cwd())
  const reportPath = join(projectDir, FEEDBACK_REPORT_PATH)
  mkdirSync(dirname(reportPath), { recursive: true })
  writeFileAtomic(reportPath, createFeedbackTemplate(projectDir))
  return { status: 0, stdout: `Feedback template written: ${reportPath}\n`, stderr: "" }
}
