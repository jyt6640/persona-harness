import { readFileSync } from "node:fs"
import { join } from "node:path"
import { isDeepStrictEqual } from "node:util"

import { canonicalV0815AcceptanceManifest } from "./consumer-authority-v0815-acceptance-schema.mjs"
import { parseCanonicalPackagePublisherPlan } from "./canonical-package-publisher.mjs"
import { parseExternalArtifactTransportPlan } from "./consumer-authority-external-artifact-transport-plan.mjs"
import { parseExternalAttestationCommandPlan } from "./consumer-authority-external-attestation-command-plan.mjs"
import { parseObserverGhToolContract } from "./consumer-authority-observer-gh-tool.mjs"

export const V0816_ACCEPTANCE_SCHEMA_VERSION = "consumer-authority-v0816-acceptance.1"

const V0816_PACKAGE_VERSION = "0.8.16"
const ACCEPTANCE_PATH = join("docs", "current", "release", "consumer-authority-v0816-acceptance.json")
const EXPECTED_MANIFEST = buildExpectedManifest()

export class V0816AcceptanceManifestError extends Error {
  constructor(code) {
    super(code)
    this.code = code
  }
}

export function canonicalV0816AcceptanceManifest() {
  return structuredClone(EXPECTED_MANIFEST)
}

export function readV0816AcceptanceManifest(packageRoot) {
  let packageVersion
  let value
  try {
    packageVersion = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8")).version
    value = JSON.parse(readFileSync(join(packageRoot, ACCEPTANCE_PATH), "utf8"))
  } catch {
    fail()
  }
  return parseV0816AcceptanceManifest(value, packageVersion)
}

export function parseV0816AcceptanceManifest(value, packageVersion) {
  if (packageVersion !== V0816_PACKAGE_VERSION || !isDeepStrictEqual(value, EXPECTED_MANIFEST)) fail()
  parseCanonicalPackagePublisherPlan(value.canonicalPackagePublisherPlan)
  parseExternalAttestationCommandPlan(value.externalAttestationCommandPlan)
  parseExternalArtifactTransportPlan(value.externalArtifactTransportPlan)
  parseObserverGhToolContract(value.observerGhTool)
  return value
}

function buildExpectedManifest() {
  const manifest = canonicalV0815AcceptanceManifest()
  manifest.schemaVersion = V0816_ACCEPTANCE_SCHEMA_VERSION
  manifest.package.channel = "unpublished"
  manifest.package.scope = "source-candidate"
  manifest.package.version = V0816_PACKAGE_VERSION
  manifest.v0815HistoricalRelease = {
    outcome: "published-0.8.15-release-is-immutable-and-not-reusable-for-this-unpublished-v0816-source-candidate-or-any-later-package",
    reusableForV0816: false,
    version: "0.8.15",
  }
  manifest.authority.readOnlyVerify = {
    command: "ph authority verify",
    input: ["archive", "artifactId", "runId", "sourceHead", "artifactDigest"],
    schemaVersion: "consumer-authority-verify.2",
    output: ["authorityEligible", "consumptionState", "reason", "schemaVersion", "sourceFallback", "sourceReason", "state"],
    sourceReason: ["head", "inputs", "identity", "status", "index", "content", "working-tree", "workspace", "unknown"],
    sourceReasonWhen: "present-only-with-reason-source-mismatch",
    nonSourceReasons: "existing-verify-reasons-omit-sourceReason",
    trustUnavailable: ["dns-unavailable", "network-unavailable", "trust-root-unavailable", "verification-timeout"],
    noCredentialFetchStoreConsumeFinishReplay: true,
    malformedMismatchSymlinkSourceStaleRuntime: "blocked",
  }
  manifest.authority.fixturePlan.registryInstall = "requires-authorized-release-before-registry-install-persona-harness@0.8.16"
  manifest.authority.hostedFixture.revision = "v0816-source-candidate-head-before-authorized-release"
  manifest.hostedResidual.id = "v0816-current-package-acceptance-and-authorized-current-artifact-observation"
  return manifest
}

function fail() {
  throw new V0816AcceptanceManifestError("v0816-acceptance-schema")
}
