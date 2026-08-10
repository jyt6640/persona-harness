import { readFileSync } from "node:fs"
import { join } from "node:path"
import { isDeepStrictEqual } from "node:util"

import { canonicalV081AcceptanceManifest } from "./consumer-authority-v081-acceptance-schema.mjs"
import { parseCanonicalPackagePublisherPlan } from "./canonical-package-publisher.mjs"
import { parseExternalArtifactTransportPlan } from "./consumer-authority-external-artifact-transport-plan.mjs"
import { parseExternalAttestationCommandPlan } from "./consumer-authority-external-attestation-command-plan.mjs"
import { parseObserverGhToolContract } from "./consumer-authority-observer-gh-tool.mjs"

export const V082_ACCEPTANCE_SCHEMA_VERSION = "consumer-authority-v082-acceptance.1"

const V082_PACKAGE_VERSION = "0.8.2"
const ACCEPTANCE_PATH = join("docs", "current", "release", "consumer-authority-v082-acceptance.json")
const EXPECTED_MANIFEST = buildExpectedManifest()

export class V082AcceptanceManifestError extends Error {
  constructor(code) {
    super(code)
    this.code = code
  }
}

export function canonicalV082AcceptanceManifest() {
  return structuredClone(EXPECTED_MANIFEST)
}

export function readV082AcceptanceManifest(packageRoot) {
  let packageVersion
  let value
  try {
    packageVersion = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8")).version
    value = JSON.parse(readFileSync(join(packageRoot, ACCEPTANCE_PATH), "utf8"))
  } catch {
    fail()
  }
  return parseV082AcceptanceManifest(value, packageVersion)
}

export function parseV082AcceptanceManifest(value, packageVersion) {
  if (packageVersion !== V082_PACKAGE_VERSION || !isDeepStrictEqual(value, EXPECTED_MANIFEST)) fail()
  parseCanonicalPackagePublisherPlan(value.canonicalPackagePublisherPlan)
  parseExternalAttestationCommandPlan(value.externalAttestationCommandPlan)
  parseExternalArtifactTransportPlan(value.externalArtifactTransportPlan)
  parseObserverGhToolContract(value.observerGhTool)
  return value
}

function buildExpectedManifest() {
  const manifest = canonicalV081AcceptanceManifest()
  manifest.schemaVersion = V082_ACCEPTANCE_SCHEMA_VERSION
  manifest.package.channel = "unpublished"
  manifest.package.scope = "source-candidate"
  manifest.package.version = V082_PACKAGE_VERSION
  manifest.v081HistoricalRelease = {
    outcome: "accepted-for-its-own-v081-tree-and-not-reusable-for-this-unpublished-v082-source-candidate-or-any-later-package",
    reusableForV082: false,
    version: "0.8.1",
  }
  manifest.authority.fixturePlan.registryInstall = "requires-authorized-release-before-registry-install-persona-harness@0.8.2"
  manifest.authority.hostedFixture.revision = "v082-source-candidate-head-before-authorized-release"
  manifest.hostedResidual.id = "v082-current-package-acceptance-and-authorized-current-artifact-observation"
  return manifest
}

function fail() {
  throw new V082AcceptanceManifestError("v082-acceptance-schema")
}
