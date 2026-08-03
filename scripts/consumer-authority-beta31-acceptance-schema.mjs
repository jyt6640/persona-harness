import { readFileSync } from "node:fs"
import { join } from "node:path"
import { isDeepStrictEqual } from "node:util"

import { canonicalBeta30AcceptanceManifest } from "./consumer-authority-beta30-acceptance-schema.mjs"
import { OBSERVER_GH_PACKAGE_RECORD_SHAPES } from "./consumer-authority-observer-gh-package-record.mjs"
import { canonicalObserverGhToolContract, parseObserverGhToolContract } from "./consumer-authority-observer-gh-tool.mjs"
import { parseCanonicalPackagePublisherPlan } from "./canonical-package-publisher.mjs"
import { parseExternalArtifactTransportPlan } from "./consumer-authority-external-artifact-transport-plan.mjs"
import { parseExternalAttestationCommandPlan } from "./consumer-authority-external-attestation-command-plan.mjs"

export const BETA31_ACCEPTANCE_SCHEMA_VERSION = "consumer-authority-beta31-acceptance.1"

const BETA31_PACKAGE_VERSION = "0.8.0-beta.31"
const ACCEPTANCE_PATH = join("docs", "current", "release", "consumer-authority-beta31-acceptance.json")
const EXPECTED_MANIFEST = buildExpectedManifest()

export class Beta31AcceptanceManifestError extends Error {
  constructor(code) {
    super(code)
    this.code = code
  }
}

export function canonicalBeta31AcceptanceManifest() {
  return structuredClone(EXPECTED_MANIFEST)
}

export function readBeta31AcceptanceManifest(packageRoot) {
  let packageVersion
  let value
  try {
    packageVersion = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8")).version
    value = JSON.parse(readFileSync(join(packageRoot, ACCEPTANCE_PATH), "utf8"))
  } catch {
    fail()
  }
  return parseBeta31AcceptanceManifest(value, packageVersion)
}

export function parseBeta31AcceptanceManifest(value, packageVersion) {
  if (packageVersion !== BETA31_PACKAGE_VERSION || !isDeepStrictEqual(value, EXPECTED_MANIFEST)) fail()
  parseCanonicalPackagePublisherPlan(value.canonicalPackagePublisherPlan)
  parseExternalAttestationCommandPlan(value.externalAttestationCommandPlan)
  parseExternalArtifactTransportPlan(value.externalArtifactTransportPlan)
  parseObserverGhToolContract(value.observerGhTool)
  return value
}

