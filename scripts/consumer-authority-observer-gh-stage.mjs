const STAGE_CODES = Object.freeze([
  "observer-gh-tool-invalid",
  "observer-gh-tool-unavailable",
  "observer-gh-tool-version-unsupported",
  "observer-gh-parser-rejected",
  "observer-gh-non-tool-stage",
])

export const OBSERVER_GH_STAGE_CODES = STAGE_CODES

export function observerGhStageCodeForPreflight(value) {
  if (!isRecord(value) || typeof value.code !== "string" || typeof value.state !== "string") {
    return "observer-gh-non-tool-stage"
  }
  if (value.state === "ready" && value.code === "gh-command-parser-accepted") return undefined
  switch (value.code) {
    case "gh-command-tool-invalid":
      return "observer-gh-tool-invalid"
    case "gh-command-tool-required":
    case "gh-command-unavailable":
      return "observer-gh-tool-unavailable"
    case "gh-command-version-unsupported":
      return "observer-gh-tool-version-unsupported"
    case "gh-authentication-required":
    case "gh-command-parser-rejected":
      return "observer-gh-parser-rejected"
    default:
      return "observer-gh-non-tool-stage"
  }
}

export function isObserverGhStageCode(value) {
  return typeof value === "string" && STAGE_CODES.includes(value)
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}
