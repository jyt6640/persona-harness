import type { TopLevelIntent } from "./top-level-intent-router.js"
import { loadWorkflowSkillBlock, topLevelIntentTemplateVariables } from "./workflow-skill-loader.js"

export function formatDebugWorkflowBlock(intent: TopLevelIntent): string {
  return loadWorkflowSkillBlock("debug", "default", topLevelIntentTemplateVariables(intent))
}
