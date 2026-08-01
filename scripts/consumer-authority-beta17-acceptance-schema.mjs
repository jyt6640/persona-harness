import { readFileSync } from "node:fs"
import { join } from "node:path"
import { isDeepStrictEqual } from "node:util"

import { canonicalBeta16AcceptanceManifest } from "./consumer-authority-beta16-acceptance-schema.mjs"
import {
  canonicalExternalArtifactTransportPlan,
  parseExternalArtifactTransportPlan,
} from "./consumer-authority-external-artifact-transport-plan.mjs"
import { parseExternalAttestationCommandPlan } from "./consumer-authority-external-attestation-command-plan.mjs"

export const BETA17_ACCEPTANCE_SCHEMA_VERSION = "consumer-authority-beta17-acceptance.1"

const BETA17_PACKAGE_VERSION = "0.8.0-beta.17"
const ACCEPTANCE_PATH = join("docs", "current", "release", "consumer-authority-beta17-acceptance.json")
const EXPECTED_MANIFEST = buildExpectedManifest()

export class Beta17AcceptanceManifestError extends Error {
  constructor(code) {
    super(code)
    this.code = code
  }
}

export function canonicalBeta17AcceptanceManifest() {
  return structuredClone(EXPECTED_MANIFEST)
}

export function readBeta17AcceptanceManifest(packageRoot) {
  let packageVersion
  let value
  try {
    packageVersion = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8")).version
    value = JSON.parse(readFileSync(join(packageRoot, ACCEPTANCE_PATH), "utf8"))
  } catch {
    fail()
  }
  return parseBeta17AcceptanceManifest(value, packageVersion)
}

export function parseBeta17AcceptanceManifest(value, packageVersion) {
  if (packageVersion !== BETA17_PACKAGE_VERSION || !isDeepStrictEqual(value, EXPECTED_MANIFEST)) fail()
  parseExternalAttestationCommandPlan(value.externalAttestationCommandPlan)
  parseExternalArtifactTransportPlan(value.externalArtifactTransportPlan)
  return value
}

function buildExpectedManifest() {
  const manifest = canonicalBeta16AcceptanceManifest()
  manifest.schemaVersion = BETA17_ACCEPTANCE_SCHEMA_VERSION
  manifest.package.version = BETA17_PACKAGE_VERSION
  delete manifest.beta15HistoricalExternal
  manifest.beta16HistoricalExternal = {
    outcome: "external-gh-artifact-download-exit-zero-with-zero-byte-output-before-zip-validation",
    reusableForBeta17: false,
    version: "0.8.0-beta.16",
  }
  manifest.externalArtifactTransportPlan = canonicalExternalArtifactTransportPlan()
  manifest.prearmedExternalHandoff.prepare.allowedBeforeFixture.splice(6, 0, "external-artifact-transport-plan-preflight")
  manifest.prearmedExternalHandoff.prepare.artifactTransportPreflight = {
    command: "node node_modules/persona-harness/scripts/preflight-consumer-authority-external-artifact-transport.mjs --json",
    credential: "absent",
    input: "no-artifact-fixed-topology-and-metadata-sentinel-only",
    output: "bounded-parser-classification-only",
    productFallback: "forbidden",
  }
  manifest.prearmedExternalHandoff.trigger.onlyAfter = "observer-credential-preflight-ready-attestation-command-plan-preflight-ready-artifact-transport-plan-preflight-ready-public-initialized-readiness-and-natural-current-version-original-artifact"
  manifest.prearmedExternalHandoff.trigger.steps = [
    "observer-credential-preflight-ready",
    "external-attestation-command-plan-parser-ready",
    "external-artifact-transport-plan-parser-ready",
    "public-initialized-finish-blocked-only-on-trusted-authority-required",
    "acquire-original-bytes-through-validated-external-artifact-transport-plan",
    "verify-online-before-leaf-certificate-notAfter",
    "authority-fetch-discovers-and-binds-original-artifact",
    "finish-consume-once",
    "finish-replay-blocked",
  ]
  manifest.prearmedExternalHandoff.nonAuthority.push(
    "transport-plan-preflight-does-not-access-an-artifact-or-network",
    "transport-model-safety-is-not-online-crypto-or-authority-evidence",
  )
  manifest.packageBoundary.contentIdentity = {
    aggregate: "sorted-package-relative-path-type-normalized-allowed-mode-size-sha256",
    allowedMemberTypes: ["regular"],
    allowedModes: ["0600", "0644", "0700", "0755"],
    canonicalPacker: {
      environment: ["isolated-HOME", "isolated-npm-cache", "isolated-npm-config", "isolated-git-config", "umask-0022", "LANG-C", "LC_ALL-C", "TZ-UTC", "SOURCE_DATE_EPOCH-0"],
      node: "20.19.0",
      npm: "10.8.2",
      publish: "publish-one-exact-canonical-tarball-only",
    },
    crossEnvironment: "compare-package-content-identity-not-generic-independent-npm-pack-raw-tar-sha256",
    rawTarballSha256: "valid-only-for-the-exact-canonical-supplied-tarball-or-postpublish-registry-blob",
    registryReadback: "require-registry-raw-sha256-integrity-and-package-content-identity-to-match-frozen-canonical-package-facts",
    retainedExternalDiagnostics: {
      beta16: {
        contentOnlySha256: "9bb1c7eaeceb79d198d7baafdaea9c8bc73cd8750209ea5aa76cfc46070e0832",
        entryCount: 1191,
        identitySha256: "9eac0bdc041e8e616bd6e4de3ba49e8490b8a269f3f0d3e520027833b927c332",
        modeCounts: { "0600": 296, "0644": 887, "0700": 7, "0755": 1 },
      },
      beta17: {
        contentOnlySha256: "d411a23a2343cd21e33ac30250ed903934968e214b7f198ccd0ea91a7d6bf580",
        entryCount: 1200,
        identitySha256: "5771dc973dd95e5d3f8b01a9e17becf3c17223b3d94aed692e5248e0c3054c5e",
        modeCounts: { "0600": 305, "0644": 887, "0700": 7, "0755": 1 },
      },
      headerClassification: "normalized-gzip-tar-headers-do-not-explain-the-retained-content-or-mode-identity-delta",
      reuse: "diagnostic-only-not-acceptance-evidence",
    },
    schemaVersion: "package-content-identity.1",
  }
  manifest.packageBoundary.authoritativeBundleContract.installedContract = "fresh-installed-package-exercise-uses-the-exact-canonical-target-tarball-sha256-and-package-content-identity"
  manifest.authority.fixturePlan.registryInstall = "npm install persona-harness@0.8.0-beta.17 --registry https://registry.npmjs.org"
  manifest.authority.hostedFixture.revision = "postmerge-persona-harness-beta17-main-sha"
  manifest.hostedResidual = {
    id: "beta17-prearmed-external-artifact-transport-authority-consumption",
    requiredEvidence: "a bounded observer credential-preflight ready result, no-token no-artifact command-plan and transport-plan parser-ready results, and a public initialized Finish blocked only on trusted-authority-required in the exact consumer before fixture authorization; one natural current-version public fixture artifact; validated external transport acquisition with exact ZIP bytes and safe members; independent online verification inside the live certificate window; real installed authority fetch; one explicit Finish consumption; and immediate replay rejection",
    whyLocalCannotClose: "GitHub Actions must mint the original current-version signed artifact, while the external observer alone performs live acquisition and online verification without retaining a credential, signed URL, raw response, or authority result.",
  }
  return manifest
}

function fail() {
  throw new Beta17AcceptanceManifestError("beta17-acceptance-schema")
}
