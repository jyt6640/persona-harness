import { spawnSync } from "node:child_process"
import { mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { gzipSync } from "node:zlib"

import { describe, expect, it } from "vitest"

import { canonicalPackageFacts } from "../scripts/canonical-package-packer.mjs"
import {
  canonicalPackagePublisherPlan,
  CANONICAL_PUBLISHER_RUNTIME,
  CanonicalPackagePublisherError,
  parseCanonicalPackagePublisherPlan,
  verifyCanonicalPublisherHandoff,
} from "../scripts/canonical-package-publisher.mjs"
import { canonicalizePackageTarball } from "../scripts/package-content-identity.mjs"

const PACKAGE = { name: "persona-harness", version: "0.8.0-beta.18" }

describe("canonical package publisher", () => {
  it("hands the exact Node20 canonical tar and facts to the Node24 dry-run publisher", () => {
    const fixture = createFixture()

    try {
      const result = verifyCanonicalPublisherHandoff({
        canonicalDirectory: fixture.canonicalDirectory,
        dryRun: true,
        packageFactsPath: fixture.packageFactsPath,
        publisherEnvironment: fixture.publisherEnvironment,
        publisherRuntime: CANONICAL_PUBLISHER_RUNTIME,
        publisherRuntimeDirectory: fixture.publisherRuntimeDirectory,
        tarballPath: fixture.tarballPath,
        distTag: "staging",
      })

      expect(result).toMatchObject({
        package: PACKAGE,
        publisherRuntime: CANONICAL_PUBLISHER_RUNTIME,
        status: "passed",
      })
      expect(result.argv).toEqual([
        "publish",
        realpathSync(fixture.tarballPath),
        "--access",
        "public",
        "--tag",
        "staging",
        "--provenance",
        "--dry-run",
      ])
    } finally {
      fixture.cleanup()
    }
  })

  it.each([
    ["Node20", { node: "20.19.0", npm: "11.16.0" }],
    ["npm10", { node: "24.18.0", npm: "10.8.2" }],
  ])("blocks %s before any publish argv can be used", (_label, publisherRuntime) => {
    const fixture = createFixture()

    try {
      expect(() => verifyCanonicalPublisherHandoff({
        canonicalDirectory: fixture.canonicalDirectory,
        dryRun: true,
        packageFactsPath: fixture.packageFactsPath,
        publisherEnvironment: fixture.publisherEnvironment,
        publisherRuntime,
        publisherRuntimeDirectory: fixture.publisherRuntimeDirectory,
        tarballPath: fixture.tarballPath,
        distTag: "staging",
      })).toThrow(CanonicalPackagePublisherError)
      expect(() => verifyCanonicalPublisherHandoff({
        canonicalDirectory: fixture.canonicalDirectory,
        dryRun: true,
        packageFactsPath: fixture.packageFactsPath,
        publisherEnvironment: fixture.publisherEnvironment,
        publisherRuntime,
        publisherRuntimeDirectory: fixture.publisherRuntimeDirectory,
        tarballPath: fixture.tarballPath,
        distTag: "staging",
      })).toThrow("canonical-package-publisher-runtime")
    } finally {
      fixture.cleanup()
    }
  })

  it("rejects workspace publish and canonical packer config inheritance", () => {
    const fixture = createFixture()

    try {
      expect(() => verifyCanonicalPublisherHandoff({
        canonicalDirectory: fixture.canonicalDirectory,
        dryRun: true,
        packageFactsPath: fixture.packageFactsPath,
        publisherEnvironment: fixture.publisherEnvironment,
        publisherRuntime: CANONICAL_PUBLISHER_RUNTIME,
        publisherRuntimeDirectory: fixture.publisherRuntimeDirectory,
        tarballPath: fixture.canonicalDirectory,
        distTag: "staging",
      })).toThrow("canonical-package-publisher-tarball")

      expect(() => verifyCanonicalPublisherHandoff({
        canonicalDirectory: fixture.canonicalDirectory,
        dryRun: true,
        packageFactsPath: fixture.packageFactsPath,
        publisherEnvironment: {
          ...fixture.publisherEnvironment,
          HOME: join(fixture.canonicalDirectory, "environment", "npm-home"),
        },
        publisherRuntime: CANONICAL_PUBLISHER_RUNTIME,
        publisherRuntimeDirectory: fixture.publisherRuntimeDirectory,
        tarballPath: fixture.tarballPath,
        distTag: "staging",
      })).toThrow("canonical-package-publisher-environment")
    } finally {
      fixture.cleanup()
    }
  })

  it("rejects a publisher runtime that encloses the canonical tar or facts that no longer bind it", () => {
    const fixture = createFixture()

    try {
      expect(() => verifyCanonicalPublisherHandoff({
        canonicalDirectory: fixture.canonicalDirectory,
        dryRun: true,
        packageFactsPath: fixture.packageFactsPath,
        publisherEnvironment: fixture.publisherEnvironment,
        publisherRuntime: CANONICAL_PUBLISHER_RUNTIME,
        publisherRuntimeDirectory: fixture.root,
        tarballPath: fixture.tarballPath,
        distTag: "staging",
      })).toThrow("canonical-package-publisher-environment")

      const facts = JSON.parse(readFileSync(fixture.packageFactsPath, "utf8"))
      facts.tarball.sha256 = "0".repeat(64)
      writeFileSync(fixture.packageFactsPath, `${JSON.stringify(facts)}\n`)
      expect(() => verifyCanonicalPublisherHandoff({
        canonicalDirectory: fixture.canonicalDirectory,
        dryRun: true,
        packageFactsPath: fixture.packageFactsPath,
        publisherEnvironment: fixture.publisherEnvironment,
        publisherRuntime: CANONICAL_PUBLISHER_RUNTIME,
        publisherRuntimeDirectory: fixture.publisherRuntimeDirectory,
        tarballPath: fixture.tarballPath,
        distTag: "staging",
      })).toThrow("canonical-package-publisher-tarball")
    } finally {
      fixture.cleanup()
    }
  })

  it("ships one strict Node24 dry-run plan without an authentication exchange", () => {
    const plan = canonicalPackagePublisherPlan()

    expect(plan).toMatchObject({
      canonicalPackerRuntime: { node: "20.19.0", npm: "10.8.2" },
      npmTrustedPublishingMinimum: { node: "22.14.0", npm: "11.5.1" },
      preflight: { mode: "node24-npm11-exact-canonical-tarball-dry-run" },
      publisherRuntime: CANONICAL_PUBLISHER_RUNTIME,
      registryPut: { evidence: "hosted-only" },
    })
    expect(() => parseCanonicalPackagePublisherPlan({ ...plan, unexpected: true })).toThrow("canonical-package-publisher-plan")
  })

  it("parses the exact canonical-tar CLI shape before rejecting this non-Node24 test runtime", () => {
    const fixture = createFixture()

    try {
      const result = spawnSync(process.execPath, [
        "scripts/canonical-package-publisher.mjs",
        "--canonical-directory", fixture.canonicalDirectory,
        "--dist-tag", "staging",
        "--package-facts", fixture.packageFactsPath,
        "--publisher-runtime-directory", fixture.publisherRuntimeDirectory,
        "--tarball", fixture.tarballPath,
        "--dry-run", "true",
      ], {
        cwd: process.cwd(),
        encoding: "utf8",
        env: { ...fixture.publisherEnvironment, PATH: process.env.PATH ?? "" },
      })

      expect(result.status).toBe(1)
      expect(result.stdout).toBe("")
      expect(result.stderr).toBe("canonical-package-publisher-runtime\n")
    } finally {
      fixture.cleanup()
    }
  })
})

function createFixture() {
  const root = mkdtempSync(join(tmpdir(), "persona-canonical-package-publisher-"))
  const canonicalDirectory = join(root, "canonical")
  const publisherRuntimeDirectory = join(root, "publisher")
  const packageFactsPath = join(root, "facts.json")
  const tarballPath = join(canonicalDirectory, "persona-harness-0.8.0-beta.18.tgz")
  mkdirSync(canonicalDirectory, { mode: 0o700 })
  mkdirSync(join(canonicalDirectory, "environment"), { mode: 0o700 })
  mkdirSync(join(canonicalDirectory, "environment", "npm-home"), { mode: 0o700 })
  mkdirSync(publisherRuntimeDirectory, { mode: 0o700 })
  const npmHome = join(publisherRuntimeDirectory, "npm-home")
  const npmCache = join(publisherRuntimeDirectory, "npm-cache")
  const npmUserConfig = join(publisherRuntimeDirectory, "npm-userconfig")
  const npmGlobalConfig = join(publisherRuntimeDirectory, "npm-globalconfig")
  mkdirSync(npmHome, { mode: 0o700 })
  mkdirSync(npmCache, { mode: 0o700 })
  writeFileSync(npmUserConfig, "", { flag: "wx", mode: 0o600 })
  writeFileSync(npmGlobalConfig, "", { flag: "wx", mode: 0o600 })

  const raw = createTarball([
    ["package/package.json", `${JSON.stringify({ ...PACKAGE, bin: { ph: "bin/ph.mjs" } })}\n`, 0o644],
    ["package/bin/ph.mjs", "#!/usr/bin/env node\n", 0o755],
    ["package/lib/value.mjs", "export const value = 1\n", 0o644],
  ])
  const canonical = canonicalizePackageTarball(raw)
  const facts = canonicalPackageFacts(canonical.bytes, PACKAGE)
  writeFileSync(tarballPath, canonical.bytes, { flag: "wx", mode: 0o600 })
  writeFileSync(packageFactsPath, `${JSON.stringify(facts)}\n`, { flag: "wx", mode: 0o600 })

  return {
    canonicalDirectory,
    cleanup: () => rmSync(root, { force: true, recursive: true }),
    packageFactsPath,
    publisherEnvironment: {
      HOME: npmHome,
      NPM_CONFIG_CACHE: npmCache,
      NPM_CONFIG_GLOBALCONFIG: npmGlobalConfig,
      NPM_CONFIG_USERCONFIG: npmUserConfig,
    },
    publisherRuntimeDirectory,
    root,
    tarballPath,
  }
}

function createTarball(entries: ReadonlyArray<readonly [string, string, number]>): Buffer {
  const blocks: Buffer[] = []
  for (const [path, content, mode] of entries) {
    const body = Buffer.from(content, "utf8")
    const header = Buffer.alloc(512)
    writeText(header, 0, 100, path)
    writeOctal(header, 100, 8, mode)
    writeOctal(header, 108, 8, 0)
    writeOctal(header, 116, 8, 0)
    writeOctal(header, 124, 12, body.byteLength)
    writeOctal(header, 136, 12, 0)
    header.fill(0x20, 148, 156)
    header[156] = 48
    writeText(header, 257, 6, "ustar\0")
    writeText(header, 263, 2, "00")
    writeChecksum(header)
    blocks.push(header, body, Buffer.alloc((512 - (body.byteLength % 512)) % 512))
  }
  return gzipSync(Buffer.concat([...blocks, Buffer.alloc(1024)]))
}

function writeChecksum(header: Buffer): void {
  const sum = header.reduce((total, byte) => total + byte, 0)
  writeText(header, 148, 8, `${sum.toString(8).padStart(6, "0")}\0 `)
}

function writeOctal(target: Buffer, offset: number, length: number, value: number): void {
  writeText(target, offset, length, `${value.toString(8).padStart(length - 1, "0")}\0`)
}

function writeText(target: Buffer, offset: number, length: number, value: string): void {
  const bytes = Buffer.from(value, "utf8")
  if (bytes.byteLength > length) throw new TypeError("test tar field overflow")
  bytes.copy(target, offset)
}
