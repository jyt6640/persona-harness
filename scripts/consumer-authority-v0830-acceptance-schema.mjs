import { readFileSync } from "node:fs"
import { join } from "node:path"
import { isDeepStrictEqual } from "node:util"

import { canonicalV0829AcceptanceManifest } from "./consumer-authority-v0829-acceptance-schema.mjs"
import { parseCanonicalPackagePublisherPlan } from "./canonical-package-publisher.mjs"
import { parseExternalArtifactTransportPlan } from "./consumer-authority-external-artifact-transport-plan.mjs"
import { parseExternalAttestationCommandPlan } from "./consumer-authority-external-attestation-command-plan.mjs"
import { parseObserverGhToolContract } from "./consumer-authority-observer-gh-tool.mjs"

export const V0830_ACCEPTANCE_SCHEMA_VERSION = "consumer-authority-v0830-acceptance.1"

const V0830_PACKAGE_VERSION = "0.8.30"
const ACCEPTANCE_PATH = join("docs", "current", "release", "consumer-authority-v0830-acceptance.json")
const EXPECTED_MANIFEST = buildExpectedManifest()

export class V0830AcceptanceManifestError extends Error {
  constructor(code) {
    super(code)
    this.code = code
  }
}

export function canonicalV0830AcceptanceManifest() {
  return structuredClone(EXPECTED_MANIFEST)
}

export function readV0830AcceptanceManifest(packageRoot) {
  let packageVersion
  let value
  try {
    packageVersion = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8")).version
    value = JSON.parse(readFileSync(join(packageRoot, ACCEPTANCE_PATH), "utf8"))
  } catch {
    fail()
  }
  return parseV0830AcceptanceManifest(value, packageVersion)
}

export function parseV0830AcceptanceManifest(value, packageVersion) {
  if (packageVersion !== V0830_PACKAGE_VERSION || !isDeepStrictEqual(value, EXPECTED_MANIFEST)) fail()
  parseCanonicalPackagePublisherPlan(value.canonicalPackagePublisherPlan)
  parseExternalAttestationCommandPlan(value.externalAttestationCommandPlan)
  parseExternalArtifactTransportPlan(value.externalArtifactTransportPlan)
  parseObserverGhToolContract(value.observerGhTool)
  return value
}

function buildExpectedManifest() {
  const manifest = canonicalV0829AcceptanceManifest()
  manifest.schemaVersion = V0830_ACCEPTANCE_SCHEMA_VERSION
  manifest.package.channel = "unpublished"
  manifest.package.scope = "source-candidate"
  manifest.package.version = V0830_PACKAGE_VERSION
  delete manifest.v0828HistoricalRelease
  manifest.v0829HistoricalRelease = {
    outcome: "published-0.8.29-release-is-immutable-and-not-reusable-for-this-unpublished-v0830-source-candidate-or-any-later-package",
    reusableForV0830: false,
    version: "0.8.29",
  }
  manifest.releaseTruth = {
    stableBody: "stable-release-source-candidate-language-rejected-before-render",
    publishedHistory: "v0829-published-release-remains-immutable-and-nonreusable",
    liveLookup: "package-visible-current-docs-use-live-npm-and-github-lookups-without-a-static-dist-tag-snapshot",
    verification: "source-provenance-audit-package-smoke-unit-repository-and-cooperative-demo-contracts",
  }
  manifest.authority.fixturePlan.registryInstall = "requires-authorized-release-before-registry-install-persona-harness@0.8.30"
  manifest.authority.hostedFixture.revision = "v0830-source-candidate-head-before-authorized-release"
  manifest.hostedResidual.id = "v0830-current-package-acceptance-and-authorized-current-artifact-observation"
  const freshTarPhases = manifest.packageBoundary.authoritativeBundleContract.exercisePhaseProtocol.freshTar
  const freshTarEvidencePhaseIndex = freshTarPhases.indexOf("evidence-read-write")
  const sourceBuiltEvidencePhaseIndex = manifest.packageBoundary.authoritativeBundleContract.exercisePhaseProtocol.sourceBuilt.indexOf("evidence-read-write")
  if (freshTarEvidencePhaseIndex < 0 || sourceBuiltEvidencePhaseIndex < 0) {
    throw new Error("v0829 acceptance manifest is missing the evidence read/write phase")
  }
  freshTarPhases.splice(freshTarEvidencePhaseIndex + 1, 0, "owner-dogfood-feedback")
  manifest.packageBoundary.authoritativeBundleContract.exercisePhaseProtocol.sourceBuilt.splice(
    sourceBuiltEvidencePhaseIndex + 1,
    0,
    "owner-dogfood-feedback",
  )
  return manifest
}

function fail() {
  throw new V0830AcceptanceManifestError("v0830-acceptance-schema")
}
