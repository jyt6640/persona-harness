import { readFileSync } from "node:fs"
import { join } from "node:path"
import { isDeepStrictEqual } from "node:util"

import { canonicalBeta23AcceptanceManifest } from "./consumer-authority-beta23-acceptance-schema.mjs"
import { canonicalFinalObserverV4CleanlinessPolicy } from "./consumer-authority-final-observer-v4-cleanliness.mjs"
import { parseCanonicalPackagePublisherPlan } from "./canonical-package-publisher.mjs"
import { parseExternalArtifactTransportPlan } from "./consumer-authority-external-artifact-transport-plan.mjs"
import { parseExternalAttestationCommandPlan } from "./consumer-authority-external-attestation-command-plan.mjs"

export const BETA24_ACCEPTANCE_SCHEMA_VERSION = "consumer-authority-beta24-acceptance.1"

const BETA24_PACKAGE_VERSION = "0.8.0-beta.24"
const ACCEPTANCE_PATH = join("docs", "current", "release", "consumer-authority-beta24-acceptance.json")
const PROCEDURE_RECORD_SHA256 = "5389c027b21f72f325a5d9e467ecd4d150f672e14da1d04f51774602a284c57d"
const EXPECTED_MANIFEST = buildExpectedManifest()

export class Beta24AcceptanceManifestError extends Error {
  constructor(code) {
    super(code)
    this.code = code
  }
}

export function canonicalBeta24AcceptanceManifest() {
  return structuredClone(EXPECTED_MANIFEST)
}

export function readBeta24AcceptanceManifest(packageRoot) {
  let packageVersion
  let value
  try {
    packageVersion = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8")).version
    value = JSON.parse(readFileSync(join(packageRoot, ACCEPTANCE_PATH), "utf8"))
  } catch {
    fail()
  }
  return parseBeta24AcceptanceManifest(value, packageVersion)
}

export function parseBeta24AcceptanceManifest(value, packageVersion) {
  if (packageVersion !== BETA24_PACKAGE_VERSION || !isDeepStrictEqual(value, EXPECTED_MANIFEST)) fail()
  parseCanonicalPackagePublisherPlan(value.canonicalPackagePublisherPlan)
  parseExternalAttestationCommandPlan(value.externalAttestationCommandPlan)
  parseExternalArtifactTransportPlan(value.externalArtifactTransportPlan)
  return value
}

function buildExpectedManifest() {
  const manifest = canonicalBeta23AcceptanceManifest()
  const procedure = manifest.prearmedExternalHandoff.finalObserverProcedure
  manifest.schemaVersion = BETA24_ACCEPTANCE_SCHEMA_VERSION
  manifest.package.version = BETA24_PACKAGE_VERSION
  manifest.beta23HistoricalFinalObserver = {
    outcome: "raw-empty-porcelain-and-clean-contradicted-approved-runtime-build-residue-after-final-commit-not-reusable-as-closure-evidence",
    reusableForBeta24: false,
    version: "0.8.0-beta.23",
  }
  manifest.authority.fixturePlan.registryInstall = "npm install persona-harness@0.8.0-beta.24 --registry https://registry.npmjs.org"
  manifest.authority.hostedFixture.revision = "postmerge-persona-harness-beta24-main-sha"
  procedure.cleanliness = v4Cleanliness()
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
  manifest.prearmedExternalHandoff.prepare.allowedBeforeFixture = [
    "prepare-one-exact-git-backed-fixture-clone-and-isolated-consumer-home-store",
    "source-bound-bootstrap-before-final-fixture-commit",
    "retain-identical-unpushed-final-fixture-commit-as-the-installed-consumer-cwd-head",
    "post-commit-excluded-runtime-build-only-preparation",
    "v4-immutable-tracked-binding-and-stage-scoped-residue-cleanliness-after-every-prepush-stage",
    "public-pre-authority-readiness",
    "public-initialized-finish-state",
    "observer-credential-preflight",
    "external-attestation-command-plan-preflight",
    "external-artifact-transport-plan-preflight",
    "enroll-after-prefetch-readiness",
    "status-and-explain-on-ready-same-consumer",
  ]
  manifest.prearmedExternalHandoff.trigger.onlyAfter = "immutable-prepush-fixture-commit-v4-tracked-binding-and-stage-scoped-residue-cleanliness-ready-and-final-observer-procedure-prefetch-ready-and-natural-current-version-original-artifact"
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
      "same-consumer-public-bootstrap-plan-loop-gradle-reports-evidence-readiness",
      "host-state-isolated-credential-preflight-and-command-transport-plans",
      "current-original-byte-and-online-crypto-before-leaf-certificate-notAfter",
      "authenticated-fetch-to-trusted-unconsumed",
      "one-Finish-consumption-and-immediate-replay-block",
    ],
    localProof: "source-built-and-fresh-packed-installed-v4-cleanliness-plus-existing-public-lifecycle-and-modeled-authority-contracts",
    remainingUncertainty: "one-authorized-v4-fixture-push-and-immediate-current-artifact-observation-only",
  }
  manifest.hostedResidual = {
    id: "beta24-v4-prearmed-same-commit-current-artifact-fetch-consume-replay",
    requiredEvidence: "one separately authorized normal push of the v4-prepared exact fixture commit; immediate current-version original-artifact transport, online verification before leaf-certificate-notAfter without validity relaxation, one authenticated fetch, one Finish consumption, and immediate replay rejection occur in the same unchanged consumer",
    whyLocalCannotClose: "A real current signed artifact, leaf-certificate validity window, isolated external credential, online verification, and GitHub Actions discovery cannot be produced locally. Local source and packed contracts prove the v4 tracked-binding, stage-scoped residue cleanliness, public readiness, privacy, trusted modeled fetch, one Finish consumption, and replay block without accessing a live artifact.",
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
  throw new Beta24AcceptanceManifestError("beta24-acceptance-schema")
}
