import { readFileSync } from "node:fs"
import { join } from "node:path"
import { isDeepStrictEqual } from "node:util"

import { canonicalBeta21AcceptanceManifest } from "./consumer-authority-beta21-acceptance-schema.mjs"
import {
  parseCanonicalPackagePublisherPlan,
} from "./canonical-package-publisher.mjs"
import {
  parseExternalArtifactTransportPlan,
} from "./consumer-authority-external-artifact-transport-plan.mjs"
import { parseExternalAttestationCommandPlan } from "./consumer-authority-external-attestation-command-plan.mjs"

export const BETA22_ACCEPTANCE_SCHEMA_VERSION = "consumer-authority-beta22-acceptance.1"

const BETA22_PACKAGE_VERSION = "0.8.0-beta.22"
const ACCEPTANCE_PATH = join("docs", "current", "release", "consumer-authority-beta22-acceptance.json")
const PROCEDURE_RECORD_SHA256 = "8b2537fa1ca4e8209790a3c9539666abbb0a5ffda13d6a82cb9e5c7e2635b863"
const EXPECTED_MANIFEST = buildExpectedManifest()

export class Beta22AcceptanceManifestError extends Error {
  constructor(code) {
    super(code)
    this.code = code
  }
}

export function canonicalBeta22AcceptanceManifest() {
  return structuredClone(EXPECTED_MANIFEST)
}

export function readBeta22AcceptanceManifest(packageRoot) {
  let packageVersion
  let value
  try {
    packageVersion = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8")).version
    value = JSON.parse(readFileSync(join(packageRoot, ACCEPTANCE_PATH), "utf8"))
  } catch {
    fail()
  }
  return parseBeta22AcceptanceManifest(value, packageVersion)
}

export function parseBeta22AcceptanceManifest(value, packageVersion) {
  if (packageVersion !== BETA22_PACKAGE_VERSION || !isDeepStrictEqual(value, EXPECTED_MANIFEST)) fail()
  parseCanonicalPackagePublisherPlan(value.canonicalPackagePublisherPlan)
  parseExternalAttestationCommandPlan(value.externalAttestationCommandPlan)
  parseExternalArtifactTransportPlan(value.externalArtifactTransportPlan)
  return value
}

function buildExpectedManifest() {
  const manifest = canonicalBeta21AcceptanceManifest()
  manifest.schemaVersion = BETA22_ACCEPTANCE_SCHEMA_VERSION
  manifest.package.version = BETA22_PACKAGE_VERSION
  manifest.beta21HistoricalFinalObserver = {
    outcome: "online-crypto-and-bindings-passed-after-leaf-window-expired-before-authority-fetch-not-reusable-as-closure-evidence",
    reusableForBeta22: false,
    version: "0.8.0-beta.21",
  }
  manifest.authority.fixturePlan.registryInstall = "npm install persona-harness@0.8.0-beta.22 --registry https://registry.npmjs.org"
  manifest.authority.hostedFixture.revision = "postmerge-persona-harness-beta22-main-sha"
  manifest.prearmedExternalHandoff.finalObserverProcedure = finalObserverProcedure()
  manifest.prearmedExternalHandoff.prepare.allowedBeforeFixture = [
    "prepare-one-exact-git-backed-fixture-clone-and-isolated-home-store",
    "source-bound-bootstrap-before-final-fixture-commit",
    "retain-identical-unpushed-final-fixture-commit-as-the-installed-consumer-cwd-head",
    "post-commit-excluded-runtime-build-only-preparation",
    "pre-push-parent-cwd-top-level-head-and-source-identity-assertion",
    "public-pre-authority-readiness",
    "public-initialized-finish-state",
    "observer-credential-preflight",
    "external-attestation-command-plan-preflight",
    "external-artifact-transport-plan-preflight",
    "enroll-after-prefetch-readiness",
    "status-and-explain-on-ready-same-consumer",
  ]
  manifest.prearmedExternalHandoff.trigger.onlyAfter = "immutable-prepush-fixture-commit-and-final-observer-procedure-prefetch-ready-and-natural-current-version-original-artifact"
  manifest.prearmedExternalHandoff.trigger.steps = [
    "pre-push-fixture-parent-cwd-head-and-source-identity-ready",
    "normal-push-of-the-same-final-fixture-commit-to-main",
    "current-original-artifact-transport-and-online-crypto",
    "verify-online-before-leaf-certificate-notAfter",
    "authority-fetch-discovers-and-binds-original-artifact",
    "same-consumer-trusted-unconsumed-no-readiness-blocker",
    "finish-consume-once",
    "finish-replay-blocked",
  ]
  manifest.hostedResidual = {
    id: "beta22-prearmed-same-commit-current-artifact-fetch-consume-replay",
    requiredEvidence: "one separately authorized normal push of the prearmed exact fixture commit; immediate current-version original-artifact transport, online verification before leaf-certificate-notAfter, one authenticated fetch, one Finish consumption, and immediate replay rejection occur in the same unchanged consumer",
    whyLocalCannotClose: "A real current signed artifact, leaf-certificate validity window, isolated external credential, online verification, and GitHub Actions discovery cannot be produced locally. Local source and packed contracts prove the pre-push source identity procedure, public readiness, privacy, trusted modeled fetch, one Finish consumption, and replay block without accessing a live artifact.",
  }
  return manifest
}

