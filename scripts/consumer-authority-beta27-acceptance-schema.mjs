import { readFileSync } from "node:fs"
import { join } from "node:path"
import { isDeepStrictEqual } from "node:util"

import { canonicalBeta23AcceptanceManifest } from "./consumer-authority-beta23-acceptance-schema.mjs"
import { canonicalFinalObserverV4CleanlinessPolicy } from "./consumer-authority-final-observer-v4-cleanliness.mjs"
import { canonicalObserverGhToolContract, parseObserverGhToolContract } from "./consumer-authority-observer-gh-tool.mjs"
import { parseCanonicalPackagePublisherPlan } from "./canonical-package-publisher.mjs"
import { parseExternalArtifactTransportPlan } from "./consumer-authority-external-artifact-transport-plan.mjs"
import { parseExternalAttestationCommandPlan } from "./consumer-authority-external-attestation-command-plan.mjs"

export const BETA27_ACCEPTANCE_SCHEMA_VERSION = "consumer-authority-beta27-acceptance.1"

const BETA27_PACKAGE_VERSION = "0.8.0-beta.27"
const ACCEPTANCE_PATH = join("docs", "current", "release", "consumer-authority-beta27-acceptance.json")
const PROCEDURE_RECORD_SHA256 = "5389c027b21f72f325a5d9e467ecd4d150f672e14da1d04f51774602a284c57d"
const EXPECTED_MANIFEST = buildExpectedManifest()

export class Beta27AcceptanceManifestError extends Error {
  constructor(code) {
    super(code)
    this.code = code
  }
}

export function canonicalBeta27AcceptanceManifest() {
  return structuredClone(EXPECTED_MANIFEST)
}

export function readBeta27AcceptanceManifest(packageRoot) {
  let packageVersion
  let value
  try {
    packageVersion = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8")).version
    value = JSON.parse(readFileSync(join(packageRoot, ACCEPTANCE_PATH), "utf8"))
  } catch {
    fail()
  }
  return parseBeta27AcceptanceManifest(value, packageVersion)
}

export function parseBeta27AcceptanceManifest(value, packageVersion) {
  if (packageVersion !== BETA27_PACKAGE_VERSION || !isDeepStrictEqual(value, EXPECTED_MANIFEST)) fail()
  parseCanonicalPackagePublisherPlan(value.canonicalPackagePublisherPlan)
  parseExternalAttestationCommandPlan(value.externalAttestationCommandPlan)
  parseExternalArtifactTransportPlan(value.externalArtifactTransportPlan)
  parseObserverGhToolContract(value.observerGhTool)
  return value
}

