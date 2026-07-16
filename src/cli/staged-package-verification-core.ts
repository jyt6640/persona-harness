import { assessStagedPackageVerificationInput } from "./staged-package-verification-assessment.js"
import {
  type StagedPackageVerificationAssessment,
  type StagedPackageVerificationResult,
} from "./staged-package-verification-types.js"

export type {
  StagedPackageVerificationInput,
  StagedPackageVerificationResult,
} from "./staged-package-verification-types.js"

function installedStatus(
  assessment: StagedPackageVerificationAssessment,
  check: keyof NonNullable<StagedPackageVerificationAssessment["installed"]>,
): "unavailable" | "verified" {
  return assessment.installed?.[check] === true ? "verified" : "unavailable"
}

export function assessStagedPackageVerification(input: unknown): StagedPackageVerificationResult {
  const assessment = assessStagedPackageVerificationInput(input)
  const verificationStatus = assessment.diagnostics.length === 0 ? "verified" : "blocked"
  const provenanceUnavailableOnly =
    assessment.diagnostics.length === 1 && assessment.diagnostics[0] === "artifact-provenance-unavailable"
  return {
    diagnostics: assessment.diagnostics,
    durableEvidence: "required-before-closure",
    installed: {
      authorityBlocked: installedStatus(assessment, "authorityBlocked"),
      cliHelp: installedStatus(assessment, "cliHelp"),
      closureAuthorityParity: installedStatus(assessment, "closureAuthorityParity"),
      exactVersion: installedStatus(assessment, "exactVersion"),
      npmTest: installedStatus(assessment, "npmTest"),
      sourceCheckoutIndependent: installedStatus(assessment, "sourceCheckoutIndependent"),
      version: installedStatus(assessment, "version"),
      workflowHelp: installedStatus(assessment, "workflowHelp"),
    },
    mode: "read-only",
    promotionAuthorized: false,
    promotionDecision: verificationStatus === "verified" || provenanceUnavailableOnly
      ? "release-approval-required"
      : "blocked",
    provenance: {
      artifactBinding: {
        status: "unavailable",
      },
      registry: {
        gitHead: assessment.registry?.gitHead ?? "unavailable",
        integrity: assessment.registry?.integrity ?? "unavailable",
        shasum: assessment.registry?.shasum ?? "unavailable",
        version: assessment.registry?.version ?? "unavailable",
      },
      source: {
        canonicalMainHead: assessment.plan?.canonicalMainHead ?? "unavailable",
        sourceHead: assessment.plan?.sourceHead ?? "unavailable",
        sourceTag: assessment.plan?.sourceTag ?? "unavailable",
      },
      tarball: {
        integrity: assessment.tarball?.integrity ?? "unavailable",
        sha1: assessment.tarball?.sha1 ?? "unavailable",
        sha256: assessment.tarball?.sha256 ?? "unavailable",
        version: assessment.tarball?.version ?? "unavailable",
      },
    },
    registryMutation: "not-performed",
    schemaVersion: "staged-package-verification.1",
    verificationStatus,
  }
}
