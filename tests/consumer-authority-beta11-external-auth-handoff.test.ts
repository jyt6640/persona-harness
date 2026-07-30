import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

const manifestPath = join(process.cwd(), "docs", "current", "release", "consumer-authority-beta11-acceptance.json")

describe("consumer authority beta.11 External credential handoff", () => {
  it("requires a host-derived ephemeral GitHub credential without a product fallback", () => {
    const manifest = readManifest()
    const handoff = record(manifest["prearmedExternalHandoff"])
    const prepare = record(handoff["prepare"])

    expect(manifest["schemaVersion"]).toBe("consumer-authority-beta11-acceptance.1")
    expect(manifest["package"]).toEqual({ channel: "staging", scope: "staging-only", version: "0.8.0-beta.11" })
    expect(prepare["credentialPrearm"]).toEqual({
      acquisition: "host-gh-auth-token-read-once",
      consumerHome: "isolated-ephemeral",
      environment: "GH_TOKEN",
      logging: "forbidden",
      persistence: "forbidden",
      productFallback: "forbidden",
      scope: "read-only-github-actions-artifact-and-run-discovery",
    })
  })

  it("keeps beta.10's credential-less observer result historical and non-authoritative", () => {
    const manifest = readManifest()
    const historical = record(manifest["beta10HistoricalExternal"])

    expect(historical).toMatchObject({
      outcome: "independent-crypto-passed-authority-fetch-not-attempted-without-github-read-credential",
      reusableForBeta11: false,
      version: "0.8.0-beta.10",
    })
  })
})

function readManifest(): Record<string, unknown> {
  return record(JSON.parse(readFileSync(manifestPath, "utf8")))
}

function record(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("expected record")
  }
  return value as Record<string, unknown>
}
