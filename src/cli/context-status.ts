import {
  isContextPersonalizationEnabled,
  loadHarnessConfigResult,
  type ContextConfigDiagnostic,
} from "../config/harness-config.js"
import { loadTeamProfile, type TeamProfileDiagnostic, type TeamProfileLoadResult } from "../context-profile/team-profile-store.js"

export type ContextStatusConfiguration = "context-config-invalid" | "harness-config-unavailable" | "ready"
export type ContextStatusDiagnostic = ContextConfigDiagnostic["code"] | "harness-config-unavailable" | TeamProfileDiagnostic

export type ContextStatus = {
  readonly configuration: ContextStatusConfiguration
  readonly contextEnabled: boolean
  readonly diagnostics: readonly ContextStatusDiagnostic[]
  readonly maxCapsules: number
  readonly maxChars: number
  readonly mode: "targeted"
  readonly teamProfile: TeamProfileLoadResult["status"]
}

export function readContextStatus(projectDir: string): ContextStatus {
  const configResult = loadHarnessConfigResult(projectDir)
  const teamProfile = loadTeamProfile(projectDir)
  const configuration = configurationStatus(configResult)
  const diagnostics: readonly ContextStatusDiagnostic[] = [
    ...configurationDiagnostics(configuration),
    ...teamProfile.diagnostics,
  ]

  return {
    configuration,
    contextEnabled: isContextPersonalizationEnabled(configResult),
    diagnostics,
    maxCapsules: configResult.config.context.maxCapsules,
    maxChars: configResult.config.context.maxChars,
    mode: configResult.config.context.mode,
    teamProfile: teamProfile.status,
  }
}

export function renderContextStatus(status: ContextStatus): string {
  return [
    "Context Personalization (Experimental)",
    `Configuration: ${status.configuration}`,
    `Context enabled: ${status.contextEnabled}`,
    `Context mode: ${status.mode}`,
    `Context budget: maxCapsules=${status.maxCapsules} maxChars=${status.maxChars}`,
    "Context Core: available",
    `Team Profile: ${status.teamProfile}`,
    "Host adapter: bundled (OpenCode 1.x)",
    "Runtime activation: safe target observed when Context is enabled",
    "Network access: not used",
    "Shell access: not used",
    `Diagnostics: ${status.diagnostics.length === 0 ? "none" : status.diagnostics.join(", ")}`,
    "",
  ].join("\n")
}

function configurationStatus(
  configResult: ReturnType<typeof loadHarnessConfigResult>,
): ContextStatusConfiguration {
  if (!configResult.safe) return "harness-config-unavailable"
  return configResult.contextDiagnostics.length === 0 ? "ready" : "context-config-invalid"
}

function configurationDiagnostics(
  configuration: ContextStatusConfiguration,
): readonly ContextStatusDiagnostic[] {
  return configuration === "ready" ? [] : [configuration]
}
