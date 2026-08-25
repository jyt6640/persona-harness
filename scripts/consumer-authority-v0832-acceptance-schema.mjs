import { readFileSync } from "node:fs"
import { join } from "node:path"
import { isDeepStrictEqual } from "node:util"

import { canonicalV0831AcceptanceManifest } from "./consumer-authority-v0831-acceptance-schema.mjs"
import { parseCanonicalPackagePublisherPlan } from "./canonical-package-publisher.mjs"
import { parseExternalArtifactTransportPlan } from "./consumer-authority-external-artifact-transport-plan.mjs"
import { parseExternalAttestationCommandPlan } from "./consumer-authority-external-attestation-command-plan.mjs"
import { parseObserverGhToolContract } from "./consumer-authority-observer-gh-tool.mjs"

export const V0832_ACCEPTANCE_SCHEMA_VERSION = "consumer-authority-v0832-acceptance.1"

const V0832_PACKAGE_VERSION = "0.8.32"
const ACCEPTANCE_PATH = join("docs", "current", "release", "consumer-authority-v0832-acceptance.json")
const EXPECTED_MANIFEST = buildExpectedManifest()

export class V0832AcceptanceManifestError extends Error {
  constructor(code) {
    super(code)
    this.code = code
  }
}

export function canonicalV0832AcceptanceManifest() {
  return structuredClone(EXPECTED_MANIFEST)
}

export function readV0832AcceptanceManifest(packageRoot) {
  let packageVersion
  let value
  try {
    packageVersion = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8")).version
    value = JSON.parse(readFileSync(join(packageRoot, ACCEPTANCE_PATH), "utf8"))
  } catch {
    fail()
  }
  return parseV0832AcceptanceManifest(value, packageVersion)
}

export function parseV0832AcceptanceManifest(value, packageVersion) {
  if (packageVersion !== V0832_PACKAGE_VERSION || !isDeepStrictEqual(value, EXPECTED_MANIFEST)) fail()
  parseCanonicalPackagePublisherPlan(value.canonicalPackagePublisherPlan)
  parseExternalAttestationCommandPlan(value.externalAttestationCommandPlan)
  parseExternalArtifactTransportPlan(value.externalArtifactTransportPlan)
  parseObserverGhToolContract(value.observerGhTool)
  return value
}

function buildExpectedManifest() {
  const manifest = canonicalV0831AcceptanceManifest()
  manifest.schemaVersion = V0832_ACCEPTANCE_SCHEMA_VERSION
  manifest.package.channel = "unpublished"
  manifest.package.scope = "source-candidate"
  manifest.package.version = V0832_PACKAGE_VERSION
  delete manifest.v0830HistoricalRelease
  manifest.v0831HistoricalRelease = {
    outcome: "published-0.8.31-release-is-immutable-and-not-reusable-for-this-unpublished-v0832-source-candidate-or-any-later-package",
    reusableForV0832: false,
    version: "0.8.31",
  }
  manifest.releaseTruth = {
    stableBody: "stable-release-source-candidate-language-rejected-before-render",
    publishedHistory: "v0831-published-release-remains-immutable-and-nonreusable",
    liveLookup: "package-visible-current-docs-use-live-npm-and-github-lookups-without-a-static-dist-tag-snapshot",
    verification: "source-provenance-audit-package-smoke-unit-repository-and-cooperative-demo-contracts",
  }
  manifest.legacyAutoUpdateRepair = {
    command: "ph update repair --yes",
    eligibility: "only-a-valid-legacy-attach-staging-manifest-with-one-regular-absolute-persona-plugin",
    preservation: "unrelated-opencode-settings-and-user-diverged-owned-files-remain-unchanged",
    rejection: "malformed-symlinked-foreign-or-nonlegacy-state-blocks-before-write",
  }
  manifest.authority.fixturePlan.registryInstall = "requires-authorized-release-before-registry-install-persona-harness@0.8.32"
  manifest.authority.hostedFixture.revision = "v0832-source-candidate-head-before-authorized-release"
  manifest.hostedResidual.id = "v0832-current-package-acceptance-and-authorized-current-artifact-observation"
  return manifest
}

function fail() {
  throw new V0832AcceptanceManifestError("v0832-acceptance-schema")
}
