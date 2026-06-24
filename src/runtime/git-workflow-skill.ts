import type { TopLevelIntent } from "./top-level-intent-router.js"
import { loadWorkflowSkillBlock, topLevelIntentTemplateVariables } from "./workflow-skill-loader.js"

export function formatGitWorkflowBlock(intent: TopLevelIntent): string {
  return loadWorkflowSkillBlock("git", "default", topLevelIntentTemplateVariables(intent))
}
