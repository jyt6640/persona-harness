import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"

import { assessSigstoreNodeRuntime } from "./node-runtime-floor.mjs"
import {
  classifyProjectFinishTrustRootError,
  classifyProjectFinishVerificationError,
} from "./project-finish-attestation-sigstore-error.mjs"

const CERTIFICATE_ISSUER = "https://token.actions.githubusercontent.com"
const PRODUCER_REPOSITORY = "jyt6640/persona-harness"
const TRUST_ROOT_MIRROR = "https://tuf-repo-cdn.sigstore.dev"
const WORKFLOW_PATH = ".github/workflows/persona-harness-project-finish.yml"
const WORKER_CACHE_ENV = "PH_PROJECT_FINISH_SIGSTORE_CACHE_PATH"

async function runWorker() {
  if (assessSigstoreNodeRuntime(process.versions.node).status !== "supported") {
    return failed("runtime-unsupported")
  }
  if (process.argv[2] === "--trust-readiness") return inspectTrustReadiness()

  const { bundleFromJSON } = await import("@sigstore/bundle")
  const { toSignedEntity, toTrustMaterial, Verifier } = await import("@sigstore/verify")
  const bundleBytes = readFileSync(0)
  const bundleDigest = `sha256:${createHash("sha256").update(bundleBytes).digest("hex")}`
  let bundle
  try {
    bundle = bundleFromJSON(JSON.parse(bundleBytes.toString("utf8")))
  } catch {
    return failed("malformed-bundle")
  }
  if (
    bundle.content?.$case !== "dsseEnvelope"
    || bundle.verificationMaterial.content?.$case !== "certificate"
    || bundle.verificationMaterial.tlogEntries.length < 1
    || bundle.verificationMaterial.tlogEntries.some((entry) => entry.inclusionProof === undefined)
  ) {
    return failed("malformed-bundle")
  }
  const statement = parseStatement(bundle.content.dsseEnvelope.payload)
  const certificateIdentity = statement === undefined
    ? undefined
    : expectedCertificateIdentity(statement)
  if (statement === undefined || certificateIdentity === undefined) return failed("malformed-bundle")

  const cachePath = workerCachePath()
  if (cachePath === undefined) return failed("trust-root-unavailable")
  const trust = await readTrustedRoot(cachePath)
  if (!trust.ok) return trust
  try {
    const verifier = new Verifier(toTrustMaterial(trust.value), {
      ctlogThreshold: 1,
      tlogThreshold: 1,
    })
    verifier.verify(toSignedEntity(bundle), {
      extensions: { issuer: CERTIFICATE_ISSUER },
      subjectAlternativeName: certificateIdentity,
    })
  } catch (error) {
    return failed(classifyProjectFinishVerificationError(error))
  }
  return { bundleDigest, ok: true, statement }
}

async function inspectTrustReadiness() {
  const cachePath = workerCachePath()
  if (cachePath === undefined) return failed("trust-root-unavailable")
  const trust = await readTrustedRoot(cachePath)
  return trust.ok ? { ok: true, state: "ready" } : trust
}

async function readTrustedRoot(cachePath) {
  try {
    const { getTrustedRoot } = await import("@sigstore/tuf")
    const value = await getTrustedRoot({
      cachePath,
      forceCache: false,
      forceInit: true,
      mirrorURL: TRUST_ROOT_MIRROR,
      retry: { retries: 0 },
      timeout: 5_000,
    })
    return { ok: true, value }
  } catch (error) {
    return failed(classifyProjectFinishTrustRootError(error))
  }
}

function workerCachePath() {
  const value = process.env[WORKER_CACHE_ENV]
  return typeof value === "string" && value.length > 0 ? value : undefined
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

runWorker()
  .then((result) => {
    process.stdout.write(JSON.stringify(result))
    if (!result.ok) process.exitCode = 1
  })
  .catch(() => {
    const state = process.argv[2] === "--trust-readiness"
      ? "trust-root-unavailable"
      : "crypto-failed"
    process.stdout.write(JSON.stringify(failed(state)))
    process.exitCode = 1
  })
