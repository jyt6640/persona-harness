import {
  readAuthorityArtifact,
  type AuthorityArtifact,
} from "./authority-artifact-store.js"
import {
  readAuthorityEnrollments,
  type AuthorityEnrollment,
  type AuthorityEnrollmentStoreOptions,
} from "./authority-enrollment.js"
import {
  captureGitIdentity,
  captureGitIdentityFromCapturedProject,
  captureWorkspaceIdentity,
} from "./ci-reverification-identity.js"
import type { ProjectReadBoundary } from "../io/bootstrap-write-boundary.js"
import {
  inspectProjectFinishAttestationArtifact,
  type ProjectFinishAttestationVerifierAssessment,
} from "./project-finish-attestation-verifier.js"

export type EnrolledProjectFinishAttestation = {
  readonly artifact: AuthorityArtifact
  readonly assessment: ProjectFinishAttestationVerifierAssessment
  readonly enrollment: AuthorityEnrollment
}

export type EnrolledProjectFinishAttestationRead = {
  readonly enrollmentState: "invalid" | "missing" | "ready"
  readonly sourceState: "ready" | "unavailable"
  readonly values: readonly EnrolledProjectFinishAttestation[]
}

export function readEnrolledProjectFinishAttestations(
  projectDir: string,
  options: Pick<AuthorityEnrollmentStoreOptions, "storeRoot"> = {},
  now = new Date(),
  projectReadBoundary?: ProjectReadBoundary,
): EnrolledProjectFinishAttestationRead {
  const enrollments = readAuthorityEnrollments(options)
  if (enrollments.state !== "ready") {
    return {
      enrollmentState: enrollments.state,
      sourceState: "unavailable",
      values: [],
    }
  }
  const workspace = projectReadBoundary === undefined
    ? captureWorkspaceIdentity(projectDir)
    : { status: "available" as const, value: projectReadBoundary.workspaceIdentity() }
  if (workspace.status !== "available") {
    return { enrollmentState: "ready", sourceState: "unavailable", values: [] }
  }
  const git = projectReadBoundary === undefined
    ? captureGitIdentity(projectDir, workspace.value)
    : captureGitIdentityFromCapturedProject((args) => projectReadBoundary.runFixedGit(args))
  if (!git.available || git.head === undefined) {
    return { enrollmentState: "ready", sourceState: "unavailable", values: [] }
  }
  const values: EnrolledProjectFinishAttestation[] = []
  for (const enrollment of enrollments.value) {
    const artifact = readAuthorityArtifact(enrollment.repositoryId, options)
    if (
      artifact.state !== "ready"
      || artifact.value.repositoryId !== enrollment.repositoryId
      || artifact.value.sourceHead !== git.head
    ) {
      continue
    }
    values.push({
      artifact: artifact.value,
      assessment: inspectProjectFinishAttestationArtifact(
        projectDir,
        enrollment,
        artifact.value.archive,
        now,
        projectReadBoundary,
      ),
      enrollment,
    })
  }
  return { enrollmentState: "ready", sourceState: "ready", values }
}
