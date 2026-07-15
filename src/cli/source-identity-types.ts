export const SOURCE_IDENTITY_SCHEMA = "source-identity.1" as const
export const SOURCE_IDENTITY_EXCLUSIONS = [
  ".git/**",
  ".gradle/**",
  "build/**",
  "node_modules/**",
  "<configured-evidence>/**",
] as const

const SOURCE_IDENTITY_KEYS = [
  "schemaVersion",
  "repositoryHead",
  "gitStatusDigest",
  "trackedIndexDigest",
  "contentDigest",
  "entryCount",
  "trackedEntryCount",
  "untrackedEntryCount",
  "exclusions",
] as const
const SHA256_PATTERN = /^sha256:[a-f0-9]{64}$/u

export type SourceIdentityExclusion = (typeof SOURCE_IDENTITY_EXCLUSIONS)[number]

export type SourceIdentity = {
  readonly contentDigest: string
  readonly entryCount: number
  readonly exclusions: readonly SourceIdentityExclusion[]
  readonly gitStatusDigest: string
  readonly repositoryHead: string
  readonly schemaVersion: typeof SOURCE_IDENTITY_SCHEMA
  readonly trackedEntryCount: number
  readonly trackedIndexDigest: string
  readonly untrackedEntryCount: number
}

export function parseSourceIdentity(value: unknown): SourceIdentity | undefined {
  if (!isRecord(value) || Object.keys(value).some((key) => !SOURCE_IDENTITY_KEYS.some((allowed) => allowed === key))) {
    return undefined
  }
  if (SOURCE_IDENTITY_KEYS.some((key) => !(key in value))) return undefined
  const exclusions = value.exclusions
  if (!Array.isArray(exclusions) || exclusions.length !== SOURCE_IDENTITY_EXCLUSIONS.length) return undefined
  if (!exclusions.every((entry, index) => entry === SOURCE_IDENTITY_EXCLUSIONS[index])) return undefined
  if (
    value.schemaVersion !== SOURCE_IDENTITY_SCHEMA
    || !isCommitId(value.repositoryHead)
    || !isDigest(value.gitStatusDigest)
    || !isDigest(value.trackedIndexDigest)
    || !isDigest(value.contentDigest)
    || !isNonNegativeInteger(value.entryCount)
    || !isNonNegativeInteger(value.trackedEntryCount)
    || !isNonNegativeInteger(value.untrackedEntryCount)
  ) {
    return undefined
  }
  return {
    contentDigest: value.contentDigest,
    entryCount: value.entryCount,
    exclusions: SOURCE_IDENTITY_EXCLUSIONS,
    gitStatusDigest: value.gitStatusDigest,
    repositoryHead: value.repositoryHead.toLowerCase(),
    schemaVersion: SOURCE_IDENTITY_SCHEMA,
    trackedEntryCount: value.trackedEntryCount,
    trackedIndexDigest: value.trackedIndexDigest,
    untrackedEntryCount: value.untrackedEntryCount,
  }
}

export function sameSourceIdentity(left: SourceIdentity, right: SourceIdentity): boolean {
  return left.schemaVersion === right.schemaVersion
    && left.repositoryHead === right.repositoryHead
    && left.gitStatusDigest === right.gitStatusDigest
    && left.trackedIndexDigest === right.trackedIndexDigest
    && left.contentDigest === right.contentDigest
    && left.entryCount === right.entryCount
    && left.trackedEntryCount === right.trackedEntryCount
    && left.untrackedEntryCount === right.untrackedEntryCount
    && left.exclusions.every((entry, index) => entry === right.exclusions[index])
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isCommitId(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{40,64}$/iu.test(value)
}

function isDigest(value: unknown): value is string {
  return typeof value === "string" && SHA256_PATTERN.test(value)
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
}
