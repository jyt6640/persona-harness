import { extractOriginalArtifactMembers } from "../../scripts/consumer-authority-artifact-archive.mjs"
import { type ProjectReadBoundary } from "../io/bootstrap-write-boundary.js"
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
  projectReadBoundary: ProjectReadBoundary,
): ProjectFinishAttestationEvidence | undefined {
  try {
    const entries = projectReadBoundary.readProjectTreeAt(
      PROJECT_FINISH_ATTESTATION_EVIDENCE_DIRECTORY,
      {
        excludedRoots: [],
        maxEntries: PROJECT_FINISH_ATTESTATION_EVIDENCE_FILES.length,
        maxFileBytes: PROJECT_FINISH_ATTESTATION_MAX_BUNDLE_BYTES,
        maxTotalBytes:
          PROJECT_FINISH_ATTESTATION_MAX_BUNDLE_BYTES
          + (2 * PROJECT_FINISH_ATTESTATION_MAX_JSON_BYTES),
      },
    )
    if (entries === undefined) return undefined
    const names = entries.map((entry) => entry.path).sort()
    if (
      names.length !== PROJECT_FINISH_ATTESTATION_EVIDENCE_FILES.length
      || names.some((name, index) => name !== PROJECT_FINISH_ATTESTATION_EVIDENCE_FILES[index])
    ) {
      return undefined
    }
    const files = new Map<string, Buffer>()
    for (const entry of entries) {
      if (entry.kind === "file") files.set(entry.path, entry.bytes)
    }
    const bundle = files.get("bundle.json")
    const predicate = files.get("predicate.json")
    const receipt = files.get("receipt.json")
    if (
      bundle === undefined
      || predicate === undefined
      || receipt === undefined
      || bundle.byteLength > PROJECT_FINISH_ATTESTATION_MAX_BUNDLE_BYTES
      || predicate.byteLength > PROJECT_FINISH_ATTESTATION_MAX_JSON_BYTES
      || receipt.byteLength > PROJECT_FINISH_ATTESTATION_MAX_JSON_BYTES
    ) {
      return undefined
    }
    return {
      bundleBytes: bundle,
      predicateBytes: predicate,
      receiptBytes: receipt,
    }
  } catch {
    return undefined
  }
}
