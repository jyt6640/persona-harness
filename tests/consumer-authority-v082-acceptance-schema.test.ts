import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { spawnSync } from "node:child_process"

import { describe, expect, it } from "vitest"

import {
  V082AcceptanceManifestError,
  canonicalV082AcceptanceManifest,
  parseV082AcceptanceManifest,
  readV082AcceptanceManifest,
} from "../scripts/consumer-authority-v082-acceptance-schema.mjs"

const repositoryRoot = process.cwd()

describe("consumer authority 0.8.2 acceptance schema", () => {
  it("binds the current package and lock to the current strict acceptance record", () => {
    const manifest = readV082AcceptanceManifest(repositoryRoot)
    const packageLock = JSON.parse(readFileSync(join(repositoryRoot, "package-lock.json"), "utf8"))

    expect(manifest.package).toMatchObject({ scope: "source-candidate", version: "0.8.2" })
    expect(packageLock).toMatchObject({ version: manifest.package.version })
    expect(packageLock.packages[""]).toMatchObject({ version: manifest.package.version })
    expect(manifest.v081HistoricalRelease).toMatchObject({ reusableForV082: false, version: "0.8.1" })
  })

  it("rejects a neighboring package version and acceptance drift", () => {
    const fixture = canonicalV082AcceptanceManifest()
    const packageRecord = fixture.package as Record<string, unknown>
    packageRecord.version = "0.8.1"

    expect(() => parseV082AcceptanceManifest(fixture, "0.8.2")).toThrow(V082AcceptanceManifestError)
    expect(() => parseV082AcceptanceManifest(canonicalV082AcceptanceManifest(), "0.8.1")).toThrow(V082AcceptanceManifestError)
  })

  it("routes both direct current preflights through the current record and executes them", () => {
    const root = mkdtempSync(join(tmpdir(), "persona-v082-preflight-"))
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
        expect(source).toContain('from "./consumer-authority-v082-acceptance-schema.mjs"')
        expect(source).toContain("readV082AcceptanceManifest(packageRoot)")
        expect(source).not.toContain("readV081AcceptanceManifest(packageRoot)")
      }
    } finally {
      rmSync(root, { force: true, recursive: true })
    }
  })
})
