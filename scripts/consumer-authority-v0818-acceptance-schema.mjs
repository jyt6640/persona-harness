import { readFileSync } from "node:fs"
import { join } from "node:path"
import { isDeepStrictEqual } from "node:util"

import { canonicalV0817AcceptanceManifest } from "./consumer-authority-v0817-acceptance-schema.mjs"
import { parseCanonicalPackagePublisherPlan } from "./canonical-package-publisher.mjs"
import { parseExternalArtifactTransportPlan } from "./consumer-authority-external-artifact-transport-plan.mjs"
import { parseExternalAttestationCommandPlan } from "./consumer-authority-external-attestation-command-plan.mjs"
import { parseObserverGhToolContract } from "./consumer-authority-observer-gh-tool.mjs"

export const V0818_ACCEPTANCE_SCHEMA_VERSION = "consumer-authority-v0818-acceptance.1"

const V0818_PACKAGE_VERSION = "0.8.18"
const ACCEPTANCE_PATH = join("docs", "current", "release", "consumer-authority-v0818-acceptance.json")
const EXPECTED_MANIFEST = buildExpectedManifest()

export class V0818AcceptanceManifestError extends Error {
  constructor(code) {
    super(code)
    this.code = code
  }
}

export function canonicalV0818AcceptanceManifest() {
  return structuredClone(EXPECTED_MANIFEST)
}

export function readV0818AcceptanceManifest(packageRoot) {
  let packageVersion
  let value
  try {
    packageVersion = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8")).version
    value = JSON.parse(readFileSync(join(packageRoot, ACCEPTANCE_PATH), "utf8"))
  } catch {
    fail()
  }
  return parseV0818AcceptanceManifest(value, packageVersion)
}

export function parseV0818AcceptanceManifest(value, packageVersion) {
  if (packageVersion !== V0818_PACKAGE_VERSION || !isDeepStrictEqual(value, EXPECTED_MANIFEST)) fail()
  parseCanonicalPackagePublisherPlan(value.canonicalPackagePublisherPlan)
  parseExternalAttestationCommandPlan(value.externalAttestationCommandPlan)
  parseExternalArtifactTransportPlan(value.externalArtifactTransportPlan)
  parseObserverGhToolContract(value.observerGhTool)
  return value
}

function buildExpectedManifest() {
  const manifest = canonicalV0817AcceptanceManifest()
  manifest.schemaVersion = V0818_ACCEPTANCE_SCHEMA_VERSION
  manifest.package.channel = "unpublished"
  manifest.package.scope = "source-candidate"
  manifest.package.version = V0818_PACKAGE_VERSION
  manifest.v0817HistoricalRelease = {
    outcome: "published-0.8.17-release-is-immutable-and-not-reusable-for-this-unpublished-v0818-source-candidate-or-any-later-package",
    reusableForV0818: false,
    version: "0.8.17",
  }
  manifest.authority.readOnlyVerify.archiveInput = {
    arbitrarySymlinkAncestorOrLeaf: "blocked-before-verifier-or-store",
    darwinSystemTemporaryAlias: "only-root-owned-/tmp-symlink-to-private-tmp-is-canonicalized-before-no-follow-validation",
    nonDarwin: "uses-input-absolute-path-without-temporary-alias-canonicalization",
  }
  manifest.authority.fixturePlan.registryInstall = "requires-authorized-release-before-registry-install-persona-harness@0.8.18"
  manifest.authority.hostedFixture.revision = "v0818-source-candidate-head-before-authorized-release"
  manifest.hostedResidual.id = "v0818-current-package-acceptance-and-authorized-current-artifact-observation"
  return manifest
}

function fail() {
  throw new V0818AcceptanceManifestError("v0818-acceptance-schema")
}
