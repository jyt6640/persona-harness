import { readFileSync } from "node:fs"
import { join } from "node:path"
import { isDeepStrictEqual } from "node:util"

import { canonicalBeta17AcceptanceManifest } from "./consumer-authority-beta17-acceptance-schema.mjs"
import {
  canonicalPackagePublisherPlan,
  parseCanonicalPackagePublisherPlan,
} from "./canonical-package-publisher.mjs"
import {
  parseExternalArtifactTransportPlan,
} from "./consumer-authority-external-artifact-transport-plan.mjs"
import { parseExternalAttestationCommandPlan } from "./consumer-authority-external-attestation-command-plan.mjs"

export const BETA18_ACCEPTANCE_SCHEMA_VERSION = "consumer-authority-beta18-acceptance.1"

const BETA18_PACKAGE_VERSION = "0.8.0-beta.18"
const ACCEPTANCE_PATH = join("docs", "current", "release", "consumer-authority-beta18-acceptance.json")
const EXPECTED_MANIFEST = buildExpectedManifest()

export class Beta18AcceptanceManifestError extends Error {
  constructor(code) {
    super(code)
    this.code = code
  }
}

export function canonicalBeta18AcceptanceManifest() {
  return structuredClone(EXPECTED_MANIFEST)
}

export function readBeta18AcceptanceManifest(packageRoot) {
  let packageVersion
  let value
  try {
    packageVersion = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8")).version
    value = JSON.parse(readFileSync(join(packageRoot, ACCEPTANCE_PATH), "utf8"))
  } catch {
    fail()
  }
  return parseBeta18AcceptanceManifest(value, packageVersion)
}

export function parseBeta18AcceptanceManifest(value, packageVersion) {
  if (packageVersion !== BETA18_PACKAGE_VERSION || !isDeepStrictEqual(value, EXPECTED_MANIFEST)) fail()
  parseCanonicalPackagePublisherPlan(value.canonicalPackagePublisherPlan)
  parseExternalAttestationCommandPlan(value.externalAttestationCommandPlan)
  parseExternalArtifactTransportPlan(value.externalArtifactTransportPlan)
  return value
}

function buildExpectedManifest() {
  const manifest = canonicalBeta17AcceptanceManifest()
  manifest.schemaVersion = BETA18_ACCEPTANCE_SCHEMA_VERSION
  manifest.package.version = BETA18_PACKAGE_VERSION
  manifest.beta17HistoricalPublish = {
    beta16Registry: "present-in-public-registry",
    outcome: "canonical-tar-and-provenance-completed-before-authorization-shaped-registry-put-e404",
    reusableForBeta18: false,
    version: "0.8.0-beta.17",
  }
  manifest.canonicalPackagePublisherPlan = canonicalPackagePublisherPlan()
  manifest.packageBoundary.contentIdentity.canonicalPacker.publish = "handoff-one-exact-canonical-tarball-to-isolated-node24-npm11-publisher"
  manifest.packageBoundary.contentIdentity.publisherRuntime = "node24.18.0-npm11.16.0-dry-run-and-real-publish-use-identical-canonical-tarball-argv"
  manifest.packageBoundary.authoritativeBundleContract.installedContract = "fresh-installed-package-exercise-uses-the-exact-canonical-target-tarball-sha256-and-package-content-identity-before-the-separate-node24-publisher-handoff"
  manifest.packageBoundary.authoritativeBundleContract.partialCloneSourceHydration = "only-a-blob-none-promisor-clone-with-the-exact-canonical-origin-may-no-filter-hydrate-the-retained-origin-main-sha-before-local-bundle-materialization-without-moving-refs"
  manifest.authority.fixturePlan.registryInstall = "npm install persona-harness@0.8.0-beta.18 --registry https://registry.npmjs.org"
  manifest.authority.hostedFixture.revision = "postmerge-persona-harness-beta18-main-sha"
  manifest.hostedResidual = {
    id: "beta18-node24-npm11-canonical-tar-registry-put",
    requiredEvidence: "a Node20/npm10 canonical tarball and facts, a separate isolated Node24/npm11 publisher dry-run using the exact canonical tarball argv, and the one npm Trusted Publishing registry PUT followed by registry raw-byte, integrity, and package-content-identity readback",
    whyLocalCannotClose: "Only npm's trusted-publishing registry endpoint can decide the real registry PUT. The observed beta17 E404 was authorization-shaped and is not evidence that beta16 is absent from the public registry.",
  }
  return manifest
}

function fail() {
  throw new Beta18AcceptanceManifestError("beta18-acceptance-schema")
}
