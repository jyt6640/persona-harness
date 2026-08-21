import { readFileSync } from "node:fs"
import { join } from "node:path"
import { isDeepStrictEqual } from "node:util"

import { canonicalV0818AcceptanceManifest } from "./consumer-authority-v0818-acceptance-schema.mjs"
import { parseCanonicalPackagePublisherPlan } from "./canonical-package-publisher.mjs"
import { parseExternalArtifactTransportPlan } from "./consumer-authority-external-artifact-transport-plan.mjs"
import { parseExternalAttestationCommandPlan } from "./consumer-authority-external-attestation-command-plan.mjs"
import { parseObserverGhToolContract } from "./consumer-authority-observer-gh-tool.mjs"

export const V0819_ACCEPTANCE_SCHEMA_VERSION = "consumer-authority-v0819-acceptance.1"

const V0819_PACKAGE_VERSION = "0.8.19"
const ACCEPTANCE_PATH = join("docs", "current", "release", "consumer-authority-v0819-acceptance.json")
const EXPECTED_MANIFEST = buildExpectedManifest()

export class V0819AcceptanceManifestError extends Error {
  constructor(code) {
    super(code)
    this.code = code
  }
}

export function canonicalV0819AcceptanceManifest() {
  return structuredClone(EXPECTED_MANIFEST)
}

export function readV0819AcceptanceManifest(packageRoot) {
  let packageVersion
  let value
  try {
    packageVersion = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8")).version
    value = JSON.parse(readFileSync(join(packageRoot, ACCEPTANCE_PATH), "utf8"))
  } catch {
    fail()
  }
  return parseV0819AcceptanceManifest(value, packageVersion)
}

export function parseV0819AcceptanceManifest(value, packageVersion) {
  if (packageVersion !== V0819_PACKAGE_VERSION || !isDeepStrictEqual(value, EXPECTED_MANIFEST)) fail()
  parseCanonicalPackagePublisherPlan(value.canonicalPackagePublisherPlan)
  parseExternalAttestationCommandPlan(value.externalAttestationCommandPlan)
  parseExternalArtifactTransportPlan(value.externalArtifactTransportPlan)
  parseObserverGhToolContract(value.observerGhTool)
  return value
}

function buildExpectedManifest() {
  const manifest = canonicalV0818AcceptanceManifest()
  manifest.schemaVersion = V0819_ACCEPTANCE_SCHEMA_VERSION
  manifest.package.channel = "unpublished"
  manifest.package.scope = "source-candidate"
  manifest.package.version = V0819_PACKAGE_VERSION
  delete manifest.v0817HistoricalRelease
  manifest.v0818HistoricalRelease = {
    outcome: "immutable-unpublished-0.8.18-release-is-not-reusable-for-this-unpublished-v0819-source-candidate-or-any-later-package",
    reusableForV0819: false,
    version: "0.8.18",
  }
  manifest.authority.readOnlyVerify.archiveInput = {
    ...manifest.authority.readOnlyVerify.archiveInput,
    ancestorDirectoryChurn: "same-no-follow-directory-location-and-mode-required-while-unrelated-entry-metadata-may-change",
    directParentIntegrity: "full-no-follow-identity-remains-required-before-read",
  }
  manifest.authority.fixturePlan.registryInstall = "requires-authorized-release-before-registry-install-persona-harness@0.8.19"
  manifest.authority.hostedFixture.revision = "v0819-source-candidate-head-before-authorized-release"
  manifest.hostedResidual.id = "v0819-current-package-acceptance-and-authorized-current-artifact-observation"
  return manifest
}

function fail() {
  throw new V0819AcceptanceManifestError("v0819-acceptance-schema")
}
