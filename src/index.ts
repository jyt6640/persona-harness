import type { Hooks, Plugin } from "@opencode-ai/plugin"

import { createPhase0Hooks } from "./runtime/hooks.js"

export const PersonaHarnessPlugin: Plugin = async (input): Promise<Hooks> =>
  createPhase0Hooks({ client: input.client, projectDir: input.directory })

export type { FileRole, PendingInjection, SelectedPolicyOverlay, SelectedSharedSkill } from "./runtime/types.js"
export {
  createProductSafetyInvariants,
  createStarterProfileDefaults,
  resolveEffectiveProfile,
} from "./runtime/effective-profile.js"
export type {
  EffectiveProfileBlockReason,
  EffectiveProfileCapsule,
  EffectiveProfileLayer,
  EffectiveProfileRelevance,
  EffectiveProfileResolution,
  EffectiveProfileResolutionInput,
  EffectiveProfileRuleInput,
  EffectiveProfileSelection,
} from "./runtime/effective-profile.js"
