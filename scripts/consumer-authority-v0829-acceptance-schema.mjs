import { readFileSync } from "node:fs"
import { join } from "node:path"
import { isDeepStrictEqual } from "node:util"

import { canonicalV0828AcceptanceManifest } from "./consumer-authority-v0828-acceptance-schema.mjs"
import { parseCanonicalPackagePublisherPlan } from "./canonical-package-publisher.mjs"
import { parseExternalArtifactTransportPlan } from "./consumer-authority-external-artifact-transport-plan.mjs"
import { parseExternalAttestationCommandPlan } from "./consumer-authority-external-attestation-command-plan.mjs"
import { parseObserverGhToolContract } from "./consumer-authority-observer-gh-tool.mjs"

export const V0829_ACCEPTANCE_SCHEMA_VERSION = "consumer-authority-v0829-acceptance.1"

const V0829_PACKAGE_VERSION = "0.8.29"
const ACCEPTANCE_PATH = join("docs", "current", "release", "consumer-authority-v0829-acceptance.json")
const EXPECTED_MANIFEST = buildExpectedManifest()

export class V0829AcceptanceManifestError extends Error {
  constructor(code) {
    super(code)
    this.code = code
  }
}

export function canonicalV0829AcceptanceManifest() {
  return structuredClone(EXPECTED_MANIFEST)
}

export function readV0829AcceptanceManifest(packageRoot) {
  let packageVersion
  let value
  try {
    packageVersion = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8")).version
    value = JSON.parse(readFileSync(join(packageRoot, ACCEPTANCE_PATH), "utf8"))
  } catch {
    fail()
  }
  return parseV0829AcceptanceManifest(value, packageVersion)
}

export function parseV0829AcceptanceManifest(value, packageVersion) {
  if (packageVersion !== V0829_PACKAGE_VERSION || !isDeepStrictEqual(value, EXPECTED_MANIFEST)) fail()
  parseCanonicalPackagePublisherPlan(value.canonicalPackagePublisherPlan)
  parseExternalAttestationCommandPlan(value.externalAttestationCommandPlan)
  parseExternalArtifactTransportPlan(value.externalArtifactTransportPlan)
  parseObserverGhToolContract(value.observerGhTool)
  return value
}

function buildExpectedManifest() {
  const manifest = canonicalV0828AcceptanceManifest()
  manifest.schemaVersion = V0829_ACCEPTANCE_SCHEMA_VERSION
  manifest.package.channel = "unpublished"
  manifest.package.scope = "source-candidate"
  manifest.package.version = V0829_PACKAGE_VERSION
  delete manifest.v0827HistoricalRelease
  manifest.v0828HistoricalRelease = {
    outcome: "published-0.8.28-release-is-immutable-and-not-reusable-for-this-unpublished-v0829-source-candidate-or-any-later-package",
    reusableForV0829: false,
    version: "0.8.28",
  }
  manifest.releaseTruth = {
    stableBody: "stable-release-source-candidate-language-rejected-before-render",
    publishedHistory: "v0828-published-release-remains-immutable-and-nonreusable",
    liveLookup: "package-visible-current-docs-use-live-npm-and-github-lookups-without-a-static-dist-tag-snapshot",
    verification: "source-provenance-audit-package-smoke-unit-repository-and-cooperative-demo-contracts",
  }
  manifest.authority.fixturePlan.registryInstall = "requires-authorized-release-before-registry-install-persona-harness@0.8.29"
  manifest.authority.hostedFixture.revision = "v0829-source-candidate-head-before-authorized-release"
  manifest.hostedResidual.id = "v0829-current-package-acceptance-and-authorized-current-artifact-observation"
  const freshTarPhases = manifest.packageBoundary.authoritativeBundleContract.exercisePhaseProtocol.freshTar
  const interviewPhaseIndex = freshTarPhases.indexOf("opencode-interview-observation")
  if (interviewPhaseIndex < 0) {
    throw new Error("v0828 acceptance manifest is missing the OpenCode interview phase")
  }
  freshTarPhases.splice(interviewPhaseIndex, 0, "opencode-shared-skill-catalog")
  const authorityDiscoveryPhaseIndex = freshTarPhases.indexOf("authority-discovery")
  if (authorityDiscoveryPhaseIndex < 0) {
    throw new Error("v0828 acceptance manifest is missing the authority discovery phase")
  }
  freshTarPhases.splice(authorityDiscoveryPhaseIndex, 0, "authority-verify")
  return manifest
}

function fail() {
  throw new V0829AcceptanceManifestError("v0829-acceptance-schema")
}
