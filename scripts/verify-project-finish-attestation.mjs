import { createHash } from "node:crypto"
import { mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { assessSigstoreNodeRuntime } from "./node-runtime-floor.mjs"

const CERTIFICATE_ISSUER = "https://token.actions.githubusercontent.com"
const PRODUCER_REPOSITORY = "jyt6640/persona-harness"
const TRUST_ROOT_MIRROR = "https://tuf-repo-cdn.sigstore.dev"
const WORKFLOW_PATH = ".github/workflows/persona-harness-project-finish.yml"

async function verifyBundle() {
  if (assessSigstoreNodeRuntime(process.versions.node).status !== "supported") {
    return failed("runtime-unsupported")
  }
  const { bundleFromJSON } = await import("@sigstore/bundle")
  const { getTrustedRoot } = await import("@sigstore/tuf")
  const { toSignedEntity, toTrustMaterial, Verifier } = await import("@sigstore/verify")
  const bundleBytes = readFileSync(0)
  const bundleDigest = `sha256:${createHash("sha256").update(bundleBytes).digest("hex")}`
  let bundle
  try {
    bundle = bundleFromJSON(JSON.parse(bundleBytes.toString("utf8")))
  } catch {
    return failed("malformed")
  }
  if (
    bundle.content?.$case !== "dsseEnvelope"
    || bundle.verificationMaterial.content?.$case !== "certificate"
    || bundle.verificationMaterial.tlogEntries.length < 1
    || bundle.verificationMaterial.tlogEntries.some((entry) => entry.inclusionProof === undefined)
  ) {
    return failed("malformed")
  }
  const statement = parseStatement(bundle.content.dsseEnvelope.payload)
  const certificateIdentity = statement === undefined
    ? undefined
    : expectedCertificateIdentity(statement)
  if (statement === undefined || certificateIdentity === undefined) return failed("malformed")

  const cachePath = mkdtempSync(join(tmpdir(), "persona-harness-project-finish-sigstore-"))
  try {
    let trustedRoot
    try {
      trustedRoot = await getTrustedRoot({
        cachePath,
        forceCache: false,
        forceInit: true,
        mirrorURL: TRUST_ROOT_MIRROR,
        timeout: 5_000,
      })
    } catch {
      return failed("network-unavailable")
    }
    try {
      const verifier = new Verifier(toTrustMaterial(trustedRoot), {
        ctlogThreshold: 1,
        tlogThreshold: 1,
      })
      verifier.verify(toSignedEntity(bundle), {
        extensions: { issuer: CERTIFICATE_ISSUER },
        subjectAlternativeName: certificateIdentity,
      })
    } catch {
      return failed("crypto-failed")
    }
    return { bundleDigest, ok: true, statement }
  } finally {
    rmSync(cachePath, { force: true, recursive: true })
  }
}

function parseStatement(payload) {
  try {
    const value = JSON.parse(Buffer.from(payload).toString("utf8"))
    return isRecord(value) ? value : undefined
  } catch {
    return undefined
  }
}

function expectedCertificateIdentity(statement) {
  const predicate = recordField(statement, "predicate")
  const receipt = predicate === undefined ? undefined : recordField(predicate, "receipt")
  const workflow = receipt === undefined ? undefined : recordField(receipt, "workflow")
  const reusable = workflow === undefined ? undefined : recordField(workflow, "reusable")
  if (
    reusable === undefined
    || reusable.path !== WORKFLOW_PATH
    || typeof reusable.ref !== "string"
    || typeof reusable.sha !== "string"
    || !/^[a-f0-9]{40}$/u.test(reusable.sha)
    || reusable.ref !== `${PRODUCER_REPOSITORY}/${WORKFLOW_PATH}@${reusable.sha}`
  ) {
    return undefined
  }
  return `^https://github\\.com/${PRODUCER_REPOSITORY}/\\.github/workflows/persona-harness-project-finish\\.yml@${reusable.sha}$`
}

function recordField(value, key) {
  if (!isRecord(value)) return undefined
  const field = value[key]
  return isRecord(field) ? field : undefined
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function failed(state) {
  return { ok: false, state }
}

verifyBundle()
  .then((result) => {
    process.stdout.write(JSON.stringify(result))
    if (!result.ok) process.exitCode = 1
  })
  .catch(() => {
    process.stdout.write(JSON.stringify(failed("crypto-failed")))
    process.exitCode = 1
  })
