import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import {
  BETA16_ACCEPTANCE_SCHEMA_VERSION,
  Beta16AcceptanceManifestError,
  parseBeta16AcceptanceManifest,
  readBeta16AcceptanceManifest,
} from "../scripts/consumer-authority-beta16-acceptance-schema.mjs"
import { BUNDLE_REFERENCE_POLICY } from "../scripts/clean-package-boundary-core.mjs"

const repositoryRoot = process.cwd()
const manifestPath = join(repositoryRoot, "docs", "current", "release", "consumer-authority-beta16-acceptance.json")

describe("consumer authority beta.16 acceptance schema", () => {
  it("accepts the canonical manifest through the shared package-root reader", () => {
    const manifest = readBeta16AcceptanceManifest(repositoryRoot)

    expect(manifest.schemaVersion).toBe(BETA16_ACCEPTANCE_SCHEMA_VERSION)
    expect(manifest.package.version).toBe("0.8.0-beta.16")
    expect(manifest.packageBoundary.authoritativeBundleContract.candidateRef)
      .toBe(BUNDLE_REFERENCE_POLICY.candidateRef)
    expect(manifest.packageBoundary.authoritativeBundleContract.headAlias)
      .toBe(BUNDLE_REFERENCE_POLICY.headAlias)
    expect(manifest.packageBoundary.authoritativeBundleContract.sourceCandidateRef)
      .toBe(BUNDLE_REFERENCE_POLICY.sourceCandidateRef)
    expect(record(manifest.packageBoundary.bundle)["requiredRefs"])
      .toEqual(BUNDLE_REFERENCE_POLICY.requiredRefs)
    expect(manifest.packageBoundary.authoritativeBundleContract).toMatchObject({
      candidateRef: BUNDLE_REFERENCE_POLICY.candidateRef,
      headAlias: BUNDLE_REFERENCE_POLICY.headAlias,
      sourceCandidateRef: BUNDLE_REFERENCE_POLICY.sourceCandidateRef,
    })
  })

  it("rejects manifest downgrade, unknown fields, and altered bundle-ref semantics", () => {
    const cases: Array<{ readonly apply: (manifest: Record<string, unknown>) => void; readonly name: string }> = [
      {
        name: "schema downgrade",
        apply: (manifest) => { manifest["schemaVersion"] = "consumer-authority-beta16-acceptance.0" },
      },
      {
        name: "unknown field",
        apply: (manifest) => { manifest["unexpected"] = "foreign-value" },
      },
      {
        name: "missing candidate ref semantic",
        apply: (manifest) => { delete bundleContract(manifest)["candidateRef"] },
      },
      {
        name: "foreign candidate ref semantic",
        apply: (manifest) => { bundleContract(manifest)["candidateRef"] = "foreign-or-ambiguous-ref-allowed" },
      },
      {
        name: "conflicting head alias semantic",
        apply: (manifest) => { bundleContract(manifest)["headAlias"] = "head-alias-may-conflict" },
      },
      {
        name: "foreign detached source candidate ref",
        apply: (manifest) => { bundleContract(manifest)["sourceCandidateRef"] = "refs/heads/foreign" },
      },
      {
        name: "legacy required HEAD alias",
        apply: (manifest) => {
          record(record(manifest["packageBoundary"])["bundle"])["requiredRefs"] = [
            "HEAD",
            "refs/remotes/origin/main",
          ]
        },
      },
      {
        name: "external command plan signer selector drift",
        apply: (manifest) => {
          record(manifest["externalAttestationCommandPlan"])["signerSelector"] = {
            flag: "--cert-identity",
            source: "reusable-signer.workflowPath",
          }
        },
      },
    ]

    for (const testCase of cases) {
      const manifest = canonicalManifest()
      testCase.apply(manifest)

      expectSchemaBlock(() => parseBeta16AcceptanceManifest(manifest, "0.8.0-beta.16"), testCase.name)
    }
  })

  it("rejects a manifest that is bound to a different package version", () => {
    expectSchemaBlock(
      () => parseBeta16AcceptanceManifest(canonicalManifest(), "0.8.0-beta.15"),
      "foreign package version",
    )
  })
})

function canonicalManifest(): Record<string, unknown> {
  return structuredClone(record(JSON.parse(readFileSync(manifestPath, "utf8"))))
}

function bundleContract(manifest: Record<string, unknown>): Record<string, unknown> {
  return record(record(manifest["packageBoundary"])["authoritativeBundleContract"])
}

function expectSchemaBlock(action: () => void, label: string): void {
  try {
    action()
  } catch (error) {
    if (error instanceof Beta16AcceptanceManifestError) {
      expect(error.code, label).toBe("beta16-acceptance-schema")
      return
    }
    throw error
  }
  throw new Error(`${label} unexpectedly passed`)
}

function record(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new TypeError("expected record")
  }
  return value
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}
