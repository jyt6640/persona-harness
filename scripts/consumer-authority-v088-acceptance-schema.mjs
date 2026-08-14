import { readFileSync } from "node:fs"
import { join } from "node:path"
import { isDeepStrictEqual } from "node:util"

import { canonicalV087AcceptanceManifest } from "./consumer-authority-v087-acceptance-schema.mjs"
import { parseCanonicalPackagePublisherPlan } from "./canonical-package-publisher.mjs"
import { parseExternalArtifactTransportPlan } from "./consumer-authority-external-artifact-transport-plan.mjs"
import { parseExternalAttestationCommandPlan } from "./consumer-authority-external-attestation-command-plan.mjs"
import { parseObserverGhToolContract } from "./consumer-authority-observer-gh-tool.mjs"

export const V088_ACCEPTANCE_SCHEMA_VERSION = "consumer-authority-v088-acceptance.1"

const V088_PACKAGE_VERSION = "0.8.8"
const ACCEPTANCE_PATH = join("docs", "current", "release", "consumer-authority-v088-acceptance.json")
const EXPECTED_MANIFEST = buildExpectedManifest()

export class V088AcceptanceManifestError extends Error {
  constructor(code) {
    super(code)
    this.code = code
  }
}

export function canonicalV088AcceptanceManifest() {
  return structuredClone(EXPECTED_MANIFEST)
}

export function readV088AcceptanceManifest(packageRoot) {
  let packageVersion
  let value
  try {
    packageVersion = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8")).version
    value = JSON.parse(readFileSync(join(packageRoot, ACCEPTANCE_PATH), "utf8"))
  } catch {
    fail()
  }
  return parseV088AcceptanceManifest(value, packageVersion)
}

export function parseV088AcceptanceManifest(value, packageVersion) {
  if (packageVersion !== V088_PACKAGE_VERSION || !isDeepStrictEqual(value, EXPECTED_MANIFEST)) fail()
  parseCanonicalPackagePublisherPlan(value.canonicalPackagePublisherPlan)
  parseExternalAttestationCommandPlan(value.externalAttestationCommandPlan)
  parseExternalArtifactTransportPlan(value.externalArtifactTransportPlan)
  parseObserverGhToolContract(value.observerGhTool)
  return value
}

function buildExpectedManifest() {
  const manifest = canonicalV087AcceptanceManifest()
  manifest.schemaVersion = V088_ACCEPTANCE_SCHEMA_VERSION
  manifest.package.channel = "unpublished"
  manifest.package.scope = "source-candidate"
  manifest.package.version = V088_PACKAGE_VERSION
  manifest.v082HistoricalRelease = {
    outcome: "published-latest-v082-release-is-immutable-and-not-reusable-for-this-unpublished-v088-source-candidate-or-any-later-package",
    reusableForV088: false,
    version: "0.8.2",
  }
  manifest.v083HistoricalRelease = {
    outcome: "published-0.8.3-release-is-immutable-and-not-reusable-for-this-unpublished-v088-source-candidate-or-any-later-package",
    reusableForV088: false,
    version: "0.8.3",
  }
  manifest.v084HistoricalRelease = {
    outcome: "published-0.8.4-release-is-immutable-and-not-reusable-for-this-unpublished-v088-source-candidate-or-any-later-package",
    reusableForV088: false,
    version: "0.8.4",
  }
  manifest.v085HistoricalRelease = {
    outcome: "immutable-v085-tag-release-is-unpublished-history-and-not-reusable-for-this-unpublished-v088-source-candidate-or-any-later-package",
    reusableForV088: false,
    version: "0.8.5",
  }
  manifest.v086HistoricalRelease = {
    outcome: "published-latest-v086-release-is-immutable-and-not-reusable-for-this-unpublished-v088-source-candidate-or-any-later-package",
    reusableForV088: false,
    version: "0.8.6",
  }
  manifest.v087HistoricalRelease = {
    outcome: "published-latest-v087-release-is-immutable-and-not-reusable-for-this-unpublished-v088-source-candidate-or-any-later-package",
    reusableForV088: false,
    version: "0.8.7",
  }
  manifest.authority.fixturePlan.registryInstall = "requires-authorized-release-before-registry-install-persona-harness@0.8.8"
  manifest.authority.hostedFixture.revision = "v088-source-candidate-head-before-authorized-release"
  manifest.hostedResidual.id = "v088-current-package-acceptance-and-authorized-current-artifact-observation"
  return manifest
}

function fail() {
  throw new V088AcceptanceManifestError("v088-acceptance-schema")
}
