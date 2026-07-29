import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

const manifestPath = join(process.cwd(), "docs", "current", "release", "consumer-authority-beta9-acceptance.json")

describe("consumer authority beta.9 artifact-discovery acceptance manifest", () => {
  it("records beta.8's verified original artifact as historical evidence with a fail-closed fetch binding outcome", () => {
    const manifest = readManifest()

    expect(manifest["schemaVersion"]).toBe("consumer-authority-beta9-acceptance.1")
    expect(manifest["package"]).toEqual({ channel: "staging", scope: "staging-only", version: "0.8.0-beta.9" })
    expect(manifest["beta8HistoricalArtifact"]).toMatchObject({
      artifactId: 8708284716,
      outcome: "verified-original-artifact-fetch-binding-unavailable",
      reusableForBeta9: false,
      version: "0.8.0-beta.8",
    })
  })

  it("keeps caller discovery and reusable certificate SAN identities distinct through the one final observer route", () => {
    const manifest = readManifest()
    const authority = record(manifest["authority"])
    const fixture = record(authority["hostedFixture"])
    const binding = record(authority["discoveryBinding"])
    const handoff = record(manifest["prearmedExternalHandoff"])
    const trigger = record(handoff["trigger"])

    expect(fixture).toMatchObject({
      callerWorkflowPath: ".github/workflows/research-attestation.yml",
      certificateSanIdentity: "reusable-producer-workflow",
      reusableWorkflowPath: ".github/workflows/persona-harness-project-finish.yml",
    })
    expect(binding["required"]).toEqual([
      "caller-workflow-path",
      "reusable-workflow-sha-and-certificate-SAN",
      "repository-id",
      "source-head",
      "workflow-run-id",
      "artifact-id-and-sha256",
    ])
    expect(trigger["steps"]).toEqual([
      "download-original-bytes-once",
      "verify-online-before-leaf-certificate-notAfter",
      "authority-fetch-binds-original-artifact-identity",
      "finish-consume-once",
      "finish-replay-blocked",
    ])
    expect(manifest["hostedResidual"]).toMatchObject({
      id: "beta9-prearmed-external-live-original-artifact-verification",
    })
  })
})

function readManifest(): Record<string, unknown> {
  return record(JSON.parse(readFileSync(manifestPath, "utf8")))
}

function record(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new TypeError("expected record")
  }
  return value
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