function buildExpectedManifest() {
  const manifest = canonicalBeta23AcceptanceManifest()
  const procedure = manifest.prearmedExternalHandoff.finalObserverProcedure
  manifest.schemaVersion = BETA27_ACCEPTANCE_SCHEMA_VERSION
  manifest.package.version = BETA27_PACKAGE_VERSION
  manifest.beta23HistoricalFinalObserver = {
    outcome: "raw-empty-porcelain-and-clean-contradicted-approved-runtime-build-residue-after-final-commit-not-reusable-as-closure-evidence",
    reusableForBeta27: false,
    version: "0.8.0-beta.23",
  }
  manifest.beta24HistoricalExternalContract = {
    outcome: "supplied-bundle-source-contract-required-ambient-gh-and-rejected-linux-runtime-owned-uv-use-io-uring-not-reusable-as-closure-evidence",
    reusableForBeta27: false,
    version: "0.8.0-beta.24",
  }
  manifest.beta25HistoricalObserverTool = {
    outcome: "protected-verify-used-an-unselected-literal-observer-gh-path-and-collapsed-tool-stage-not-reusable-as-closure-evidence",
    reusableForBeta27: false,
    version: "0.8.0-beta.25",
  }
  manifest.beta26HistoricalObserverTool = {
    outcome: "ubuntu-gh-package-record-includes-a-regular-nonexecutable-completion-sibling-and-basename-only-selection-blocked-before-tool-assessment-not-reusable-as-closure-evidence",
    reusableForBeta27: false,
    version: "0.8.0-beta.26",
  }
  manifest.authority.fixturePlan.registryInstall = "npm install persona-harness@0.8.0-beta.27 --registry https://registry.npmjs.org"
  manifest.authority.hostedFixture.revision = "postmerge-persona-harness-beta27-main-sha"
  procedure.cleanliness = v4Cleanliness()
  procedure.observerGhTool = canonicalObserverGhToolContract()
  procedure.observerGhSelection = "workflow-owned-dpkg-record-lstat-qualified-single-regular-nonsymlink-executable-to-private-copy-before-every-package-contract"
  procedure.postCommitPreparation.allowedMutations = [
    ".persona/.ph-init-manifest.json",
    ".persona/evidence/**",
    ".persona/workflow/**",
    ".gradle/**",
    "build/**",
    "node_modules/**",
  ]
  procedure.prePushCommit.sourceIdentity = "immutable-tracked-source-head-parent-reusable-pin-and-digest-map-with-v4-stage-scoped-runtime-residue-projection"
  procedure.prefetchSteps = [
    "one-exact-git-backed-fixture-clone-cwd-head-and-isolated-consumer-home-store",
    "baseline-v4-immutable-tracked-binding-and-normalized-residue-projection",
    "source-bound-bootstrap-before-final-fixture-commit",
    "source-bound-preparation-v4-constrained-final-diff-and-normalized-residue-projection",
    "one-final-commit-with-only-source-bound-bootstrap-allowlist-and-reusable-pin",
    "post-commit-excluded-runtime-build-only-slow-preparation-before-push-without-arbitrary-outer-timeout",
    "credential-handoff-v4-immutable-binding-and-normalized-residue-projection",
    "observer-child-v4-immutable-binding-and-normalized-residue-projection",
    "immediately-pre-push-v4-immutable-binding-and-normalized-residue-projection",
    "workflow-selected-observer-gh-tool-dpkg-record-qualified-regular-nonsymlink-executable-version-compatible-and-no-package-path-lookup",
    "public-bootstrap-accepted-plan-and-current-loop-state",
    "public-Gradle-test-compileJava-and-clean",
    "public-README-profile-and-Java-evidence",
    "public-implementation-and-review-report-ingress",
    "public-plan-status",
    "default-Finish-blocked-only-trusted-authority-required",
  ]
  procedure.procedureRecord = {
    location: "coordinator-governed-immutable-external-procedure-record-no-local-path",
    sha256: PROCEDURE_RECORD_SHA256,
  }
  procedure.schemaVersion = "consumer-authority-final-observer-procedure.4"
  manifest.observerGhTool = canonicalObserverGhToolContract()
  manifest.observerGhSelection = {
    diagnostics: "only-fixed-tool-invalid-tool-unavailable-tool-version-unsupported-parser-rejected-or-non-tool-stage-codes-cross-the-package-contract-boundary",
    dpkgRecord: "lstat-each-basename-gh-entry-without-following-links-and-require-exactly-one-regular-nonsymlink-executable",
    ancillary: "ignore-only-the-documented-regular-nonexecutable-/usr/share/bash-completion/completions/gh-package-record-and-reject-missing-symlink-nonregular-malformed-or-ambiguous-executable-records",
    workflow: "runner-package-record-qualified-executable-selection-to-private-regular-nonsymlink-copy-before-ci-publish-and-release-package-contracts",
  }
  manifest.prearmedExternalHandoff.prepare.allowedBeforeFixture = [
    "prepare-one-exact-git-backed-fixture-clone-and-isolated-consumer-home-store",
    "source-bound-bootstrap-before-final-fixture-commit",
    "retain-identical-unpushed-final-fixture-commit-as-the-installed-consumer-cwd-head",
    "post-commit-excluded-runtime-build-only-preparation",
    "v4-immutable-tracked-binding-and-stage-scoped-residue-cleanliness-after-every-prepush-stage",
    "workflow-selected-observer-gh-tool-preflight-without-package-path-lookup-token-or-artifact",
    "public-pre-authority-readiness",
    "public-initialized-finish-state",
    "observer-credential-preflight",
    "external-attestation-command-plan-preflight",
    "external-artifact-transport-plan-preflight",
    "enroll-after-prefetch-readiness",
    "status-and-explain-on-ready-same-consumer",
  ]
  manifest.prearmedExternalHandoff.trigger.onlyAfter = "immutable-prepush-fixture-commit-v4-tracked-binding-and-stage-scoped-residue-cleanliness-and-workflow-selected-observer-gh-tool-ready-and-natural-current-version-original-artifact"
  manifest.prearmedExternalHandoff.trigger.steps = [
    "pre-push-fixture-parent-cwd-head-source-identity-and-v4-cleanliness-ready",
    "normal-push-of-the-same-final-fixture-commit-to-main",
    "current-original-artifact-transport-and-online-crypto",
    "verify-online-before-leaf-certificate-notAfter-without-validity-relaxation",
    "authority-fetch-discovers-and-binds-original-artifact",
    "same-consumer-trusted-unconsumed-no-readiness-blocker",
    "finish-consume-once",
    "finish-replay-blocked",
  ]
  manifest.closureCompleteness = {
    deterministicLinks: [
      "immutable-tracked-source-head-parent-pin-and-digest-map",
      "v4-stage-scoped-runtime-residue-cleanliness",
      "ubuntu-dpkg-record-qualified-workflow-selected-observer-gh-tool-without-package-path-lookup",
      "linux-runtime-owned-uv-use-io-uring-child-envelope-only",
      "same-consumer-public-bootstrap-plan-loop-gradle-reports-evidence-readiness",
      "host-state-isolated-credential-preflight-and-command-transport-plans",
      "current-original-byte-and-online-crypto-before-leaf-certificate-notAfter",
      "authenticated-fetch-to-trusted-unconsumed",
      "one-Finish-consumption-and-immediate-replay-block",
    ],
    localProof: "clean-linux-node20-source-built-and-fresh-packed-installed-v4-cleanliness-qualified-dpkg-workflow-selected-gh-parser-fixed-stage-diagnostics-and-authority-child-contracts",
    remainingUncertainty: "one-authorized-v4-fixture-push-and-immediate-current-artifact-observation-only",
  }
  manifest.hostedResidual = {
    id: "beta27-v4-prearmed-same-commit-current-artifact-fetch-consume-replay",
    requiredEvidence: "one separately authorized normal push of the v4-prepared exact fixture commit; immediate current-version original-artifact transport, online verification before leaf-certificate-notAfter without validity relaxation, one authenticated fetch, one Finish consumption, and immediate replay rejection occur in the same unchanged consumer",
    whyLocalCannotClose: "A real current signed artifact, leaf-certificate validity window, isolated external credential, online verification, and GitHub Actions discovery cannot be produced locally. Local source and packed contracts prove v4 tracked-binding, stage-scoped residue cleanliness, workflow-selected observer-gh parser preflight with fixed stage diagnostics, Linux child-envelope behavior, public readiness, privacy, trusted modeled fetch, one Finish consumption, and replay block without accessing a live artifact.",
  }
  return manifest
}

function v4Cleanliness() {
  return {
    constrainedFinalDiff: "exact-v4-record-final-diff-only-with-immutable-reusable-pin",
    finalDiffPolicy: "only-documented-source-bound-bootstrap-paths-plus-the-required-immutable-reusable-pin",
    diagnostic: "normalized-clean-diagnostic-equals-stage-expected-residue-set",
    enumeration: "nul-safe-untracked-and-ignored-only",
    forbiddenConsumerPaths: [".local/**", ".config/**", ".cache/**"],
    immutableTrackedBinding: "exact-cwd-git-toplevel-head-parent-remote-parent-reusable-pin-digest-and-source-identity-digest-map",
    residueInspection: "lstat-and-realpath-contained-for-every-residue-and-ancestor",
    sourceProjection: "only-source-identity-and-project-finish-runtime-exclusions",
    stageResidueProjection: "exact-normalized-v4-record-residue-set-for-each-of-the-five-fences",
    policy: canonicalFinalObserverV4CleanlinessPolicy(),
  }
}

function fail() {
  throw new Beta27AcceptanceManifestError("beta27-acceptance-schema")
}
