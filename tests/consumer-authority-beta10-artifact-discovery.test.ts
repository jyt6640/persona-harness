import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

const manifestPath = join(process.cwd(), "docs", "current", "release", "consumer-authority-beta10-acceptance.json")

describe("consumer authority beta.10 artifact-discovery acceptance manifest", () => {
  it("records beta.9's independently verified original artifact as historical non-authority evidence", () => {
    const manifest = readManifest()

    expect(manifest["schemaVersion"]).toBe("consumer-authority-beta10-acceptance.1")
    expect(manifest["package"]).toEqual({ channel: "staging", scope: "staging-only", version: "0.8.0-beta.10" })
    expect(manifest["beta9HistoricalArtifact"]).toMatchObject({
      artifactId: 8712218259,
      outcome: "verified-original-artifact-discovery-unavailable",
      reusableForBeta10: false,
      version: "0.8.0-beta.9",
    })
  })

  it("fixes discovery to the enrolled caller workflow filename while keeping the reusable signer identity separate", () => {
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
    expect(binding).toMatchObject({
      fixedWorkflowIdentifier: "enrolled-caller-workflow-filename",
      storeSchema: "consumer-authority-original-artifact.2",
    })
    expect(binding["required"]).toEqual([
      "caller-workflow-filename",
      "reusable-workflow-sha-and-certificate-SAN",
      "repository-id",
      "source-head",
      "workflow-run-id",
      "artifact-id-and-sha256",
    ])
    expect(trigger["steps"]).toEqual([
      "download-original-bytes-for-independent-online-verification",
      "verify-online-before-leaf-certificate-notAfter",
      "authority-fetch-discovers-and-binds-original-artifact",
      "finish-consume-once",
      "finish-replay-blocked",
    ])
    expect(manifest["hostedResidual"]).toMatchObject({
      id: "beta10-prearmed-external-live-original-artifact-verification",
    })
  })

  it("requires an exact bundle checkout rather than ambient package-root selection", () => {
    const manifest = readManifest()
    const boundary = record(manifest["packageBoundary"])
    const bundle = record(boundary["bundle"])
    const checkout = record(boundary["cleanCheckout"])
    const npm = record(boundary["npm"])
    const pack = record(boundary["pack"])

    expect(bundle).toEqual({
      requiredRefs: ["HEAD", "refs/remotes/origin/main"],
      verification: "git-bundle-verify-and-exact-ref-binding",
    })
    expect(checkout["requiredBindings"]).toEqual([
      "checkout-cwd",
      "git-toplevel",
      "npm-prefix",
      "HEAD-package-json-bytes",
      "HEAD-package-lock-bytes",
    ])
    expect(checkout["sourceFallback"]).toBe("forbidden")
    expect(npm).toEqual({
      global: false,
      ignoreScriptsBeforePack: false,
      install: "npm-ci-ignore-scripts",
      workspaces: false,
    })
    expect(pack).toEqual({
      metadata: "name-version-filename-must-match-frozen-package-and-lock",
      postcondition: "fresh-installed-cli-version-must-match-tarball-version",
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
