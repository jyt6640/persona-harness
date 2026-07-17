import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { bundleFromJSON } from "@sigstore/bundle"
import { getTrustedRoot } from "@sigstore/tuf"
import { toSignedEntity, toTrustMaterial, Verifier } from "@sigstore/verify"

import {
  STAGED_PACKAGE_ARTIFACT_WORKFLOW_REF,
  StagedPackageArtifactProvenanceError,
} from "./staged-package-artifact-provenance-policy.mjs"

const TRUST_ROOT_MIRROR = "https://tuf-repo-cdn.sigstore.dev"
const CERTIFICATE_ISSUER = "https://token.actions.githubusercontent.com"
const CERTIFICATE_IDENTITY = `^${escapeRegex(`https://github.com/${STAGED_PACKAGE_ARTIFACT_WORKFLOW_REF}`)}$`

export async function readVerifiedStagedPackageArtifactStatement(bundleJson) {
  let bundle
  try {
    bundle = bundleFromJSON(bundleJson)
  } catch {
    throw new StagedPackageArtifactProvenanceError("artifact-provenance-bundle-invalid")
  }
  if (
    bundle.content?.$case !== "dsseEnvelope"
    || bundle.verificationMaterial.content?.$case !== "certificate"
    || bundle.verificationMaterial.tlogEntries.length < 1
    || bundle.verificationMaterial.tlogEntries.some((entry) => entry.inclusionProof === undefined)
  ) {
    throw new StagedPackageArtifactProvenanceError("artifact-provenance-bundle-invalid")
  }

  const cachePath = mkdtempSync(join(tmpdir(), "persona-staged-artifact-sigstore-"))
  try {
    const trustedRoot = await getTrustedRoot({
      cachePath,
      forceCache: false,
      forceInit: true,
      mirrorURL: TRUST_ROOT_MIRROR,
      timeout: 5_000,
    })
    const verifier = new Verifier(toTrustMaterial(trustedRoot), {
      ctlogThreshold: 1,
      tlogThreshold: 1,
    })
    verifier.verify(toSignedEntity(bundle), {
      extensions: { issuer: CERTIFICATE_ISSUER },
      subjectAlternativeName: CERTIFICATE_IDENTITY,
    })
  } catch {
    throw new StagedPackageArtifactProvenanceError("artifact-provenance-crypto")
  } finally {
    rmSync(cachePath, { force: true, recursive: true })
  }

  try {
    return JSON.parse(Buffer.from(bundle.content.dsseEnvelope.payload).toString("utf8"))
  } catch {
    throw new StagedPackageArtifactProvenanceError("artifact-provenance-statement-invalid")
  }
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")
}
