import { readFileSync } from "node:fs"
import { join } from "node:path"
import { isDeepStrictEqual } from "node:util"

import { canonicalBeta19AcceptanceManifest } from "./consumer-authority-beta19-acceptance-schema.mjs"
import {
  canonicalPackagePublisherPlan,
  parseCanonicalPackagePublisherPlan,
} from "./canonical-package-publisher.mjs"
import {
  parseExternalArtifactTransportPlan,
} from "./consumer-authority-external-artifact-transport-plan.mjs"
import { parseExternalAttestationCommandPlan } from "./consumer-authority-external-attestation-command-plan.mjs"

export const BETA20_ACCEPTANCE_SCHEMA_VERSION = "consumer-authority-beta20-acceptance.1"

const BETA20_PACKAGE_VERSION = "0.8.0-beta.20"
const ACCEPTANCE_PATH = join("docs", "current", "release", "consumer-authority-beta20-acceptance.json")
const EXPECTED_MANIFEST = buildExpectedManifest()

export class Beta20AcceptanceManifestError extends Error {
  constructor(code) {
    super(code)
    this.code = code
  }
}

export function canonicalBeta20AcceptanceManifest() {
  return structuredClone(EXPECTED_MANIFEST)
}

export function readBeta20AcceptanceManifest(packageRoot) {
  let packageVersion
  let value
  try {
    packageVersion = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8")).version
    value = JSON.parse(readFileSync(join(packageRoot, ACCEPTANCE_PATH), "utf8"))
  } catch {
    fail()
  }
  return parseBeta20AcceptanceManifest(value, packageVersion)
}

export function parseBeta20AcceptanceManifest(value, packageVersion) {
  if (packageVersion !== BETA20_PACKAGE_VERSION || !isDeepStrictEqual(value, EXPECTED_MANIFEST)) fail()
  parseCanonicalPackagePublisherPlan(value.canonicalPackagePublisherPlan)
  parseExternalAttestationCommandPlan(value.externalAttestationCommandPlan)
  parseExternalArtifactTransportPlan(value.externalArtifactTransportPlan)
  return value
}

function buildExpectedManifest() {
  const manifest = canonicalBeta19AcceptanceManifest()
  manifest.schemaVersion = BETA20_ACCEPTANCE_SCHEMA_VERSION
  manifest.package.version = BETA20_PACKAGE_VERSION
  manifest.beta19HistoricalPublish = {
    outcome: "published-immutable-staging-package-not-reusable-as-current-package-evidence",
    reusableForBeta20: false,
    version: "0.8.0-beta.19",
  }
  manifest.canonicalPackagePublisherPlan = canonicalPackagePublisherPlan()
  manifest.authority.fetchDiagnostic = {
    allowedCodes: [
      "authority-fetch-evidence",
      "authority-fetch-invalid",
      "authority-fetch-network",
      "authority-fetch-policy",
    ],
    childEnvelope: "only-exit-one-fixed-code-ok-false",
    persistence: "blocked-child-leaves-no-artifact-or-authority-state",
    privacy: "no-token-path-url-or-raw-child-output",
    publicState: "missing",
  }
  manifest.authority.fixturePlan.registryInstall = "npm install persona-harness@0.8.0-beta.20 --registry https://registry.npmjs.org"
  manifest.authority.hostedFixture.revision = "postmerge-persona-harness-beta20-main-sha"
  manifest.hostedResidual = {
    id: "beta20-live-authenticated-authority-fetch-child-stage",
    requiredEvidence: "one pre-armed live authenticated fetch-child result after the current package is installed; any fixed child failure may render only its allowlisted diagnostic while public fetch state remains missing",
    whyLocalCannotClose: "The real isolated credential and GitHub Actions discovery child are external procedure evidence. Local source and packed contracts prove the fixed envelope, privacy, no-persistence behavior, trusted fetch, one Finish consumption, and replay rejection without accessing a live artifact.",
  }
  return manifest
}

function fail() {
  throw new Beta20AcceptanceManifestError("beta20-acceptance-schema")
}
