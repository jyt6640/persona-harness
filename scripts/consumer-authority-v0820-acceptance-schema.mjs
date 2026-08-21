import { readFileSync } from "node:fs"
import { join } from "node:path"
import { isDeepStrictEqual } from "node:util"

import { canonicalV0819AcceptanceManifest } from "./consumer-authority-v0819-acceptance-schema.mjs"
import { parseCanonicalPackagePublisherPlan } from "./canonical-package-publisher.mjs"
import { parseExternalArtifactTransportPlan } from "./consumer-authority-external-artifact-transport-plan.mjs"
import { parseExternalAttestationCommandPlan } from "./consumer-authority-external-attestation-command-plan.mjs"
import { parseObserverGhToolContract } from "./consumer-authority-observer-gh-tool.mjs"

export const V0820_ACCEPTANCE_SCHEMA_VERSION = "consumer-authority-v0820-acceptance.1"

const V0820_PACKAGE_VERSION = "0.8.20"
const ACCEPTANCE_PATH = join("docs", "current", "release", "consumer-authority-v0820-acceptance.json")
const EXPECTED_MANIFEST = buildExpectedManifest()

export class V0820AcceptanceManifestError extends Error {
  constructor(code) {
    super(code)
    this.code = code
  }
}

export function canonicalV0820AcceptanceManifest() {
  return structuredClone(EXPECTED_MANIFEST)
}

export function readV0820AcceptanceManifest(packageRoot) {
  let packageVersion
  let value
  try {
    packageVersion = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8")).version
    value = JSON.parse(readFileSync(join(packageRoot, ACCEPTANCE_PATH), "utf8"))
  } catch {
    fail()
  }
  return parseV0820AcceptanceManifest(value, packageVersion)
}

export function parseV0820AcceptanceManifest(value, packageVersion) {
  if (packageVersion !== V0820_PACKAGE_VERSION || !isDeepStrictEqual(value, EXPECTED_MANIFEST)) fail()
  parseCanonicalPackagePublisherPlan(value.canonicalPackagePublisherPlan)
  parseExternalAttestationCommandPlan(value.externalAttestationCommandPlan)
  parseExternalArtifactTransportPlan(value.externalArtifactTransportPlan)
  parseObserverGhToolContract(value.observerGhTool)
  return value
}

function buildExpectedManifest() {
  const manifest = canonicalV0819AcceptanceManifest()
  manifest.schemaVersion = V0820_ACCEPTANCE_SCHEMA_VERSION
  manifest.package.channel = "unpublished"
  manifest.package.scope = "source-candidate"
  manifest.package.version = V0820_PACKAGE_VERSION
  delete manifest.v0818HistoricalRelease
  manifest.v0819HistoricalRelease = {
    outcome: "published-0.8.19-release-is-immutable-and-not-reusable-for-this-unpublished-v0820-source-candidate-or-any-later-package",
    reusableForV0820: false,
    version: "0.8.19",
  }
  manifest.initialization = {
    packageTemplateIdentity: "canonical-package-template-digest-remains-separate-from-effective-bootstrap-overlay-file-digests",
    repairStaging: "manifest-less-recognized-portable-static-baseline-records-the-caller-realpath-before-staging-ownership-verification",
  }
  manifest.authority.readOnlyVerify.archiveInput = {
    ...manifest.authority.readOnlyVerify.archiveInput,
    ancestorDirectoryChurn: "same-no-follow-directory-location-and-mode-required-while-unrelated-entry-metadata-may-change",
    directParentIntegrity: "full-no-follow-identity-remains-required-before-read",
  }
  manifest.authority.fixturePlan.registryInstall = "requires-authorized-release-before-registry-install-persona-harness@0.8.20"
  manifest.authority.hostedFixture.revision = "v0820-source-candidate-head-before-authorized-release"
  manifest.hostedResidual.id = "v0820-current-package-acceptance-and-authorized-current-artifact-observation"
  return manifest
}

function fail() {
  throw new V0820AcceptanceManifestError("v0820-acceptance-schema")
}
