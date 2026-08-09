import { loadHarnessConfig } from "../config/harness-config.js"
import { writeIntentEvidence } from "./evidence.js"
import { formatDebugWorkflowBlock } from "./debug-workflow-skill.js"
import { formatGitWorkflowBlock } from "./git-workflow-skill.js"
import { injectTextIntoLatestUserMessage } from "./messages.js"
import { ProductDeepInterviewTracker } from "./product-deep-interview.js"
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

type IntentWorkflowOptions = {
  readonly evidenceDir?: string
}

const IMPLEMENTATION_PROFILE_GUARD_LINES = [
  "- Before implementation, if `.persona/project-profile.jsonc` exists, read it and do not create a stack that conflicts with its language/framework/build tool/profile constraints.",
  "- If the profile exists but has not been read yet, do not implement; read the profile plus README/requirements/current task card first.",
] as const

const FINISH_SEQUENCE_GUARD =
  "- Before reporting completion, follow the project’s explicit report/review/finish policy; this host route does not create or advance that state."

function latestUserText(output: TransformMessagesOutput): string | undefined {
  const latestUserMessage = [...output.messages].reverse().find((message) => message.info.role === "user")
  const textPart = latestUserMessage?.parts.find((part) => part.type === "text" && typeof part.text === "string")
  return textPart?.type === "text" ? textPart.text : undefined
}

export function maybeInjectProductDeepInterview(
  output: TransformMessagesOutput,
  sessionID: string,
  tracker: ProductDeepInterviewTracker,
): boolean {
  const text = latestUserText(output)
  if (text === undefined) {
    return false
  }
  const result = tracker.route(sessionID, text)
  if (result === undefined) {
    return false
  }
  return injectTextIntoLatestUserMessage(output, result.block, "[Persona Harness Product Interview]")
}

function runtimeReliabilityGuardLines(intent: TopLevelIntent): readonly string[] {
  if (intent.primary === "programming") {
    return [
      ...IMPLEMENTATION_PROFILE_GUARD_LINES,
      FINISH_SEQUENCE_GUARD,
    ]
  }

  if (intent.primary !== "requirements" || intent.requirementsIntent === undefined) {
    return []
  }

  const baseLines = [
    ...IMPLEMENTATION_PROFILE_GUARD_LINES,
    FINISH_SEQUENCE_GUARD,
  ]

  if (intent.requirementsIntent.kind === "requirement-drafting") {
    return [
      "- Do not implement prompt-only requirements; route them through draft/review-before-implementation and do not run implement before user approval.",
    ]
  }

  if (intent.requirementsIntent.kind === "requirement-approval") {
    return [
      ...baseLines,
      "- An approved brief is an explicit handoff to technical intake and planning; do not create backlog, ticket, or implementation state from this route.",
    ]
  }

  if (intent.requirementsIntent.kind === "requirement-continuation") {
    return [
      ...baseLines,
      "- Ask for the explicit current delivery boundary and do not claim the whole backlog is complete.",
    ]
  }

  if (intent.requirementsIntent.source === "prompt") {
    return [
      ...baseLines,
      "- If prompt-only requirements are not already an approved brief, do not implement directly; keep discovery and approval conversational until the user selects the next procedure.",
    ]
  }

  return [
    ...baseLines,
    "- For README/requirements-based work, read the source through the end and route explicitly to technical intake or planning before implementation.",
  ]
}

function appendRuntimeReliabilityGuard(block: string, intent: TopLevelIntent): string {
  const lines = runtimeReliabilityGuardLines(intent)
  if (lines.length === 0) {
    return block
  }

  return [
    block,
    "",
    "Runtime reliability guard:",
    ...lines,
  ].join("\n")
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
  options: IntentWorkflowOptions,
): boolean {
  const injected = injectTextIntoLatestUserMessage(output, appendRuntimeReliabilityGuard(block, intent), railMarker)
  if (injected) {
    compliance.startRail(sessionID, userPrompt, intent, railMarker)
    writeIntentEvidence(projectDir, {
      hook: "experimental.chat.messages.transform",
      sessionID,
      injectedInto: "intent-workflow",
      userPrompt,
      intent,
      railMarker,
    }, {
      evidenceDir: options.evidenceDir,
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
  options: IntentWorkflowOptions = {},
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
      options,
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
      options,
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
      options,
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
      options,
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
      options,
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
    options,
  )
}
