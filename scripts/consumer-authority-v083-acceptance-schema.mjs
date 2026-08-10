import { readFileSync } from "node:fs"
import { join } from "node:path"
import { isDeepStrictEqual } from "node:util"

import { canonicalV082AcceptanceManifest } from "./consumer-authority-v082-acceptance-schema.mjs"
import { parseCanonicalPackagePublisherPlan } from "./canonical-package-publisher.mjs"
import { parseExternalArtifactTransportPlan } from "./consumer-authority-external-artifact-transport-plan.mjs"
import { parseExternalAttestationCommandPlan } from "./consumer-authority-external-attestation-command-plan.mjs"
import { parseObserverGhToolContract } from "./consumer-authority-observer-gh-tool.mjs"

export const V083_ACCEPTANCE_SCHEMA_VERSION = "consumer-authority-v083-acceptance.1"

const V083_PACKAGE_VERSION = "0.8.3"
const ACCEPTANCE_PATH = join("docs", "current", "release", "consumer-authority-v083-acceptance.json")
const EXPECTED_MANIFEST = buildExpectedManifest()

export class V083AcceptanceManifestError extends Error {
  constructor(code) {
    super(code)
    this.code = code
  }
}

export function canonicalV083AcceptanceManifest() {
  return structuredClone(EXPECTED_MANIFEST)
}

export function readV083AcceptanceManifest(packageRoot) {
  let packageVersion
  let value
  try {
    packageVersion = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8")).version
    value = JSON.parse(readFileSync(join(packageRoot, ACCEPTANCE_PATH), "utf8"))
  } catch {
    fail()
  }
  return parseV083AcceptanceManifest(value, packageVersion)
}

export function parseV083AcceptanceManifest(value, packageVersion) {
  if (packageVersion !== V083_PACKAGE_VERSION || !isDeepStrictEqual(value, EXPECTED_MANIFEST)) fail()
  parseCanonicalPackagePublisherPlan(value.canonicalPackagePublisherPlan)
  parseExternalAttestationCommandPlan(value.externalAttestationCommandPlan)
  parseExternalArtifactTransportPlan(value.externalArtifactTransportPlan)
  parseObserverGhToolContract(value.observerGhTool)
  return value
}

function buildExpectedManifest() {
  const manifest = canonicalV082AcceptanceManifest()
  manifest.schemaVersion = V083_ACCEPTANCE_SCHEMA_VERSION
  manifest.package.channel = "unpublished"
  manifest.package.scope = "source-candidate"
  manifest.package.version = V083_PACKAGE_VERSION
  manifest.v082HistoricalRelease = {
    outcome: "published-latest-v082-release-is-immutable-and-not-reusable-for-this-unpublished-v083-source-candidate-or-any-later-package",
    reusableForV083: false,
    version: "0.8.2",
  }
  manifest.authority.fixturePlan.registryInstall = "requires-authorized-release-before-registry-install-persona-harness@0.8.3"
  manifest.authority.hostedFixture.revision = "v083-source-candidate-head-before-authorized-release"
  manifest.hostedResidual.id = "v083-current-package-acceptance-and-authorized-current-artifact-observation"
  return manifest
}

function fail() {
  throw new V083AcceptanceManifestError("v083-acceptance-schema")
}
