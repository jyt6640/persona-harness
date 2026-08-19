import {
  personaSharedSkillPath,
  resolvePersonaSharedSkill,
} from "./persona-shared-skill-catalog.js"
import { createOpenCodeSkillAdapter } from "./portable-skill-adapters.js"
import {
  createPortableSkillCapsule,
  defaultPortableHostCapabilities,
  type PortableSkillActivationInput,
} from "./portable-skill-contract.js"

export type OpenCodeSkillRouteDecision = PortableSkillActivationInput["decision"]

export type OpenCodeSkillRouteInput = PortableSkillActivationInput

function renderHandoff(skill: ReturnType<typeof resolvePersonaSharedSkill>): string {
  if (skill.id === "plan") {
    return "optional ralplan, then tdd"
  }
  return skill.handoff === null ? "none" : skill.handoff
}

export function createOpenCodeSkillRoute(input: OpenCodeSkillRouteInput): string {
  const capsule = createPortableSkillCapsule(input)
  const result = createOpenCodeSkillAdapter().consume({
    capsule,
    capabilities: defaultPortableHostCapabilities(),
  })
  if (result.status === "unsupported") {
    return createOpenCodeUnavailableSkillRoute("unavailable-explicit-skill")
  }
  const skill = resolvePersonaSharedSkill(input.skillId)
  const handoff = renderHandoff(skill)

  return [
    "[Persona Harness Skill Route]",
    `Decision: ${input.decision}`,
    `Skill: ${skill.id}`,
    `Reference: ${personaSharedSkillPath(skill.id)}`,
    `Reason code: ${capsule.reasonCode}`,
    `First safe action: ${input.firstAction}`,
    `Handoff: ${handoff}`,
    "OpenCode activates this catalog reference for the current turn only. OpenCode advises and routes only: it does not load a full skill body. It does not create plans, tickets, branches, files, agents, or workflow state, or advance a workflow automatically.",
  ].join("\n")
}

export function createOpenCodeUnavailableSkillRoute(reasonCode: "malformed-explicit-skill-command" | "unavailable-explicit-skill"): string {
  return [
    "[Persona Harness Skill Route]",
    "Decision: unavailable",
    `Reason code: ${reasonCode}`,
    "OpenCode does not load a skill body, create state, or fall back to a different procedure.",
  ].join("\n")
}
