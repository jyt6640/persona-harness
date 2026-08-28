import type { Hooks, Plugin } from "@opencode-ai/plugin"
import { fileURLToPath } from "node:url"

import { isRecord } from "./config/jsonc.js"
import { createOpenCodeContextHooks } from "./context-delivery/opencode-context-hooks.js"
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
  const contextHooks = createOpenCodeContextHooks({ projectDir: input.directory })
  return {
    ...phase0Hooks,
    event: async (event) => {
      await phase0Hooks.event?.(event)
      await contextHooks.event?.(event)
    },
    "tool.execute.after": async (input, output) => {
      await phase0Hooks["tool.execute.after"]?.(input, output)
      await contextHooks["tool.execute.after"]?.(input, output)
    },
    "experimental.chat.messages.transform": async (input, output) => {
      await phase0Hooks["experimental.chat.messages.transform"]?.(input, output)
      await contextHooks["experimental.chat.messages.transform"]?.(input, output)
    },
    config: async (config) => {
      registerPersonaSharedSkills(config)
      await phase0Hooks.config?.(config)
    },
  }
}

export type { FileRole, PendingInjection, SelectedPolicyOverlay, SelectedSharedSkill } from "./runtime/types.js"
