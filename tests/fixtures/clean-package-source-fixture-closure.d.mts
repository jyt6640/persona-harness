export const CLEAN_PACKAGE_SOURCE_FIXTURE_ROOT: "scripts/verify-clean-package-boundary.mjs"

export const CLEAN_PACKAGE_SOURCE_FIXTURE_PATHS: readonly string[]

export function cleanPackageSourceFixtureImportClosure(repositoryRoot: string): readonly string[]

export function assertCleanPackageSourceFixtureClosure(
  repositoryRoot: string,
  fixturePaths: readonly string[],
): void
