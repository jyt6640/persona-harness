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
  captureWorkspaceIdentity,
} from "./ci-reverification-identity.js"
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
): EnrolledProjectFinishAttestationRead {
  const enrollments = readAuthorityEnrollments(options)
  if (enrollments.state !== "ready") {
    return {
      enrollmentState: enrollments.state,
      sourceState: "unavailable",
      values: [],
    }
  }
  const workspace = captureWorkspaceIdentity(projectDir)
  if (workspace.status !== "available") {
    return { enrollmentState: "ready", sourceState: "unavailable", values: [] }
  }
  const git = captureGitIdentity(projectDir, workspace.value)
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
      assessment: inspectProjectFinishAttestationArtifact(projectDir, enrollment, artifact.value.archive, now),
      enrollment,
    })
  }
  return { enrollmentState: "ready", sourceState: "ready", values }
}
