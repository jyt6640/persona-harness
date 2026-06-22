import { mkdirSync, writeFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import process from "node:process"

import type { CliRunResult } from "./bearshell.js"
import { readWorkflowStatus } from "./workflow-status.js"

type FeedbackOptions = {
  readonly projectDir?: string
}

const FEEDBACK_REPORT_PATH = ".persona/workflow/feedback-report.md"

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

export function runFeedbackCommand(_args: readonly string[], options: FeedbackOptions = {}): CliRunResult {
  const projectDir = resolve(options.projectDir ?? process.cwd())
  const reportPath = join(projectDir, FEEDBACK_REPORT_PATH)
  mkdirSync(dirname(reportPath), { recursive: true })
  writeFileSync(reportPath, createFeedbackTemplate(projectDir))
  return { status: 0, stdout: `Feedback template written: ${reportPath}\n`, stderr: "" }
}
