import { readFileSync } from "node:fs"
import { join } from "node:path"
import { isDeepStrictEqual } from "node:util"

import { canonicalV0822AcceptanceManifest } from "./consumer-authority-v0822-acceptance-schema.mjs"
import { parseCanonicalPackagePublisherPlan } from "./canonical-package-publisher.mjs"
import { parseExternalArtifactTransportPlan } from "./consumer-authority-external-artifact-transport-plan.mjs"
import { parseExternalAttestationCommandPlan } from "./consumer-authority-external-attestation-command-plan.mjs"
import { parseObserverGhToolContract } from "./consumer-authority-observer-gh-tool.mjs"

export const V0823_ACCEPTANCE_SCHEMA_VERSION = "consumer-authority-v0823-acceptance.1"

const V0823_PACKAGE_VERSION = "0.8.23"
const ACCEPTANCE_PATH = join("docs", "current", "release", "consumer-authority-v0823-acceptance.json")
const EXPECTED_MANIFEST = buildExpectedManifest()

export class V0823AcceptanceManifestError extends Error {
  constructor(code) {
    super(code)
    this.code = code
  }
}

export function canonicalV0823AcceptanceManifest() {
  return structuredClone(EXPECTED_MANIFEST)
}

export function readV0823AcceptanceManifest(packageRoot) {
  let packageVersion
  let value
  try {
    packageVersion = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8")).version
    value = JSON.parse(readFileSync(join(packageRoot, ACCEPTANCE_PATH), "utf8"))
  } catch {
    fail()
  }
  return parseV0823AcceptanceManifest(value, packageVersion)
}

export function parseV0823AcceptanceManifest(value, packageVersion) {
  if (packageVersion !== V0823_PACKAGE_VERSION || !isDeepStrictEqual(value, EXPECTED_MANIFEST)) fail()
  parseCanonicalPackagePublisherPlan(value.canonicalPackagePublisherPlan)
  parseExternalAttestationCommandPlan(value.externalAttestationCommandPlan)
  parseExternalArtifactTransportPlan(value.externalArtifactTransportPlan)
  parseObserverGhToolContract(value.observerGhTool)
  return value
}

function buildExpectedManifest() {
  const manifest = canonicalV0822AcceptanceManifest()
  manifest.schemaVersion = V0823_ACCEPTANCE_SCHEMA_VERSION
  manifest.package.channel = "unpublished"
  manifest.package.scope = "source-candidate"
  manifest.package.version = V0823_PACKAGE_VERSION
  delete manifest.v0821HistoricalRelease
  manifest.v0822HistoricalRelease = {
    outcome: "published-0.8.22-release-is-immutable-and-not-reusable-for-this-unpublished-v0823-source-candidate-or-any-later-package",
    reusableForV0823: false,
    version: "0.8.22",
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
  manifest.authority.readOnlyVerify.artifactDigestInput = "canonical-sha256-prefix-or-exact-64-hex-normalized-before-archive-verification"
  manifest.authority.fixturePlan.registryInstall = "requires-authorized-release-before-registry-install-persona-harness@0.8.23"
  manifest.authority.hostedFixture.revision = "v0823-source-candidate-head-before-authorized-release"
  manifest.hostedResidual.id = "v0823-current-package-acceptance-and-authorized-current-artifact-observation"
  return manifest
}

function fail() {
  throw new V0823AcceptanceManifestError("v0823-acceptance-schema")
}
