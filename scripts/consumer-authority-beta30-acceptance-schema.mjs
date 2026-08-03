import { readFileSync } from "node:fs"
import { join } from "node:path"
import { isDeepStrictEqual } from "node:util"

import { canonicalBeta29AcceptanceManifest } from "./consumer-authority-beta29-acceptance-schema.mjs"
import { OBSERVER_GH_PACKAGE_RECORD_SHAPES } from "./consumer-authority-observer-gh-package-record.mjs"
import { canonicalObserverGhToolContract, parseObserverGhToolContract } from "./consumer-authority-observer-gh-tool.mjs"
import { parseCanonicalPackagePublisherPlan } from "./canonical-package-publisher.mjs"
import { parseExternalArtifactTransportPlan } from "./consumer-authority-external-artifact-transport-plan.mjs"
import { parseExternalAttestationCommandPlan } from "./consumer-authority-external-attestation-command-plan.mjs"

export const BETA30_ACCEPTANCE_SCHEMA_VERSION = "consumer-authority-beta30-acceptance.1"

const BETA30_PACKAGE_VERSION = "0.8.0-beta.30"
const ACCEPTANCE_PATH = join("docs", "current", "release", "consumer-authority-beta30-acceptance.json")
const EXPECTED_MANIFEST = buildExpectedManifest()

export class Beta30AcceptanceManifestError extends Error {
  constructor(code) {
    super(code)
    this.code = code
  }
}

export function canonicalBeta30AcceptanceManifest() {
  return structuredClone(EXPECTED_MANIFEST)
}

export function readBeta30AcceptanceManifest(packageRoot) {
  let packageVersion
  let value
  try {
    packageVersion = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8")).version
    value = JSON.parse(readFileSync(join(packageRoot, ACCEPTANCE_PATH), "utf8"))
  } catch {
    fail()
  }
  return parseBeta30AcceptanceManifest(value, packageVersion)
}

export function parseBeta30AcceptanceManifest(value, packageVersion) {
  if (packageVersion !== BETA30_PACKAGE_VERSION || !isDeepStrictEqual(value, EXPECTED_MANIFEST)) fail()
  parseCanonicalPackagePublisherPlan(value.canonicalPackagePublisherPlan)
  parseExternalAttestationCommandPlan(value.externalAttestationCommandPlan)
  parseExternalArtifactTransportPlan(value.externalArtifactTransportPlan)
  parseObserverGhToolContract(value.observerGhTool)
  return value
}

