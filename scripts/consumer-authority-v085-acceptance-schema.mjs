import { readFileSync } from "node:fs"
import { join } from "node:path"
import { isDeepStrictEqual } from "node:util"

import { canonicalV084AcceptanceManifest } from "./consumer-authority-v084-acceptance-schema.mjs"
import { parseCanonicalPackagePublisherPlan } from "./canonical-package-publisher.mjs"
import { parseExternalArtifactTransportPlan } from "./consumer-authority-external-artifact-transport-plan.mjs"
import { parseExternalAttestationCommandPlan } from "./consumer-authority-external-attestation-command-plan.mjs"
import { parseObserverGhToolContract } from "./consumer-authority-observer-gh-tool.mjs"

export const V085_ACCEPTANCE_SCHEMA_VERSION = "consumer-authority-v085-acceptance.1"

const V085_PACKAGE_VERSION = "0.8.5"
const ACCEPTANCE_PATH = join("docs", "current", "release", "consumer-authority-v085-acceptance.json")
const EXPECTED_MANIFEST = buildExpectedManifest()

export class V085AcceptanceManifestError extends Error {
  constructor(code) {
    super(code)
    this.code = code
  }
}

export function canonicalV085AcceptanceManifest() {
  return structuredClone(EXPECTED_MANIFEST)
}

export function readV085AcceptanceManifest(packageRoot) {
  let packageVersion
  let value
  try {
    packageVersion = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8")).version
    value = JSON.parse(readFileSync(join(packageRoot, ACCEPTANCE_PATH), "utf8"))
  } catch {
    fail()
  }
  return parseV085AcceptanceManifest(value, packageVersion)
}

export function parseV085AcceptanceManifest(value, packageVersion) {
  if (packageVersion !== V085_PACKAGE_VERSION || !isDeepStrictEqual(value, EXPECTED_MANIFEST)) fail()
  parseCanonicalPackagePublisherPlan(value.canonicalPackagePublisherPlan)
  parseExternalAttestationCommandPlan(value.externalAttestationCommandPlan)
  parseExternalArtifactTransportPlan(value.externalArtifactTransportPlan)
  parseObserverGhToolContract(value.observerGhTool)
  return value
}

