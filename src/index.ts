import type { Hooks, Plugin } from "@opencode-ai/plugin"

import { createPhase0Hooks } from "./runtime/hooks.js"

export const PersonaHarnessPlugin: Plugin = async (input): Promise<Hooks> =>
  createPhase0Hooks({ client: input.client, projectDir: input.directory })

export type { FileRole, PendingInjection, SelectedPolicyOverlay, SelectedSharedSkill } from "./runtime/types.js"