function finalObserverProcedure() {
  return {
    failureHandling: {
      afterFetch: "do-not-reinitialize-switch-reset-or-retry",
      beforeFetch: "abandon-and-recreate-the-consumer-before-any-live-fetch",
    },
    liveSteps: [
      "normal-push-of-the-same-final-fixture-commit-to-main",
      "current-original-artifact-transport-and-online-crypto-within-leaf-window",
      "authenticated-fetch-once",
      "same-consumer-status-and-explain-trusted-unconsumed-with-no-readiness-blocker",
      "Finish-consume-once",
      "immediate-Finish-replay-blocked",
    ],
    noReinitializationAfterFetch: [
      "consumer-cwd-git-head-or-source-profile-change",
      "consumer-home-or-authority-store-replacement",
      "bootstrap-plan-report-evidence-or-loop-state-reset",
      "consumer-switch-or-copied-state",
    ],
    postCommitPreparation: {
      allowedMutations: [
        ".persona/.ph-init-manifest.json",
        ".persona/evidence/**",
        ".persona/workflow/**",
        ".gradle/**",
        "build/**",
        "node_modules/**",
      ],
      forbiddenSourceBoundMutations: [
        ".github/workflows/research-attestation.yml",
        ".gitignore",
        ".opencode/opencode.json",
        ".persona/conventions/**",
        ".persona/harness.jsonc",
        ".persona/policies/**",
        ".persona/project-profile.jsonc",
        ".persona/rules/**",
        "AGENTS.md",
        "root-gradle-build-and-settings",
        "src/**",
      ],
    },
    prePushCommit: {
      cwd: "must-be-exact-fixture-git-toplevel-and-canonical-project-root",
      finalCommit: "one-final-commit-contains-only-allowed-source-bound-bootstrap-outputs-and-reusable-pin",
      head: "must-remain-the-identical-unpushed-final-fixture-commit",
      remoteParent: "must-remain-unchanged-immediately-before-normal-push",
      sourceBoundBootstrap: "must-complete-before-final-commit",
      sourceIdentity: "must-be-clean-except-excluded-runtime-and-build-residue",
    },
    prefetchSteps: [
      "one-exact-git-backed-fixture-clone-cwd-head-and-isolated-home-store",
      "source-bound-bootstrap-before-final-fixture-commit",
      "one-final-commit-with-only-source-bound-bootstrap-allowlist-and-reusable-pin",
      "post-commit-excluded-runtime-build-only-preparation",
      "pre-push-parent-cwd-top-level-head-and-source-identity-assertion",
      "public-bootstrap-accepted-plan-and-current-loop-state",
      "public-Gradle-test-compileJava-and-clean",
      "public-README-profile-and-Java-evidence",
      "public-implementation-and-review-report-ingress",
      "public-plan-status",
      "default-Finish-blocked-only-trusted-authority-required",
    ],
    procedureRecord: {
      location: "coordinator-governed-immutable-external-procedure-record-no-local-path",
      sha256: PROCEDURE_RECORD_SHA256,
    },
    schemaVersion: "consumer-authority-final-observer-procedure.2",
  }
}

function fail() {
  throw new Beta22AcceptanceManifestError("beta22-acceptance-schema")
}
