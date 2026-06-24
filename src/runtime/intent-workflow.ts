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

const IMPLEMENTATION_PROFILE_GUARD_LINES = [
  "- 구현 전에 `.persona/project-profile.jsonc`가 있으면 반드시 읽고, language/framework/build tool/profile constraints와 다른 stack을 만들지 않는다.",
  "- profile이 존재하지만 아직 읽지 않았다면 구현하지 말고 먼저 profile과 README/requirements/current task card를 읽는다.",
] as const

const FINISH_SEQUENCE_GUARD =
  "- 완료 보고 전 `.persona/workflow/implementation-report.md`, `.persona/workflow/review-report.md`, `npx ph plan --report-filled review`, `npx ph workflow finish implement` 순서를 지킨다."

function latestUserText(output: TransformMessagesOutput): string | undefined {
  const latestUserMessage = [...output.messages].reverse().find((message) => message.info.role === "user")
  const textPart = latestUserMessage?.parts.find((part) => part.type === "text" && typeof part.text === "string")
  return textPart?.type === "text" ? textPart.text : undefined
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
      "- prompt-only requirements는 구현하지 않고 draft/review-before-implementation으로 유도한다. 사용자가 승인하기 전에는 implement를 실행하지 않는다.",
    ]
  }

  if (intent.requirementsIntent.kind === "requirement-approval") {
    return [
      ...baseLines,
      "- 승인된 draft만 backlog로 전환하고 `npx ph workflow next`로 첫 pending ticket을 확인한 뒤 현재 ticket만 구현한다.",
    ]
  }

  if (intent.requirementsIntent.kind === "requirement-continuation") {
    return [
      ...baseLines,
      "- pending tickets remain → `npx ph workflow next` / `npx ph workflow continue`로 다음 ticket을 이어가고 전체 완료라고 주장하지 않는다.",
    ]
  }

  if (intent.requirementsIntent.source === "prompt") {
    return [
      ...baseLines,
      "- prompt-only requirements는 사용자가 이미 승인한 draft가 아니라면 바로 구현하지 않고 `npx ph workflow capture --stdin` 또는 `npx ph workflow draft --stdin`로 요구사항 source/backlog를 먼저 만든다.",
    ]
  }

  return [
    ...baseLines,
    "- README/requirements 기반 구현은 파일을 끝까지 읽고 `npx ph workflow next` 또는 `npx ph workflow continue`로 pending ticket을 확인한 뒤 현재 ticket만 구현한다.",
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
