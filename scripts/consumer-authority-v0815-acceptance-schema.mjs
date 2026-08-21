import { readFileSync } from "node:fs"
import { join } from "node:path"
import { isDeepStrictEqual } from "node:util"

import { canonicalV0814AcceptanceManifest } from "./consumer-authority-v0814-acceptance-schema.mjs"
import { parseCanonicalPackagePublisherPlan } from "./canonical-package-publisher.mjs"
import { parseExternalArtifactTransportPlan } from "./consumer-authority-external-artifact-transport-plan.mjs"
import { parseExternalAttestationCommandPlan } from "./consumer-authority-external-attestation-command-plan.mjs"
import { parseObserverGhToolContract } from "./consumer-authority-observer-gh-tool.mjs"

export const V0815_ACCEPTANCE_SCHEMA_VERSION = "consumer-authority-v0815-acceptance.1"

const V0815_PACKAGE_VERSION = "0.8.15"
const ACCEPTANCE_PATH = join("docs", "current", "release", "consumer-authority-v0815-acceptance.json")
const EXPECTED_MANIFEST = buildExpectedManifest()

export class V0815AcceptanceManifestError extends Error {
  constructor(code) {
    super(code)
    this.code = code
  }
}

export function canonicalV0815AcceptanceManifest() {
  return structuredClone(EXPECTED_MANIFEST)
}

export function readV0815AcceptanceManifest(packageRoot) {
  let packageVersion
  let value
  try {
    packageVersion = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8")).version
    value = JSON.parse(readFileSync(join(packageRoot, ACCEPTANCE_PATH), "utf8"))
  } catch {
    fail()
  }
  return parseV0815AcceptanceManifest(value, packageVersion)
}

export function parseV0815AcceptanceManifest(value, packageVersion) {
  if (packageVersion !== V0815_PACKAGE_VERSION || !isDeepStrictEqual(value, EXPECTED_MANIFEST)) fail()
  parseCanonicalPackagePublisherPlan(value.canonicalPackagePublisherPlan)
  parseExternalAttestationCommandPlan(value.externalAttestationCommandPlan)
  parseExternalArtifactTransportPlan(value.externalArtifactTransportPlan)
  parseObserverGhToolContract(value.observerGhTool)
  return value
}

function buildExpectedManifest() {
  const manifest = canonicalV0814AcceptanceManifest()
  manifest.schemaVersion = V0815_ACCEPTANCE_SCHEMA_VERSION
  manifest.package.channel = "unpublished"
  manifest.package.scope = "source-candidate"
  manifest.package.version = V0815_PACKAGE_VERSION
  manifest.v0814HistoricalRelease = {
    outcome: "published-0.8.14-release-is-immutable-and-not-reusable-for-this-unpublished-v0815-source-candidate-or-any-later-package",
    reusableForV0815: false,
    version: "0.8.14",
  }
  manifest.authority.readOnlyVerify = {
    command: "ph authority verify",
    input: ["archive", "artifactId", "runId", "sourceHead", "artifactDigest"],
    schemaVersion: "consumer-authority-verify.1",
    output: ["authorityEligible", "consumptionState", "reason", "schemaVersion", "sourceFallback", "state"],
    trustUnavailable: ["dns-unavailable", "network-unavailable", "trust-root-unavailable", "verification-timeout"],
    noCredentialFetchStoreConsumeFinishReplay: true,
    malformedMismatchSymlinkSourceStaleRuntime: "blocked",
  }
  manifest.authority.fixturePlan.registryInstall = "requires-authorized-release-before-registry-install-persona-harness@0.8.15"
  manifest.authority.hostedFixture.revision = "v0815-source-candidate-head-before-authorized-release"
  manifest.hostedResidual.id = "v0815-current-package-acceptance-and-authorized-current-artifact-observation"
  return manifest
}

function fail() {
  throw new V0815AcceptanceManifestError("v0815-acceptance-schema")
}
