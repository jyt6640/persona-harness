import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import {
  BETA15_ACCEPTANCE_SCHEMA_VERSION,
  Beta15AcceptanceManifestError,
  parseBeta15AcceptanceManifest,
  readBeta15AcceptanceManifest,
} from "../scripts/consumer-authority-beta15-acceptance-schema.mjs"

const repositoryRoot = process.cwd()
const manifestPath = join(repositoryRoot, "docs", "current", "release", "consumer-authority-beta15-acceptance.json")

describe("consumer authority beta.15 acceptance schema", () => {
  it("accepts the canonical manifest through the shared package-root reader", () => {
    const manifest = readBeta15AcceptanceManifest(repositoryRoot)

    expect(manifest.schemaVersion).toBe(BETA15_ACCEPTANCE_SCHEMA_VERSION)
    expect(manifest.package.version).toBe("0.8.0-beta.15")
    expect(manifest.packageBoundary.authoritativeBundleContract.candidateRef)
      .toBe("explicit-single-refs-heads-candidate-must-match-expected-head")
    expect(manifest.packageBoundary.authoritativeBundleContract.headAlias)
      .toBe("optional-head-mapping-must-match-the-same-expected-head")
  })

  it("rejects manifest downgrade, unknown fields, and altered bundle-ref semantics", () => {
    const cases: Array<{ readonly apply: (manifest: Record<string, unknown>) => void; readonly name: string }> = [
      {
        name: "schema downgrade",
        apply: (manifest) => { manifest["schemaVersion"] = "consumer-authority-beta15-acceptance.1" },
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
    ]

    for (const testCase of cases) {
      const manifest = canonicalManifest()
      testCase.apply(manifest)

      expectSchemaBlock(() => parseBeta15AcceptanceManifest(manifest, "0.8.0-beta.15"), testCase.name)
    }
  })

  it("rejects a manifest that is bound to a different package version", () => {
    expectSchemaBlock(
      () => parseBeta15AcceptanceManifest(canonicalManifest(), "0.8.0-beta.14"),
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
    if (error instanceof Beta15AcceptanceManifestError) {
      expect(error.code, label).toBe("beta15-acceptance-schema")
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
  return value
}
