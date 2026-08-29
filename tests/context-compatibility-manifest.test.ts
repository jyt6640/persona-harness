import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import {
  CONTEXT_COMPATIBILITY_MANIFEST_SCHEMA_VERSION,
  ContextCompatibilityManifestError,
  parseContextCompatibilityManifest,
  runContextCompatibilityManifest,
} from "../scripts/context-compatibility-manifest-runner.mjs"

const repositoryRoot = resolve(process.cwd())
const temporaryRoots: string[] = []

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    rmSync(root, { force: true, recursive: true })
  }
})

describe("Context compatibility manifest", () => {
  it("rejects malformed, incomplete, and source-fallback manifests before an installed command can run", () => {
    const valid = manifestFor({
      contentIdentity: identityFixture(),
      packageVersion: "0.8.32",
      tarballSha256: "0".repeat(64),
    })

    for (const candidate of [
      { ...valid, sourceFallback: true },
      { ...valid, package: { ...valid.package, tarballSha256: "not-a-digest" } },
      { ...valid, scenarios: valid.scenarios.slice(1) },
      { ...valid, unexpected: "field" },
    ]) {
      expect(() => parseContextCompatibilityManifest(candidate)).toThrow(ContextCompatibilityManifestError)
    }
  })

  it("blocks an archive digest mismatch before it can inspect an installed package or invoke Context", () => {
    const root = createTemporaryRoot()
    const archivePath = join(root, "candidate.tgz")
    writeFileSync(archivePath, "not-a-tarball\n")

    const result = runContextCompatibilityManifest(manifestFor({
      contentIdentity: identityFixture(),
      packageVersion: "0.8.32",
      tarballSha256: "0".repeat(64),
    }), {
      archivePath,
      installedPackageRoot: join(root, "missing-installed-package"),
      sourceRoot: repositoryRoot,
      temporaryRoot: root,
    })

    expect(result).toEqual({
      code: "context-compatibility-archive-sha256-mismatch",
      schemaVersion: "persona-context-compatibility-result.1",
      state: "BLOCKED",
    })
  })
})

function manifestFor({
  contentIdentity,
  packageVersion,
  tarballSha256,
}: {
  readonly contentIdentity: unknown
  readonly packageVersion: string
  readonly tarballSha256: string
}) {
  return {
    package: {
      contentIdentity,
      name: "persona-harness",
      tarballSha256,
      version: packageVersion,
    },
    requiredPackagePaths: ["dist/cli/index.js"],
    scenarios: [
      "status-default",
      "preview-safe-target",
      "explain-safe-target",
      "init-preview-no-write",
      "init-enable-no-overwrite",
      "invalid-config",
    ],
    schemaVersion: CONTEXT_COMPATIBILITY_MANIFEST_SCHEMA_VERSION,
    sourceFallback: false,
  }
}

function identityFixture() {
  return {
    contentSha256: "1".repeat(64),
    entryCount: 1,
    identitySha256: "2".repeat(64),
    modeCounts: { "0644": 1 },
    schemaVersion: "package-content-identity.1",
  }
}

function createTemporaryRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "persona-context-compatibility-unit-"))
  temporaryRoots.push(root)
  return root
}
