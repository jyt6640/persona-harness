import { readFileSync } from "node:fs"
import { join } from "node:path"
import { isDeepStrictEqual } from "node:util"

import { canonicalV0825AcceptanceManifest } from "./consumer-authority-v0825-acceptance-schema.mjs"
import { parseCanonicalPackagePublisherPlan } from "./canonical-package-publisher.mjs"
import { parseExternalArtifactTransportPlan } from "./consumer-authority-external-artifact-transport-plan.mjs"
import { parseExternalAttestationCommandPlan } from "./consumer-authority-external-attestation-command-plan.mjs"
import { parseObserverGhToolContract } from "./consumer-authority-observer-gh-tool.mjs"

export const V0826_ACCEPTANCE_SCHEMA_VERSION = "consumer-authority-v0826-acceptance.1"

const V0826_PACKAGE_VERSION = "0.8.26"
const ACCEPTANCE_PATH = join("docs", "current", "release", "consumer-authority-v0826-acceptance.json")
const EXPECTED_MANIFEST = buildExpectedManifest()

export class V0826AcceptanceManifestError extends Error {
  constructor(code) {
    super(code)
    this.code = code
  }
}

export function canonicalV0826AcceptanceManifest() {
  return structuredClone(EXPECTED_MANIFEST)
}

export function readV0826AcceptanceManifest(packageRoot) {
  let packageVersion
  let value
  try {
    packageVersion = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8")).version
    value = JSON.parse(readFileSync(join(packageRoot, ACCEPTANCE_PATH), "utf8"))
  } catch {
    fail()
  }
  return parseV0826AcceptanceManifest(value, packageVersion)
}

export function parseV0826AcceptanceManifest(value, packageVersion) {
  if (packageVersion !== V0826_PACKAGE_VERSION || !isDeepStrictEqual(value, EXPECTED_MANIFEST)) fail()
  parseCanonicalPackagePublisherPlan(value.canonicalPackagePublisherPlan)
  parseExternalAttestationCommandPlan(value.externalAttestationCommandPlan)
  parseExternalArtifactTransportPlan(value.externalArtifactTransportPlan)
  parseObserverGhToolContract(value.observerGhTool)
  return value
}

function buildExpectedManifest() {
  const manifest = canonicalV0825AcceptanceManifest()
  manifest.schemaVersion = V0826_ACCEPTANCE_SCHEMA_VERSION
  manifest.package.channel = "unpublished"
  manifest.package.scope = "source-candidate"
  manifest.package.version = V0826_PACKAGE_VERSION
  delete manifest.v0824HistoricalRelease
  manifest.v0825HistoricalRelease = {
    outcome: "published-0.8.25-release-is-immutable-and-not-reusable-for-this-unpublished-v0826-source-candidate-or-any-later-package",
    reusableForV0826: false,
    version: "0.8.25",
  }
  manifest.releaseTruth = {
    stableBody: "stable-release-source-candidate-language-rejected-before-render",
    publishedHistory: "v0825-published-release-remains-immutable-and-nonreusable",
    liveLookup: "package-visible-current-docs-use-live-npm-and-github-lookups-without-a-static-dist-tag-snapshot",
    verification: "public-docs-map-package-smoke-unit-repository-and-cooperative-demo-contracts",
  }
  manifest.authority.fixturePlan.registryInstall = "requires-authorized-release-before-registry-install-persona-harness@0.8.26"
  manifest.authority.hostedFixture.revision = "v0826-source-candidate-head-before-authorized-release"
  manifest.hostedResidual.id = "v0826-current-package-acceptance-and-authorized-current-artifact-observation"
  return manifest
}

function fail() {
  throw new V0826AcceptanceManifestError("v0826-acceptance-schema")
}
