import { createHash } from "node:crypto"
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { basename, join, resolve } from "node:path"
import { spawnSync } from "node:child_process"

import { afterEach, describe, expect, it } from "vitest"

import { readPackageContentIdentity } from "../scripts/package-content-identity.mjs"
import {
  CONTEXT_COMPATIBILITY_MANIFEST_SCHEMA_VERSION,
  runContextCompatibilityManifest,
} from "../scripts/context-compatibility-manifest-runner.mjs"
import { withPackagePackLock } from "./package-pack-lock.js"

const repositoryRoot = resolve(process.cwd())
const temporaryRoots: string[] = []
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm"

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    rmSync(root, { force: true, recursive: true })
  }
})

describe("Context compatibility manifest runner", () => {
  it("validates one fresh installed tarball through a version-neutral Context contract", () => {
    const subject = createFreshInstalledSubject()
    const tarballBytes = readFileSync(subject.archivePath)
    const packageJson = readJson(join(subject.installedPackageRoot, "package.json"))
    const packageVersion = stringField(packageJson, "version")
    const packageName = stringField(packageJson, "name")

    const manifest = manifestFor({
      contentIdentity: readPackageContentIdentity(tarballBytes),
      packageName,
      packageVersion,
      tarballSha256: sha256(tarballBytes),
    })

    const result = runContextCompatibilityManifest(manifest, {
      archivePath: subject.archivePath,
      installedPackageRoot: subject.installedPackageRoot,
      sourceRoot: repositoryRoot,
      temporaryRoot: subject.temporaryRoot,
    })

    expect(result).toEqual({
      code: "context-compatibility-valid",
      schemaVersion: "persona-context-compatibility-result.1",
      state: "PASS",
    })
    expect(readdirSync(subject.temporaryRoot).some((entry) => entry.startsWith("context-compatibility-runner-"))).toBe(false)

    const sourceFallback = runContextCompatibilityManifest(manifest, {
      archivePath: subject.archivePath,
      installedPackageRoot: repositoryRoot,
      sourceRoot: repositoryRoot,
      temporaryRoot: subject.temporaryRoot,
    })

    expect(sourceFallback).toEqual({
      code: "context-compatibility-source-fallback-detected",
      schemaVersion: "persona-context-compatibility-result.1",
      state: "BLOCKED",
    })
  }, 180_000)

  it("rejects an installed package whose executable path resolves into source", () => {
    const subject = createFreshInstalledSubject()
    const tarballBytes = readFileSync(subject.archivePath)
    const packageJson = readJson(join(subject.installedPackageRoot, "package.json"))
    const manifest = manifestFor({
      contentIdentity: readPackageContentIdentity(tarballBytes),
      packageName: stringField(packageJson, "name"),
      packageVersion: stringField(packageJson, "version"),
      tarballSha256: sha256(tarballBytes),
    })

    const sourceRoot = join(subject.temporaryRoot, "source")
    const sourceDist = join(sourceRoot, "dist")
    mkdirSync(join(sourceDist, "cli"), { recursive: true })
    mkdirSync(join(sourceDist, "context-core"), { recursive: true })
    for (const path of [
      "cli/context-command.js",
      "cli/index.js",
      "context-core/context-envelope-builder.js",
      "context-core/index.js",
    ]) {
      writeFileSync(join(sourceDist, path), "export {}\n", { mode: 0o600 })
    }

    rmSync(join(subject.installedPackageRoot, "dist"), { force: true, recursive: true })
    symlinkSync(sourceDist, join(subject.installedPackageRoot, "dist"), "dir")

    expect(runContextCompatibilityManifest(manifest, {
      archivePath: subject.archivePath,
      installedPackageRoot: subject.installedPackageRoot,
      sourceRoot,
      temporaryRoot: subject.temporaryRoot,
    })).toEqual({
      code: "context-compatibility-source-fallback-detected",
      schemaVersion: "persona-context-compatibility-result.1",
      state: "BLOCKED",
    })
  }, 180_000)
})

function manifestFor({
  contentIdentity,
  packageName = "persona-harness",
  packageVersion,
  tarballSha256,
}: {
  readonly contentIdentity: unknown
  readonly packageName?: string
  readonly packageVersion: string
  readonly tarballSha256: string
}) {
  return {
    package: {
      contentIdentity,
      name: packageName,
      tarballSha256,
      version: packageVersion,
    },
    requiredPackagePaths: [
      "dist/cli/context-command.js",
      "dist/cli/index.js",
      "dist/context-core/context-envelope-builder.js",
      "dist/context-core/index.js",
    ],
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

function createFreshInstalledSubject(): {
  readonly archivePath: string
  readonly installedPackageRoot: string
  readonly temporaryRoot: string
} {
  const temporaryRoot = createTemporaryRoot()
  const pack = withPackagePackLock(() => run(
    npmCommand,
    ["pack", "--json", "--pack-destination", temporaryRoot],
    repositoryRoot,
    temporaryRoot,
  ))
  const tarballName = packedTarballName(pack.stdout)
  const archivePath = join(temporaryRoot, tarballName)
  const consumerRoot = join(temporaryRoot, "consumer")
  mkdirSync(consumerRoot)
  writeFileSync(
    join(consumerRoot, "package.json"),
    `${JSON.stringify({ name: "context-manifest-consumer", private: true, type: "module" }, null, 2)}\n`,
  )
  run(
    npmCommand,
    ["install", "--ignore-scripts", "--no-audit", "--no-fund", "--no-package-lock", archivePath],
    consumerRoot,
    temporaryRoot,
  )

  return {
    archivePath,
    installedPackageRoot: join(consumerRoot, "node_modules", "persona-harness"),
    temporaryRoot,
  }
}

function createTemporaryRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "persona-context-compatibility-"))
  temporaryRoots.push(root)
  return root
}

function run(command: string, args: readonly string[], cwd: string, temporaryRoot: string): { readonly stdout: string } {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    env: {
      ...process.env,
      APPDATA: join(temporaryRoot, "appdata"),
      HOME: join(temporaryRoot, "home"),
      PH_HOME: join(temporaryRoot, "persona-state"),
      USERPROFILE: join(temporaryRoot, "home"),
      XDG_CONFIG_HOME: join(temporaryRoot, "xdg-config"),
      npm_config_audit: "false",
      npm_config_cache: join(temporaryRoot, "npm-cache"),
      npm_config_fund: "false",
    },
    maxBuffer: 16 * 1024 * 1024,
    timeout: 120_000,
  })
  if (result.error !== undefined || result.status !== 0) {
    throw new Error(`command failed: ${command}`)
  }
  return { stdout: result.stdout }
}

function packedTarballName(stdout: string): string {
  const parsed: unknown = JSON.parse(stdout)
  if (!Array.isArray(parsed) || parsed.length !== 1 || !isRecord(parsed[0]) || typeof parsed[0].filename !== "string") {
    throw new TypeError("npm pack output is invalid")
  }
  const filename = parsed[0].filename
  if (basename(filename) !== filename || !filename.endsWith(".tgz")) throw new TypeError("npm pack filename is invalid")
  return filename
}

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex")
}

function readJson(path: string): Record<string, unknown> {
  const parsed: unknown = JSON.parse(readFileSync(path, "utf8"))
  if (!isRecord(parsed)) throw new TypeError("expected object")
  return parsed
}

function stringField(value: Record<string, unknown>, field: string): string {
  const candidate = value[field]
  if (typeof candidate !== "string" || candidate.length === 0) throw new TypeError(`expected ${field}`)
  return candidate
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
