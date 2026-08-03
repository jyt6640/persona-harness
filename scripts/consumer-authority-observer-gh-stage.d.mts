export const OBSERVER_GH_STAGE_CODES: readonly [
  "observer-gh-tool-invalid",
  "observer-gh-tool-unavailable",
  "observer-gh-tool-version-unsupported",
  "observer-gh-parser-rejected",
  "observer-gh-parser-timeout",
  "observer-gh-non-tool-stage",
  "observer-gh-selector-environment",
  "observer-gh-selector-package-list",
  "observer-gh-selector-package-record-record-encoding",
  "observer-gh-selector-package-record-record-path",
  "observer-gh-selector-package-record-primary-missing",
  "observer-gh-selector-package-record-primary-unsafe",
  "observer-gh-selector-package-record-ancillary-unsafe",
  "observer-gh-selector-package-record-executable-ambiguous",
  "observer-gh-selector-package-record-lstat-failed",
  "observer-gh-selector-package-record-canonical",
  "observer-gh-selector-source-assessment",
  "observer-gh-selector-private-reservation",
  "observer-gh-selector-private-copy",
  "observer-gh-selector-private-assessment",
  "observer-gh-selector-output-handoff",
  "observer-gh-selector-internal",
]

export function observerGhStageCodeForPreflight(value: unknown): (typeof OBSERVER_GH_STAGE_CODES)[number] | undefined
export function observerGhStageCodeForWorkflowSelector(value: unknown): (typeof OBSERVER_GH_STAGE_CODES)[number] | undefined
export function observerGhStageCodeForPrivateCopy(value: unknown): (typeof OBSERVER_GH_STAGE_CODES)[number] | undefined
export function isObserverGhStageCode(value: unknown): value is (typeof OBSERVER_GH_STAGE_CODES)[number]
