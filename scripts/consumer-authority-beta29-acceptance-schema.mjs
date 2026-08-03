import { readFileSync } from "node:fs"
import { join } from "node:path"
import { isDeepStrictEqual } from "node:util"

import { canonicalBeta28AcceptanceManifest } from "./consumer-authority-beta28-acceptance-schema.mjs"
import { OBSERVER_GH_PACKAGE_RECORD_SHAPES } from "./consumer-authority-observer-gh-package-record.mjs"
import { canonicalObserverGhToolContract, parseObserverGhToolContract } from "./consumer-authority-observer-gh-tool.mjs"
import { parseCanonicalPackagePublisherPlan } from "./canonical-package-publisher.mjs"
import { parseExternalArtifactTransportPlan } from "./consumer-authority-external-artifact-transport-plan.mjs"
import { parseExternalAttestationCommandPlan } from "./consumer-authority-external-attestation-command-plan.mjs"

export const BETA29_ACCEPTANCE_SCHEMA_VERSION = "consumer-authority-beta29-acceptance.1"

const BETA29_PACKAGE_VERSION = "0.8.0-beta.29"
const ACCEPTANCE_PATH = join("docs", "current", "release", "consumer-authority-beta29-acceptance.json")
const EXPECTED_MANIFEST = buildExpectedManifest()

export class Beta29AcceptanceManifestError extends Error {
  constructor(code) {
    super(code)
    this.code = code
  }
}

export function canonicalBeta29AcceptanceManifest() {
  return structuredClone(EXPECTED_MANIFEST)
}

export function readBeta29AcceptanceManifest(packageRoot) {
  let packageVersion
  let value
  try {
    packageVersion = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8")).version
    value = JSON.parse(readFileSync(join(packageRoot, ACCEPTANCE_PATH), "utf8"))
  } catch {
    fail()
  }
  return parseBeta29AcceptanceManifest(value, packageVersion)
}

export function parseBeta29AcceptanceManifest(value, packageVersion) {
  if (packageVersion !== BETA29_PACKAGE_VERSION || !isDeepStrictEqual(value, EXPECTED_MANIFEST)) fail()
  parseCanonicalPackagePublisherPlan(value.canonicalPackagePublisherPlan)
  parseExternalAttestationCommandPlan(value.externalAttestationCommandPlan)
  parseExternalArtifactTransportPlan(value.externalArtifactTransportPlan)
  parseObserverGhToolContract(value.observerGhTool)
  return value
}

function buildExpectedManifest() {
  const manifest = canonicalBeta28AcceptanceManifest()
  const procedure = manifest.prearmedExternalHandoff.finalObserverProcedure
  manifest.schemaVersion = BETA29_ACCEPTANCE_SCHEMA_VERSION
  manifest.package.version = BETA29_PACKAGE_VERSION
  manifest.beta28HistoricalObserverTool = {
    outcome: "protected-verify-observed-an-unattributed-package-record-selector-block-before-tests-and-beta28-is-not-reusable-as-closure-evidence",
    reusableForBeta29: false,
    version: "0.8.0-beta.28",
  }
  manifest.authority.fixturePlan.registryInstall = "npm install persona-harness@0.8.0-beta.29 --registry https://registry.npmjs.org"
  manifest.authority.hostedFixture.revision = "postmerge-persona-harness-beta29-main-sha"
  procedure.observerGhTool = canonicalObserverGhToolContract()
  procedure.observerGhSelection = "workflow-owned-dpkg-ownership-and-byte-strict-package-record-qualified-private-copy-with-fixed-nonreflective-selector-stage-and-package-record-shape-before-every-package-contract"
  procedure.prefetchSteps = procedure.prefetchSteps.map((step) => step === "workflow-selected-observer-gh-tool-dpkg-record-qualified-regular-nonsymlink-executable-version-compatible-fixed-selector-stage-and-no-package-path-lookup"
    ? "workflow-selected-observer-gh-tool-dpkg-ownership-byte-strict-record-qualified-regular-nonsymlink-policy-primary-private-copy-version-compatible-fixed-selector-stage-and-package-record-shape-without-package-path-lookup"
    : step)
  manifest.observerGhTool = canonicalObserverGhToolContract()
  manifest.observerGhSelection = {
    diagnostics: "only-fixed-tool-invalid-tool-unavailable-tool-version-unsupported-parser-rejected-non-tool-stage-selector-stage-and-package-record-shape-codes-cross-the-package-contract-boundary",
    dpkgOwnership: "bounded-direct-dpkg-query-requires-gh-installed-status-ii-and-the-current-linux-architecture-before-package-record-parsing",
    packageRecord: {
      ancillary: "require-the-documented-regular-nonexecutable-/usr/share/bash-completion/completions/gh-record-and-reject-missing-symlink-nonregular-or-unknown-ancillary-gh-records",
      encoding: "bounded-buffer-valid-utf8-lf-only-with-an-optional-final-lf-and-no-nul-cr-blank-duplicate-or-noncanonical-records",
      primary: "require-exactly-the-policy-primary-/usr/bin/gh-record-as-a-regular-nonsymlink-executable-after-no-follow-lstat",
      shapes: [...OBSERVER_GH_PACKAGE_RECORD_SHAPES],
      unknownExecutables: "reject-multiple-qualified-executables",
    },
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
    workflow: "validate-runner-temp-and-github-output-then-owned-dpkg-status-architecture-and-byte-record-selection-to-private-regular-nonsymlink-copy-before-ci-publish-and-release-package-contracts",
  }
  manifest.closureCompleteness.deterministicLinks = manifest.closureCompleteness.deterministicLinks.map((link) => link === "ubuntu-dpkg-record-qualified-workflow-selected-observer-gh-tool-with-fixed-nonreflective-selector-stage-without-package-path-lookup"
    ? "ubuntu-dpkg-ownership-byte-strict-package-record-policy-primary-workflow-selected-observer-gh-tool-with-fixed-nonreflective-selector-stage-and-package-record-shape-without-package-path-lookup"
    : link)
  manifest.closureCompleteness.localProof = "clean-linux-node20-source-built-and-fresh-packed-installed-v4-cleanliness-qualified-dpkg-ownership-byte-strict-package-record-workflow-selected-gh-selector-lifecycle-parser-fixed-stage-and-shape-diagnostics-and-authority-child-contracts"
  manifest.hostedResidual = {
    id: "beta29-v4-prearmed-same-commit-current-artifact-fetch-consume-replay",
    requiredEvidence: "one separately authorized normal push of the v4-prepared exact fixture commit; immediate current-version original-artifact transport, online verification before leaf-certificate-notAfter without validity relaxation, one authenticated fetch, one Finish consumption, and immediate replay rejection occur in the same unchanged consumer",
    whyLocalCannotClose: "A real current signed artifact, leaf-certificate validity window, isolated external credential, online verification, and GitHub Actions discovery cannot be produced locally. Local source and packed contracts prove v4 tracked-binding, stage-scoped residue cleanliness, workflow-selected observer-gh ownership and byte-strict package-record selector lifecycle with fixed stage and shape diagnostics, Linux child-envelope behavior, public readiness, privacy, trusted modeled fetch, one Finish consumption, and replay block without accessing a live artifact.",
  }
  return manifest
}

function fail() {
  throw new Beta29AcceptanceManifestError("beta29-acceptance-schema")
}