function buildExpectedManifest() {
  const manifest = canonicalV084AcceptanceManifest()
  manifest.schemaVersion = V085_ACCEPTANCE_SCHEMA_VERSION
  manifest.package.channel = "unpublished"
  manifest.package.scope = "source-candidate"
  manifest.package.version = V085_PACKAGE_VERSION
  manifest.v082HistoricalRelease = {
    outcome: "published-latest-v082-release-is-immutable-and-not-reusable-for-this-unpublished-v085-source-candidate-or-any-later-package",
    reusableForV085: false,
    version: "0.8.2",
  }
  manifest.v083HistoricalRelease = {
    outcome: "published-0.8.3-release-is-immutable-and-not-reusable-for-this-unpublished-v085-source-candidate-or-any-later-package",
    reusableForV085: false,
    version: "0.8.3",
  }
  manifest.v084HistoricalRelease = {
    outcome: "published-0.8.4-release-is-immutable-and-not-reusable-for-this-unpublished-v085-source-candidate-or-any-later-package",
    reusableForV085: false,
    version: "0.8.4",
  }
  manifest.authority.fetchBindingReason = {
    allowedReasons: [
      "artifact",
      "package-version",
      "source",
      "enrollment",
      "run",
      "signer",
      "freshness",
      "consumption",
      "verification",
      "unknown",
    ],
    output: "fixed-enum-only-no-values-paths-tokens-urls-or-raw-output",
    publicState: "binding-mismatch",
    schemaVersion: "consumer-authority-fetch-binding-reason.1",
  }
  manifest.authority.fixturePlan.registryInstall = "requires-authorized-release-before-registry-install-persona-harness@0.8.5"
  manifest.authority.hostedFixture.revision = "v085-source-candidate-head-before-authorized-release"
  if (!manifest.preAuthorityReadiness.commands.includes("ph plan --accept")) {
    manifest.preAuthorityReadiness.commands.splice(1, 0, "ph plan --accept")
  }
  manifest.preAuthorityReadiness.initialization.acceptedPlan = "ph plan --accept"
  manifest.preAuthorityReadiness.initialization.retainedDraftPlan =
    "bootstrap preserves an existing draft plan; public readiness must accept it explicitly"
  const prefetchSteps = manifest.prearmedExternalHandoff.finalObserverProcedure.prefetchSteps
  const bootstrapStep = prefetchSteps.indexOf("public-bootstrap-accepted-plan-and-current-loop-state")
  prefetchSteps.splice(
    bootstrapStep,
    1,
    "public-bootstrap-current-loop-state",
    "public-plan-accept-retained-or-draft-plan",
  )
  const completeness = manifest.closureCompleteness.deterministicLinks
  const readinessStep = completeness.indexOf("same-consumer-public-bootstrap-plan-loop-gradle-reports-evidence-readiness")
  if (readinessStep >= 0) {
    completeness[readinessStep] = "same-consumer-public-bootstrap-explicit-plan-accept-loop-gradle-reports-evidence-readiness"
  }
  delete completeness["-1"]
  const exerciseProtocol = manifest.packageBoundary.authoritativeBundleContract.exercisePhaseProtocol
  if (!exerciseProtocol.freshTar.includes("opencode-interview-observation")) {
    exerciseProtocol.freshTar.splice(exerciseProtocol.freshTar.indexOf("repository-only-files"), 0, "opencode-interview-observation")
  }
  if (!exerciseProtocol.sourceBuilt.includes("opencode-interview-observation")) {
    exerciseProtocol.sourceBuilt.splice(exerciseProtocol.sourceBuilt.indexOf("producer-intake"), 0, "opencode-interview-observation")
  }
  if (!manifest.acceptanceResponsibilities.package.requires.includes("post-model-assistant-response-and-pre-approval-trace")) {
    manifest.acceptanceResponsibilities.package.requires.push("post-model-assistant-response-and-pre-approval-trace")
  }
  const opencodeLink = "actual-opencode-first-assistant-response-linked-event-and-zero-pre-approval-mutation-trace-without-transformed-input-substitution"
  if (!manifest.closureCompleteness.deterministicLinks.includes(opencodeLink)) {
    manifest.closureCompleteness.deterministicLinks.push(opencodeLink)
  }
  manifest.hostedResidual.whyLocalCannotClose =
    "A real current signed artifact, leaf-certificate validity window, isolated external credential, online verification, and GitHub Actions discovery cannot be produced locally. Source and CI-shaped packed exercise prove v4 tracked-binding, stage-scoped residue cleanliness, workflow-selected observer-gh ownership, byte-strict primary package-record selector lifecycle, COPYFILE_EXCL private-copy reassessment, one runner-temp isolated token-free state root, fixed-placeholder exact-plan help parser preflight without artifact or network access, strict secondary validation, fixed stage and shape diagnostics. Package acceptance separately proves current package-lock-acceptance binding, exact-tar provenance, normal installation, installed-only no-source fallback, CLI approval-before-mutation behavior, complete source and fresh-installed fixture import closure, explicit public acceptance of a retained draft plan, exact Linux authority-fetch child envelope behavior, trusted-unconsumed-persisted discovery result binding, public readiness, privacy, trusted modeled fetch, one Finish consumption, and replay block without accessing a live artifact."
  manifest.hostedResidual.id = "v085-current-package-acceptance-and-authorized-current-artifact-observation"
  manifest.openCodeInterviewObservation = {
    approvalBoundary: {
      event: "permission.replied",
      acceptedResponses: ["once", "always"],
      preApprovalMutation: "tool.execute-before-or-after-command-executed-file-edited-file-watcher-updated-session-diff-and-assistant-tool-parts-block-before-approval",
    },
    input: "normalized-opencode-event-stream-from-message-and-plugin-hook-surfaces",
    firstResponse: {
      assistantMessage: "first-message.updated-role-assistant-with-one-session-bound-message-id",
      assistantText: "message.part.updated-text-parts-linked-to-that-assistant-message-only",
      transformedUserInput: "user-messages-and-user-text-parts-never-satisfy-the-post-model-predicate",
      messageIdentity: "message-id-session-role-and-event-surface-association-is-immutable-role-drift-blocks",
      partIdentity: "part-id-session-message-type-and-event-surface-association-is-immutable-linked-text-cannot-promote",
      lifecycle: {
        message: "message.updated-first-or-same-binding-repeat-then-user-message.removed-once; no-unknown-remove-or-update-after-remove",
        part: "message.part.updated-first-or-same-binding-repeat-then-message.part.removed-once; no-unknown-remove-update-after-remove-or-rebind",
        rejectedCodes: ["message-lifecycle-invalid", "part-lifecycle-invalid"],
      },
      cardinality: "one-assistant-message-id-only-repeated-updates-of-that-id-allowed",
    },
    response: {
      predicate: "one-bounded-single-question-response-with-one-terminal-question-mark",
      rejectedContent: ["solution", "plan", "command", "file-change", "multiple-or-nonquestion-content"],
    },
    output: "fixed-status-booleans-and-code-only-no-response-text-path-argument-token-or-host-data",
    schemaVersion: "opencode-interview-observation.1",
  }
  return manifest
}

function fail() {
  throw new V085AcceptanceManifestError("v085-acceptance-schema")
}
