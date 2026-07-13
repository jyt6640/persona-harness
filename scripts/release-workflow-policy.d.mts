export type PolicyResult =
  | { readonly ok: true; readonly action?: "already-valid" | "create" }
  | { readonly code: string; readonly message: string; readonly ok: false }

export type CanonicalMainSource = {
  readonly canonicalMainSha: string
  readonly isAncestor: boolean
  readonly ref: string
  readonly sha: string
}

export type TagSource = {
  readonly canonicalMainSha: string
  readonly isAncestor: boolean
  readonly packageVersion: string
  readonly sha: string
  readonly tagCommit: string
  readonly tagName: string
}

export type DistTagCompatibility = {
  readonly distTag: string
  readonly version: string
}

export type RegistryMetadata = {
  readonly "dist.integrity"?: string
  readonly "dist.shasum"?: string
  readonly gitHead?: string
  readonly version?: string
}

export type RegistryCheck = {
  readonly distTag: string
  readonly distTagsText: string
  readonly expectedHead: string
  readonly expectedVersion: string
  readonly metadata: RegistryMetadata
}

export type ReleaseState = {
  readonly expectedCommit: string
  readonly expectedPrerelease: boolean
  readonly expectedTag: string
  readonly release: {
    readonly isPrerelease?: boolean
    readonly name?: string
    readonly tagName?: string
    readonly targetCommitish?: string
  } | null
  readonly tagCommit: string
}

export function checkCanonicalMainSource(input: CanonicalMainSource): PolicyResult
export function checkDistTagCompatibility(input: DistTagCompatibility): PolicyResult
export function checkRegistryMetadata(input: RegistryCheck): PolicyResult
export function checkReleaseState(input: ReleaseState): PolicyResult
export function checkTagSource(input: TagSource): PolicyResult
