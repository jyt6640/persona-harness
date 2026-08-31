import type { Hooks, Plugin } from "@opencode-ai/plugin"

import { isRecord } from "./config/jsonc.js"
import { createOpenCodeContextHooks } from "./context-delivery/opencode-context-hooks.js"
import { createPhase0Hooks } from "./runtime/hooks.js"

function projectAutoUpdateEnabled(options: unknown): boolean {
  return isRecord(options) && options.autoUpdate === true
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
      await phase0Hooks.config?.(config)
    },
  }
}

export type { FileRole, PendingInjection, SelectedPolicyOverlay, SelectedSharedSkill } from "./runtime/types.js"
