import { readFileSync } from "node:fs"
import { join } from "node:path"
import { isDeepStrictEqual } from "node:util"

import { canonicalV089AcceptanceManifest } from "./consumer-authority-v089-acceptance-schema.mjs"
import { parseCanonicalPackagePublisherPlan } from "./canonical-package-publisher.mjs"
import { parseExternalArtifactTransportPlan } from "./consumer-authority-external-artifact-transport-plan.mjs"
import { parseExternalAttestationCommandPlan } from "./consumer-authority-external-attestation-command-plan.mjs"
import { parseObserverGhToolContract } from "./consumer-authority-observer-gh-tool.mjs"

export const V0810_ACCEPTANCE_SCHEMA_VERSION = "consumer-authority-v0810-acceptance.1"

const V0810_PACKAGE_VERSION = "0.8.10"
const ACCEPTANCE_PATH = join("docs", "current", "release", "consumer-authority-v0810-acceptance.json")
const EXPECTED_MANIFEST = buildExpectedManifest()

export class V0810AcceptanceManifestError extends Error {
  constructor(code) {
    super(code)
    this.code = code
  }
}

export function canonicalV0810AcceptanceManifest() {
  return structuredClone(EXPECTED_MANIFEST)
}

export function readV0810AcceptanceManifest(packageRoot) {
  let packageVersion
  let value
  try {
    packageVersion = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8")).version
    value = JSON.parse(readFileSync(join(packageRoot, ACCEPTANCE_PATH), "utf8"))
  } catch {
    fail()
  }
  return parseV0810AcceptanceManifest(value, packageVersion)
}

export function parseV0810AcceptanceManifest(value, packageVersion) {
  if (packageVersion !== V0810_PACKAGE_VERSION || !isDeepStrictEqual(value, EXPECTED_MANIFEST)) fail()
  parseCanonicalPackagePublisherPlan(value.canonicalPackagePublisherPlan)
  parseExternalAttestationCommandPlan(value.externalAttestationCommandPlan)
  parseExternalArtifactTransportPlan(value.externalArtifactTransportPlan)
  parseObserverGhToolContract(value.observerGhTool)
  return value
}

function buildExpectedManifest() {
  const manifest = canonicalV089AcceptanceManifest()
  manifest.schemaVersion = V0810_ACCEPTANCE_SCHEMA_VERSION
  manifest.package.channel = "unpublished"
  manifest.package.scope = "source-candidate"
  manifest.package.version = V0810_PACKAGE_VERSION
  manifest.v082HistoricalRelease = {
    outcome: "published-latest-v082-release-is-immutable-and-not-reusable-for-this-unpublished-v0810-source-candidate-or-any-later-package",
    reusableForV0810: false,
    version: "0.8.2",
  }
  manifest.v083HistoricalRelease = {
    outcome: "published-0.8.3-release-is-immutable-and-not-reusable-for-this-unpublished-v0810-source-candidate-or-any-later-package",
    reusableForV0810: false,
    version: "0.8.3",
  }
  manifest.v084HistoricalRelease = {
    outcome: "published-0.8.4-release-is-immutable-and-not-reusable-for-this-unpublished-v0810-source-candidate-or-any-later-package",
    reusableForV0810: false,
    version: "0.8.4",
  }
  manifest.v085HistoricalRelease = {
    outcome: "immutable-v085-tag-release-is-unpublished-history-and-not-reusable-for-this-unpublished-v0810-source-candidate-or-any-later-package",
    reusableForV0810: false,
    version: "0.8.5",
  }
  manifest.v086HistoricalRelease = {
    outcome: "published-latest-v086-release-is-immutable-and-not-reusable-for-this-unpublished-v0810-source-candidate-or-any-later-package",
    reusableForV0810: false,
    version: "0.8.6",
  }
  manifest.v087HistoricalRelease = {
    outcome: "published-latest-v087-release-is-immutable-and-not-reusable-for-this-unpublished-v0810-source-candidate-or-any-later-package",
    reusableForV0810: false,
    version: "0.8.7",
  }
  manifest.v088HistoricalRelease = {
    outcome: "published-latest-v088-release-is-immutable-and-not-reusable-for-this-unpublished-v0810-source-candidate-or-any-later-package",
    reusableForV0810: false,
    version: "0.8.8",
  }
  manifest.v089HistoricalRelease = {
    outcome: "published-latest-v089-release-is-immutable-and-not-reusable-for-this-unpublished-v0810-source-candidate-or-any-later-package",
    reusableForV0810: false,
    version: "0.8.9",
  }
  manifest.authority.fixturePlan.registryInstall = "requires-authorized-release-before-registry-install-persona-harness@0.8.10"
  manifest.authority.hostedFixture.revision = "v0810-source-candidate-head-before-authorized-release"
  manifest.hostedResidual.id = "v0810-current-package-acceptance-and-authorized-current-artifact-observation"
  return manifest
}

function fail() {
  throw new V0810AcceptanceManifestError("v0810-acceptance-schema")
}
