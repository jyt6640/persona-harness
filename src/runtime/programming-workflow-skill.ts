import type { TopLevelIntent } from "./top-level-intent-router.js"
import { loadWorkflowSkillBlock, topLevelIntentTemplateVariables } from "./workflow-skill-loader.js"

export function formatProgrammingWorkflowBlock(intent: TopLevelIntent): string {
  return loadWorkflowSkillBlock("programming", "default", topLevelIntentTemplateVariables(intent))
}
