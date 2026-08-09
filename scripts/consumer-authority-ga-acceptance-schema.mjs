import { readFileSync } from "node:fs"
import { join } from "node:path"
import { isDeepStrictEqual } from "node:util"

import { canonicalBeta33AcceptanceManifest } from "./consumer-authority-beta33-acceptance-schema.mjs"
import { parseCanonicalPackagePublisherPlan } from "./canonical-package-publisher.mjs"
import { parseExternalArtifactTransportPlan } from "./consumer-authority-external-artifact-transport-plan.mjs"
import { parseExternalAttestationCommandPlan } from "./consumer-authority-external-attestation-command-plan.mjs"
import { parseObserverGhToolContract } from "./consumer-authority-observer-gh-tool.mjs"

export const GA_ACCEPTANCE_SCHEMA_VERSION = "consumer-authority-ga-acceptance.1"

const GA_PACKAGE_VERSION = "0.8.0"
const ACCEPTANCE_PATH = join("docs", "current", "release", "consumer-authority-ga-acceptance.json")
const EXPECTED_MANIFEST = buildExpectedManifest()

export class GaAcceptanceManifestError extends Error {
  constructor(code) {
    super(code)
    this.code = code
  }
}

export function canonicalGaAcceptanceManifest() {
  return structuredClone(EXPECTED_MANIFEST)
}

export function readGaAcceptanceManifest(packageRoot) {
  let packageVersion
  let value
  try {
    packageVersion = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8")).version
    value = JSON.parse(readFileSync(join(packageRoot, ACCEPTANCE_PATH), "utf8"))
  } catch {
    fail()
  }
  return parseGaAcceptanceManifest(value, packageVersion)
}

export function parseGaAcceptanceManifest(value, packageVersion) {
  if (packageVersion !== GA_PACKAGE_VERSION || !isDeepStrictEqual(value, EXPECTED_MANIFEST)) fail()
  parseCanonicalPackagePublisherPlan(value.canonicalPackagePublisherPlan)
  parseExternalAttestationCommandPlan(value.externalAttestationCommandPlan)
  parseExternalArtifactTransportPlan(value.externalArtifactTransportPlan)
  parseObserverGhToolContract(value.observerGhTool)
  return value
}

/**
 * 0 supersedes beta.33 for a procedural reason, not a code change: the
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
  manifest.schemaVersion = GA_ACCEPTANCE_SCHEMA_VERSION
  manifest.package.version = GA_PACKAGE_VERSION
  // The record declares the channel it was accepted for. Carrying `staging-only`
  // into a general-availability record would state something untrue on its face.
  manifest.package.channel = "latest"
  manifest.package.scope = "ga-approved"
  manifest.rc1HistoricalNextChannelOnly = {
    outcome: "published-to-the-next-channel-to-open-the-release-candidate-cycle-the-integrity-roadmap-requires-before-stable-and-establishes-no-latest-or-general-availability-claim-on-its-own",
    reusableForGa: false,
    version: "0.8.0-rc.1",
  }
  manifest.authority.fixturePlan.registryInstall = "npm install persona-harness@0.8.0 --registry https://registry.npmjs.org"
  manifest.authority.hostedFixture.revision = "postmerge-persona-harness-ga-main-sha"
  manifest.hostedResidual.id = "ga-v4-prearmed-same-commit-current-artifact-fetch-consume-replay"
  return manifest
}

function fail() {
  throw new GaAcceptanceManifestError("ga-acceptance-schema")
}
