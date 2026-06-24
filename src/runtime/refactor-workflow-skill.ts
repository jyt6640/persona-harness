import type { TopLevelIntent } from "./top-level-intent-router.js"
import { loadWorkflowSkillBlock, topLevelIntentTemplateVariables } from "./workflow-skill-loader.js"

export function formatRefactorWorkflowBlock(intent: TopLevelIntent): string {
  return loadWorkflowSkillBlock("refactor", "default", topLevelIntentTemplateVariables(intent))
}