function buildExpectedManifest() {
  const manifest = canonicalBeta30AcceptanceManifest()
  const procedure = manifest.prearmedExternalHandoff.finalObserverProcedure
  manifest.schemaVersion = BETA31_ACCEPTANCE_SCHEMA_VERSION
  manifest.package.version = BETA31_PACKAGE_VERSION
  manifest.beta30HistoricalObserverTool = {
    outcome: "protected-verify-observed-a-documented-nonselected-completion-in-executable-mode-classified-as-an-ambiguous-executor-before-the-known-completion-policy-branch-and-beta30-is-not-reusable-as-closure-evidence",
    reusableForBeta31: false,
    version: "0.8.0-beta.30",
  }
  manifest.authority.fixturePlan.registryInstall = "npm install persona-harness@0.8.0-beta.31 --registry https://registry.npmjs.org"
  manifest.authority.hostedFixture.revision = "postmerge-persona-harness-beta31-main-sha"
  procedure.observerGhTool = canonicalObserverGhToolContract()
  procedure.observerGhSelection = "workflow-owned-dpkg-ownership-and-byte-strict-package-record-qualified-primary-with-optional-known-completion-mode-independent-validation-and-strict-secondary-inert-or-block-policy-private-copy-with-runner-temp-isolated-token-free-state-root-and-fixed-nonreflective-selector-stage-and-package-record-shape-before-every-package-contract"
  procedure.prefetchSteps = procedure.prefetchSteps.map((step) => step.includes("workflow-selected-observer-gh-tool-dpkg-ownership-byte-strict")
    ? "workflow-selected-observer-gh-tool-dpkg-ownership-byte-strict-record-qualified-regular-nonsymlink-policy-primary-optional-known-completion-mode-independent-and-strict-secondary-inert-or-block-private-copy-version-compatible-runner-temp-isolated-token-free-state-root-fixed-selector-stage-and-package-record-shape-without-package-path-lookup"
    : step)
  manifest.observerGhTool = canonicalObserverGhToolContract()
  manifest.observerGhSelection = {
    diagnostics: "only-fixed-tool-invalid-tool-unavailable-tool-version-unsupported-parser-rejected-non-tool-stage-selector-stage-and-package-record-shape-codes-cross-the-package-contract-boundary",
    dpkgOwnership: "bounded-direct-dpkg-query-requires-gh-installed-status-ii-and-the-current-linux-architecture-before-package-record-parsing",
    packageRecord: {
      ancillary: "allow-an-absent-documented-completion-silently-and-allow-only-the-present-known-completion-after-no-follow-regular-nonsymlink-validation-regardless-of-executable-mode; treat-other-present-secondary-basename-gh-records-as-inert-only-after-no-follow-regular-nonsymlink-nonexecutable-validation; reject-listed-missing-symlink-nonregular-or-unknown-executable-secondary-records",
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
    workflow: "validate-runner-temp-and-github-output-then-owned-dpkg-status-architecture-and-byte-record-primary-selection-with-optional-known-completion-mode-independent-validation-and-strict-secondary-inert-or-block-policy-and-runner-temp-isolated-token-free-state-root-to-private-regular-nonsymlink-copy-before-ci-publish-and-release-package-contracts",
  }
  manifest.closureCompleteness.deterministicLinks = manifest.closureCompleteness.deterministicLinks.map((link) => link.includes("ubuntu-dpkg-ownership-byte-strict-package-record")
    ? "ubuntu-dpkg-ownership-byte-strict-package-record-policy-primary-with-optional-known-completion-mode-independent-validation-and-strict-secondary-records-workflow-selected-observer-gh-tool-with-fixed-nonreflective-selector-stage-and-package-record-shape-without-package-path-lookup"
    : link)
  manifest.closureCompleteness.localProof = "clean-linux-node20-source-built-and-fresh-packed-installed-v4-cleanliness-qualified-dpkg-ownership-byte-strict-primary-with-optional-known-completion-mode-independent-validation-and-strict-secondary-package-record-runner-temp-isolated-token-free-gh-state-workflow-selected-selector-lifecycle-parser-fixed-stage-and-shape-diagnostics-and-authority-child-contracts"
  manifest.hostedResidual = {
    id: "beta31-v4-prearmed-same-commit-current-artifact-fetch-consume-replay",
    requiredEvidence: "one separately authorized normal push of the v4-prepared exact fixture commit; immediate current-version original-artifact transport, online verification before leaf-certificate-notAfter without validity relaxation, one authenticated fetch, one Finish consumption, and immediate replay rejection occur in the same unchanged consumer",
    whyLocalCannotClose: "A real current signed artifact, leaf-certificate validity window, isolated external credential, online verification, and GitHub Actions discovery cannot be produced locally. Local source and packed contracts prove v4 tracked-binding, stage-scoped residue cleanliness, workflow-selected observer-gh ownership, runner-temp isolated token-free state, and byte-strict primary package-record selector lifecycle with optional known completion mode-independent validation, strict secondary validation, and fixed stage and shape diagnostics, Linux child-envelope behavior, public readiness, privacy, trusted modeled fetch, one Finish consumption, and replay block without accessing a live artifact.",
  }
  return manifest
}

function fail() {
  throw new Beta31AcceptanceManifestError("beta31-acceptance-schema")
}
