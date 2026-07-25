import { readdirSync, realpathSync } from "node:fs"
import { join, resolve } from "node:path"

import { extractOriginalArtifactMembers } from "../../scripts/consumer-authority-artifact-archive.mjs"
import {
  captureNoFollowDirectory,
  readNoFollowRegularFile,
  sameNoFollowPathIdentity,
  type NoFollowPathIdentity,
} from "../io/no-follow-file.js"
import {
  PROJECT_FINISH_ATTESTATION_EVIDENCE_DIRECTORY,
  PROJECT_FINISH_ATTESTATION_EVIDENCE_FILES,
  PROJECT_FINISH_ATTESTATION_MAX_BUNDLE_BYTES,
  PROJECT_FINISH_ATTESTATION_MAX_JSON_BYTES,
} from "./project-finish-attestation-verifier-types.js"

export type ProjectFinishAttestationEvidence = {
  readonly bundleBytes: Buffer
  readonly predicateBytes: Buffer
  readonly receiptBytes: Buffer
}

export function evidenceFromOriginalArtifact(
  archive: Buffer,
): ProjectFinishAttestationEvidence | undefined {
  try {
    const members = extractOriginalArtifactMembers(archive)
    return {
      bundleBytes: members.bundle,
      predicateBytes: members.predicate,
      receiptBytes: members.receipt,
    }
  } catch {
    return undefined
  }
}

export function readProjectFinishAttestationEvidence(
  projectDir: string,
): ProjectFinishAttestationEvidence | undefined {
  const personaDirectory = join(projectDir, ".persona")
  const evidenceDirectory = join(projectDir, ".persona", "evidence")
  const artifactDirectory = join(projectDir, PROJECT_FINISH_ATTESTATION_EVIDENCE_DIRECTORY)
  const root = captureNoFollowDirectory(projectDir)
  const persona = captureNoFollowDirectory(personaDirectory)
  const evidence = captureNoFollowDirectory(evidenceDirectory)
  const artifact = captureNoFollowDirectory(artifactDirectory)
  if (
    root.kind !== "ready"
    || persona.kind !== "ready"
    || evidence.kind !== "ready"
    || artifact.kind !== "ready"
    || !isCanonicalDirectory(projectDir)
    || !isCanonicalDirectory(personaDirectory)
    || !isCanonicalDirectory(evidenceDirectory)
    || !isCanonicalDirectory(artifactDirectory)
  ) {
    return undefined
  }
  try {
    const names = readdirSync(artifactDirectory).sort()
    if (
      names.length !== PROJECT_FINISH_ATTESTATION_EVIDENCE_FILES.length
      || names.some((name, index) => name !== PROJECT_FINISH_ATTESTATION_EVIDENCE_FILES[index])
    ) {
      return undefined
    }
    const bundle = readNoFollowRegularFile(
      join(artifactDirectory, "bundle.json"),
      PROJECT_FINISH_ATTESTATION_MAX_BUNDLE_BYTES,
      artifactDirectory,
    )
    const predicate = readNoFollowRegularFile(
      join(artifactDirectory, "predicate.json"),
      PROJECT_FINISH_ATTESTATION_MAX_JSON_BYTES,
      artifactDirectory,
    )
    const receipt = readNoFollowRegularFile(
      join(artifactDirectory, "receipt.json"),
      PROJECT_FINISH_ATTESTATION_MAX_JSON_BYTES,
      artifactDirectory,
    )
    if (bundle.kind !== "ready" || predicate.kind !== "ready" || receipt.kind !== "ready") return undefined
    if (
      !sameDirectory(projectDir, root.value)
      || !sameDirectory(personaDirectory, persona.value)
      || !sameDirectory(evidenceDirectory, evidence.value)
      || !sameDirectory(artifactDirectory, artifact.value)
    ) {
      return undefined
    }
    return {
      bundleBytes: bundle.value.bytes,
      predicateBytes: predicate.value.bytes,
      receiptBytes: receipt.value.bytes,
    }
  } catch {
    return undefined
  }
}

export function resolveSafeProjectRoot(projectDir: string): string | undefined {
  const requestedRoot = resolve(projectDir)
  const requested = captureNoFollowDirectory(requestedRoot)
  if (requested.kind !== "ready") return undefined
  try {
    const projectRoot = realpathSync(requestedRoot)
    const canonical = captureNoFollowDirectory(projectRoot)
    return canonical.kind === "ready"
      && sameNoFollowPathIdentity(requested.value, canonical.value)
      && isCanonicalDirectory(projectRoot)
      ? projectRoot
      : undefined
  } catch {
    return undefined
  }
}

function isCanonicalDirectory(path: string): boolean {
  try {
    return realpathSync(path) === path
  } catch {
    return false
  }
}

function sameDirectory(path: string, expected: NoFollowPathIdentity): boolean {
  const current = captureNoFollowDirectory(path)
  return current.kind === "ready" && sameNoFollowPathIdentity(expected, current.value)
}
