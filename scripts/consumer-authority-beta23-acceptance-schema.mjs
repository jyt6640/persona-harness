import { readFileSync } from "node:fs"
import { join } from "node:path"
import { isDeepStrictEqual } from "node:util"

import { canonicalBeta22AcceptanceManifest } from "./consumer-authority-beta22-acceptance-schema.mjs"
import {
  parseCanonicalPackagePublisherPlan,
} from "./canonical-package-publisher.mjs"
import {
  parseExternalArtifactTransportPlan,
} from "./consumer-authority-external-artifact-transport-plan.mjs"
import { parseExternalAttestationCommandPlan } from "./consumer-authority-external-attestation-command-plan.mjs"

export const BETA23_ACCEPTANCE_SCHEMA_VERSION = "consumer-authority-beta23-acceptance.1"

const BETA23_PACKAGE_VERSION = "0.8.0-beta.23"
const ACCEPTANCE_PATH = join("docs", "current", "release", "consumer-authority-beta23-acceptance.json")
const PROCEDURE_RECORD_SHA256 = "24eeeb198a683cdbdade04142aa2dca2479f94fb06bc4f39c1633d16c5286c8b"
const EXPECTED_MANIFEST = buildExpectedManifest()

export class Beta23AcceptanceManifestError extends Error {
  constructor(code) {
    super(code)
    this.code = code
  }
}

export function canonicalBeta23AcceptanceManifest() {
  return structuredClone(EXPECTED_MANIFEST)
}

export function readBeta23AcceptanceManifest(packageRoot) {
  let packageVersion
  let value
  try {
    packageVersion = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8")).version
    value = JSON.parse(readFileSync(join(packageRoot, ACCEPTANCE_PATH), "utf8"))
  } catch {
    fail()
  }
  return parseBeta23AcceptanceManifest(value, packageVersion)
}

export function parseBeta23AcceptanceManifest(value, packageVersion) {
  if (packageVersion !== BETA23_PACKAGE_VERSION || !isDeepStrictEqual(value, EXPECTED_MANIFEST)) fail()
  parseCanonicalPackagePublisherPlan(value.canonicalPackagePublisherPlan)
  parseExternalAttestationCommandPlan(value.externalAttestationCommandPlan)
  parseExternalArtifactTransportPlan(value.externalArtifactTransportPlan)
  return value
}

function buildExpectedManifest() {
  const manifest = canonicalBeta22AcceptanceManifest()
  manifest.schemaVersion = BETA23_ACCEPTANCE_SCHEMA_VERSION
  manifest.package.version = BETA23_PACKAGE_VERSION
  manifest.beta22HistoricalFinalObserver = {
    outcome: "host-gh-xdg-state-created-untracked-local-device-id-after-final-commit-not-reusable-as-closure-evidence",
    reusableForBeta23: false,
    version: "0.8.0-beta.22",
  }
  manifest.authority.fixturePlan.registryInstall = "npm install persona-harness@0.8.0-beta.23 --registry https://registry.npmjs.org"
  manifest.authority.hostedFixture.revision = "postmerge-persona-harness-beta23-main-sha"
  manifest.prearmedExternalHandoff.finalObserverProcedure = finalObserverProcedure()
  manifest.prearmedExternalHandoff.prepare.allowedBeforeFixture = [
    "prepare-one-exact-git-backed-fixture-clone-and-isolated-consumer-home-store",
    "source-bound-bootstrap-before-final-fixture-commit",
    "retain-identical-unpushed-final-fixture-commit-as-the-installed-consumer-cwd-head",
    "post-commit-excluded-runtime-build-only-preparation",
    "v3-env-i-host-state-isolation-and-cleanliness-after-every-prepush-stage",
    "public-pre-authority-readiness",
    "public-initialized-finish-state",
    "observer-credential-preflight",
    "external-attestation-command-plan-preflight",
    "external-artifact-transport-plan-preflight",
    "enroll-after-prefetch-readiness",
    "status-and-explain-on-ready-same-consumer",
  ]
  manifest.prearmedExternalHandoff.trigger.onlyAfter = "immutable-prepush-fixture-commit-v3-host-state-isolation-clean-and-final-observer-procedure-prefetch-ready-and-natural-current-version-original-artifact"
  manifest.prearmedExternalHandoff.trigger.steps = [
    "pre-push-fixture-parent-cwd-head-source-identity-and-v3-host-state-cleanliness-ready",
    "normal-push-of-the-same-final-fixture-commit-to-main",
    "current-original-artifact-transport-and-online-crypto",
    "verify-online-before-leaf-certificate-notAfter-without-validity-relaxation",
    "authority-fetch-discovers-and-binds-original-artifact",
    "same-consumer-trusted-unconsumed-no-readiness-blocker",
    "finish-consume-once",
    "finish-replay-blocked",
  ]
  manifest.hostedResidual = {
    id: "beta23-v3-prearmed-same-commit-current-artifact-fetch-consume-replay",
    requiredEvidence: "one separately authorized normal push of the v3-prepared exact fixture commit; immediate current-version original-artifact transport, online verification before leaf-certificate-notAfter without validity relaxation, one authenticated fetch, one Finish consumption, and immediate replay rejection occur in the same unchanged consumer",
    whyLocalCannotClose: "A real current signed artifact, leaf-certificate validity window, isolated external credential, online verification, and GitHub Actions discovery cannot be produced locally. Local source and packed contracts prove the v3 host-state isolation procedure, public readiness, privacy, trusted modeled fetch, one Finish consumption, and replay block without accessing a live artifact.",
  }
  return manifest
}

