import {
  personaSharedSkillPath,
  resolvePersonaSharedSkill,
  type PersonaSharedSkillId,
} from "./persona-shared-skill-catalog.js"

export type OpenCodeSkillRouteDecision = "none" | "suggest" | "explicit"

export type OpenCodeSkillRouteInput = {
  readonly decision: Exclude<OpenCodeSkillRouteDecision, "none">
  readonly skillId: PersonaSharedSkillId
  readonly reason: string
}

function boundedReason(reason: string): string {
  return reason.replace(/[\r\n]+/gu, " ").trim().slice(0, 180) || "The current request matches this Persona procedure."
}

export function createOpenCodeSkillRoute(input: OpenCodeSkillRouteInput): string {
  const skill = resolvePersonaSharedSkill(input.skillId)
  const handoff = skill.handoff === null ? "none" : skill.handoff

  return [
    "[Persona Harness Skill Route]",
    `Decision: ${input.decision}`,
    `Skill: ${skill.id}`,
    `Reference: ${personaSharedSkillPath(skill.id)}`,
    `Reason: ${boundedReason(input.reason)}`,
    `Handoff: ${handoff}`,
    "OpenCode advises and routes only. It does not create plans, tickets, branches, files, agents, or workflow state, load a full skill body, or advance a workflow automatically.",
    "Use the referenced skill only when the user explicitly chooses that next step.",
  ].join("\n")
}
