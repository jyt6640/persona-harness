import { readFileSync } from "node:fs"
import { join } from "node:path"
import { isDeepStrictEqual } from "node:util"

import { BUNDLE_REFERENCE_POLICY } from "./clean-package-boundary-core.mjs"

export const BETA15_ACCEPTANCE_SCHEMA_VERSION = "consumer-authority-beta15-acceptance.2"

const BETA15_PACKAGE_VERSION = "0.8.0-beta.15"
const ACCEPTANCE_PATH = join("docs", "current", "release", "consumer-authority-beta15-acceptance.json")
const EXPECTED_MANIFEST = {
  schemaVersion: BETA15_ACCEPTANCE_SCHEMA_VERSION,
  package: { channel: "staging", scope: "staging-only", version: BETA15_PACKAGE_VERSION },
  packageBoundary: {
    bundle: { requiredRefs: BUNDLE_REFERENCE_POLICY.requiredRefs, verification: "git-bundle-verify-and-exact-ref-binding", baseComparison: "independent-no-local-base-checkout-under-the-same-npm-policy" },
    cleanCheckout: { requiredBindings: ["checkout-cwd", "git-toplevel", "npm-prefix", "resolved-package-json-path", "resolved-package-lock-path", "HEAD-package-json-bytes", "HEAD-package-lock-bytes"], sourceFallback: "forbidden" },
    npm: { invocation: "plain-npm-from-bound-detached-checkout-cwd", packPrefixFlag: "forbidden", global: false, ignoreScriptsBeforePack: false, install: "npm-ci-ignore-scripts", workspaces: false },
    pack: { metadata: "name-version-filename-must-match-frozen-package-and-lock", prepack: "package-root-build-script-derived-from-its-own-package-root", postcondition: "fresh-installed-cli-version-must-match-tarball-version" },
    authoritativeBundleContract: {
      command: "node scripts/verify-clean-package-boundary.mjs --exercise-contract",
      baseAndTarget: "fresh-detached-no-local-checkouts-from-the-same-complete-bundle",
      candidateRef: BUNDLE_REFERENCE_POLICY.candidateRef,
      headAlias: BUNDLE_REFERENCE_POLICY.headAlias,
      rejectBeforePack: "launcher-cwd-or-manifest-outside-bound-checkout",
      sourceContract: "built-cli-package-exercise-contract-under-the-same-executable",
      installedContract: "fresh-installed-package-exercise-uses-exact-target-tarball-sha256",
      fullJavaGradleContract: "source-and-fresh-installed-full-contract-on-a-provisioned-java-gradle-host",
    },
  },
  beta14HistoricalExternal: { outcome: "trusted-fetch-with-uninitialized-finish-noop-and-no-consumption", reusableForBeta15: false, version: "0.8.0-beta.14" },
  preAuthorityReadiness: {
    consumer: "exact-registry-installed-java-spring-gradle",
    commands: ["ph bootstrap backend --strict --no-developer-mcp", "ph bearshell ./gradlew test", "ph bearshell ./gradlew compileJava", "ph bearshell ./gradlew clean", "ph evidence read README.md", "ph evidence read .persona/project-profile.jsonc", "ph evidence read src/main/java/example/cooperative/GreetingService.java", "ph plan --report-filled implementation --stdin", "ph plan --report-filled review --stdin"],
    expectedDefaultFinish: { absentBlockers: ["implementation-report-missing", "review-report-missing", "evidence-missing", "report-coverage-missing", "profile-read-coverage-missing", "java-role-read-coverage-missing", "workflow-loop-state-absent", "ralph-loop-state-absent"], primaryBlocker: "trusted-authority-required", status: "blocked" },
    publicOutput: { absoluteWorkspacePaths: "omitted", stableReferences: [".persona/workflow/plan.md", ".persona/workflow/implementation-report.md", ".persona/workflow/review-report.md"] },
    initialization: {
      acceptedPlan: "ph bootstrap backend --strict --no-developer-mcp",
      binding: { consumerRoot: "same-canonical-project-root", profile: ".persona/project-profile.jsonc", reportsAndEvidence: "public-command-created-only", sourceIdentity: "current-git-source-identity" },
      inactiveFinish: { blocker: "workflow-state-uninitialized", status: "blocked" },
      loopState: [".persona/workflow/workflow-loop-state.json", ".persona/workflow/ralph-loop-state.json"],
      sameConsumer: true,
    },
    negativeCases: ["absolute-workspace-or-temp-path-public-output", "missing-or-malformed-report", "repeated-control-or-oversized-report", "missing-unsafe-replaced-or-identity-drifted-evidence", "workflow-or-ralph-loop-missing-malformed-or-unsafe", "default-finish-has-no-authority-side-effect"],
    proof: "source-built-and-fresh-packed-installed-public-cli",
  },
  authority: {
    binding: {
      callerEnrollment: { repositoryId: 1304576182, repositorySlug: "jyt6640/persona-harness-attestation-claim-fixture", workflowPath: ".github/workflows/research-attestation.yml", workflowRef: "refs/heads/main" },
      reusableSigner: { certificateSanIdentity: "reusable-producer-workflow", workflowPath: ".github/workflows/persona-harness-project-finish.yml" },
      runtimeSourceProjection: { excludedRuntimeMetadata: [".persona/.ph-init-manifest.json", ".persona/workflow"], reason: "bootstrap-local ownership metadata contains the consumer real path and is not caller project source", stillBound: [".persona/project-profile.jsonc", "root-gradle-build-and-settings", "git-source-identity", "public-reports-and-evidence"] },
      required: ["caller-workflow-filename-ref-and-sha", "reusable-workflow-sha-and-certificate-SAN", "repository-id-and-slug", "source-head-and-source-identity", "workflow-run-and-attempt", "artifact-id-and-sha256", "original-archive-members"],
      storeSchema: "consumer-authority-original-artifact.2",
    },
    modeledContract: { acceptedTopology: "separate-enrolled-caller-and-reusable-signer", proof: "source-built-and-fresh-packed-installed-public-bootstrap-bound-discovery-exact-once-finish-and-replay-test", rejected: ["caller-workflow-mismatch", "reusable-workflow-or-certificate-SAN-mismatch", "repository-source-or-run-mismatch", "artifact-digest-or-archive-mismatch", "stale-or-replayed-terminal-record"], authorityClaim: "none-before-a-current-original-artifact-is-verified-online" },
    fixturePlan: { artifact: "project-finish-attestation", consumer: "public-java-spring-gradle", postmergeAction: "normal-push-to-main", registryInstall: "npm install persona-harness@0.8.0-beta.15 --registry https://registry.npmjs.org" },
    hostedFixture: { callerWorkflowPath: ".github/workflows/research-attestation.yml", certificateSanIdentity: "reusable-producer-workflow", event: "push", ref: "refs/heads/main", repository: "jyt6640/persona-harness-attestation-claim-fixture", reusableWorkflowPath: ".github/workflows/persona-harness-project-finish.yml", revision: "postmerge-persona-harness-beta15-main-sha" },
    verification: { predicate: "project-finish-attestation.1", route: "fixed-product-owned-online", unavailable: "bounded-non-authoritative" },
  },
  prearmedExternalHandoff: {
    prepare: {
      allowedBeforeFixture: ["prepare-isolated-consumer-home", "enroll", "status", "explain", "observer-credential-preflight", "public-pre-authority-readiness", "public-initialized-finish-state"],
      consumer: "isolated-exact-registry-install",
      credentialPreflight: { acquisition: "host-gh-auth-token-read-once", command: "node node_modules/persona-harness/scripts/preflight-consumer-authority-observer.mjs --json", consumerHome: "isolated-ephemeral", hostCredential: "host-gh-only", logging: "forbidden", observerWorker: "github-actions-read-only", persistence: "forbidden", productFallback: "forbidden", scope: "fixed-authenticated-user-and-empty-sentinel-actions-metadata", tokenEnvironment: "PH_OBSERVER_PREFLIGHT_GITHUB_TOKEN" },
      prohibitedBeforeArtifact: ["artifact-download", "online-crypto-validation", "authority-fetch", "finish-consumption", "replay-observation"],
      requiredBeforeFixtureAuthorization: "public-initialized-finish-blocked-only-on-trusted-authority-required",
    },
    trigger: { onlyAfter: "observer-credential-preflight-ready-public-initialized-readiness-and-natural-current-version-original-artifact", steps: ["observer-credential-preflight-ready", "public-initialized-finish-blocked-only-on-trusted-authority-required", "download-original-bytes-for-independent-online-verification", "verify-online-before-leaf-certificate-notAfter", "authority-fetch-discovers-and-binds-original-artifact", "finish-consume-once", "finish-replay-blocked"] },
    nonAuthority: ["preflight-does-not-self-validate", "readiness-does-not-authorize-fixture", "readiness-does-not-grant-authority", "readiness-does-not-persist-or-log-host-credential", "readiness-does-not-reuse-beta14-artifact"],
  },
  hostedResidual: { id: "beta15-prearmed-external-authority-consumption", requiredEvidence: "a bounded observer credential-preflight ready result and a public initialized Finish blocked only on trusted-authority-required in the exact consumer before fixture authorization, one natural current-version public fixture artifact, independent online verification inside the live certificate window, real installed authority fetch, one explicit Finish consumption, and immediate replay rejection", whyLocalCannotClose: "GitHub Actions must mint the original current-version signed artifact, while independent online verification and the installed authenticated discovery route must observe live hosted state without retaining a credential." },
  mutationBoundary: { performed: false, prohibited: ["npm-publish", "tag-or-dist-tag-mutation", "release-creation", "artifact-download-or-live-verification", "Finish-consumption", "fixture-push-or-workflow-dispatch"] },
}

export class Beta15AcceptanceManifestError extends Error {
  constructor(code) {
    super(code)
    this.code = code
  }
}

export function readBeta15AcceptanceManifest(packageRoot) {
  let packageVersion
  let value
  try {
    packageVersion = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8")).version
    value = JSON.parse(readFileSync(join(packageRoot, ACCEPTANCE_PATH), "utf8"))
  } catch {
    fail()
  }
  return parseBeta15AcceptanceManifest(value, packageVersion)
}

export function parseBeta15AcceptanceManifest(value, packageVersion) {
  if (packageVersion !== BETA15_PACKAGE_VERSION || !isDeepStrictEqual(value, EXPECTED_MANIFEST)) fail()
  return value
}

function fail() {
  throw new Beta15AcceptanceManifestError("beta15-acceptance-schema")
}
