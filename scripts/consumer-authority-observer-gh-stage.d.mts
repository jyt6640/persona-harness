export const OBSERVER_GH_STAGE_CODES: readonly [
  "observer-gh-tool-invalid",
  "observer-gh-tool-unavailable",
  "observer-gh-tool-version-unsupported",
  "observer-gh-parser-rejected",
  "observer-gh-non-tool-stage",
]

export function observerGhStageCodeForPreflight(value: unknown): (typeof OBSERVER_GH_STAGE_CODES)[number] | undefined
export function isObserverGhStageCode(value: unknown): value is (typeof OBSERVER_GH_STAGE_CODES)[number]
