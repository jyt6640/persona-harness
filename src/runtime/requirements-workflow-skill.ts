import { existsSync } from "node:fs"
import { join } from "node:path"

import type { RequirementsIntent } from "./requirements-intent-router.js"

export type RequirementsWorkflowSkill = {
  readonly name: "workflow-requirements"
  readonly domain: "workflow"
  readonly path: "packages/shared-skills/skills/workflow/requirements/SKILL.md"
  readonly reason: string
}

export function hasPersonaWorkflowOptIn(projectDir: string): boolean {
  return existsSync(join(projectDir, ".persona"))
}

export function selectedRequirementsWorkflowSkill(intent: RequirementsIntent): RequirementsWorkflowSkill {
  return {
    name: "workflow-requirements",
    domain: "workflow",
    path: "packages/shared-skills/skills/workflow/requirements/SKILL.md",
    reason: intent.reason,
  }
}

function fileFlow(intent: RequirementsIntent): readonly string[] {
  const sourceFile = intent.sourceFile ?? "README.md"
  return [
    `- 요구사항 파일: \`${sourceFile}\``,
    `- 먼저 \`npx ph bearshell --shell 'sed -n \"1,220p\" ${sourceFile}'\`처럼 범위를 나눠 파일을 끝까지 읽는다.`,
    `- 그 다음 \`npx ph workflow split ${sourceFile}\`를 실행해 requirements-analysis/backlog/task card를 만든다.`,
    "- `npx ph workflow next`를 실행하고 현재 task card만 구현한다.",
  ]
}

function promptFlow(): readonly string[] {
  return [
    "- 프롬프트 본문을 요구사항 source로 취급한다.",
    "- 구현 전에 `npx ph workflow capture --stdin`로 요구사항을 저장한다.",
    "- 그 다음 `npx ph workflow split`를 실행해 requirements-analysis/backlog/task card를 만든다.",
    "- `npx ph workflow next`를 실행하고 현재 task card만 구현한다.",
  ]
}

function continuationFlow(): readonly string[] {
  return [
    "- 이어서 할 ticket을 찾기 위해 `npx ph workflow next`를 실행한다.",
    "- accepted plan continuation이 필요하면 `npx ph workflow continue`를 실행한다.",
    "- 현재 task card만 구현하고, 남은 ticket이 있으면 전체 완료라고 말하지 않는다.",
  ]
}

export function formatRequirementsWorkflowBlock(intent: RequirementsIntent): string {
  const flow =
    intent.source === "file" ? fileFlow(intent) : intent.source === "workflow" ? continuationFlow() : promptFlow()
  return [
    "[Persona Harness Requirements Workflow]",
    "",
    `Detected intent: ${intent.kind}`,
    `Selected skill: workflow-requirements (${selectedRequirementsWorkflowSkill(intent).path})`,
    `Reason: ${intent.reason}`,
    "",
    "Required flow:",
    ...flow,
    "",
    "Finish gate:",
    "- `.persona/workflow/implementation-report.md`를 채운다.",
    "- `.persona/workflow/review-report.md`를 채운다.",
    "- 완료한 ticket은 `npx ph workflow archive <ticket>`로 history에 남긴다.",
    "- 최종 완료 전 `npx ph workflow finish implement`를 실행한다.",
    "- pending ticket이 남아 있으면 전체 완료라고 말하지 말고 다음 ticket을 보고한다.",
    "",
    "Non-goals:",
    "- generated app product quality 보증이 아니다.",
    "- AST/linter/enforcement gate가 아니다.",
    "- `.persona`가 없는 프로젝트에는 이 workflow를 강제하지 않는다.",
  ].join("\n")
}
