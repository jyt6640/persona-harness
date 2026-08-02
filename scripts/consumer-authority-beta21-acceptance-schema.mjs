import { readFileSync } from "node:fs"
import { join } from "node:path"
import { isDeepStrictEqual } from "node:util"

import { canonicalBeta20AcceptanceManifest } from "./consumer-authority-beta20-acceptance-schema.mjs"
import {
  canonicalPackagePublisherPlan,
  parseCanonicalPackagePublisherPlan,
} from "./canonical-package-publisher.mjs"
import {
  parseExternalArtifactTransportPlan,
} from "./consumer-authority-external-artifact-transport-plan.mjs"
import { parseExternalAttestationCommandPlan } from "./consumer-authority-external-attestation-command-plan.mjs"

export const BETA21_ACCEPTANCE_SCHEMA_VERSION = "consumer-authority-beta21-acceptance.1"

const BETA21_PACKAGE_VERSION = "0.8.0-beta.21"
const ACCEPTANCE_PATH = join("docs", "current", "release", "consumer-authority-beta21-acceptance.json")
const EXPECTED_MANIFEST = buildExpectedManifest()

export class Beta21AcceptanceManifestError extends Error {
  constructor(code) {
    super(code)
    this.code = code
  }
}

export function canonicalBeta21AcceptanceManifest() {
  return structuredClone(EXPECTED_MANIFEST)
}

export function readBeta21AcceptanceManifest(packageRoot) {
  let packageVersion
  let value
  try {
    packageVersion = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8")).version
    value = JSON.parse(readFileSync(join(packageRoot, ACCEPTANCE_PATH), "utf8"))
  } catch {
    fail()
  }
  return parseBeta21AcceptanceManifest(value, packageVersion)
}

export function parseBeta21AcceptanceManifest(value, packageVersion) {
  if (packageVersion !== BETA21_PACKAGE_VERSION || !isDeepStrictEqual(value, EXPECTED_MANIFEST)) fail()
  parseCanonicalPackagePublisherPlan(value.canonicalPackagePublisherPlan)
  parseExternalAttestationCommandPlan(value.externalAttestationCommandPlan)
  parseExternalArtifactTransportPlan(value.externalArtifactTransportPlan)
  return value
}

function buildExpectedManifest() {
  const manifest = canonicalBeta20AcceptanceManifest()
  manifest.schemaVersion = BETA21_ACCEPTANCE_SCHEMA_VERSION
  manifest.package.version = BETA21_PACKAGE_VERSION
  manifest.beta20HistoricalFinalObserver = {
    outcome: "trusted-unconsumed-live-fetch-followed-by-intentional-workflow-state-uninitialized-block-not-reusable-as-closure-evidence",
    procedureRecordSha256: "1d370a4e4cdd55b20e27c016073246b78c373548c84c89c3499b3838e27980a7",
    reusableForBeta21: false,
    version: "0.8.0-beta.20",
  }
  manifest.canonicalPackagePublisherPlan = canonicalPackagePublisherPlan()
  manifest.authority.fixturePlan.registryInstall = "npm install persona-harness@0.8.0-beta.21 --registry https://registry.npmjs.org"
  manifest.authority.hostedFixture.revision = "postmerge-persona-harness-beta21-main-sha"
  manifest.prearmedExternalHandoff.finalObserverProcedure = finalObserverProcedure()
  manifest.prearmedExternalHandoff.prepare.allowedBeforeFixture = [
    "prepare-one-exact-git-backed-consumer-cwd-head-and-isolated-home-store",
    "public-pre-authority-readiness",
    "public-initialized-finish-state",
    "observer-credential-preflight",
    "external-attestation-command-plan-preflight",
    "external-artifact-transport-plan-preflight",
    "enroll-after-prefetch-readiness",
    "status-and-explain-on-ready-same-consumer",
  ]
  manifest.prearmedExternalHandoff.trigger.onlyAfter = "immutable-final-observer-procedure-prefetch-ready-and-natural-current-version-original-artifact"
  manifest.prearmedExternalHandoff.trigger.steps = [
    "final-observer-procedure-prefetch-ready",
    "observer-credential-preflight-ready",
    "external-attestation-command-plan-parser-ready",
    "external-artifact-transport-plan-parser-ready",
    "enroll-after-prefetch-readiness",
    "acquire-original-bytes-through-validated-external-artifact-transport-plan",
    "verify-online-before-leaf-certificate-notAfter",
    "authority-fetch-discovers-and-binds-original-artifact",
    "same-consumer-trusted-unconsumed-no-readiness-blocker",
    "finish-consume-once",
    "finish-replay-blocked",
  ]
  manifest.hostedResidual = {
    id: "beta21-prearmed-current-artifact-fetch-consume-replay",
    requiredEvidence: "one natural current-version original-artifact observation after the immutable final-observer prefetch procedure; online verification, one authenticated fetch, one Finish consumption, and immediate replay rejection occur in the same unchanged consumer",
    whyLocalCannotClose: "A real current signed artifact, isolated external credential, online verification, and GitHub Actions discovery cannot be produced locally. Local source and packed contracts prove the public readiness, procedure binding, privacy, trusted modeled fetch, one Finish consumption, and replay block without accessing a live artifact.",
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
      "enroll-once-after-prefetch-readiness",
      "current-original-artifact-transport-and-online-crypto",
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
    prefetchSteps: [
      "one-exact-git-backed-registry-consumer-cwd-and-head-with-one-isolated-home-store",
      "public-bootstrap-accepted-plan-and-current-loop-state",
      "public-Gradle-test-compileJava-and-clean",
      "public-README-profile-and-Java-evidence",
      "public-implementation-and-review-report-ingress",
      "public-plan-status",
      "default-Finish-blocked-only-trusted-authority-required",
    ],
    procedureRecord: {
      location: "coordinator-governed-immutable-external-procedure-record-no-local-path",
      sha256: "1d370a4e4cdd55b20e27c016073246b78c373548c84c89c3499b3838e27980a7",
    },
    schemaVersion: "consumer-authority-final-observer-procedure.1",
  }
}

function fail() {
  throw new Beta21AcceptanceManifestError("beta21-acceptance-schema")
}
