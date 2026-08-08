import { readFileSync } from "node:fs"
import { join } from "node:path"
import { isDeepStrictEqual } from "node:util"

import { canonicalBeta33AcceptanceManifest } from "./consumer-authority-beta33-acceptance-schema.mjs"
import { parseCanonicalPackagePublisherPlan } from "./canonical-package-publisher.mjs"
import { parseExternalArtifactTransportPlan } from "./consumer-authority-external-artifact-transport-plan.mjs"
import { parseExternalAttestationCommandPlan } from "./consumer-authority-external-attestation-command-plan.mjs"
import { parseObserverGhToolContract } from "./consumer-authority-observer-gh-tool.mjs"

export const BETA34_ACCEPTANCE_SCHEMA_VERSION = "consumer-authority-beta34-acceptance.1"

const BETA34_PACKAGE_VERSION = "0.8.0-beta.34"
const ACCEPTANCE_PATH = join("docs", "current", "release", "consumer-authority-beta34-acceptance.json")
const EXPECTED_MANIFEST = buildExpectedManifest()

export class Beta34AcceptanceManifestError extends Error {
  constructor(code) {
    super(code)
    this.code = code
  }
}

export function canonicalBeta34AcceptanceManifest() {
  return structuredClone(EXPECTED_MANIFEST)
}

export function readBeta34AcceptanceManifest(packageRoot) {
  let packageVersion
  let value
  try {
    packageVersion = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8")).version
    value = JSON.parse(readFileSync(join(packageRoot, ACCEPTANCE_PATH), "utf8"))
  } catch {
    fail()
  }
  return parseBeta34AcceptanceManifest(value, packageVersion)
}

export function parseBeta34AcceptanceManifest(value, packageVersion) {
  if (packageVersion !== BETA34_PACKAGE_VERSION || !isDeepStrictEqual(value, EXPECTED_MANIFEST)) fail()
  parseCanonicalPackagePublisherPlan(value.canonicalPackagePublisherPlan)
  parseExternalAttestationCommandPlan(value.externalAttestationCommandPlan)
  parseExternalArtifactTransportPlan(value.externalArtifactTransportPlan)
  parseObserverGhToolContract(value.observerGhTool)
  return value
}

/**
 * beta.34 supersedes beta.33 for a procedural reason, not a code change: the
 * two versions carry the same tree. beta.33 reached the registry outside
 * `.github/workflows/publish.yml`, so neither the npm provenance attestation
 * nor the `release-registry-readback.mjs` record exists for it, and npm does
 * not allow republishing a version to add them.
 *
 * Every field below is either a version string or a statement of a verified
 * registry fact. Nothing here asserts a new acceptance outcome.
 */
function buildExpectedManifest() {
  const manifest = canonicalBeta33AcceptanceManifest()
  manifest.schemaVersion = BETA34_ACCEPTANCE_SCHEMA_VERSION
  manifest.package.version = BETA34_PACKAGE_VERSION
  manifest.beta33HistoricalRegistryPublish = {
    outcome: "published-to-staging-outside-the-governed-publish-workflow-so-no-npm-provenance-attestation-and-no-release-registry-readback-record-exist-for-that-version-and-npm-forbids-republishing-it-to-add-them",
    reusableForBeta34: false,
    version: "0.8.0-beta.33",
  }
  manifest.authority.fixturePlan.registryInstall = "npm install persona-harness@0.8.0-beta.34 --registry https://registry.npmjs.org"
  manifest.authority.hostedFixture.revision = "postmerge-persona-harness-beta34-main-sha"
  manifest.hostedResidual.id = "beta34-v4-prearmed-same-commit-current-artifact-fetch-consume-replay"
  return manifest
}

function fail() {
  throw new Beta34AcceptanceManifestError("beta34-acceptance-schema")
}
