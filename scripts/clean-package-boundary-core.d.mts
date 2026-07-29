export class CleanPackageBoundaryError extends Error {
  readonly code: string
}

export type CleanPackageIdentity = Readonly<{
  name: string
  version: string
}>

export function assertSourcePackageIdentity(packageJson: unknown, packageLock: unknown): CleanPackageIdentity
export function parseBundleHeads(output: string): readonly Readonly<{ ref: string; sha: string }>[]
export function assertBundleHeadBinding(
  heads: unknown,
  expected: Readonly<{ base: string; head: string }>,
): Readonly<{ base: string; head: string }>
export function assertPackRecordBinding(record: unknown, identity: CleanPackageIdentity): CleanPackageIdentity
