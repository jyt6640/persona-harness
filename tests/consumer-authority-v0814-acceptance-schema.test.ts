import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import {
  V0814AcceptanceManifestError,
  canonicalV0814AcceptanceManifest,
  parseV0814AcceptanceManifest,
  readV0814AcceptanceManifest,
} from "../scripts/consumer-authority-v0814-acceptance-schema.mjs"
import { parseV0810AcceptanceManifest } from "../scripts/consumer-authority-v0810-acceptance-schema.mjs"
import { parseV0811AcceptanceManifest } from "../scripts/consumer-authority-v0811-acceptance-schema.mjs"
import { parseV0812AcceptanceManifest } from "../scripts/consumer-authority-v0812-acceptance-schema.mjs"
import { parseV0813AcceptanceManifest } from "../scripts/consumer-authority-v0813-acceptance-schema.mjs"

const repositoryRoot = process.cwd()

describe("consumer authority 0.8.14 acceptance schema", () => {
  it("binds the historical package root to 0.8.14 while retaining immutable history", () => {
    const historicalPackageRoot = createHistoricalPackageRoot()
    try {
      const manifest = readV0814AcceptanceManifest(historicalPackageRoot)
      const v0810 = parseV0810AcceptanceManifest(
        JSON.parse(readFileSync(join(repositoryRoot, "docs", "current", "release", "consumer-authority-v0810-acceptance.json"), "utf8")),
        "0.8.10",
      )
      const v0811 = parseV0811AcceptanceManifest(
        JSON.parse(readFileSync(join(repositoryRoot, "docs", "current", "release", "consumer-authority-v0811-acceptance.json"), "utf8")),
        "0.8.11",
      )
      const v0812 = parseV0812AcceptanceManifest(
        JSON.parse(readFileSync(join(repositoryRoot, "docs", "current", "release", "consumer-authority-v0812-acceptance.json"), "utf8")),
        "0.8.12",
      )
      const v0813 = parseV0813AcceptanceManifest(
        JSON.parse(readFileSync(join(repositoryRoot, "docs", "current", "release", "consumer-authority-v0813-acceptance.json"), "utf8")),
        "0.8.13",
      )

      expect(manifest.package).toMatchObject({ channel: "unpublished", scope: "source-candidate", version: "0.8.14" })
      expect(manifest.v0813HistoricalRelease).toMatchObject({ reusableForV0814: false, version: "0.8.13" })
      expect(manifest.v0812HistoricalRelease).toMatchObject({ reusableForV0814: false, version: "0.8.12" })
      expect(manifest.v0811HistoricalRelease).toMatchObject({ reusableForV0814: false, version: "0.8.11" })
      expect(manifest.v0810HistoricalRelease).toMatchObject({ reusableForV0814: false, version: "0.8.10" })
      expect(v0810.package.version).toBe("0.8.10")
      expect(v0811.package.version).toBe("0.8.11")
      expect(v0812.package.version).toBe("0.8.12")
      expect(v0813.package.version).toBe("0.8.13")
      expect(manifest.authority.fetchSelection).toMatchObject({
        repositoryOnly: "blocked-before-enrollment-or-fetch",
        requiredTuple: ["artifactId", "runId", "sourceHead", "artifactDigest"],
      })
      expect(manifest.authority.fetchResult).toMatchObject({
        schemaVersion: "consumer-authority-fetch.4",
        sourceReason: ["head", "inputs", "identity", "status", "index", "content", "working-tree", "workspace", "unknown"],
        sourceReasonWhen: "present-only-with-bindingReason-source",
        nonSourceReasons: "existing-binding-reasons-omit-sourceReason",
      })
      expect(manifest.observerGhVersionProbe).toEqual({
        ceilingMs: 15_000,
        timeoutCode: "gh-command-version-timeout",
        unavailableCode: "gh-command-unavailable",
        unsupportedCode: "gh-command-version-unsupported",
        invalidCode: "gh-command-tool-invalid",
        selectorCode: "observer-gh-workflow-tool-timeout",
        stageCode: "observer-gh-tool-timeout",
        output: "fixed-code-only-no-process-output",
      })
    } finally {
      rmSync(historicalPackageRoot, { force: true, recursive: true })
    }
  })

  it("rejects neighboring versions and reused historical records", () => {
    expect(() => parseV0814AcceptanceManifest(canonicalV0814AcceptanceManifest(), "0.8.13")).toThrow(V0814AcceptanceManifestError)
    expect(() => parseV0814AcceptanceManifest(canonicalV0814AcceptanceManifest(), "0.8.15")).toThrow(V0814AcceptanceManifestError)
    expect(() => readV0814AcceptanceManifest(repositoryRoot)).toThrow(V0814AcceptanceManifestError)
    expect(() => parseV0813AcceptanceManifest(canonicalV0814AcceptanceManifest(), "0.8.14")).toThrow()
  })

  it("keeps current preflights off the historical v0814 record", () => {
    for (const script of [
      "preflight-consumer-authority-external-attestation.mjs",
      "preflight-consumer-authority-external-artifact-transport.mjs",
    ]) {
      const source = readFileSync(join(repositoryRoot, "scripts", script), "utf8")
      expect(source).toContain('from "./consumer-authority-v0821-acceptance-schema.mjs"')
      expect(source).toContain("readV0821AcceptanceManifest(packageRoot)")
      expect(source).not.toContain('from "./consumer-authority-v0814-acceptance-schema.mjs"')
      expect(source).not.toContain("readV0814AcceptanceManifest(packageRoot)")
    }
  })
})

function createHistoricalPackageRoot() {
  const packageRoot = mkdtempSync(join(tmpdir(), "persona-harness-v0814-history-"))
  const releaseRoot = join(packageRoot, "docs", "current", "release")
  mkdirSync(releaseRoot, { recursive: true })
  copyFileSync(
    join(repositoryRoot, "docs", "current", "release", "consumer-authority-v0814-acceptance.json"),
    join(releaseRoot, "consumer-authority-v0814-acceptance.json"),
  )
  writeFileSync(join(packageRoot, "package.json"), '{"version":"0.8.14"}\n', "utf8")
  return packageRoot
}
