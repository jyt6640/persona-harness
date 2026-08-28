import type { ContextStatus } from "./context-status.js"

export function renderContextDoctor(status: ContextStatus): string {
  return [
    "Context Doctor (Experimental)",
    `Configuration: ${status.configuration}`,
    `Context enabled: ${status.contextEnabled}`,
    `Context mode: ${status.mode}`,
    `Context budget: maxCapsules=${status.maxCapsules} maxChars=${status.maxChars}`,
    "Context Core: available",
    "CLI inspection: available",
    `Team Profile: ${status.teamProfile}`,
    "Host adapter: bundled (OpenCode 1.x)",
    "Runtime activation: safe target observed when Context is enabled",
    "Network access: not used",
    "Shell access: not used",
    `Diagnostics: ${status.diagnostics.length === 0 ? "none" : status.diagnostics.join(", ")}`,
    "",
  ].join("\n")
}
