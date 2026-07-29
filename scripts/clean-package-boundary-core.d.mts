export class CleanPackageBoundaryError extends Error {
  readonly code: string
}

export function assertSourcePackageIdentity(
  packageJson: unknown,
  packageLock: unknown,
): { name: string; version: string }

export function parseBundleHeads(output: string): Array<{ ref: string; sha: string }>

export function assertBundleHeadBinding(
  heads: Array<{ ref: string; sha: string }>,
  expected: { base: string; head: string },
): { base: string; head: string }

export function assertCheckoutPackageBinding(binding: {
  root: string
  gitRoot: string
  npmPrefix: string
  packageSha256: string
  headPackageSha256: string
  lockSha256: string
  headLockSha256: string
}): { root: string }

export function assertNpmExecutionPolicy(policy: {
  global: string
  ignoreScripts: string
  workspaces: string
}): { global: string; ignoreScripts: string; workspaces: string }

export function assertPackRecordBinding(
  record: unknown,
  identity: { name: string; version: string },
): { name: string; version: string }
