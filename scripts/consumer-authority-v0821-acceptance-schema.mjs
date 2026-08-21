import { readFileSync } from "node:fs"
import { join } from "node:path"
import { isDeepStrictEqual } from "node:util"

import { canonicalV0820AcceptanceManifest } from "./consumer-authority-v0820-acceptance-schema.mjs"
import { parseCanonicalPackagePublisherPlan } from "./canonical-package-publisher.mjs"
import { parseExternalArtifactTransportPlan } from "./consumer-authority-external-artifact-transport-plan.mjs"
import { parseExternalAttestationCommandPlan } from "./consumer-authority-external-attestation-command-plan.mjs"
import { parseObserverGhToolContract } from "./consumer-authority-observer-gh-tool.mjs"

export const V0821_ACCEPTANCE_SCHEMA_VERSION = "consumer-authority-v0821-acceptance.1"

const V0821_PACKAGE_VERSION = "0.8.21"
const ACCEPTANCE_PATH = join("docs", "current", "release", "consumer-authority-v0821-acceptance.json")
const EXPECTED_MANIFEST = buildExpectedManifest()

export class V0821AcceptanceManifestError extends Error {
  constructor(code) {
    super(code)
    this.code = code
  }
}

export function canonicalV0821AcceptanceManifest() {
  return structuredClone(EXPECTED_MANIFEST)
}

export function readV0821AcceptanceManifest(packageRoot) {
  let packageVersion
  let value
  try {
    packageVersion = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8")).version
    value = JSON.parse(readFileSync(join(packageRoot, ACCEPTANCE_PATH), "utf8"))
  } catch {
    fail()
  }
  return parseV0821AcceptanceManifest(value, packageVersion)
}

export function parseV0821AcceptanceManifest(value, packageVersion) {
  if (packageVersion !== V0821_PACKAGE_VERSION || !isDeepStrictEqual(value, EXPECTED_MANIFEST)) fail()
  parseCanonicalPackagePublisherPlan(value.canonicalPackagePublisherPlan)
  parseExternalAttestationCommandPlan(value.externalAttestationCommandPlan)
  parseExternalArtifactTransportPlan(value.externalArtifactTransportPlan)
  parseObserverGhToolContract(value.observerGhTool)
  return value
}

function buildExpectedManifest() {
  const manifest = canonicalV0820AcceptanceManifest()
  manifest.schemaVersion = V0821_ACCEPTANCE_SCHEMA_VERSION
  manifest.package.channel = "unpublished"
  manifest.package.scope = "source-candidate"
  manifest.package.version = V0821_PACKAGE_VERSION
  delete manifest.v0819HistoricalRelease
  manifest.v0820HistoricalRelease = {
    outcome: "published-0.8.20-release-is-immutable-and-not-reusable-for-this-unpublished-v0821-source-candidate-or-any-later-package",
    reusableForV0821: false,
    version: "0.8.20",
  }
  manifest.initialization = {
    packageTemplateIdentity: "canonical-package-template-digest-remains-separate-from-effective-bootstrap-overlay-file-digests",
    repairStaging: "manifest-less-recognized-portable-static-baseline-records-the-caller-realpath-before-staging-ownership-verification",
  }
  manifest.projectFinishSourceIdentity = {
    adoptedInstructionPolicy: "remains-source-bound",
    repairInferenceObservations: "excludes-only-.persona/instructions/inferred.json-and-.persona/instructions/conflicts.json",
  }
  manifest.authority.readOnlyVerify.archiveInput = {
    ...manifest.authority.readOnlyVerify.archiveInput,
    ancestorDirectoryChurn: "same-no-follow-directory-location-and-mode-required-while-unrelated-entry-metadata-may-change",
    directParentIntegrity: "full-no-follow-identity-remains-required-before-read",
  }
  manifest.authority.fixturePlan.registryInstall = "requires-authorized-release-before-registry-install-persona-harness@0.8.21"
  manifest.authority.hostedFixture.revision = "v0821-source-candidate-head-before-authorized-release"
  manifest.hostedResidual.id = "v0821-current-package-acceptance-and-authorized-current-artifact-observation"
  return manifest
}

function fail() {
  throw new V0821AcceptanceManifestError("v0821-acceptance-schema")
}
