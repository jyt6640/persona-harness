import { readFileSync } from "node:fs"
import { join } from "node:path"
import { isDeepStrictEqual } from "node:util"

import { canonicalV0832AcceptanceManifest } from "./consumer-authority-v0832-acceptance-schema.mjs"
import { parseCanonicalPackagePublisherPlan } from "./canonical-package-publisher.mjs"
import { parseExternalArtifactTransportPlan } from "./consumer-authority-external-artifact-transport-plan.mjs"
import { parseExternalAttestationCommandPlan } from "./consumer-authority-external-attestation-command-plan.mjs"
import { parseObserverGhToolContract } from "./consumer-authority-observer-gh-tool.mjs"

export const CURRENT_ACCEPTANCE_SCHEMA_VERSION = "consumer-authority-current-acceptance.1"

const ACCEPTANCE_PATH = join("docs", "current", "release", "consumer-authority-current-acceptance.json")
const CURRENT_SOURCE_CANDIDATE = Object.freeze({
  hostedResidualId: "current-package-acceptance-and-authorized-current-artifact-observation",
  hostedRevision: "current-source-candidate-head-before-authorized-release",
  registryInstall: "requires-authorized-release-before-registry-install",
})
const PREVIOUS_PUBLISHED_RELEASE = Object.freeze({
  outcome: "published-release-is-immutable-and-not-reusable-for-this-current-source-candidate-or-any-later-package",
  reusableForCurrent: false,
  version: "0.8.31",
})
const ACCEPTANCE_RESPONSIBILITIES = Object.freeze({
  package: Object.freeze({
    excludes: Object.freeze(["attestation-parser", "observer-gh-selector"]),
    requires: Object.freeze([
      "exact-tar-provenance",
      "normal-install",
      "installed-only-no-source-fallback",
      "cli-and-approval-before-mutation",
      "post-model-assistant-response-and-pre-approval-trace",
    ]),
  }),
  sourceAndProtectedUbuntuCi: Object.freeze({
    requires: Object.freeze([
      "workflow-owned-dpkg-observer-gh-selection",
      "private-regular-nonsymlink-observer-gh-copy",
      "path-free-attestation-parser-preflight",
    ]),
  }),
})

export class CurrentAcceptanceManifestError extends Error {
  constructor(code) {
    super(code)
    this.code = code
  }
}

export function readCurrentAcceptanceManifest(packageRoot) {
  let packageVersion
  let value
  try {
    packageVersion = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8")).version
    value = JSON.parse(readFileSync(join(packageRoot, ACCEPTANCE_PATH), "utf8"))
  } catch {
    fail()
  }
  return parseCurrentAcceptanceManifest(value, packageVersion)
}

export function parseCurrentAcceptanceManifest(value, packageVersion) {
  if (!isCurrentPackageVersion(packageVersion) || !isDeepStrictEqual(value, expectedCurrentAcceptanceRecord(packageVersion))) fail()

  const manifest = expandCurrentAcceptanceManifest(packageVersion)
  parseCanonicalPackagePublisherPlan(manifest.canonicalPackagePublisherPlan)
  parseExternalAttestationCommandPlan(manifest.externalAttestationCommandPlan)
  parseExternalArtifactTransportPlan(manifest.externalArtifactTransportPlan)
  parseObserverGhToolContract(manifest.observerGhTool)
  return manifest
}

function expectedCurrentAcceptanceRecord(packageVersion) {
  return {
    acceptanceResponsibilities: ACCEPTANCE_RESPONSIBILITIES,
    currentSourceCandidate: CURRENT_SOURCE_CANDIDATE,
    package: {
      channel: "unpublished",
      scope: "source-candidate",
      version: packageVersion,
    },
    previousPublishedRelease: PREVIOUS_PUBLISHED_RELEASE,
    schemaVersion: CURRENT_ACCEPTANCE_SCHEMA_VERSION,
  }
}

function expandCurrentAcceptanceManifest(packageVersion) {
  const manifest = canonicalV0832AcceptanceManifest()
  const record = expectedCurrentAcceptanceRecord(packageVersion)

  manifest.schemaVersion = record.schemaVersion
  manifest.package = record.package
  manifest.acceptanceResponsibilities = record.acceptanceResponsibilities
  manifest.previousPublishedRelease = record.previousPublishedRelease
  manifest.authority.fixturePlan.registryInstall = record.currentSourceCandidate.registryInstall
  manifest.authority.hostedFixture.revision = record.currentSourceCandidate.hostedRevision
  manifest.hostedResidual.id = record.currentSourceCandidate.hostedResidualId
  return manifest
}

function isCurrentPackageVersion(value) {
  return typeof value === "string" && /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(value)
}

function fail() {
  throw new CurrentAcceptanceManifestError("current-acceptance-schema")
}
