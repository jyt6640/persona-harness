import { readFileSync } from "node:fs"
import { join } from "node:path"
import { isDeepStrictEqual } from "node:util"

import { canonicalGaAcceptanceManifest } from "./consumer-authority-ga-acceptance-schema.mjs"
import { parseCanonicalPackagePublisherPlan } from "./canonical-package-publisher.mjs"
import { parseExternalArtifactTransportPlan } from "./consumer-authority-external-artifact-transport-plan.mjs"
import { parseExternalAttestationCommandPlan } from "./consumer-authority-external-attestation-command-plan.mjs"
import { parseObserverGhToolContract } from "./consumer-authority-observer-gh-tool.mjs"

export const V081_ACCEPTANCE_SCHEMA_VERSION = "consumer-authority-v081-acceptance.1"

const V081_PACKAGE_VERSION = "0.8.1"
const ACCEPTANCE_PATH = join("docs", "current", "release", "consumer-authority-v081-acceptance.json")
const EXPECTED_MANIFEST = buildExpectedManifest()

export class V081AcceptanceManifestError extends Error {
  constructor(code) {
    super(code)
    this.code = code
  }
}

export function canonicalV081AcceptanceManifest() {
  return structuredClone(EXPECTED_MANIFEST)
}

export function readV081AcceptanceManifest(packageRoot) {
  let packageVersion
  let value
  try {
    packageVersion = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8")).version
    value = JSON.parse(readFileSync(join(packageRoot, ACCEPTANCE_PATH), "utf8"))
  } catch {
    fail()
  }
  return parseV081AcceptanceManifest(value, packageVersion)
}

export function parseV081AcceptanceManifest(value, packageVersion) {
  if (packageVersion !== V081_PACKAGE_VERSION || !isDeepStrictEqual(value, EXPECTED_MANIFEST)) fail()
  parseCanonicalPackagePublisherPlan(value.canonicalPackagePublisherPlan)
  parseExternalAttestationCommandPlan(value.externalAttestationCommandPlan)
  parseExternalArtifactTransportPlan(value.externalArtifactTransportPlan)
  parseObserverGhToolContract(value.observerGhTool)
  return value
}

/**
 * 0.8.1 supersedes 0.8.0 for a code change rather than a procedural one, which
 * makes it the first link in this chain that does.
 *
 * The two fixes it carries are both about a platform the release builds no
 * native project-read artifact for. `workflow finish` there reported a
 * verification that had never run (#235), and the cooperative path could not
 * evaluate a single blocker. Neither changes what a platform *with* an
 * artifact does, and neither relaxes a gate: the same platform still cannot
 * reach a cooperative PASS, and now refuses one explicitly.
 *
 * Every field below is either a version string or a statement of a verified
 * registry fact. Nothing here asserts a new acceptance outcome, and 0.8.0
 * remains the accepted general-availability record for its own tree.
 */
function buildExpectedManifest() {
  const manifest = canonicalGaAcceptanceManifest()
  manifest.schemaVersion = V081_ACCEPTANCE_SCHEMA_VERSION
  manifest.package.version = V081_PACKAGE_VERSION
  manifest.gaHistoricalSupersededByPatch = {
    outcome: "accepted-as-the-general-availability-record-for-its-own-tree-and-superseded-only-for-the-two-no-native-artifact-finish-fixes-this-patch-carries-so-it-establishes-no-claim-about-them",
    reusableForV081: false,
    version: "0.8.0",
  }
  manifest.authority.fixturePlan.registryInstall = "npm install persona-harness@0.8.1 --registry https://registry.npmjs.org"
  manifest.authority.hostedFixture.revision = "postmerge-persona-harness-v081-main-sha"
  manifest.hostedResidual.id = "v081-v4-prearmed-same-commit-current-artifact-fetch-consume-replay"
  return manifest
}

function fail() {
  throw new V081AcceptanceManifestError("v081-acceptance-schema")
}
