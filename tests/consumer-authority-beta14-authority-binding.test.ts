import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

const manifestPath = join(process.cwd(), "docs", "current", "release", "consumer-authority-beta14-acceptance.json")

describe("consumer authority beta.14 authority binding", () => {
  it("keeps caller enrollment, reusable signer, bootstrap-local metadata, and replay policy distinct", () => {
    const manifest = readManifest()
    const authority = record(manifest["authority"])
    const binding = record(authority["binding"])
    const caller = record(binding["callerEnrollment"])
    const signer = record(binding["reusableSigner"])
    const projection = record(binding["runtimeSourceProjection"])
    const modeled = record(authority["modeledContract"])

    expect(manifest["schemaVersion"]).toBe("consumer-authority-beta14-acceptance.1")
    expect(manifest["package"]).toEqual({ channel: "staging", scope: "staging-only", version: "0.8.0-beta.14" })
    expect(caller).toEqual({
      repositoryId: 1304576182,
      repositorySlug: "jyt6640/persona-harness-attestation-claim-fixture",
      workflowPath: ".github/workflows/research-attestation.yml",
      workflowRef: "refs/heads/main",
    })
    expect(signer).toEqual({
      certificateSanIdentity: "reusable-producer-workflow",
      workflowPath: ".github/workflows/persona-harness-project-finish.yml",
    })
    expect(projection["excludedRuntimeMetadata"]).toEqual([
      ".persona/.ph-init-manifest.json",
      ".persona/workflow",
    ])
    expect(projection["stillBound"]).toEqual([
      ".persona/project-profile.jsonc",
      "root-gradle-build-and-settings",
      "git-source-identity",
      "public-reports-and-evidence",
    ])
    expect(modeled["rejected"]).toContain("stale-or-replayed-terminal-record")
    expect(modeled["authorityClaim"]).toBe("none-before-a-current-original-artifact-is-verified-online")
  })

  it("keeps beta.13 historical and leaves only the pre-armed hosted residual", () => {
    const manifest = readManifest()
    const historical = record(manifest["beta13HistoricalExternal"])
    const residual = record(manifest["hostedResidual"])
    const mutationBoundary = record(manifest["mutationBoundary"])

    expect(historical).toEqual({
      outcome: "artifact-crypto-passed-but-installed-authority-binding-mismatch",
      reusableForBeta14: false,
      version: "0.8.0-beta.13",
    })
    expect(residual["id"]).toBe("beta14-prearmed-external-authority-consumption")
    expect(mutationBoundary["performed"]).toBe(false)
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
