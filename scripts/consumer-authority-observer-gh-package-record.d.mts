export const OBSERVER_GH_PACKAGE_RECORD_SHAPES: readonly [
  "record-encoding",
  "record-path",
  "primary-missing",
  "primary-unsafe",
  "ancillary-unsafe",
  "executable-ambiguous",
  "lstat-failed",
  "canonical",
]

export const OBSERVER_GH_POLICY_PRIMARY_RECORD: "/usr/bin/gh"
export const OBSERVER_GH_OPTIONAL_ANCILLARY_RECORDS: readonly [
  "/usr/share/bash-completion/completions/gh",
]

export class ObserverGhPackageRecordError extends Error {
  readonly shape: typeof OBSERVER_GH_PACKAGE_RECORD_SHAPES[number]
}

export class ObserverGhPackageOwnershipError extends Error {}

export interface ObserverGhPackageRecordStat {
  isFile(): boolean
  isSymbolicLink(): boolean
  mode: number
}

export interface ObserverGhPackageRecordSelectorOptions {
  readonly lstat?: (path: string) => ObserverGhPackageRecordStat
}

export interface InstalledGhPackageRecordOptions {
  readonly architecture?: "amd64" | "arm64"
  readonly execute?: (command: string, args: string[], options: unknown) => unknown
}

export function readInstalledGhPackageRecord(options?: InstalledGhPackageRecordOptions): readonly string[]
export function parseObserverGhPackageRecord(value: Buffer): readonly string[]
export function selectInstalledObserverGhCandidate(
  records: readonly string[],
  options?: ObserverGhPackageRecordSelectorOptions,
): Readonly<{ candidate: string; packageRecordShape: "canonical" }>
