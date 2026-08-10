import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { spawnSync } from "node:child_process"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import {
  V083AcceptanceManifestError,
  canonicalV083AcceptanceManifest,
  parseV083AcceptanceManifest,
  readV083AcceptanceManifest,
} from "../scripts/consumer-authority-v083-acceptance-schema.mjs"
import {
  parseV082AcceptanceManifest,
} from "../scripts/consumer-authority-v082-acceptance-schema.mjs"

const repositoryRoot = process.cwd()

describe("consumer authority 0.8.3 acceptance schema", () => {
  it("binds the current package and lock to a new strict 0.8.3 record while preserving v082 history", () => {
    const manifest = readV083AcceptanceManifest(repositoryRoot)
    const packageLock = JSON.parse(readFileSync(join(repositoryRoot, "package-lock.json"), "utf8"))
    const v082 = parseV082AcceptanceManifest(
      JSON.parse(readFileSync(join(repositoryRoot, "docs", "current", "release", "consumer-authority-v082-acceptance.json"), "utf8")),
      "0.8.2",
    )

    expect(manifest.package).toMatchObject({ scope: "source-candidate", version: "0.8.3" })
    expect(packageLock).toMatchObject({ version: manifest.package.version })
    expect(packageLock.packages[""]).toMatchObject({ version: manifest.package.version })
    expect(manifest.v082HistoricalRelease).toMatchObject({ reusableForV083: false, version: "0.8.2" })
    expect(v082.package).toMatchObject({ channel: "latest", scope: "ga-approved", version: "0.8.2" })
  })

  it("rejects neighboring versions and records that attempt to reuse v082 as current", () => {
    const fixture = canonicalV083AcceptanceManifest()
    const packageRecord = fixture.package as Record<string, unknown>
    packageRecord.version = "0.8.2"

    expect(() => parseV083AcceptanceManifest(fixture, "0.8.3")).toThrow(V083AcceptanceManifestError)
    expect(() => parseV083AcceptanceManifest(canonicalV083AcceptanceManifest(), "0.8.2")).toThrow(V083AcceptanceManifestError)
    expect(() => parseV082AcceptanceManifest(canonicalV083AcceptanceManifest(), "0.8.3")).toThrow()
  })

  it("routes both direct current preflights through v083 without changing their bounded behavior", () => {
    const root = mkdtempSync(join(tmpdir(), "persona-v083-preflight-"))
    const ghPath = join(root, "gh")
    try {
      writeFileSync(ghPath, [
        `#!${process.execPath}`,
        "if (process.argv[2] === '--version') {",
        "  process.stdout.write('gh version 2.96.0 (fixture)\\n')",
        "  process.exit(0)",
        "}",
        "process.exit(process.argv.at(-1) === '--help' ? 0 : 1)",
        "",
      ].join("\n"))
      chmodSync(ghPath, 0o700)

      const attestation = spawnSync(
        process.execPath,
        ["scripts/preflight-consumer-authority-external-attestation.mjs", "--json", "--observer-gh", ghPath],
        { cwd: repositoryRoot, encoding: "utf8", env: { HOME: root } },
      )
      const transport = spawnSync(
        process.execPath,
        ["scripts/preflight-consumer-authority-external-artifact-transport.mjs", "--json"],
        { cwd: repositoryRoot, encoding: "utf8", env: { HOME: root } },
      )

      expect(attestation.status).toBe(0)
      expect(JSON.parse(attestation.stdout)).toMatchObject({ code: "gh-command-parser-accepted", state: "ready" })
      expect(transport.status).toBe(0)
      expect(JSON.parse(transport.stdout)).toMatchObject({ code: "external-artifact-transport-parser-accepted", state: "ready" })

      for (const script of [
        "preflight-consumer-authority-external-attestation.mjs",
        "preflight-consumer-authority-external-artifact-transport.mjs",
      ]) {
        const source = readFileSync(join(repositoryRoot, "scripts", script), "utf8")
        expect(source).toContain('from "./consumer-authority-v083-acceptance-schema.mjs"')
        expect(source).toContain("readV083AcceptanceManifest(packageRoot)")
        expect(source).not.toContain("readV082AcceptanceManifest(packageRoot)")
      }
    } finally {
      rmSync(root, { force: true, recursive: true })
    }
  })
})