function buildExpectedManifest() {
  const manifest = canonicalBeta29AcceptanceManifest()
  const procedure = manifest.prearmedExternalHandoff.finalObserverProcedure
  manifest.schemaVersion = BETA30_ACCEPTANCE_SCHEMA_VERSION
  manifest.package.version = BETA30_PACKAGE_VERSION
  manifest.beta29HistoricalObserverTool = {
    outcome: "protected-verify-observed-a-primary-validated-package-record-block-at-a-conflated-nonselected-ancillary-shape-and-beta29-is-not-reusable-as-closure-evidence",
    reusableForBeta30: false,
    version: "0.8.0-beta.29",
  }
  manifest.authority.fixturePlan.registryInstall = "npm install persona-harness@0.8.0-beta.30 --registry https://registry.npmjs.org"
  manifest.authority.hostedFixture.revision = "postmerge-persona-harness-beta30-main-sha"
  procedure.observerGhTool = canonicalObserverGhToolContract()
  procedure.observerGhSelection = "workflow-owned-dpkg-ownership-and-byte-strict-package-record-qualified-primary-centric-optional-inert-ancillary-private-copy-with-runner-temp-isolated-token-free-state-root-and-fixed-nonreflective-selector-stage-and-package-record-shape-before-every-package-contract"
  procedure.prefetchSteps = procedure.prefetchSteps.map((step) => step.includes("workflow-selected-observer-gh-tool-dpkg-ownership-byte-strict")
    ? "workflow-selected-observer-gh-tool-dpkg-ownership-byte-strict-record-qualified-regular-nonsymlink-policy-primary-optional-inert-ancillary-private-copy-version-compatible-runner-temp-isolated-token-free-state-root-fixed-selector-stage-and-package-record-shape-without-package-path-lookup"
    : step)
  manifest.observerGhTool = canonicalObserverGhToolContract()
  manifest.observerGhSelection = {
    diagnostics: "only-fixed-tool-invalid-tool-unavailable-tool-version-unsupported-parser-rejected-non-tool-stage-selector-stage-and-package-record-shape-codes-cross-the-package-contract-boundary",
    dpkgOwnership: "bounded-direct-dpkg-query-requires-gh-installed-status-ii-and-the-current-linux-architecture-before-package-record-parsing",
    packageRecord: {
      ancillary: "allow-an-absent-documented-completion-silently-and-treat-every-present-secondary-basename-gh-record-as-inert-only-after-no-follow-regular-nonsymlink-nonexecutable-validation; reject-listed-missing-symlink-nonregular-or-executable-secondary-records",
      encoding: "bounded-buffer-valid-utf8-lf-only-with-an-optional-final-lf-and-no-nul-cr-blank-duplicate-or-noncanonical-records",
      primary: "require-exactly-the-policy-primary-/usr/bin/gh-record-as-a-regular-nonsymlink-executable-after-no-follow-lstat",
      shapes: [...OBSERVER_GH_PACKAGE_RECORD_SHAPES],
      unknownExecutables: "reject-every-secondary-executable-or-alias-as-ambiguous",
    },
    stateIsolation: "every-direct-version-assessment-uses-only-a-validated-runner-temp-real-directory-as-an-explicit-token-free-home-gh-xdg-temp-git-and-npm-state-root-so-gh-cannot-create-consumer-local-state",
    stages: [
      "environment",
      "package-list",
      "package-record",
      "source-assessment",
      "private-reservation",
      "private-copy",
      "private-assessment",
      "output-handoff",
    ],
    unknown: "selector-internal",
    workflow: "validate-runner-temp-and-github-output-then-owned-dpkg-status-architecture-and-byte-record-primary-centric-selection-with-optional-inert-secondary-validation-and-runner-temp-isolated-token-free-state-root-to-private-regular-nonsymlink-copy-before-ci-publish-and-release-package-contracts",
  }
  manifest.closureCompleteness.deterministicLinks = manifest.closureCompleteness.deterministicLinks.map((link) => link.includes("ubuntu-dpkg-ownership-byte-strict-package-record")
    ? "ubuntu-dpkg-ownership-byte-strict-package-record-policy-primary-with-optional-inert-secondary-records-workflow-selected-observer-gh-tool-with-fixed-nonreflective-selector-stage-and-package-record-shape-without-package-path-lookup"
    : link)
  manifest.closureCompleteness.localProof = "clean-linux-node20-source-built-and-fresh-packed-installed-v4-cleanliness-qualified-dpkg-ownership-byte-strict-primary-centric-optional-inert-secondary-package-record-runner-temp-isolated-token-free-gh-state-workflow-selected-selector-lifecycle-parser-fixed-stage-and-shape-diagnostics-and-authority-child-contracts"
  manifest.hostedResidual = {
    id: "beta30-v4-prearmed-same-commit-current-artifact-fetch-consume-replay",
    requiredEvidence: "one separately authorized normal push of the v4-prepared exact fixture commit; immediate current-version original-artifact transport, online verification before leaf-certificate-notAfter without validity relaxation, one authenticated fetch, one Finish consumption, and immediate replay rejection occur in the same unchanged consumer",
    whyLocalCannotClose: "A real current signed artifact, leaf-certificate validity window, isolated external credential, online verification, and GitHub Actions discovery cannot be produced locally. Local source and packed contracts prove v4 tracked-binding, stage-scoped residue cleanliness, workflow-selected observer-gh ownership, runner-temp isolated token-free state, and byte-strict primary-centric package-record selector lifecycle with optional inert secondary validation and fixed stage and shape diagnostics, Linux child-envelope behavior, public readiness, privacy, trusted modeled fetch, one Finish consumption, and replay block without accessing a live artifact.",
  }
  return manifest
}

function fail() {
  throw new Beta30AcceptanceManifestError("beta30-acceptance-schema")
}
