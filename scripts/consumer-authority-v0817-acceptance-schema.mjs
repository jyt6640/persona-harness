import { readFileSync } from "node:fs"
import { join } from "node:path"
import { isDeepStrictEqual } from "node:util"

import { canonicalV0816AcceptanceManifest } from "./consumer-authority-v0816-acceptance-schema.mjs"
import { parseCanonicalPackagePublisherPlan } from "./canonical-package-publisher.mjs"
import { parseExternalArtifactTransportPlan } from "./consumer-authority-external-artifact-transport-plan.mjs"
import { parseExternalAttestationCommandPlan } from "./consumer-authority-external-attestation-command-plan.mjs"
import { parseObserverGhToolContract } from "./consumer-authority-observer-gh-tool.mjs"

export const V0817_ACCEPTANCE_SCHEMA_VERSION = "consumer-authority-v0817-acceptance.1"

const V0817_PACKAGE_VERSION = "0.8.17"
const ACCEPTANCE_PATH = join("docs", "current", "release", "consumer-authority-v0817-acceptance.json")
const EXPECTED_MANIFEST = buildExpectedManifest()

export class V0817AcceptanceManifestError extends Error {
  constructor(code) {
    super(code)
    this.code = code
  }
}

export function canonicalV0817AcceptanceManifest() {
  return structuredClone(EXPECTED_MANIFEST)
}

export function readV0817AcceptanceManifest(packageRoot) {
  let packageVersion
  let value
  try {
    packageVersion = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8")).version
    value = JSON.parse(readFileSync(join(packageRoot, ACCEPTANCE_PATH), "utf8"))
  } catch {
    fail()
  }
  return parseV0817AcceptanceManifest(value, packageVersion)
}

export function parseV0817AcceptanceManifest(value, packageVersion) {
  if (packageVersion !== V0817_PACKAGE_VERSION || !isDeepStrictEqual(value, EXPECTED_MANIFEST)) fail()
  parseCanonicalPackagePublisherPlan(value.canonicalPackagePublisherPlan)
  parseExternalAttestationCommandPlan(value.externalAttestationCommandPlan)
  parseExternalArtifactTransportPlan(value.externalArtifactTransportPlan)
  parseObserverGhToolContract(value.observerGhTool)
  return value
}

function buildExpectedManifest() {
  const manifest = canonicalV0816AcceptanceManifest()
  manifest.schemaVersion = V0817_ACCEPTANCE_SCHEMA_VERSION
  manifest.package.channel = "unpublished"
  manifest.package.scope = "source-candidate"
  manifest.package.version = V0817_PACKAGE_VERSION
  manifest.v0816HistoricalRelease = {
    outcome: "published-0.8.16-release-is-immutable-and-not-reusable-for-this-unpublished-v0817-source-candidate-or-any-later-package",
    reusableForV0817: false,
    version: "0.8.16",
  }
  manifest.authority.readOnlyVerify.archiveInput = {
    arbitrarySymlinkAncestorOrLeaf: "blocked-before-verifier-or-store",
    darwinSystemTemporaryAlias: "only-root-owned-/tmp-symlink-to-private-tmp-is-canonicalized-before-no-follow-validation",
    nonDarwin: "uses-input-absolute-path-without-temporary-alias-canonicalization",
  }
  manifest.authority.fixturePlan.registryInstall = "requires-authorized-release-before-registry-install-persona-harness@0.8.17"
  manifest.authority.hostedFixture.revision = "v0817-source-candidate-head-before-authorized-release"
  manifest.hostedResidual.id = "v0817-current-package-acceptance-and-authorized-current-artifact-observation"
  return manifest
}

function fail() {
  throw new V0817AcceptanceManifestError("v0817-acceptance-schema")
}
