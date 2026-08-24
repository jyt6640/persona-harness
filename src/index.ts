import type { Hooks, Plugin } from "@opencode-ai/plugin"

import { isRecord } from "./config/jsonc.js"
import { createPhase0Hooks } from "./runtime/hooks.js"

function projectAutoUpdateEnabled(options: unknown): boolean {
  return isRecord(options) && options.autoUpdate === true
}

export const PersonaHarnessPlugin: Plugin = async (input, options): Promise<Hooks> =>
  createPhase0Hooks({
    client: input.client,
    projectAutoUpdate: { enabled: projectAutoUpdateEnabled(options) },
    projectDir: input.directory,
  })

export type { FileRole, PendingInjection, SelectedPolicyOverlay, SelectedSharedSkill } from "./runtime/types.js"
