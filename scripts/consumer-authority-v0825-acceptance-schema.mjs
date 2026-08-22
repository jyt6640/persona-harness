import { readFileSync } from "node:fs"
import { join } from "node:path"
import { isDeepStrictEqual } from "node:util"

import { canonicalV0824AcceptanceManifest } from "./consumer-authority-v0824-acceptance-schema.mjs"
import { parseCanonicalPackagePublisherPlan } from "./canonical-package-publisher.mjs"
import { parseExternalArtifactTransportPlan } from "./consumer-authority-external-artifact-transport-plan.mjs"
import { parseExternalAttestationCommandPlan } from "./consumer-authority-external-attestation-command-plan.mjs"
import { parseObserverGhToolContract } from "./consumer-authority-observer-gh-tool.mjs"

export const V0825_ACCEPTANCE_SCHEMA_VERSION = "consumer-authority-v0825-acceptance.1"

const V0825_PACKAGE_VERSION = "0.8.25"
const ACCEPTANCE_PATH = join("docs", "current", "release", "consumer-authority-v0825-acceptance.json")
const EXPECTED_MANIFEST = buildExpectedManifest()

export class V0825AcceptanceManifestError extends Error {
  constructor(code) {
    super(code)
    this.code = code
  }
}

export function canonicalV0825AcceptanceManifest() {
  return structuredClone(EXPECTED_MANIFEST)
}

export function readV0825AcceptanceManifest(packageRoot) {
  let packageVersion
  let value
  try {
    packageVersion = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8")).version
    value = JSON.parse(readFileSync(join(packageRoot, ACCEPTANCE_PATH), "utf8"))
  } catch {
    fail()
  }
  return parseV0825AcceptanceManifest(value, packageVersion)
}

export function parseV0825AcceptanceManifest(value, packageVersion) {
  if (packageVersion !== V0825_PACKAGE_VERSION || !isDeepStrictEqual(value, EXPECTED_MANIFEST)) fail()
  parseCanonicalPackagePublisherPlan(value.canonicalPackagePublisherPlan)
  parseExternalAttestationCommandPlan(value.externalAttestationCommandPlan)
  parseExternalArtifactTransportPlan(value.externalArtifactTransportPlan)
  parseObserverGhToolContract(value.observerGhTool)
  return value
}

function buildExpectedManifest() {
  const manifest = canonicalV0824AcceptanceManifest()
  manifest.schemaVersion = V0825_ACCEPTANCE_SCHEMA_VERSION
  manifest.package.channel = "unpublished"
  manifest.package.scope = "source-candidate"
  manifest.package.version = V0825_PACKAGE_VERSION
  delete manifest.v0823HistoricalRelease
  manifest.v0824HistoricalRelease = {
    outcome: "published-0.8.24-release-is-immutable-and-not-reusable-for-this-unpublished-v0825-source-candidate-or-any-later-package",
    reusableForV0825: false,
    version: "0.8.24",
  }
  manifest.releaseTruth = {
    stableBody: "stable-release-source-candidate-language-rejected-before-render",
    publishedHistory: "v0824-published-release-remains-immutable-and-nonreusable",
    verification: "public-docs-map-package-smoke-unit-repository-and-cooperative-demo-contracts",
  }
  manifest.workflowDemonstration = {
    cooperativeFinish: "exact-packed-package-java21-gradle94-junit-block-to-cooperative-pass",
    protectedCi: "verify-repository-runs-demo-cooperative-finish",
    runtimeInjection: "legacy-hook-demos-explicit-preview-opt-in-default-off",
  }
  manifest.authority.fixturePlan.registryInstall = "requires-authorized-release-before-registry-install-persona-harness@0.8.25"
  manifest.authority.hostedFixture.revision = "v0825-source-candidate-head-before-authorized-release"
  manifest.hostedResidual.id = "v0825-current-package-acceptance-and-authorized-current-artifact-observation"
  return manifest
}

function fail() {
  throw new V0825AcceptanceManifestError("v0825-acceptance-schema")
}
