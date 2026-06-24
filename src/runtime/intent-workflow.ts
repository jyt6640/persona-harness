import { loadHarnessConfig } from "../config/harness-config.js"
import { writeIntentEvidence } from "./evidence.js"
import { formatDebugWorkflowBlock } from "./debug-workflow-skill.js"
import { formatGitWorkflowBlock } from "./git-workflow-skill.js"
import { injectTextIntoLatestUserMessage } from "./messages.js"
import { formatProgrammingWorkflowBlock } from "./programming-workflow-skill.js"
import { RailComplianceTracker } from "./rail-compliance.js"
import { formatRefactorWorkflowBlock } from "./refactor-workflow-skill.js"
import {
  formatRequirementsWorkflowBlock,
  hasPersonaWorkflowOptIn,
  hasRequirementsDraft,
} from "./requirements-workflow-skill.js"
import { formatReviewWorkflowBlock } from "./review-workflow-skill.js"
import { detectTopLevelIntent, type TopLevelIntent } from "./top-level-intent-router.js"
import type { TransformMessagesOutput } from "./types.js"

function latestUserText(output: TransformMessagesOutput): string | undefined {
  const latestUserMessage = [...output.messages].reverse().find((message) => message.info.role === "user")
  const textPart = latestUserMessage?.parts.find((part) => part.type === "text" && typeof part.text === "string")
  return textPart?.type === "text" ? textPart.text : undefined
}

function injectIntentWorkflowRail(
  output: TransformMessagesOutput,
  projectDir: string,
  sessionID: string,
  userPrompt: string,
  intent: TopLevelIntent,
  block: string,
  railMarker: string,
  compliance: RailComplianceTracker,
): boolean {
  const injected = injectTextIntoLatestUserMessage(output, block, railMarker)
  if (injected) {
    compliance.startRail(sessionID, userPrompt, intent, railMarker)
    writeIntentEvidence(projectDir, {
      hook: "experimental.chat.messages.transform",
      sessionID,
      injectedInto: "intent-workflow",
      userPrompt,
      intent,
      railMarker,
    })
  }
  return injected
}

export function maybeInjectIntentWorkflow(
  output: TransformMessagesOutput,
  projectDir: string,
  sessionID: string,
  config: ReturnType<typeof loadHarnessConfig>,
  compliance: RailComplianceTracker,
): boolean {
  if (!config.enabled || !config.enabledDomains.includes("workflow") || !hasPersonaWorkflowOptIn(projectDir)) {
    return false
  }
  const text = latestUserText(output)
  if (text === undefined) {
    return false
  }
  const intent = detectTopLevelIntent(text)

  if (intent?.primary === "debug") {
    return injectIntentWorkflowRail(
      output,
      projectDir,
      sessionID,
      text,
      intent,
      formatDebugWorkflowBlock(intent),
      "[Persona Harness Debug Workflow]",
      compliance,
    )
  }

  if (intent?.primary === "review") {
    return injectIntentWorkflowRail(
      output,
      projectDir,
      sessionID,
      text,
      intent,
      formatReviewWorkflowBlock(intent),
      "[Persona Harness Review Workflow]",
      compliance,
    )
  }

  if (intent?.primary === "refactor") {
    return injectIntentWorkflowRail(
      output,
      projectDir,
      sessionID,
      text,
      intent,
      formatRefactorWorkflowBlock(intent),
      "[Persona Harness Refactor Workflow]",
      compliance,
    )
  }

  if (intent?.primary === "git") {
    return injectIntentWorkflowRail(
      output,
      projectDir,
      sessionID,
      text,
      intent,
      formatGitWorkflowBlock(intent),
      "[Persona Harness Git Workflow]",
      compliance,
    )
  }

  if (intent?.primary === "programming") {
    return injectIntentWorkflowRail(
      output,
      projectDir,
      sessionID,
      text,
      intent,
      formatProgrammingWorkflowBlock(intent),
      "[Persona Harness Programming Workflow]",
      compliance,
    )
  }

  if (intent === undefined || intent.primary !== "requirements" || intent.requirementsIntent === undefined) {
    return false
  }

  if (intent.requirementsIntent.kind === "requirement-approval" && !hasRequirementsDraft(projectDir)) {
    return false
  }
  return injectIntentWorkflowRail(
    output,
    projectDir,
    sessionID,
    text,
    intent,
    formatRequirementsWorkflowBlock(intent.requirementsIntent),
    "[Persona Harness Requirements Workflow]",
    compliance,
  )
}