function finalObserverProcedure() {
  return {
    credentialHandoff: "retrieve-host-gh-credential-silently-outside-the-consumer-and-pass-it-only-to-one-fixed-read-only-observer-child",
    execution: {
      environment: "env-i-with-only-fixed-allowlisted-variables",
      toolPaths: ["absolute-gh", "absolute-git", "absolute-node", "absolute-npm"],
    },
    failureHandling: {
      afterFetch: "do-not-reinitialize-switch-reset-or-retry",
      beforeFetch: "abandon-and-recreate-the-consumer-before-any-live-fetch",
    },
    hostStateIsolation: {
      externalStateRoots: [
        "HOME",
        "GH_CONFIG_DIR",
        "XDG_CONFIG_HOME",
        "XDG_DATA_HOME",
        "XDG_STATE_HOME",
        "XDG_CACHE_HOME",
        "XDG_RUNTIME_DIR",
        "TMPDIR",
        "APPDATA",
        "LOCALAPPDATA",
        "USERPROFILE",
        "GIT_CONFIG_GLOBAL",
        "GIT_CONFIG_SYSTEM",
        "NPM_CONFIG_USERCONFIG",
        "NPM_CONFIG_CACHE",
      ],
      forbiddenConsumerPaths: [".local/**", ".config/**", ".cache/**"],
      rootBinding: "all-fifteen-absolute-state-roots-must-remain-outside-the-consumer-realpath",
    },
    liveSteps: [
      "normal-push-of-the-same-final-fixture-commit-to-main",
      "current-original-artifact-transport-and-online-crypto-within-leaf-window-without-validity-relaxation",
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
        ".local/**",
        ".config/**",
        ".cache/**",
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
      "one-exact-git-backed-fixture-clone-cwd-head-and-isolated-consumer-home-store",
      "baseline-cwd-git-toplevel-head-source-identity-empty-porcelain-and-empty-git-clean-ndx",
      "source-bound-bootstrap-before-final-fixture-commit",
      "source-bound-preparation-cwd-git-toplevel-head-source-identity-empty-porcelain-and-empty-git-clean-ndx",
      "one-final-commit-with-only-source-bound-bootstrap-allowlist-and-reusable-pin",
      "post-commit-excluded-runtime-build-only-slow-preparation-before-push-without-arbitrary-outer-timeout",
      "credential-handoff-cwd-git-toplevel-head-source-identity-empty-porcelain-and-empty-git-clean-ndx",
      "observer-child-cwd-git-toplevel-head-source-identity-empty-porcelain-and-empty-git-clean-ndx",
      "immediately-pre-push-cwd-git-toplevel-head-source-identity-empty-porcelain-and-empty-git-clean-ndx",
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
    stageCleanliness: [
      "baseline",
      "source-bound-preparation",
      "credential-handoff",
      "observer-child",
      "immediately-pre-push",
    ],
    timeBounds: {
      certificateValidity: "non-relaxable-verify-online-before-leaf-certificate-notAfter",
      outerTimeout: "forbidden-no-arbitrary-outer-timeout",
      slowPreparation: "complete-before-one-normal-push",
    },
    schemaVersion: "consumer-authority-final-observer-procedure.3",
  }
}

function fail() {
  throw new Beta23AcceptanceManifestError("beta23-acceptance-schema")
}
