import { isRecord } from "../config/jsonc.js"

export type DoctorRegistryStatus = "available" | "malformed" | "timeout" | "unavailable"
export type DoctorRegistryDeprecation = "none observed" | "present" | "unavailable"
export type DoctorRegistryChannelState = "DRIFT" | "MATCH" | "RETIRED" | "UNAVAILABLE"

export type DoctorRegistryResponse =
  | {
      readonly status: "available"
      readonly text: string
    }
  | {
      readonly status: Exclude<DoctorRegistryStatus, "available">
    }

export type DoctorRegistryInput = {
  readonly deprecation: DoctorRegistryResponse
  readonly distTags: DoctorRegistryResponse
  readonly installedVersion: unknown
}

export type DoctorRegistrySummary = {
  readonly channelStates: {
    readonly latest: DoctorRegistryChannelState
    readonly legacy: DoctorRegistryChannelState
    readonly next: DoctorRegistryChannelState
    readonly staging: DoctorRegistryChannelState
  }
  readonly channels: {
    readonly installed: string
    readonly latest: string
    readonly legacy: string
    readonly next: string
    readonly staging: string
  }
  readonly deprecation: DoctorRegistryDeprecation
  readonly diagnostics: readonly string[]
  readonly status: DoctorRegistryStatus
  readonly text: string
}

type ParsedChannel =
  | { readonly kind: "invalid" }
  | { readonly kind: "missing" }
  | { readonly kind: "value"; readonly value: string }

type ParsedDeprecation = {
  readonly diagnostic?: string
  readonly state: DoctorRegistryDeprecation
}

const VERSION_PATTERN =
  /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-(?:0|[1-9]\d*|[0-9A-Za-z-]*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|[0-9A-Za-z-]*[A-Za-z-][0-9A-Za-z-]*))*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/u
const SENSITIVE_VERSION_PATTERN =
  /(?:sk[-_]?live[-_]|api[-_]?key|apikey|bearer|password|passwd|jdbc|pem|private[-_]?key|secret|https?:\/\/|[A-Za-z0-9._%+-]+:[^/@\s]+@)/iu
const MAX_CHANNEL_VERSION_LENGTH = 128
const MAX_DEPRECATION_BYTES = 4 * 1024
const MAX_DIST_TAG_BYTES = 64 * 1024

export function isDoctorRegistryVersion(value: unknown): value is string {
  return typeof value === "string"
    && value.length <= MAX_CHANNEL_VERSION_LENGTH
    && !SENSITIVE_VERSION_PATTERN.test(value)
    && VERSION_PATTERN.test(value)
}

export function readDoctorRegistry(input: DoctorRegistryInput): DoctorRegistrySummary {
  if (!isDoctorRegistryVersion(input.installedVersion)) {
    return malformedSummary("registry-installed-version-invalid")
  }
  const installedVersion = input.installedVersion

  switch (input.distTags.status) {
    case "timeout":
    case "unavailable":
    case "malformed":
      return unavailableSummary(installedVersion, input.distTags.status)
    case "available":
      return readAvailableRegistry(installedVersion, input.distTags.text, input.deprecation)
    default:
      return assertNever(input.distTags)
  }
}

function readAvailableRegistry(
  installedVersion: string,
  text: string,
  deprecationResponse: DoctorRegistryResponse,
): DoctorRegistrySummary {
  if (Buffer.byteLength(text, "utf8") > MAX_DIST_TAG_BYTES) {
    return malformedSummary("registry-malformed")
  }
  const trimmed = text.trim()
  if (trimmed.length === 0) {
    return unavailableSummary(installedVersion, "unavailable")
  }

  const parsed = parseJsonObject(trimmed)
  if (parsed === undefined) {
    return malformedSummary("registry-malformed")
  }
  const latest = parseChannel(parsed["latest"])
  const next = parseChannel(parsed["next"])
  const staging = parseChannel(parsed["staging"])
  const legacy = parseLegacyChannel(parsed)
  if (
    latest.kind === "invalid"
    || next.kind === "invalid"
    || staging.kind === "invalid"
    || legacy.kind === "invalid"
  ) {
    return malformedSummary("registry-malformed")
  }

  const deprecation = parseDeprecation(deprecationResponse)
  const latestVersion = valueOrUnavailable(latest)
  const nextVersion = valueOrUnavailable(next)
  const stagingVersion = valueOrUnavailable(staging)
  const legacyVersion = legacy.kind === "value" ? legacy.value : "retired"
  return {
    channelStates: {
      latest: channelState(installedVersion, latestVersion),
      legacy: legacyVersion === "retired" ? "RETIRED" : channelState(installedVersion, legacyVersion),
      next: channelState(installedVersion, nextVersion),
      staging: channelState(installedVersion, stagingVersion),
    },
    channels: {
      installed: installedVersion,
      latest: latestVersion,
      legacy: legacyVersion,
      next: nextVersion,
      staging: stagingVersion,
    },
    deprecation: deprecation.state,
    diagnostics: deprecation.diagnostic === undefined ? [] : [deprecation.diagnostic],
    status: "available",
    text: "fixed registry channel readback",
  }
}

