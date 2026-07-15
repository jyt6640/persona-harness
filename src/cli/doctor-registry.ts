type RegistryStatus = "available" | "malformed" | "timeout" | "unavailable"
type RegistryDeprecation = "none observed" | "present" | "unavailable"
type RegistryChannelState = "DRIFT" | "MATCH" | "RETIRED" | "UNAVAILABLE"

export type DoctorRegistrySummary = {
  readonly channels: {
    readonly installed: string
    readonly latest: string
    readonly legacy: string
    readonly next: string
  }
  readonly channelStates: {
    readonly latest: RegistryChannelState
    readonly legacy: RegistryChannelState
    readonly next: RegistryChannelState
  }
  readonly deprecation: RegistryDeprecation
  readonly diagnostics: readonly string[]
  readonly status: RegistryStatus
  readonly text: string
}

type RegistryInput = {
  readonly deprecatedText?: string
  readonly distTagsText?: string
  readonly forcedStatus?: string
  readonly installedVersion: string
}

const VERSION_PATTERN =
  /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-(?:0|[1-9]\d*|[0-9A-Za-z-]*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|[0-9A-Za-z-]*[A-Za-z-][0-9A-Za-z-]*))*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/u
const SENSITIVE_VERSION_PATTERN =
  /(?:sk[-_]?live[-_]|api[-_]?key|apikey|bearer|password|passwd|jdbc|pem|private[-_]?key|secret|https?:\/\/|[A-Za-z0-9._%+-]+:[^/@\s]+@)/iu
const MAX_CHANNEL_VERSION_LENGTH = 128

function boundedVersion(value: unknown): string | undefined {
  return typeof value === "string"
    && value.length <= MAX_CHANNEL_VERSION_LENGTH
    && !SENSITIVE_VERSION_PATTERN.test(value)
    && VERSION_PATTERN.test(value)
    ? value
    : undefined
}

function unavailableSummary(installedVersion: string, status: Exclude<RegistryStatus, "available">): DoctorRegistrySummary {
  return {
    channels: { installed: installedVersion, latest: "unavailable", legacy: "unavailable", next: "unavailable" },
    channelStates: { latest: "UNAVAILABLE", legacy: "UNAVAILABLE", next: "UNAVAILABLE" },
    deprecation: "unavailable",
    diagnostics: [`registry-${status}`],
    status,
    text: "registry unavailable",
  }
}

function channelState(installedVersion: string, version: string): RegistryChannelState {
  return version === "unavailable" ? "UNAVAILABLE" : version === installedVersion ? "MATCH" : "DRIFT"
}

function deprecationState(value: string | undefined): RegistryDeprecation {
  if (value === undefined) {
    return "unavailable"
  }
  try {
    const parsed: unknown = JSON.parse(value)
    if (parsed === false || parsed === null) {
      return "none observed"
    }
    if (typeof parsed === "string") {
      return parsed.length === 0 ? "none observed" : "present"
    }
    return "unavailable"
  } catch {
    return "unavailable"
  }
}

export function readDoctorRegistry(input: RegistryInput): DoctorRegistrySummary {
  const forcedStatus = input.forcedStatus
    ?? (input.distTagsText === "timeout" || input.distTagsText === "unavailable" ? input.distTagsText : undefined)
  if (forcedStatus === "timeout" || forcedStatus === "unavailable") {
    return unavailableSummary(input.installedVersion, forcedStatus)
  }
  if (input.distTagsText === undefined || input.distTagsText.trim() === "") {
    return unavailableSummary(input.installedVersion, "unavailable")
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(input.distTagsText)
  } catch {
    return {
      ...unavailableSummary(input.installedVersion, "malformed"),
      diagnostics: ["registry-malformed"],
      text: "registry malformed",
    }
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return {
      ...unavailableSummary(input.installedVersion, "malformed"),
      diagnostics: ["registry-malformed"],
      text: "registry malformed",
    }
  }

  const tags = parsed as Record<string, unknown>
  const latest = boundedVersion(tags.latest) ?? "unavailable"
  const next = boundedVersion(tags.next) ?? "unavailable"
  const legacy = boundedVersion(tags.legacy ?? tags.alpha) ?? "retired"
  const deprecation = deprecationState(input.deprecatedText)
  const malformedTag = [tags.latest, tags.next, tags.legacy ?? tags.alpha]
    .some((value) => value !== undefined && boundedVersion(value) === undefined)
  if (malformedTag) {
    return {
      ...unavailableSummary(input.installedVersion, "malformed"),
      diagnostics: ["registry-malformed"],
      text: "registry malformed",
    }
  }

  return {
    channels: { installed: input.installedVersion, latest, legacy, next },
    channelStates: {
      latest: channelState(input.installedVersion, latest),
      legacy: legacy === "retired" ? "RETIRED" : "DRIFT",
      next: channelState(input.installedVersion, next),
    },
    deprecation,
    diagnostics: deprecation === "unavailable" ? ["registry-deprecation-unavailable"] : [],
    status: "available",
    text: `alpha=${legacy === "retired" ? "missing" : legacy}, latest=${latest}`,
  }
}
