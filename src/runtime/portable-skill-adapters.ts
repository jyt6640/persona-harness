import {
  negotiatePortableSkill,
  type PortableHost,
  type PortableSkillCapsule,
  type PortableSkillHostResult,
} from "./portable-skill-contract.js"

export type PortableSkillAdapterInput = {
  readonly capsule: PortableSkillCapsule
  readonly capabilities?: unknown
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
      capabilities: input.capabilities,
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
