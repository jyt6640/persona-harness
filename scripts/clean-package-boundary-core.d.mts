export class CleanPackageBoundaryError extends Error {
  readonly code: string
}

export const BUNDLE_REFERENCE_POLICY: {
  readonly candidateRef: "explicit-single-refs-heads-candidate-must-match-expected-head"
  readonly headAlias: "optional-head-mapping-must-match-the-same-expected-head"
  readonly mainRef: "refs/remotes/origin/main"
  readonly sourceCandidateRef: "refs/heads/clean-package-source"
  readonly requiredRefs: readonly [
    "explicit-single-refs-heads-candidate-must-match-expected-head",
    "refs/remotes/origin/main",
  ]
}

export function assertSourcePackageIdentity(
  packageJson: unknown,
  packageLock: unknown,
): { name: string; version: string }

export function parseBundleHeads(output: string): Array<{ ref: string; sha: string }>

export function assertBundleHeadBinding(
  heads: Array<{ ref: string; sha: string }>,
  expected: { base: string; candidateRef: string; head: string },
): { base: string; candidateRef: string; head: string }

export function assertCheckoutPackageBinding(binding: {
  root: string
  gitRoot: string
  npmPrefix: string
  packageSha256: string
  headPackageSha256: string
  lockSha256: string
  headLockSha256: string
}): { root: string }

export function assertPackageExecutionBinding(binding: {
  commandCwd: string
  expectedLockPath: string
  expectedPackagePath: string
  gitRoot: string
  lockPath: string
  npmPrefix: string
  packagePath: string
  root: string
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
