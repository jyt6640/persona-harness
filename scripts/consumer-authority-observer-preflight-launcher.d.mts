import type { ObserverPreflightResult } from "./consumer-authority-observer-preflight-core.mjs"

export type ObserverPreflightCommandResult = {
  readonly error?: unknown
  readonly status?: number | null
  readonly stdout?: string
}

export type ObserverPreflightCommandOptions = {
  readonly env: Readonly<Record<string, string>>
  readonly maxBuffer: number
  readonly timeout: number
}

export type ObserverPreflightOptions = {
  readonly createHome?: () => string
  readonly environment?: Readonly<Record<string, string | undefined>>
  readonly execute?: (
    command: string,
    args: readonly string[],
    options: ObserverPreflightCommandOptions,
  ) => ObserverPreflightCommandResult
  readonly removeHome?: (home: string) => void
}

export function runObserverCredentialPreflight(
  options?: ObserverPreflightOptions,
): ObserverPreflightResult
