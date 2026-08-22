import { readFileSync } from "node:fs"
import { join } from "node:path"
import { isDeepStrictEqual } from "node:util"

import { canonicalV0823AcceptanceManifest } from "./consumer-authority-v0823-acceptance-schema.mjs"
import { parseCanonicalPackagePublisherPlan } from "./canonical-package-publisher.mjs"
import { parseExternalArtifactTransportPlan } from "./consumer-authority-external-artifact-transport-plan.mjs"
import { parseExternalAttestationCommandPlan } from "./consumer-authority-external-attestation-command-plan.mjs"
import { parseObserverGhToolContract } from "./consumer-authority-observer-gh-tool.mjs"

export const V0824_ACCEPTANCE_SCHEMA_VERSION = "consumer-authority-v0824-acceptance.1"

const V0824_PACKAGE_VERSION = "0.8.24"
const ACCEPTANCE_PATH = join("docs", "current", "release", "consumer-authority-v0824-acceptance.json")
const EXPECTED_MANIFEST = buildExpectedManifest()

export class V0824AcceptanceManifestError extends Error {
  constructor(code) {
    super(code)
    this.code = code
  }
}

export function canonicalV0824AcceptanceManifest() {
  return structuredClone(EXPECTED_MANIFEST)
}

export function readV0824AcceptanceManifest(packageRoot) {
  let packageVersion
  let value
  try {
    packageVersion = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8")).version
    value = JSON.parse(readFileSync(join(packageRoot, ACCEPTANCE_PATH), "utf8"))
  } catch {
    fail()
  }
  return parseV0824AcceptanceManifest(value, packageVersion)
}

export function parseV0824AcceptanceManifest(value, packageVersion) {
  if (packageVersion !== V0824_PACKAGE_VERSION || !isDeepStrictEqual(value, EXPECTED_MANIFEST)) fail()
  parseCanonicalPackagePublisherPlan(value.canonicalPackagePublisherPlan)
  parseExternalAttestationCommandPlan(value.externalAttestationCommandPlan)
  parseExternalArtifactTransportPlan(value.externalArtifactTransportPlan)
  parseObserverGhToolContract(value.observerGhTool)
  return value
}

function buildExpectedManifest() {
  const manifest = canonicalV0823AcceptanceManifest()
  manifest.schemaVersion = V0824_ACCEPTANCE_SCHEMA_VERSION
  manifest.package.channel = "unpublished"
  manifest.package.scope = "source-candidate"
  manifest.package.version = V0824_PACKAGE_VERSION
  delete manifest.v0822HistoricalRelease
  manifest.v0823HistoricalRelease = {
    outcome: "published-0.8.23-release-is-immutable-and-not-reusable-for-this-unpublished-v0824-source-candidate-or-any-later-package",
    reusableForV0824: false,
    version: "0.8.23",
  }
  manifest.workflowDemonstration = {
    cooperativeFinish: "exact-packed-package-java21-gradle94-junit-block-to-cooperative-pass",
    protectedCi: "verify-repository-runs-demo-cooperative-finish",
    runtimeInjection: "legacy-hook-demos-explicit-preview-opt-in-default-off",
  }
  manifest.authority.fixturePlan.registryInstall = "requires-authorized-release-before-registry-install-persona-harness@0.8.24"
  manifest.authority.hostedFixture.revision = "v0824-source-candidate-head-before-authorized-release"
  manifest.hostedResidual.id = "v0824-current-package-acceptance-and-authorized-current-artifact-observation"
  return manifest
}

function fail() {
  throw new V0824AcceptanceManifestError("v0824-acceptance-schema")
}
