import { readFileSync } from "node:fs"
import { relative, resolve } from "node:path"

export const CLEAN_PACKAGE_SOURCE_FIXTURE_ROOT = "scripts/verify-clean-package-boundary.mjs"

export const CLEAN_PACKAGE_SOURCE_FIXTURE_PATHS = Object.freeze([
  "scripts/clean-package-boundary-core.mjs",
  "scripts/clean-package-exercise-phase.mjs",
  "scripts/consumer-authority-observer-gh-package-record.mjs",
  "scripts/consumer-authority-observer-gh-stage.mjs",
  "scripts/package-content-identity.mjs",
  CLEAN_PACKAGE_SOURCE_FIXTURE_ROOT,
])

const RELATIVE_MJS_IMPORT = /\bfrom\s+["'](\.[^"']+\.mjs)["']/gu

export function cleanPackageSourceFixtureImportClosure(repositoryRoot) {
  const pending = [CLEAN_PACKAGE_SOURCE_FIXTURE_ROOT]
  const closure = new Set()

  while (pending.length > 0) {
    const relativePath = pending.pop()
    if (relativePath === undefined || closure.has(relativePath)) continue
    if (!relativePath.startsWith("scripts/") || !relativePath.endsWith(".mjs")) {
      throw new TypeError("clean-package-source-fixture-import")
    }

    closure.add(relativePath)
    const absolutePath = resolve(repositoryRoot, relativePath)
    const source = readFileSync(absolutePath, "utf8")
    for (const match of source.matchAll(RELATIVE_MJS_IMPORT)) {
      const specifier = match[1]
      if (specifier === undefined) throw new TypeError("clean-package-source-fixture-import")
      const importedPath = relative(repositoryRoot, resolve(absolutePath, "..", specifier))
      if (importedPath.startsWith("..") || importedPath === "" || !importedPath.endsWith(".mjs")) {
        throw new TypeError("clean-package-source-fixture-import")
      }
      pending.push(importedPath)
    }
  }

  return [...closure].sort()
}

export function assertCleanPackageSourceFixtureClosure(repositoryRoot, fixturePaths) {
  const expected = cleanPackageSourceFixtureImportClosure(repositoryRoot)
  const actual = [...fixturePaths].sort()
  if (actual.length !== expected.length || actual.some((path, index) => path !== expected[index])) {
    throw new TypeError("clean-package-source-fixture-closure")
  }
}
