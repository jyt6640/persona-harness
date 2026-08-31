import {
  negotiatePortableSkill,
  type PortableHost,
  type PortableSkillCapsule,
  type PortableSkillHostResult,
} from "./portable-skill-contract.js"
import type { HostAssuranceRequirement } from "./host-capability-manifest.js"

export type PortableSkillAdapterInput = {
  readonly capsule: PortableSkillCapsule
  readonly manifest: unknown
  readonly binding: unknown
  readonly requiredAssurance?: HostAssuranceRequirement
}

export type PortableSkillHostAdapter = {
  readonly host: PortableHost
  readonly consume: (input: PortableSkillAdapterInput) => PortableSkillHostResult
}

function createAdapter(host: PortableHost): PortableSkillHostAdapter {
  return {
    host,
    consume: (input) => negotiatePortableSkill({
      host,
      capsule: input.capsule,
      manifest: input.manifest,
      binding: input.binding,
      requiredAssurance: input.requiredAssurance,
    }),
  }
}

export function createCodexSkillAdapter(): PortableSkillHostAdapter {
  return createAdapter("codex")
}

export function createOpenCodeSkillAdapter(): PortableSkillHostAdapter {
  return createAdapter("opencode")
}

export function createClaudeCodeSkillAdapter(): PortableSkillHostAdapter {
  return createAdapter("claude-code")
}

export function createAntigravitySkillAdapter(): PortableSkillHostAdapter {
  return createAdapter("antigravity")
}
