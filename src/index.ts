import type { Hooks, Plugin, PluginModule } from "@opencode-ai/plugin"

import { createPhase0Hooks } from "./phase0/hooks.js"

const serverPlugin: Plugin = async (input): Promise<Hooks> => createPhase0Hooks({ projectDir: input.directory })

const pluginModule: PluginModule = {
  id: "persona-harness",
  server: serverPlugin,
}

export default pluginModule

export { createPhase0Hooks } from "./phase0/hooks.js"
export type { FileRole, PendingInjection } from "./phase0/types.js"
