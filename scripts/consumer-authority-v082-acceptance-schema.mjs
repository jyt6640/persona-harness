import { readFileSync } from "node:fs"
import { join } from "node:path"
import { isDeepStrictEqual } from "node:util"

import { canonicalV081AcceptanceManifest } from "./consumer-authority-v081-acceptance-schema.mjs"
import { parseCanonicalPackagePublisherPlan } from "./canonical-package-publisher.mjs"
import { parseExternalArtifactTransportPlan } from "./consumer-authority-external-artifact-transport-plan.mjs"
import { parseExternalAttestationCommandPlan } from "./consumer-authority-external-attestation-command-plan.mjs"
import { parseObserverGhToolContract } from "./consumer-authority-observer-gh-tool.mjs"

export const V082_ACCEPTANCE_SCHEMA_VERSION = "consumer-authority-v082-acceptance.1"

const V082_PACKAGE_VERSION = "0.8.2"
const ACCEPTANCE_PATH = join("docs", "current", "release", "consumer-authority-v082-acceptance.json")
const EXPECTED_MANIFEST = buildExpectedManifest()

export class V082AcceptanceManifestError extends Error {
  constructor(code) {
    super(code)
    this.code = code
  }
}

export function canonicalV082AcceptanceManifest() {
  return structuredClone(EXPECTED_MANIFEST)
}

export function readV082AcceptanceManifest(packageRoot) {
  let packageVersion
  let value
  try {
    packageVersion = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8")).version
    value = JSON.parse(readFileSync(join(packageRoot, ACCEPTANCE_PATH), "utf8"))
  } catch {
    fail()
  }
  return parseV082AcceptanceManifest(value, packageVersion)
}

export function parseV082AcceptanceManifest(value, packageVersion) {
  if (packageVersion !== V082_PACKAGE_VERSION || !isDeepStrictEqual(value, EXPECTED_MANIFEST)) fail()
  parseCanonicalPackagePublisherPlan(value.canonicalPackagePublisherPlan)
  parseExternalAttestationCommandPlan(value.externalAttestationCommandPlan)
  parseExternalArtifactTransportPlan(value.externalArtifactTransportPlan)
  parseObserverGhToolContract(value.observerGhTool)
  return value
}

function buildExpectedManifest() {
  const manifest = canonicalV081AcceptanceManifest()
  manifest.schemaVersion = V082_ACCEPTANCE_SCHEMA_VERSION
  manifest.package.channel = "latest"
  manifest.package.scope = "ga-approved"
  manifest.package.version = V082_PACKAGE_VERSION
  manifest.acceptanceResponsibilities = {
    package: {
      excludes: ["attestation-parser", "observer-gh-selector"],
      requires: [
        "exact-tar-provenance",
        "normal-install",
        "installed-only-no-source-fallback",
        "cli-and-approval-before-mutation",
      ],
    },
    sourceAndProtectedUbuntuCi: {
      requires: [
        "workflow-owned-dpkg-observer-gh-selection",
        "private-regular-nonsymlink-observer-gh-copy",
        "path-free-attestation-parser-preflight",
      ],
    },
  }
  manifest.prearmedExternalHandoff.finalObserverProcedure.observerGhSelection =
    "source-and-protected-ubuntu-ci-only-workflow-owned-dpkg-ownership-and-byte-strict-package-record-qualified-primary-with-optional-known-completion-mode-independent-validation-and-strict-secondary-inert-or-block-policy-copyfile-excl-private-copy-reassessment-with-runner-temp-isolated-token-free-state-root-and-fixed-nonreflective-selector-stage-and-package-record-shape"
  manifest.hostedResidual.whyLocalCannotClose =
    "A real current signed artifact, leaf-certificate validity window, isolated external credential, online verification, and GitHub Actions discovery cannot be produced locally. Source and CI-shaped packed exercise prove v4 tracked-binding, stage-scoped residue cleanliness, workflow-selected observer-gh ownership, byte-strict primary package-record selector lifecycle, COPYFILE_EXCL private-copy reassessment, one runner-temp isolated token-free state root, fixed-placeholder exact-plan help parser preflight without artifact or network access, strict secondary validation, fixed stage and shape diagnostics. Package acceptance separately proves current package-lock-acceptance binding, exact-tar provenance, normal installation, installed-only no-source fallback, CLI approval-before-mutation behavior, complete source and fresh-installed fixture import closure, exact Linux authority-fetch child envelope behavior, trusted-unconsumed-persisted discovery result binding, public readiness, privacy, trusted modeled fetch, one Finish consumption, and replay block without accessing a live artifact."
  manifest.v081HistoricalRelease = {
    outcome: "accepted-for-its-own-v081-tree-and-not-reusable-for-the-published-v082-release-or-any-later-package",
    reusableForV082: false,
    version: "0.8.1",
  }
  manifest.authority.fixturePlan.registryInstall = "published-persona-harness@0.8.2-latest-release-record"
  manifest.authority.hostedFixture.revision = "v082-published-latest-release-record"
  manifest.hostedResidual.id = "v082-published-latest-release-record"
  return manifest
}

function fail() {
  throw new V082AcceptanceManifestError("v082-acceptance-schema")
}