function unavailableSummary(installedVersion: string, status: Exclude<DoctorRegistryStatus, "available">): DoctorRegistrySummary {
  return {
    channelStates: {
      latest: "UNAVAILABLE",
      legacy: "UNAVAILABLE",
      next: "UNAVAILABLE",
      staging: "UNAVAILABLE",
    },
    channels: {
      installed: installedVersion,
      latest: "unavailable",
      legacy: "unavailable",
      next: "unavailable",
      staging: "unavailable",
    },
    deprecation: "unavailable",
    diagnostics: [`registry-${status}`],
    status,
    text: "registry unavailable",
  }
}

function malformedSummary(diagnostic: string): DoctorRegistrySummary {
  return {
    channelStates: {
      latest: "UNAVAILABLE",
      legacy: "UNAVAILABLE",
      next: "UNAVAILABLE",
      staging: "UNAVAILABLE",
    },
    channels: {
      installed: "unavailable",
      latest: "unavailable",
      legacy: "unavailable",
      next: "unavailable",
      staging: "unavailable",
    },
    deprecation: "unavailable",
    diagnostics: [diagnostic],
    status: "malformed",
    text: "registry malformed",
  }
}

function parseJsonObject(value: string): Record<string, unknown> | undefined {
  try {
    const parsed: unknown = JSON.parse(value)
    return isRecord(parsed) ? parsed : undefined
  } catch (error) {
    if (error instanceof SyntaxError) return undefined
    throw error
  }
}

function parseChannel(value: unknown): ParsedChannel {
  if (value === undefined) return { kind: "missing" }
  return isDoctorRegistryVersion(value)
    ? { kind: "value", value }
    : { kind: "invalid" }
}

function parseLegacyChannel(tags: Record<string, unknown>): ParsedChannel {
  const legacy = parseChannel(tags["legacy"])
  const alpha = parseChannel(tags["alpha"])
  if (legacy.kind === "invalid" || alpha.kind === "invalid") return { kind: "invalid" }
  if (legacy.kind === "value" && alpha.kind === "value" && legacy.value !== alpha.value) {
    return { kind: "invalid" }
  }
  return legacy.kind === "value" ? legacy : alpha
}

function parseDeprecation(response: DoctorRegistryResponse): ParsedDeprecation {
  if (response.status !== "available") {
    return {
      diagnostic: `registry-deprecation-${response.status}`,
      state: "unavailable",
    }
  }
  if (Buffer.byteLength(response.text, "utf8") > MAX_DEPRECATION_BYTES) {
    return { diagnostic: "registry-deprecation-malformed", state: "unavailable" }
  }
  const trimmed = response.text.trim()
  if (trimmed.length === 0) return { state: "none observed" }
  try {
    const parsed: unknown = JSON.parse(trimmed)
    if (parsed === false || parsed === null) return { state: "none observed" }
    if (typeof parsed === "string") {
      return parsed.length === 0 ? { state: "none observed" } : { state: "present" }
    }
    return { diagnostic: "registry-deprecation-malformed", state: "unavailable" }
  } catch (error) {
    if (error instanceof SyntaxError) {
      return { diagnostic: "registry-deprecation-malformed", state: "unavailable" }
    }
    throw error
  }
}

function valueOrUnavailable(channel: Exclude<ParsedChannel, { readonly kind: "invalid" }>): string {
  return channel.kind === "value" ? channel.value : "unavailable"
}

function channelState(installedVersion: string, version: string): DoctorRegistryChannelState {
  if (version === "unavailable") return "UNAVAILABLE"
  return version === installedVersion ? "MATCH" : "DRIFT"
}

function assertNever(value: never): never {
  throw new TypeError(`Unknown doctor registry response: ${String(value)}`)
}
