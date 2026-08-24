import { readFileSync } from "node:fs"
import { join } from "node:path"
import { isDeepStrictEqual } from "node:util"

import { canonicalV0830AcceptanceManifest } from "./consumer-authority-v0830-acceptance-schema.mjs"
import { parseCanonicalPackagePublisherPlan } from "./canonical-package-publisher.mjs"
import { parseExternalArtifactTransportPlan } from "./consumer-authority-external-artifact-transport-plan.mjs"
import { parseExternalAttestationCommandPlan } from "./consumer-authority-external-attestation-command-plan.mjs"
import { parseObserverGhToolContract } from "./consumer-authority-observer-gh-tool.mjs"

export const V0831_ACCEPTANCE_SCHEMA_VERSION = "consumer-authority-v0831-acceptance.1"

const V0831_PACKAGE_VERSION = "0.8.31"
const ACCEPTANCE_PATH = join("docs", "current", "release", "consumer-authority-v0831-acceptance.json")
const EXPECTED_MANIFEST = buildExpectedManifest()

export class V0831AcceptanceManifestError extends Error {
  constructor(code) {
    super(code)
    this.code = code
  }
}

export function canonicalV0831AcceptanceManifest() {
  return structuredClone(EXPECTED_MANIFEST)
}

export function readV0831AcceptanceManifest(packageRoot) {
  let packageVersion
  let value
  try {
    packageVersion = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8")).version
    value = JSON.parse(readFileSync(join(packageRoot, ACCEPTANCE_PATH), "utf8"))
  } catch {
    fail()
  }
  return parseV0831AcceptanceManifest(value, packageVersion)
}

export function parseV0831AcceptanceManifest(value, packageVersion) {
  if (packageVersion !== V0831_PACKAGE_VERSION || !isDeepStrictEqual(value, EXPECTED_MANIFEST)) fail()
  parseCanonicalPackagePublisherPlan(value.canonicalPackagePublisherPlan)
  parseExternalAttestationCommandPlan(value.externalAttestationCommandPlan)
  parseExternalArtifactTransportPlan(value.externalArtifactTransportPlan)
  parseObserverGhToolContract(value.observerGhTool)
  return value
}

function buildExpectedManifest() {
  const manifest = canonicalV0830AcceptanceManifest()
  manifest.schemaVersion = V0831_ACCEPTANCE_SCHEMA_VERSION
  manifest.package.channel = "unpublished"
  manifest.package.scope = "source-candidate"
  manifest.package.version = V0831_PACKAGE_VERSION
  delete manifest.v0829HistoricalRelease
  manifest.v0830HistoricalRelease = {
    outcome: "published-0.8.30-release-is-immutable-and-not-reusable-for-this-unpublished-v0831-source-candidate-or-any-later-package",
    reusableForV0831: false,
    version: "0.8.30",
  }
  manifest.releaseTruth = {
    stableBody: "stable-release-source-candidate-language-rejected-before-render",
    publishedHistory: "v0830-published-release-remains-immutable-and-nonreusable",
    liveLookup: "package-visible-current-docs-use-live-npm-and-github-lookups-without-a-static-dist-tag-snapshot",
    verification: "source-provenance-audit-package-smoke-unit-repository-and-cooperative-demo-contracts",
  }
  manifest.workflowFinishSourceReadDiagnostic = {
    blockerId: "source-read-runtime-unavailable",
    recordedArtifacts: "diagnostic-only-and-never-finish-authority",
    retry: "restore-source-read-environment-before-retrying-finish",
  }
  manifest.authority.fixturePlan.registryInstall = "requires-authorized-release-before-registry-install-persona-harness@0.8.31"
  manifest.authority.hostedFixture.revision = "v0831-source-candidate-head-before-authorized-release"
  manifest.hostedResidual.id = "v0831-current-package-acceptance-and-authorized-current-artifact-observation"
  return manifest
}

function fail() {
  throw new V0831AcceptanceManifestError("v0831-acceptance-schema")
}
