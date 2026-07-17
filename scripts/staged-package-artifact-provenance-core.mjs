import { readStagedTarballFacts, StagedTarballError } from "./staged-package-artifact-tarball.mjs"
import { readVerifiedStagedPackageArtifactStatement } from "./staged-package-artifact-provenance-crypto.mjs"
import {
  readRegistryBindings,
  readStagedPackageArtifactSelection,
  StagedPackageArtifactProvenanceError,
  verifyStagedPackageArtifactStatement,
} from "./staged-package-artifact-provenance-policy.mjs"

export async function verifyStagedPackageArtifactEvidence(input) {
  const selection = readStagedPackageArtifactSelection(input?.channel, input?.version)
  const now = readNow(input?.now)
  let tarball
  try {
    tarball = readStagedTarballFacts(input?.tarballBytes, "persona-harness", selection.version)
  } catch (error) {
    if (error instanceof StagedTarballError) throw new StagedPackageArtifactProvenanceError("artifact-provenance-tarball-invalid")
    throw error
  }
  const registry = readRegistryBindings(selection, input?.registryIndex, input?.registryVersion, tarball)
  const attestation = readAttestation(input?.attestation)
  if (!Array.isArray(input?.attestations) || input.attestations.length !== 1 || input.attestations[0] !== input.attestation) {
    throw new StagedPackageArtifactProvenanceError("artifact-provenance-replay")
  }
  const statement = await readVerifiedStagedPackageArtifactStatement(attestation.bundle)
  const binding = verifyStagedPackageArtifactStatement({
    actionRun: input?.actionRun,
    attestationRepositoryId: attestation.repositoryId,
    now,
    registry,
    selection,
    statement,
    tarball,
  })
  return {
    channel: selection.channel,
    sourceHead: binding.sourceHead,
    subjectDigest: binding.subjectDigest,
    version: selection.version,
  }
}

function readAttestation(value) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new StagedPackageArtifactProvenanceError("artifact-provenance-attestation-invalid")
  }
  const repositoryId = value.repository_id
  if (repositoryId !== 1272008570 || value.bundle === null || typeof value.bundle !== "object") {
    throw new StagedPackageArtifactProvenanceError("artifact-provenance-attestation-invalid")
  }
  return { bundle: value.bundle, repositoryId }
}

function readNow(value) {
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) {
    throw new StagedPackageArtifactProvenanceError("artifact-provenance-time-invalid")
  }
  return value
}
