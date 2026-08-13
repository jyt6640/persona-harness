import { gzipSync } from "node:zlib"
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { delimiter, dirname, join } from "node:path"

import { describe, expect, it } from "vitest"

import {
  CANONICAL_PACKAGE_PACKER_PROFILE,
  CanonicalPackagePackerError,
  assertCanonicalPackagePackerProfile,
  canonicalNpmInvocation,
  canonicalPackageFacts,
  classifyCanonicalPackagePackerError,
  createCanonicalNpmEnvironment,
  resolveCanonicalNpmCli,
} from "../scripts/canonical-package-packer.mjs"
import { PackageContentIdentityError } from "../scripts/package-content-identity.mjs"

describe("canonical package packer", () => {
  it("pins package metadata and lock metadata to the canonical npm runtime", () => {
    const packageRoot = process.cwd()
    const packageJson = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8"))
    const packageLock = JSON.parse(readFileSync(join(packageRoot, "package-lock.json"), "utf8"))

    expect(packageJson.packageManager).toBe("npm@10.8.2")
    expect(packageLock.packages[""]?.packageManager).toBe("npm@10.8.2")
  })

  it("locks text checkout bytes to LF before canonical pack construction", () => {
    const attributes = readFileSync(join(process.cwd(), ".gitattributes"), "utf8")

    expect(attributes).toContain("* text=auto eol=lf")
    expect(attributes).not.toContain("\r\n")
  })

  it("isolates npm and Git configuration from the ambient host", () => {
    const parent = mkdtempSync(join(tmpdir(), "persona-canonical-packer-"))
    const workspace = join(parent, "environment")
    const nodeExecutable = writeFakeNodeDistribution(join(parent, "node-runtime"))

    try {
      const environment = createCanonicalNpmEnvironment(process.cwd(), workspace, nodeExecutable)

      expect(environment).toMatchObject({
        GIT_CONFIG_NOSYSTEM: "1",
        GIT_TERMINAL_PROMPT: "0",
        LANG: "C",
        LC_ALL: "C",
        NPM_CONFIG_UMASK: "0022",
        TZ: "UTC",
      })
      expect(environment.GIT_CONFIG_GLOBAL).toBe(join(workspace, "git-globalconfig"))
      expect(readFileSync(environment.GIT_CONFIG_GLOBAL, "utf8")).toBe("")
      expect(environment.HOME).toBe(join(workspace, "npm-home"))
      expect(environment.NPM_CONFIG_CACHE).toBe(join(workspace, "npm-cache"))
    } finally {
      rmSync(parent, { force: true, recursive: true })
    }
  })

  it("binds npm execution to the selected Node distribution instead of PATH", () => {
    const root = mkdtempSync(join(tmpdir(), "persona-canonical-npm-runtime-"))
    const nodeExecutable = join(root, "bin", "node")
    const npmCliPath = join(root, "lib", "node_modules", "npm", "bin", "npm-cli.js")
    const conflictingBin = join(root, "conflicting-bin")
    const previousPath = process.env.PATH

    try {
      mkdirSync(join(root, "bin"), { recursive: true })
      mkdirSync(join(root, "lib", "node_modules", "npm", "bin"), { recursive: true })
      mkdirSync(conflictingBin)
      writeFileSync(nodeExecutable, "selected-node\n", { mode: 0o755 })
      writeFileSync(npmCliPath, "selected-npm\n", { mode: 0o755 })
      writeFileSync(join(root, "lib", "node_modules", "npm", "package.json"), JSON.stringify({ version: "10.8.2" }))
      writeFileSync(join(conflictingBin, "npm"), "conflicting-npm\n", { mode: 0o755 })
      chmodSync(nodeExecutable, 0o755)
      chmodSync(npmCliPath, 0o755)
      process.env.PATH = conflictingBin

      expect(resolveCanonicalNpmCli(nodeExecutable)).toEqual({ nodeExecutable: realpathSync(nodeExecutable), npmCliPath: realpathSync(npmCliPath) })
      expect(canonicalNpmInvocation(["pack"], nodeExecutable)).toEqual([realpathSync(nodeExecutable), realpathSync(npmCliPath), "pack"])
      const environment = createCanonicalNpmEnvironment(process.cwd(), join(root, "environment"), nodeExecutable)
      expect(environment.PATH).toBe(`${dirname(realpathSync(nodeExecutable))}${delimiter}${conflictingBin}`)
    } finally {
      process.env.PATH = previousPath
      rmSync(root, { force: true, recursive: true })
    }
  })

  it("fails closed when the selected Node executable is missing", () => {
    const root = mkdtempSync(join(tmpdir(), "persona-canonical-npm-runtime-missing-"))

    try {
      expect(() => createCanonicalNpmEnvironment(
        process.cwd(),
        join(root, "environment"),
        join(root, "missing", "node"),
      )).toThrow("canonical-package-packer-runtime")
    } finally {
      rmSync(root, { force: true, recursive: true })
    }
  })

  it.each([
    [new CanonicalPackagePackerError("canonical-package-packer-pack"), "canonical-package-packer-pack"],
    [new PackageContentIdentityError("package-content-identity-archive"), "canonical-package-packer-content"],
    [new Error("unexpected raw path or package content"), "canonical-package-packer-internal"],
  ])("classifies terminal failures without reflecting error details", (error, expected) => {
    expect(classifyCanonicalPackagePackerError(error)).toBe(expected)
    expect(classifyCanonicalPackagePackerError(error)).not.toContain("raw")
    expect(classifyCanonicalPackagePackerError(error)).not.toContain("path")
  })

  it.each([
    ["missing bundled npm", (npmCliPath: string) => rmSync(npmCliPath, { force: true })],
    ["mismatched bundled npm", (npmCliPath: string) => writeFileSync(join(dirname(dirname(npmCliPath)), "package.json"), JSON.stringify({ version: "10.9.8" }))],
  ])("fails closed for a %s", (_label, invalidate) => {
    const root = mkdtempSync(join(tmpdir(), "persona-canonical-npm-runtime-invalid-"))
    const nodeExecutable = join(root, "bin", "node")
    const npmCliPath = join(root, "lib", "node_modules", "npm", "bin", "npm-cli.js")

    try {
      mkdirSync(join(root, "bin"), { recursive: true })
      mkdirSync(join(root, "lib", "node_modules", "npm", "bin"), { recursive: true })
      writeFileSync(nodeExecutable, "selected-node\n", { mode: 0o755 })
      writeFileSync(npmCliPath, "selected-npm\n", { mode: 0o755 })
      writeFileSync(join(root, "lib", "node_modules", "npm", "package.json"), JSON.stringify({ version: "10.8.2" }))
      chmodSync(nodeExecutable, 0o755)
      chmodSync(npmCliPath, 0o755)
      invalidate(npmCliPath)

      expect(() => resolveCanonicalNpmCli(nodeExecutable)).toThrow("canonical-package-packer-runtime")
    } finally {
      rmSync(root, { force: true, recursive: true })
    }
  })

  it("binds a canonical tar and portable content identity to the pinned profile", () => {
    // Given
    const tarball = createTarball([
      ["package/package.json", "{\"name\":\"persona-harness\",\"version\":\"0.8.0-beta.17\",\"bin\":{\"ph\":\"bin/ph.mjs\"}}\n", 0o600],
      ["package/bin/ph.mjs", "#!/usr/bin/env node\n", 0o700],
      ["package/lib/value.mjs", "export const value = 1\n", 0o600],
    ])

    // When
    const facts = canonicalPackageFacts(tarball, { name: "persona-harness", version: "0.8.0-beta.17" })

    // Then
    expect(facts).toMatchObject({
      package: { name: "persona-harness", version: "0.8.0-beta.17" },
      schemaVersion: "canonical-package-packer.1",
      tarball: { contentIdentity: { modeCounts: { "0644": 2, "0755": 1 } } },
      toolchain: CANONICAL_PACKAGE_PACKER_PROFILE,
    })
    expect(JSON.stringify(facts)).not.toContain("package/")
    expect(JSON.stringify(facts)).not.toContain("export const value")
  })

  it.each([
    ["wrong node", { ...CANONICAL_PACKAGE_PACKER_PROFILE, node: "22.22.3" }],
    ["wrong npm", { ...CANONICAL_PACKAGE_PACKER_PROFILE, npm: "10.9.0" }],
    ["wrong locale", { ...CANONICAL_PACKAGE_PACKER_PROFILE, locale: "ko_KR.UTF-8" }],
    ["wrong timezone", { ...CANONICAL_PACKAGE_PACKER_PROFILE, timezone: "Asia/Seoul" }],
    ["wrong umask", { ...CANONICAL_PACKAGE_PACKER_PROFILE, umask: "0002" }],
  ])("blocks a %s profile before packing", (_label, profile) => {
    expect(() => assertCanonicalPackagePackerProfile(profile)).toThrow(CanonicalPackagePackerError)
    expect(() => assertCanonicalPackagePackerProfile(profile)).toThrow("canonical-package-packer-profile")
  })
})

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

function writeFakeNodeDistribution(root: string, npmVersion = "10.8.2"): string {
  const nodeExecutable = join(root, "bin", "node")
  const npmCliPath = join(root, "lib", "node_modules", "npm", "bin", "npm-cli.js")
  mkdirSync(join(root, "bin"), { recursive: true })
  mkdirSync(join(root, "lib", "node_modules", "npm", "bin"), { recursive: true })
  writeFileSync(nodeExecutable, "selected-node\n", { mode: 0o755 })
  writeFileSync(npmCliPath, "selected-npm\n", { mode: 0o755 })
  writeFileSync(join(root, "lib", "node_modules", "npm", "package.json"), JSON.stringify({ version: npmVersion }))
  chmodSync(nodeExecutable, 0o755)
  chmodSync(npmCliPath, 0o755)
  return nodeExecutable
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
