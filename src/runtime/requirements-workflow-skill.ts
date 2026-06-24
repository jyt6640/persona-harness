import { existsSync } from "node:fs"
import { join } from "node:path"

import type { RequirementsIntent } from "./requirements-intent-router.js"
import { loadWorkflowSkillBlock, workflowSkillPath } from "./workflow-skill-loader.js"

const DRAFT_REQUIREMENTS_BACKLOG_PATH = ".persona/workflow/requirements/backlog.md"

export type RequirementsWorkflowSkill = {
  readonly name: "workflow-requirements"
  readonly domain: "workflow"
  readonly path: string
  readonly reason: string
}

type RequirementsRuntimeBlockName = "draft" | "approval" | "file" | "prompt" | "continuation"

export function hasPersonaWorkflowOptIn(projectDir: string): boolean {
  return existsSync(join(projectDir, ".persona"))
}

export function hasRequirementsDraft(projectDir: string): boolean {
  return existsSync(join(projectDir, DRAFT_REQUIREMENTS_BACKLOG_PATH))
}

export function selectedRequirementsWorkflowSkill(intent: RequirementsIntent): RequirementsWorkflowSkill {
  return {
    name: "workflow-requirements",
    domain: "workflow",
    path: workflowSkillPath("requirements"),
    reason: intent.reason,
  }
}

function runtimeBlockName(intent: RequirementsIntent): RequirementsRuntimeBlockName {
  if (intent.kind === "requirement-drafting") {
    return "draft"
  }
  if (intent.kind === "requirement-approval") {
    return "approval"
  }
  if (intent.source === "file") {
    return "file"
  }
  return intent.source === "workflow" ? "continuation" : "prompt"
}

export function formatRequirementsWorkflowBlock(intent: RequirementsIntent): string {
  return loadWorkflowSkillBlock("requirements", runtimeBlockName(intent), {
    detectedIntent: intent.kind,
    selectedSkillPath: selectedRequirementsWorkflowSkill(intent).path,
    reason: intent.reason,
    sourceFile: intent.sourceFile ?? "README.md",
  })
}
