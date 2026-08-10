import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { assertWindowsNpmBinLinkSurface } from "../scripts/windows-npm-install-surface.mjs"

const temporaryDirectories: string[] = []

afterEach(() => {
  while (temporaryDirectories.length > 0) {
    const directory = temporaryDirectories.pop()
    if (directory !== undefined) rmSync(directory, { force: true, recursive: true })
  }
})

describe("Windows npm install surface", () => {
  it("uses npm's Windows bin-link implementation for every installed declared bin", () => {
    // Given: a minimal already-installed consumer tree, not repository source.
    const consumerRoot = mkdtempSync(join(tmpdir(), "persona-windows-npm-install-"))
    temporaryDirectories.push(consumerRoot)
    writeConsumerPackage(consumerRoot)
    writeInstalledBin(consumerRoot, "persona-harness", "ph", "dist/cli/index.js")
    writeInstalledBin(consumerRoot, "semver", "semver", "bin/semver.js")

    // When
    assertWindowsNpmBinLinkSurface(consumerRoot)

    // Then: cmd-shim's Windows-facing files exist for every declared command.
    for (const name of ["ph", "semver"]) {
      expect(existsSync(join(consumerRoot, "node_modules", ".bin", name))).toBe(true)
      expect(existsSync(join(consumerRoot, "node_modules", ".bin", `${name}.cmd`))).toBe(true)
      expect(existsSync(join(consumerRoot, "node_modules", ".bin", `${name}.ps1`))).toBe(true)
    }
  })

  it("fails closed when an installed bin target is absent", () => {
    // Given
    const consumerRoot = mkdtempSync(join(tmpdir(), "persona-windows-npm-install-"))
    temporaryDirectories.push(consumerRoot)
    writeConsumerPackage(consumerRoot)
    mkdirSync(join(consumerRoot, "node_modules", "persona-harness"), { recursive: true })
    writeFileSync(
      join(consumerRoot, "node_modules", "persona-harness", "package.json"),
      `${JSON.stringify({ bin: { ph: "dist/cli/index.js" }, name: "persona-harness", version: "0.0.0" })}\n`,
    )

    // Then
    expect(() => assertWindowsNpmBinLinkSurface(consumerRoot)).toThrow("windows-npm-install-bin-link")
  })

  it("does not use ambient PATH to locate npm's Windows bin-link implementation", () => {
    // Given
    const consumerRoot = mkdtempSync(join(tmpdir(), "persona-windows-npm-install-"))
    temporaryDirectories.push(consumerRoot)
    writeConsumerPackage(consumerRoot)
    writeInstalledBin(consumerRoot, "persona-harness", "ph", "dist/cli/index.js")
    writeInstalledBin(consumerRoot, "semver", "semver", "bin/semver.js")
    const originalPath = process.env.PATH
    process.env.PATH = ""

    try {
      // Then
      expect(() => assertWindowsNpmBinLinkSurface(consumerRoot)).not.toThrow()
    } finally {
      process.env.PATH = originalPath
    }
  })
})

function writeConsumerPackage(consumerRoot: string): void {
  mkdirSync(join(consumerRoot, "node_modules"), { recursive: true })
  writeFileSync(
    join(consumerRoot, "package-lock.json"),
    `${JSON.stringify({
      lockfileVersion: 3,
      packages: {
        "": { private: true },
        "node_modules/persona-harness": { bin: { ph: "dist/cli/index.js" } },
        "node_modules/semver": { bin: { semver: "bin/semver.js" } },
      },
    })}\n`,
  )
}

function writeInstalledBin(consumerRoot: string, packageName: string, binName: string, target: string): void {
  const packageRoot = join(consumerRoot, "node_modules", packageName)
  const targetPath = join(packageRoot, ...target.split("/"))
  mkdirSync(dirname(targetPath), { recursive: true })
  writeFileSync(
    join(packageRoot, "package.json"),
    `${JSON.stringify({ bin: { [binName]: target }, name: packageName, version: "0.0.0" })}\n`,
  )
  writeFileSync(targetPath, "#!/usr/bin/env node\n")
}
