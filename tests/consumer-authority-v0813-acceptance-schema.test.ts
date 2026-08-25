import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import {
  V0813AcceptanceManifestError,
  canonicalV0813AcceptanceManifest,
  parseV0813AcceptanceManifest,
} from "../scripts/consumer-authority-v0813-acceptance-schema.mjs"
import { parseV0810AcceptanceManifest } from "../scripts/consumer-authority-v0810-acceptance-schema.mjs"
import { parseV0811AcceptanceManifest } from "../scripts/consumer-authority-v0811-acceptance-schema.mjs"
import { parseV0812AcceptanceManifest } from "../scripts/consumer-authority-v0812-acceptance-schema.mjs"

const repositoryRoot = process.cwd()

describe("historical consumer authority 0.8.13 acceptance schema", () => {
  it("retains the strict 0.8.13 record while the current package advances", () => {
    const manifest = parseV0813AcceptanceManifest(
      JSON.parse(readFileSync(join(repositoryRoot, "docs", "current", "release", "consumer-authority-v0813-acceptance.json"), "utf8")),
      "0.8.13",
    )
    const v0810 = parseV0810AcceptanceManifest(
      JSON.parse(readFileSync(join(repositoryRoot, "docs", "current", "release", "consumer-authority-v0810-acceptance.json"), "utf8")),
      "0.8.10",
    )
    const v0812 = parseV0812AcceptanceManifest(
      JSON.parse(readFileSync(join(repositoryRoot, "docs", "current", "release", "consumer-authority-v0812-acceptance.json"), "utf8")),
      "0.8.12",
    )
    const v0811 = parseV0811AcceptanceManifest(
      JSON.parse(readFileSync(join(repositoryRoot, "docs", "current", "release", "consumer-authority-v0811-acceptance.json"), "utf8")),
      "0.8.11",
    )

    expect(manifest.package).toMatchObject({ channel: "unpublished", scope: "source-candidate", version: "0.8.13" })
    expect(manifest.v0810HistoricalRelease).toMatchObject({ reusableForV0813: false, version: "0.8.10" })
    expect(v0810.package).toMatchObject({ channel: "unpublished", scope: "source-candidate", version: "0.8.10" })
    expect(manifest.v0811HistoricalRelease).toMatchObject({ reusableForV0813: false, version: "0.8.11" })
    expect(manifest.v0812HistoricalRelease).toMatchObject({ reusableForV0813: false, version: "0.8.12" })
    expect(manifest.v0813HistoricalRelease).toBeUndefined()
    expect(v0812.package).toMatchObject({ channel: "unpublished", scope: "source-candidate", version: "0.8.12" })
    expect(v0811.package).toMatchObject({ channel: "unpublished", scope: "source-candidate", version: "0.8.11" })
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
  })

  it("rejects neighboring versions and reused historical records", () => {
    expect(() => parseV0813AcceptanceManifest(canonicalV0813AcceptanceManifest(), "0.8.10")).toThrow(V0813AcceptanceManifestError)
    expect(() => parseV0813AcceptanceManifest(canonicalV0813AcceptanceManifest(), "0.8.12")).toThrow(V0813AcceptanceManifestError)
    expect(() => parseV0813AcceptanceManifest(canonicalV0813AcceptanceManifest(), "0.8.14")).toThrow(V0813AcceptanceManifestError)
    expect(() => parseV0811AcceptanceManifest(canonicalV0813AcceptanceManifest(), "0.8.13")).toThrow()
    expect(() => parseV0812AcceptanceManifest(canonicalV0813AcceptanceManifest(), "0.8.13")).toThrow()
    expect(() => parseV0810AcceptanceManifest(canonicalV0813AcceptanceManifest(), "0.8.13")).toThrow()
  })

  it("routes current preflights through v0818 and off the historical v0813 record", () => {
    for (const script of [
      "preflight-consumer-authority-external-attestation.mjs",
      "preflight-consumer-authority-external-artifact-transport.mjs",
    ]) {
      const source = readFileSync(join(repositoryRoot, "scripts", script), "utf8")
      expect(source).toContain('from "./consumer-authority-v0832-acceptance-schema.mjs"')
      expect(source).toContain("readV0832AcceptanceManifest(packageRoot)")
      expect(source).not.toContain('from "./consumer-authority-v0813-acceptance-schema.mjs"')
      expect(source).not.toContain("readV0813AcceptanceManifest(packageRoot)")
      expect(source).not.toContain('from "./consumer-authority-v0810-acceptance-schema.mjs"')
      expect(source).not.toContain("readV0810AcceptanceManifest(packageRoot)")
    }
  })
})
