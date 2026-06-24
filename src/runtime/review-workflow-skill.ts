import type { TopLevelIntent } from "./top-level-intent-router.js"
import { loadWorkflowSkillBlock, topLevelIntentTemplateVariables } from "./workflow-skill-loader.js"

export function formatReviewWorkflowBlock(intent: TopLevelIntent): string {
  return loadWorkflowSkillBlock("review", "default", topLevelIntentTemplateVariables(intent))
}
