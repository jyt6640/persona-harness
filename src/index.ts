import type { Hooks, Plugin } from "@opencode-ai/plugin"
import { fileURLToPath } from "node:url"

import { isRecord } from "./config/jsonc.js"
import { createPhase0Hooks } from "./runtime/hooks.js"

const PERSONA_SHARED_SKILLS_PATH = fileURLToPath(new URL("../packages/shared-skills/skills", import.meta.url))

function projectAutoUpdateEnabled(options: unknown): boolean {
  return isRecord(options) && options.autoUpdate === true
}

function registerPersonaSharedSkills(config: unknown): void {
  if (!isRecord(config)) {
    return
  }
  if (config.skills === undefined) {
    config.skills = { paths: [PERSONA_SHARED_SKILLS_PATH] }
    return
  }

  const skills = config.skills
  if (Array.isArray(skills)) {
    if (!skills.every((source) => typeof source === "string") || skills.includes(PERSONA_SHARED_SKILLS_PATH)) {
      return
    }
    config.skills = [...skills, PERSONA_SHARED_SKILLS_PATH]
    return
  }
  if (!isRecord(skills)) {
    return
  }
  const paths = skills.paths
  if (paths !== undefined && (!Array.isArray(paths) || !paths.every((path) => typeof path === "string"))) {
    return
  }
  if (paths?.includes(PERSONA_SHARED_SKILLS_PATH)) {
    return
  }
  config.skills = {
    ...skills,
    paths: [...(paths ?? []), PERSONA_SHARED_SKILLS_PATH],
  }
}

export const PersonaHarnessPlugin: Plugin = async (input, options): Promise<Hooks> => {
  const phase0Hooks = createPhase0Hooks({
    client: input.client,
    projectAutoUpdate: { enabled: projectAutoUpdateEnabled(options) },
    projectDir: input.directory,
  })
  return {
    ...phase0Hooks,
    config: async (config) => {
      registerPersonaSharedSkills(config)
      await phase0Hooks.config?.(config)
    },
  }
}

export type { FileRole, PendingInjection, SelectedPolicyOverlay, SelectedSharedSkill } from "./runtime/types.js"
