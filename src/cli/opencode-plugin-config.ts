import { isRecord } from "../config/jsonc.js"

export const OPENCODE_CONFIG_PATH = ".opencode/opencode.json"
export const PERSONA_HARNESS_PACKAGE_NAME = "persona-harness"

const VERSIONED_NPM_PACKAGE_PATTERN = /^(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/u

export type OpenCodePluginEntry =
  | { readonly kind: "plain"; readonly specifier: string }
  | { readonly kind: "configured"; readonly options: Readonly<Record<string, unknown>>; readonly specifier: string }

export type OpenCodePluginConfigValue =
  | string
  | readonly [string, Readonly<Record<string, unknown>>]

export type PersonaAutoUpdateState = "disabled" | "enabled" | "invalid"

function validSpecifier(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0
}

function readPluginEntry(value: unknown): OpenCodePluginEntry | undefined {
  if (validSpecifier(value)) {
    return { kind: "plain", specifier: value }
  }
  if (
    !Array.isArray(value)
    || value.length !== 2
    || !validSpecifier(value[0])
    || !isRecord(value[1])
  ) {
    return undefined
  }
  return {
    kind: "configured",
    options: Object.fromEntries(Object.entries(value[1])),
    specifier: value[0],
  }
}

export function readOpenCodePluginEntries(value: unknown): readonly OpenCodePluginEntry[] | undefined {
  if (value === undefined) {
    return []
  }
  if (validSpecifier(value)) {
    return [{ kind: "plain", specifier: value }]
  }
  if (!Array.isArray(value)) {
    return undefined
  }
  const entries: OpenCodePluginEntry[] = []
  for (const candidate of value) {
    const entry = readPluginEntry(candidate)
    if (entry === undefined) {
      return undefined
    }
    entries.push(entry)
  }
  return entries
}

export function serializeOpenCodePluginEntries(entries: readonly OpenCodePluginEntry[]): readonly OpenCodePluginConfigValue[] {
  return entries.map((entry) => entry.kind === "plain"
    ? entry.specifier
    : [entry.specifier, Object.fromEntries(Object.entries(entry.options))] as const)
}

export function isPersonaHarnessNpmPluginSpecifier(entry: string): boolean {
  const prefix = `${PERSONA_HARNESS_PACKAGE_NAME}@`
  return entry.startsWith(prefix) && VERSIONED_NPM_PACKAGE_PATTERN.test(entry.slice(prefix.length))
}

export function isPersonaHarnessPluginSpecifier(entry: string): boolean {
  const normalized = entry.trim()
  return normalized === PERSONA_HARNESS_PACKAGE_NAME
    || normalized === `${PERSONA_HARNESS_PACKAGE_NAME}@latest`
    || isPersonaHarnessNpmPluginSpecifier(normalized)
}

export function personaAutoUpdateState(entry: OpenCodePluginEntry): PersonaAutoUpdateState {
  if (entry.kind === "plain" || entry.options["autoUpdate"] === undefined || entry.options["autoUpdate"] === false) {
    return "disabled"
  }
  return entry.options["autoUpdate"] === true ? "enabled" : "invalid"
}

export function withPersonaAutoUpdate(entry: OpenCodePluginEntry, enabled: boolean): OpenCodePluginEntry {
  const retainedOptions = entry.kind === "configured"
    ? Object.entries(entry.options).filter(([key]) => key !== "autoUpdate")
    : []
  if (!enabled && retainedOptions.length === 0) {
    return { kind: "plain", specifier: entry.specifier }
  }
  return {
    kind: "configured",
    options: Object.fromEntries(enabled ? [...retainedOptions, ["autoUpdate", true]] : retainedOptions),
    specifier: entry.specifier,
  }
}

export function withPluginSpecifier(entry: OpenCodePluginEntry, specifier: string): OpenCodePluginEntry {
  return entry.kind === "plain"
    ? { kind: "plain", specifier }
    : { kind: "configured", options: entry.options, specifier }
}

export function activePersonaHarnessPluginIndex(entries: readonly OpenCodePluginEntry[]): number | undefined {
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const entry = entries[index]
    if (entry !== undefined && isPersonaHarnessPluginSpecifier(entry.specifier)) {
      return index
    }
  }
  return undefined
}

export function isVersionedNpmPackageVersion(value: string): boolean {
  return VERSIONED_NPM_PACKAGE_PATTERN.test(value)
}
