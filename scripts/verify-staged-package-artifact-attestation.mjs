import {
  readStagedPackageArtifactSelection,
  STAGED_PACKAGE_ARTIFACT_PROVENANCE_SCHEMA,
  StagedPackageArtifactProvenanceError,
} from "./staged-package-artifact-provenance-policy.mjs"
import { fetchStagedPackageArtifactEvidence } from "./staged-package-artifact-provenance-network.mjs"
import { verifyStagedPackageArtifactEvidence } from "./staged-package-artifact-provenance-core.mjs"

async function main() {
  let selection
  try {
    selection = readArguments(process.argv.slice(2))
    const evidence = await fetchStagedPackageArtifactEvidence(selection)
    const verified = await verifyStagedPackageArtifactEvidence({ ...evidence, ...selection, now: new Date() })
    writeResult({
      channel: verified.channel,
      diagnostics: [],
      sourceHead: verified.sourceHead,
      status: "verified",
      subjectDigest: verified.subjectDigest,
      version: verified.version,
    })
  } catch (error) {
    const code = error instanceof StagedPackageArtifactProvenanceError
      ? error.code
      : "artifact-provenance-unavailable"
    writeResult({
      channel: selection?.channel ?? "unavailable",
      diagnostics: [code],
      status: "blocked",
      version: selection?.version ?? "unavailable",
    })
  }
}

function readArguments(args) {
  if (args.length !== 4 || args[0] !== "--channel" || args[2] !== "--version") {
    throw new StagedPackageArtifactProvenanceError("artifact-provenance-input-invalid")
  }
  return readStagedPackageArtifactSelection(args[1], args[3])
}

function writeResult(value) {
  process.stdout.write(`${JSON.stringify({
    authorityEligible: false,
    channel: value.channel,
    diagnostics: value.diagnostics,
    mode: "read-only",
    promotionAuthorized: false,
    promotionDecision: "release-approval-required",
    registryMutation: "not-performed",
    schemaVersion: STAGED_PACKAGE_ARTIFACT_PROVENANCE_SCHEMA,
    sourceHead: value.sourceHead,
    subjectDigest: value.subjectDigest,
    verificationStatus: value.status,
    version: value.version,
  })}\n`)
}

main()
