export const OBSERVER_GH_TOOL_SCHEMA_VERSION: "consumer-authority-observer-gh-tool.1"

export class ObserverGhToolError extends Error {
  readonly code: "observer-gh-tool-contract"
}

export interface ObserverGhToolContract {
  readonly executable: "explicit-absolute-regular-non-symlink"
  readonly invocation: "direct-exec-no-shell-no-path-lookup"
  readonly output: "bounded-version-classification-only"
  readonly schemaVersion: "consumer-authority-observer-gh-tool.1"
  readonly version: ">=2.96.0 <3.0.0"
}

export interface ObserverGhToolAssessment {
  readonly code: "gh-command-tool-ready" | "gh-command-tool-required" | "gh-command-tool-invalid" | "gh-command-unavailable" | "gh-command-version-unsupported"
  readonly state: "ready" | "blocked"
}

export function canonicalObserverGhToolContract(): ObserverGhToolContract
export function parseObserverGhToolContract(value: unknown): ObserverGhToolContract
export function assessObserverGhTool(
  ghPath: unknown,
  options?: {
    readonly contract?: ObserverGhToolContract
    readonly execute?: (command: string, argumentsList: readonly string[], options: {
      readonly encoding: "utf8"
      readonly env: Readonly<Record<string, string>>
      readonly maxBuffer: number
      readonly shell: false
      readonly stdio: readonly ["ignore", "pipe", "pipe"]
      readonly timeout: number
    }) => { readonly error?: unknown; readonly status?: number | null; readonly stderr?: string; readonly stdout?: string }
  },
): ObserverGhToolAssessment
