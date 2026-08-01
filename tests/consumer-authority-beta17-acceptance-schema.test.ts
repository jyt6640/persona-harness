import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import {
  BETA17_ACCEPTANCE_SCHEMA_VERSION,
  Beta17AcceptanceManifestError,
  parseBeta17AcceptanceManifest,
  readBeta17AcceptanceManifest,
} from "../scripts/consumer-authority-beta17-acceptance-schema.mjs"
import { BUNDLE_REFERENCE_POLICY } from "../scripts/clean-package-boundary-core.mjs"

const repositoryRoot = process.cwd()
const manifestPath = join(repositoryRoot, "docs", "current", "release", "consumer-authority-beta17-acceptance.json")

describe("consumer authority beta.17 acceptance schema", () => {
  it("binds the shipped version, bundle policy, command plan, and fixed artifact transport plan together", () => {
    const manifest = readBeta17AcceptanceManifest(repositoryRoot)

    expect(manifest.schemaVersion).toBe(BETA17_ACCEPTANCE_SCHEMA_VERSION)
    expect(manifest.package.version).toBe("0.8.0-beta.17")
    expect(record(manifest.packageBoundary).authoritativeBundleContract).toMatchObject({
      candidateRef: BUNDLE_REFERENCE_POLICY.candidateRef,
      headAlias: BUNDLE_REFERENCE_POLICY.headAlias,
      sourceCandidateRef: BUNDLE_REFERENCE_POLICY.sourceCandidateRef,
    })
    expect(record(manifest.packageBoundary).contentIdentity).toMatchObject({
      canonicalPacker: { node: "20.19.0", npm: "10.8.2" },
      schemaVersion: "package-content-identity.1",
    })
    expect(record(manifest.externalArtifactTransportPlan)).toMatchObject({
      endpoint: { method: "GET" },
      schemaVersion: "consumer-authority-external-artifact-transport-plan.1",
    })
  })

  it("rejects schema, transport, identity, and package version drift before an observer can run", () => {
    const cases: Array<{ readonly apply: (manifest: Record<string, unknown>) => void; readonly name: string }> = [
      {
        name: "schema downgrade",
        apply: (manifest) => { manifest.schemaVersion = "consumer-authority-beta17-acceptance.0" },
      },
      {
        name: "unknown field",
        apply: (manifest) => { manifest.unexpected = "foreign" },
      },
      {
        name: "transport endpoint URL input",
        apply: (manifest) => { record(manifest.externalArtifactTransportPlan).endpoint = { method: "GET", path: "https://untrusted.example" } },
      },
      {
        name: "transport redirect authorization downgrade",
        apply: (manifest) => { record(manifest.externalArtifactTransportPlan).redirect = { authorization: "forward", maximum: 1, permittedHosts: [] } },
      },
      {
        name: "caller repository drift",
        apply: (manifest) => { record(record(manifest.authority).binding).callerEnrollment = { repositoryId: 1 } },
      },
      {
        name: "command plan signer selector drift",
        apply: (manifest) => { record(manifest.externalAttestationCommandPlan).signerSelector = { flag: "--cert-identity", source: "caller" } },
      },
      {
        name: "package content identity raw hash downgrade",
        apply: (manifest) => { record(record(manifest.packageBoundary).contentIdentity).rawTarballSha256 = "generic-npm-pack-equality" },
      },
    ]

    for (const testCase of cases) {
      const manifest = canonicalManifest()
      testCase.apply(manifest)
      expectSchemaBlock(() => parseBeta17AcceptanceManifest(manifest, "0.8.0-beta.17"), testCase.name)
    }
    expectSchemaBlock(
      () => parseBeta17AcceptanceManifest(canonicalManifest(), "0.8.0-beta.16"),
      "foreign package version",
    )
  })
})

function canonicalManifest(): Record<string, unknown> {
  return structuredClone(record(JSON.parse(readFileSync(manifestPath, "utf8"))))
}

function expectSchemaBlock(action: () => void, label: string): void {
  try {
    action()
  } catch (error) {
    if (error instanceof Beta17AcceptanceManifestError) {
      expect(error.code, label).toBe("beta17-acceptance-schema")
      return
    }
    throw error
  }
  throw new Error(`${label} unexpectedly passed`)
}

function record(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("expected record")
  }
  return value as Record<string, unknown>
}
