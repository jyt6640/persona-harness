import { readFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import type { TopLevelIntent } from "./top-level-intent-router.js"

export type WorkflowSkillName = "requirements" | "debug" | "review" | "refactor" | "git" | "programming"

export type WorkflowSkillTemplateVariables = Readonly<Record<string, string>>

const WORKFLOW_SKILL_PATHS = {
  requirements: "packages/shared-skills/skills/workflow/requirements/SKILL.md",
  debug: "packages/shared-skills/skills/workflow/debug/SKILL.md",
  review: "packages/shared-skills/skills/workflow/review/SKILL.md",
  refactor: "packages/shared-skills/skills/workflow/refactor/SKILL.md",
  git: "packages/shared-skills/skills/workflow/git/SKILL.md",
  programming: "packages/shared-skills/skills/workflow/programming/SKILL.md",
} as const satisfies Record<WorkflowSkillName, string>

function packageRoot(): string {
  return resolve(dirname(fileURLToPath(import.meta.url)), "..", "..")
}

export function workflowSkillPath(skill: WorkflowSkillName): string {
  return WORKFLOW_SKILL_PATHS[skill]
}

export function topLevelIntentTemplateVariables(intent: TopLevelIntent): WorkflowSkillTemplateVariables {
  return {
    detectedIntent: intent.primary,
    secondaryIntents: intent.secondary.length > 0 ? intent.secondary.join(", ") : "none",
    reason: intent.reason,
  }
}

function workflowSkillAbsolutePath(skill: WorkflowSkillName): string {
  return join(packageRoot(), workflowSkillPath(skill))
}

function runtimeBlock(content: string, skill: WorkflowSkillName, blockName: string): string {
  const startMarker = `<!-- PH_RUNTIME_BLOCK:${blockName} -->`
  const endMarker = "<!-- /PH_RUNTIME_BLOCK -->"
  const startIndex = content.indexOf(startMarker)
  if (startIndex < 0) {
    throw new Error(`Missing ${startMarker} in ${workflowSkillPath(skill)}`)
  }

  const contentStart = startIndex + startMarker.length
  const endIndex = content.indexOf(endMarker, contentStart)
  if (endIndex < 0) {
    throw new Error(`Missing ${endMarker} after ${startMarker} in ${workflowSkillPath(skill)}`)
  }

  return content.slice(contentStart, endIndex).trim()
}

function renderTemplate(template: string, variables: WorkflowSkillTemplateVariables): string {
  return Object.entries(variables).reduce(
    (rendered, [key, value]) => rendered.replaceAll(`{{${key}}}`, value),
    template,
  )
}

export function loadWorkflowSkillBlock(
  skill: WorkflowSkillName,
  blockName: string,
  variables: WorkflowSkillTemplateVariables,
): string {
  const content = readFileSync(workflowSkillAbsolutePath(skill), "utf8")
  return renderTemplate(runtimeBlock(content, skill, blockName), variables)
}
