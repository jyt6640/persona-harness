import { createOpenCodeSkillRoute, createOpenCodeUnavailableSkillRoute } from "./opencode-skill-adapter.js"
import { personaSharedSkillPath, type PersonaSharedSkillId } from "./persona-shared-skill-catalog.js"
import { activateAutomaticPersonaSkill, type PersonaSharedSkillActivation } from "./persona-shared-skill-activation.js"
import type { TopLevelIntent } from "./top-level-intent-router.js"

export type WorkflowSkillName = "requirements" | "debug" | "review" | "refactor" | "git" | "programming"

export type WorkflowSkillTemplateVariables = {
  readonly activation?: PersonaSharedSkillActivation
  readonly detectedIntent?: string
  readonly reason?: string
  readonly secondaryIntents?: string
  readonly selectedSkillPath?: string
  readonly sourceFile?: string
}

const WORKFLOW_SKILL_IDS = {
  requirements: "plan",
  debug: "debug",
  review: "review",
  refactor: "refactor",
  git: "git",
  programming: "programming",
} as const satisfies Record<WorkflowSkillName, PersonaSharedSkillId>

function intentClassification(skill: WorkflowSkillName, blockName: string): string {
  if (skill === "requirements") {
    if (blockName === "approval") {
      return "approved requirements request"
    }
    if (blockName === "continuation") {
      return "explicit continuation request"
    }
    return "requirements or delivery-planning request"
  }
  if (skill === "programming") {
    return "direct programming request"
  }
  if (skill === "git") {
    return "git work request"
  }
  return `${skill} request`
}

function legacyRouteMarker(skill: WorkflowSkillName): string {
  if (skill === "requirements") {
    return "[Persona Harness Requirements Workflow]"
  }
  return `[Persona Harness ${skill[0]?.toUpperCase()}${skill.slice(1)} Workflow]`
}

function advisoryFocus(skill: WorkflowSkillName): readonly string[] {
  if (skill === "debug") {
    return ["Advisory focus: Reproduce the failure first. Form at least three hypotheses with evidence. Fix only the confirmed cause. Rerun relevant tests/build/smoke."]
  }
  if (skill === "review") {
    return ["Advisory focus: Do not modify code. Write findings first with file/line/evidence/impact. Make fixes only when the user explicitly requests them."]
  }
  if (skill === "refactor") {
    return ["Advisory focus: lock current public behavior first. Do not add features. Make a small structural change and rerun the same test/build/smoke command. This is not the implementation/debug rail."]
  }
  if (skill === "git") {
    return ["Advisory focus: run git status. Inspect the diff. Stage only relevant files, make an atomic commit, and Push only when the user explicitly requested a push. This is not implementation/debug/refactor work."]
  }
  if (skill === "programming") {
    return ["Advisory focus: Read the relevant files first. Follow the existing project structure and naming. Do not add features, refactor, or change policy outside the requested scope. Do not describe unverified items as complete. This does not replace requirements/debug/review/refactor/git rails."]
  }
  return ["Advisory focus: clarify the product or delivery brief before selecting an explicit next procedure."]
}

export function workflowSkillPath(skill: WorkflowSkillName): string {
  return personaSharedSkillPath(WORKFLOW_SKILL_IDS[skill])
}

export function topLevelIntentTemplateVariables(intent: TopLevelIntent): WorkflowSkillTemplateVariables {
  return {
    activation: intent.activation,
    detectedIntent: intent.primary,
    secondaryIntents: intent.secondary.length > 0 ? intent.secondary.join(", ") : "none",
    reason: intent.reason,
  }
}

export function loadWorkflowSkillBlock(
  skill: WorkflowSkillName,
  blockName: string,
  variables: WorkflowSkillTemplateVariables,
): string {
  const skillId = WORKFLOW_SKILL_IDS[skill]
  const activation = variables.activation ?? activateAutomaticPersonaSkill(
    skill,
    variables.reason ?? "The current message matches a bounded Persona procedure.",
  )
  const decision = skill === "requirements" && blockName === "approval"
    ? "explicit"
    : activation.decision === "explicit"
      ? "explicit"
      : "activate"
  const sourceLine = variables.sourceFile === undefined ? [] : [`Source context: ${variables.sourceFile}`]

  return [
    legacyRouteMarker(skill),
    `Detected intent: ${variables.detectedIntent ?? skill}`,
    `Secondary intents: ${variables.secondaryIntents ?? "none"}`,
    `Intent classification: ${intentClassification(skill, blockName)}.`,
    ...sourceLine,
    ...advisoryFocus(skill),
    createOpenCodeSkillRoute({
      decision,
      firstAction: activation.firstAction,
      skillId,
      reason: variables.reason ?? "The current message matches a bounded Persona procedure.",
    }),
    "The next handoff is explicit; no command, workflow, ticket, report, or agent action is performed by this route.",
  ].join("\n")
}

export function formatExplicitPersonaSkillActivationBlock(intent: TopLevelIntent): string {
  const activation = intent.activation
  if (activation === undefined || activation.decision !== "explicit") {
    throw new Error("Explicit Persona skill activation requires an explicit activation contract")
  }

  return [
    "[Persona Harness Skill Activation]",
    `Detected intent: ${intent.primary}`,
    createOpenCodeSkillRoute({
      decision: "explicit",
      firstAction: activation.firstAction,
      skillId: activation.skillId,
      reason: activation.reason,
    }),
    "The explicit command selects only this bounded catalog reference; it does not create or advance workflow state.",
  ].join("\n")
}

export function formatUnavailablePersonaSkillActivationBlock(intent: TopLevelIntent): string {
  if (intent.primary !== "unavailable" || intent.reasonCode === undefined) {
    throw new Error("Unavailable Persona skill activation requires an unavailable route contract")
  }

  return createOpenCodeUnavailableSkillRoute(intent.reasonCode)
}
