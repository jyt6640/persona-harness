import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

const manifestPath = join(process.cwd(), "docs", "current", "release", "consumer-authority-beta12-acceptance.json")

describe("consumer authority beta.12 observer credential preflight", () => {
  it("requires a bounded host-only preflight before fixture authorization without a product credential fallback", () => {
    const manifest = readManifest()
    const handoff = record(manifest["prearmedExternalHandoff"])
    const prepare = record(handoff["prepare"])

    expect(manifest["schemaVersion"]).toBe("consumer-authority-beta12-acceptance.1")
    expect(manifest["package"]).toEqual({ channel: "staging", scope: "staging-only", version: "0.8.0-beta.12" })
    expect(prepare["credentialPreflight"]).toEqual({
      acquisition: "host-gh-auth-token-read-once",
      command: "node node_modules/persona-harness/scripts/preflight-consumer-authority-observer.mjs --json",
      consumerHome: "isolated-ephemeral",
      hostCredential: "host-gh-only",
      logging: "forbidden",
      observerWorker: "github-actions-read-only",
      persistence: "forbidden",
      productFallback: "forbidden",
      scope: "fixed-authenticated-user-and-empty-sentinel-actions-metadata",
      tokenEnvironment: "PH_OBSERVER_PREFLIGHT_GITHUB_TOKEN",
    })
    expect(prepare["allowedBeforeFixture"]).toEqual([
      "prepare-isolated-consumer-home",
      "enroll",
      "status",
      "explain",
      "observer-credential-preflight",
    ])
    expect(prepare["prohibitedBeforeArtifact"]).toEqual([
      "artifact-download",
      "online-crypto-validation",
      "finish-consumption",
      "replay-observation",
    ])
  })

  it("keeps beta.11's unverified observer condition historical and requires a new one-shot hosted observation", () => {
    const manifest = readManifest()
    const historical = record(manifest["beta11HistoricalExternal"])
    const handoff = record(manifest["prearmedExternalHandoff"])
    const trigger = record(handoff["trigger"])
    const residual = record(manifest["hostedResidual"])

    expect(historical).toEqual({
      outcome: "credential-preflight-did-not-establish-verified-isolated-observer-condition-before-fixture-authorization",
      reusableForBeta12: false,
      version: "0.8.0-beta.11",
    })
    expect(trigger["onlyAfter"]).toBe("observer-credential-preflight-ready-and-natural-current-version-original-artifact")
    expect(trigger["steps"]).toEqual([
      "observer-credential-preflight-ready",
      "download-original-bytes-for-independent-online-verification",
      "verify-online-before-leaf-certificate-notAfter",
      "authority-fetch-discovers-and-binds-original-artifact",
      "finish-consume-once",
      "finish-replay-blocked",
    ])
    expect(residual["id"]).toBe("beta12-prearmed-external-live-original-artifact-verification")
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
