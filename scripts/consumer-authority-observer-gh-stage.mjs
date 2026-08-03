import { OBSERVER_GH_PACKAGE_RECORD_SHAPES } from "./consumer-authority-observer-gh-package-record.mjs"

const PACKAGE_RECORD_STAGE_CODES = OBSERVER_GH_PACKAGE_RECORD_SHAPES.map(
  (shape) => `observer-gh-selector-package-record-${shape}`,
)

const STAGE_CODES = Object.freeze([
  "observer-gh-tool-invalid",
  "observer-gh-tool-unavailable",
  "observer-gh-tool-version-unsupported",
  "observer-gh-parser-rejected",
  "observer-gh-parser-timeout",
  "observer-gh-non-tool-stage",
  "observer-gh-selector-environment",
  "observer-gh-selector-package-list",
  ...PACKAGE_RECORD_STAGE_CODES,
  "observer-gh-selector-source-assessment",
  "observer-gh-selector-private-reservation",
  "observer-gh-selector-private-copy",
  "observer-gh-selector-private-assessment",
  "observer-gh-selector-output-handoff",
  "observer-gh-selector-internal",
])

const SELECTOR_STAGES = Object.freeze([
  "environment",
  "package-list",
  "package-record",
  "source-assessment",
  "private-reservation",
  "private-copy",
  "private-assessment",
  "output-handoff",
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
    case "gh-command-parser-timeout":
      return "observer-gh-parser-timeout"
    default:
      return "observer-gh-non-tool-stage"
  }
}

export function observerGhStageCodeForWorkflowSelector(value) {
  if (!isRecord(value) || typeof value.code !== "string" || typeof value.state !== "string") {
    return "observer-gh-non-tool-stage"
  }
  if (
    value.state === "ready"
    && value.code === "observer-gh-workflow-ready"
    && value.selectorStage === "output-handoff"
    && value.packageRecordShape === "canonical"
  ) {
    return undefined
  }
  if (value.state !== "blocked" || typeof value.selectorStage !== "string") {
    return "observer-gh-non-tool-stage"
  }
  if (value.selectorStage === "selector-internal" && value.packageRecordShape === undefined) {
    return "observer-gh-selector-internal"
  }
  if (value.selectorStage === "package-record") {
    return OBSERVER_GH_PACKAGE_RECORD_SHAPES.includes(value.packageRecordShape)
      ? `observer-gh-selector-package-record-${value.packageRecordShape}`
      : "observer-gh-non-tool-stage"
  }
  if (["environment", "package-list"].includes(value.selectorStage) && value.packageRecordShape === undefined) {
    return `observer-gh-selector-${value.selectorStage}`
  }
  if (
    SELECTOR_STAGES.includes(value.selectorStage)
    && value.packageRecordShape === "canonical"
  ) {
    return `observer-gh-selector-${value.selectorStage}`
  }
  return "observer-gh-non-tool-stage"
}

export function observerGhStageCodeForPrivateCopy(value) {
  if (!isRecord(value) || typeof value.code !== "string" || typeof value.state !== "string") {
    return "observer-gh-non-tool-stage"
  }
  if (
    value.state === "ready"
    && value.code === "observer-gh-private-copy-ready"
    && value.selectorStage === "private-assessment"
  ) {
    return undefined
  }
  if (value.state !== "blocked" || typeof value.selectorStage !== "string") {
    return "observer-gh-non-tool-stage"
  }
  switch (value.code) {
    case "observer-gh-workflow-tool-unavailable":
      return "observer-gh-tool-unavailable"
    case "observer-gh-workflow-tool-version-unsupported":
      return "observer-gh-tool-version-unsupported"
    case "observer-gh-workflow-tool-invalid":
      return ["source-assessment", "private-reservation", "private-copy", "private-assessment"].includes(value.selectorStage)
        ? `observer-gh-selector-${value.selectorStage}`
        : "observer-gh-non-tool-stage"
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
