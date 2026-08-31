import {
  personaSharedSkillPath,
  resolvePersonaSharedSkill,
} from "./persona-shared-skill-catalog.js"
import { createOpenCodeSkillAdapter } from "./portable-skill-adapters.js"
import {
  createPortableSkillCapsule,
  type PortableSkillActivationInput,
} from "./portable-skill-contract.js"
import {
  HOST_CAPABILITY_IDS,
  HOST_CAPABILITY_MANIFEST_SCHEMA,
  type HostCapabilityManifest,
} from "./host-capability-manifest.js"

export type OpenCodeSkillRouteDecision = PortableSkillActivationInput["decision"]

export type OpenCodeSkillRouteInput = PortableSkillActivationInput

const OPENCODE_HOST_VERSION = "1.x"
const OPENCODE_ADAPTER_VERSION = "1.0.0"
const OPENCODE_CAPABILITY_MANIFEST: HostCapabilityManifest = {
  schemaVersion: HOST_CAPABILITY_MANIFEST_SCHEMA,
  host: "opencode",
  hostVersion: OPENCODE_HOST_VERSION,
  adapterVersion: OPENCODE_ADAPTER_VERSION,
  capabilities: HOST_CAPABILITY_IDS.map((id) => ({
    id,
    state: id === "pre-tool-gate" || id === "completion-gate"
      ? "unavailable"
      : id === "activation-notice" || id === "session-persistence"
        ? "emulated"
        : "supported",
  })),
}
const OPENCODE_CAPABILITY_BINDING = {
  host: "opencode",
  hostVersion: OPENCODE_HOST_VERSION,
  adapterVersion: OPENCODE_ADAPTER_VERSION,
} as const

function boundedReason(reason: string): string {
  return reason.replace(/[\r\n]+/gu, " ").trim().slice(0, 180) || "The current request matches this Persona procedure."
}

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
    manifest: OPENCODE_CAPABILITY_MANIFEST,
    binding: OPENCODE_CAPABILITY_BINDING,
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
    `Reason: ${boundedReason(input.reason)}`,
    `First safe action: ${input.firstAction}`,
    `Handoff: ${handoff}`,
    `User-visible skill notice: At the beginning of the next assistant response, write one short line in the user's language naming \`(PH) ${skill.title}\`, activation \`${input.decision}\`, and the bounded reason. Then continue with the requested help. Do not claim that the full skill body was loaded.`,
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
