import { readFileSync } from "node:fs"
import { join } from "node:path"
import { isDeepStrictEqual } from "node:util"

import { canonicalBeta18AcceptanceManifest } from "./consumer-authority-beta18-acceptance-schema.mjs"
import {
  canonicalPackagePublisherPlan,
  parseCanonicalPackagePublisherPlan,
} from "./canonical-package-publisher.mjs"
import {
  parseExternalArtifactTransportPlan,
} from "./consumer-authority-external-artifact-transport-plan.mjs"
import { parseExternalAttestationCommandPlan } from "./consumer-authority-external-attestation-command-plan.mjs"

export const BETA19_ACCEPTANCE_SCHEMA_VERSION = "consumer-authority-beta19-acceptance.1"

const BETA19_PACKAGE_VERSION = "0.8.0-beta.19"
const ACCEPTANCE_PATH = join("docs", "current", "release", "consumer-authority-beta19-acceptance.json")
const EXPECTED_MANIFEST = buildExpectedManifest()

export class Beta19AcceptanceManifestError extends Error {
  constructor(code) {
    super(code)
    this.code = code
  }
}

export function canonicalBeta19AcceptanceManifest() {
  return structuredClone(EXPECTED_MANIFEST)
}

export function readBeta19AcceptanceManifest(packageRoot) {
  let packageVersion
  let value
  try {
    packageVersion = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8")).version
    value = JSON.parse(readFileSync(join(packageRoot, ACCEPTANCE_PATH), "utf8"))
  } catch {
    fail()
  }
  return parseBeta19AcceptanceManifest(value, packageVersion)
}

export function parseBeta19AcceptanceManifest(value, packageVersion) {
  if (packageVersion !== BETA19_PACKAGE_VERSION || !isDeepStrictEqual(value, EXPECTED_MANIFEST)) fail()
  parseCanonicalPackagePublisherPlan(value.canonicalPackagePublisherPlan)
  parseExternalAttestationCommandPlan(value.externalAttestationCommandPlan)
  parseExternalArtifactTransportPlan(value.externalArtifactTransportPlan)
  return value
}

function buildExpectedManifest() {
  const manifest = canonicalBeta18AcceptanceManifest()
  manifest.schemaVersion = BETA19_ACCEPTANCE_SCHEMA_VERSION
  manifest.package.version = BETA19_PACKAGE_VERSION
  manifest.beta18HistoricalPublish = {
    contentIdentity: "bf3de031ae9ed6d9ab290291f151d0befc1fc4804465f55bddb5ad382399a150",
    outcome: "registry-publish-succeeded-and-canonical-registry-bytes-matched-before-an-unsupported-githead-metadata-requirement-blocked-readback",
    rawTarballSha256: "66ef460552d03fd067baf412c1d4952e5bd42811b419c585092fc7a75b4c54e6",
    reusableForBeta19: false,
    version: "0.8.0-beta.18",
  }
  manifest.canonicalPackagePublisherPlan = canonicalPackagePublisherPlan()
  manifest.packageBoundary.contentIdentity.canonicalPacker.publish = "handoff-one-exact-canonical-tarball-to-isolated-node24-npm11-publisher"
  manifest.packageBoundary.contentIdentity.publisherRuntime = "node24.18.0-npm11.16.0-dry-run-and-real-publish-use-identical-canonical-tarball-argv"
  manifest.packageBoundary.contentIdentity.registryReadback = "require-protected-main-tag-source-preflight-and-registry-version-sha1-sri-raw-sha256-and-package-content-identity-to-match-frozen-canonical-package-facts-without-registry-githead"
  manifest.packageBoundary.authoritativeBundleContract.installedContract = "fresh-installed-package-exercise-uses-the-exact-canonical-target-tarball-sha256-and-package-content-identity-before-the-separate-node24-publisher-handoff"
  manifest.packageBoundary.authoritativeBundleContract.partialCloneSourceHydration = "only-a-blob-none-promisor-clone-with-the-exact-canonical-origin-may-no-filter-hydrate-the-retained-origin-main-sha-before-local-bundle-materialization-without-moving-refs"
  manifest.packageBoundary.registryReadback = {
    failureEvidence: "sanitized-readback-is-uploaded-even-when-postpublish-reconciliation-blocks",
    sourceBinding: "workflow-verified-canonical-tar",
    unsupportedMetadata: "registry-githead-is-neither-required-nor-reflected",
  }
  manifest.authority.fixturePlan.registryInstall = "npm install persona-harness@0.8.0-beta.19 --registry https://registry.npmjs.org"
  manifest.authority.hostedFixture.revision = "postmerge-persona-harness-beta19-main-sha"
  manifest.hostedResidual = {
    id: "beta19-node24-npm11-canonical-tar-registry-reconciliation",
    requiredEvidence: "a protected main/tag source preflight, Node20/npm10 canonical tarball and facts, a separate isolated Node24/npm11 publisher dry-run using the exact canonical tarball argv, and one npm Trusted Publishing registry PUT followed by a sanitized registry version, selected-tag, SHA-1/SRI, raw-SHA-256, and package-content-identity reconciliation",
    whyLocalCannotClose: "Only npm's trusted-publishing registry endpoint can decide the real registry PUT and expose the final registry tarball. The beta18 registry bytes matched canonical facts, but its failed unsupported gitHead metadata predicate is non-reusable evidence.",
  }
  return manifest
}

function fail() {
  throw new Beta19AcceptanceManifestError("beta19-acceptance-schema")
}
