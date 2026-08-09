import { readFileSync } from "node:fs"
import { join } from "node:path"
import { isDeepStrictEqual } from "node:util"

import { canonicalBeta33AcceptanceManifest } from "./consumer-authority-beta33-acceptance-schema.mjs"
import { parseCanonicalPackagePublisherPlan } from "./canonical-package-publisher.mjs"
import { parseExternalArtifactTransportPlan } from "./consumer-authority-external-artifact-transport-plan.mjs"
import { parseExternalAttestationCommandPlan } from "./consumer-authority-external-attestation-command-plan.mjs"
import { parseObserverGhToolContract } from "./consumer-authority-observer-gh-tool.mjs"

export const RC1_ACCEPTANCE_SCHEMA_VERSION = "consumer-authority-rc1-acceptance.1"

const RC1_PACKAGE_VERSION = "0.8.0-rc.1"
const ACCEPTANCE_PATH = join("docs", "current", "release", "consumer-authority-rc1-acceptance.json")
const EXPECTED_MANIFEST = buildExpectedManifest()

export class Rc1AcceptanceManifestError extends Error {
  constructor(code) {
    super(code)
    this.code = code
  }
}

export function canonicalRc1AcceptanceManifest() {
  return structuredClone(EXPECTED_MANIFEST)
}

export function readRc1AcceptanceManifest(packageRoot) {
  let packageVersion
  let value
  try {
    packageVersion = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8")).version
    value = JSON.parse(readFileSync(join(packageRoot, ACCEPTANCE_PATH), "utf8"))
  } catch {
    fail()
  }
  return parseRc1AcceptanceManifest(value, packageVersion)
}

export function parseRc1AcceptanceManifest(value, packageVersion) {
  if (packageVersion !== RC1_PACKAGE_VERSION || !isDeepStrictEqual(value, EXPECTED_MANIFEST)) fail()
  parseCanonicalPackagePublisherPlan(value.canonicalPackagePublisherPlan)
  parseExternalAttestationCommandPlan(value.externalAttestationCommandPlan)
  parseExternalArtifactTransportPlan(value.externalArtifactTransportPlan)
  parseObserverGhToolContract(value.observerGhTool)
  return value
}

/**
 * rc.1 supersedes beta.33 for a procedural reason, not a code change: the
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
  manifest.schemaVersion = RC1_ACCEPTANCE_SCHEMA_VERSION
  manifest.package.version = RC1_PACKAGE_VERSION
  manifest.beta34HistoricalStagingOnly = {
    outcome: "accepted-as-consumer-authority-beta-on-the-staging-channel-only-with-a-go-decision-carrying-conditions-so-it-does-not-establish-a-release-candidate-or-latest-claim",
    reusableForRc1: false,
    version: "0.8.0-beta.34",
  }
  manifest.authority.fixturePlan.registryInstall = "npm install persona-harness@0.8.0-rc.1 --registry https://registry.npmjs.org"
  manifest.authority.hostedFixture.revision = "postmerge-persona-harness-rc1-main-sha"
  manifest.hostedResidual.id = "rc1-v4-prearmed-same-commit-current-artifact-fetch-consume-replay"
  return manifest
}

function fail() {
  throw new Rc1AcceptanceManifestError("rc1-acceptance-schema")
}
