import { describe, expect, it } from "vitest"

import { readBeta15AcceptanceManifest } from "../scripts/consumer-authority-beta15-acceptance-schema.mjs"
import { BUNDLE_REFERENCE_POLICY } from "../scripts/clean-package-boundary-core.mjs"

describe("consumer authority beta.15 final readiness", () => {
  it("keeps caller enrollment, reusable signer, bootstrap-local metadata, and replay policy distinct", () => {
    const manifest = readManifest()
    const authority = record(manifest["authority"])
    const binding = record(authority["binding"])
    const caller = record(binding["callerEnrollment"])
    const signer = record(binding["reusableSigner"])
    const projection = record(binding["runtimeSourceProjection"])
    const modeled = record(authority["modeledContract"])
    const packageBoundary = record(manifest["packageBoundary"])
    const bundle = record(packageBoundary["bundle"])
    const npm = record(packageBoundary["npm"])
    const proof = record(packageBoundary["authoritativeBundleContract"])

    expect(manifest["schemaVersion"]).toBe("consumer-authority-beta15-acceptance.2")
    expect(manifest["package"]).toEqual({ channel: "staging", scope: "staging-only", version: "0.8.0-beta.15" })
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
    expect(npm).toMatchObject({
      invocation: "plain-npm-from-bound-detached-checkout-cwd",
      packPrefixFlag: "forbidden",
    })
    expect(proof).toEqual({
      baseAndTarget: "fresh-detached-no-local-checkouts-from-the-same-complete-bundle",
      candidateRef: BUNDLE_REFERENCE_POLICY.candidateRef,
      command: "node scripts/verify-clean-package-boundary.mjs --exercise-contract",
      fullJavaGradleContract: "source-and-fresh-installed-full-contract-on-a-provisioned-java-gradle-host",
      headAlias: BUNDLE_REFERENCE_POLICY.headAlias,
      installedContract: "fresh-installed-package-exercise-uses-exact-target-tarball-sha256",
      rejectBeforePack: "launcher-cwd-or-manifest-outside-bound-checkout",
      sourceCandidateRef: BUNDLE_REFERENCE_POLICY.sourceCandidateRef,
      sourceContract: "built-cli-package-exercise-contract-under-the-same-executable",
    })
    expect(bundle["requiredRefs"]).toEqual(BUNDLE_REFERENCE_POLICY.requiredRefs)
  })

  it("requires public initialization before the only pre-armed hosted residual", () => {
    const manifest = readManifest()
    const historical = record(manifest["beta14HistoricalExternal"])
    const readiness = record(manifest["preAuthorityReadiness"])
    const initialization = record(readiness["initialization"])
    const residual = record(manifest["hostedResidual"])
    const mutationBoundary = record(manifest["mutationBoundary"])

    expect(historical).toEqual({
      outcome: "trusted-fetch-with-uninitialized-finish-noop-and-no-consumption",
      reusableForBeta15: false,
      version: "0.8.0-beta.14",
    })
    expect(initialization).toEqual({
      acceptedPlan: "ph bootstrap backend --strict --no-developer-mcp",
      binding: {
        consumerRoot: "same-canonical-project-root",
        profile: ".persona/project-profile.jsonc",
        reportsAndEvidence: "public-command-created-only",
        sourceIdentity: "current-git-source-identity",
      },
      inactiveFinish: { blocker: "workflow-state-uninitialized", status: "blocked" },
      loopState: [
        ".persona/workflow/workflow-loop-state.json",
        ".persona/workflow/ralph-loop-state.json",
      ],
      sameConsumer: true,
    })
    expect(residual["id"]).toBe("beta15-prearmed-external-authority-consumption")
    expect(mutationBoundary["performed"]).toBe(false)
  })
})

function readManifest() {
  return readBeta15AcceptanceManifest(process.cwd())
}

function record(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("expected record")
  }
  return value as Record<string, unknown>
}
