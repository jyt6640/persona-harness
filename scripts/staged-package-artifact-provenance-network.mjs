import https from "node:https"
import { createHash } from "node:crypto"

import { uncompressSync } from "snappy"

import {
  STAGED_PACKAGE_ARTIFACT_PACKAGE,
  STAGED_PACKAGE_ARTIFACT_PREDICATE_TYPE,
  STAGED_PACKAGE_ARTIFACT_REGISTRY_ORIGIN,
  STAGED_PACKAGE_ARTIFACT_REPOSITORY,
  STAGED_PACKAGE_ARTIFACT_REPOSITORY_ID,
  StagedPackageArtifactProvenanceError,
  stagedPackageArtifactTarballUrl,
} from "./staged-package-artifact-provenance-policy.mjs"

const GITHUB_API_ORIGIN = "https://api.github.com"
const GITHUB_BUNDLE_HOST = "tmaproduction.blob.core.windows.net"
const MAX_JSON_BYTES = 2 * 1024 * 1024
const MAX_TARBALL_BYTES = 20 * 1024 * 1024
const REQUEST_TIMEOUT_MS = 15_000

export async function fetchStagedPackageArtifactEvidence(selection) {
  const registryIndex = await requestJson(new URL(`/${STAGED_PACKAGE_ARTIFACT_PACKAGE}`, STAGED_PACKAGE_ARTIFACT_REGISTRY_ORIGIN), MAX_JSON_BYTES)
  const registryVersion = await requestJson(new URL(`/${STAGED_PACKAGE_ARTIFACT_PACKAGE}/${selection.version}`, STAGED_PACKAGE_ARTIFACT_REGISTRY_ORIGIN), MAX_JSON_BYTES)
  const tarballBytes = await requestBytes(new URL(stagedPackageArtifactTarballUrl(selection.version)), MAX_TARBALL_BYTES)
  const digest = `sha256:${await sha256(tarballBytes)}`
  const encodedPredicate = encodeURIComponent(STAGED_PACKAGE_ARTIFACT_PREDICATE_TYPE)
  const attestations = await requestJson(
    new URL(`/repos/${STAGED_PACKAGE_ARTIFACT_REPOSITORY}/attestations/${digest}?predicate_type=${encodedPredicate}&per_page=100`, GITHUB_API_ORIGIN),
    MAX_JSON_BYTES,
  )
  const record = readAttestationRecord(attestations)
  const bundle = record.bundle === null ? await requestJson(readBundleUrl(record.bundle_url), MAX_JSON_BYTES) : record.bundle
  const attestation = { bundle, repository_id: record.repository_id }
  const actionRun = await requestJson(
    new URL(`/repos/${STAGED_PACKAGE_ARTIFACT_REPOSITORY}/actions/runs/${readRunId(bundle)}`, GITHUB_API_ORIGIN),
    MAX_JSON_BYTES,
  )
  return {
    actionRun,
    attestation,
    attestations: [attestation],
    registryIndex,
    registryVersion,
    tarballBytes,
  }
}

function readAttestationRecord(value) {
  if (typeof value !== "object" || value === null || Array.isArray(value) || !Array.isArray(value.attestations) || value.attestations.length !== 1) {
    throw new StagedPackageArtifactProvenanceError("artifact-provenance-replay")
  }
  const record = value.attestations[0]
  if (typeof record !== "object" || record === null || Array.isArray(record) || record.repository_id !== STAGED_PACKAGE_ARTIFACT_REPOSITORY_ID || !("bundle" in record) || typeof record.bundle_url !== "string") {
    throw new StagedPackageArtifactProvenanceError("artifact-provenance-attestation-invalid")
  }
  return record
}

function readBundleUrl(value) {
  if (typeof value !== "string") throw new StagedPackageArtifactProvenanceError("artifact-provenance-attestation-invalid")
  let url
  try {
    url = new URL(value)
  } catch {
    throw new StagedPackageArtifactProvenanceError("artifact-provenance-attestation-invalid")
  }
  if (
    url.protocol !== "https:"
    || url.hostname !== GITHUB_BUNDLE_HOST
    || !url.pathname.startsWith(`/attestations/${STAGED_PACKAGE_ARTIFACT_REPOSITORY_ID}/`)
    || url.searchParams.get("sig") === null
    || url.searchParams.get("se") === null
  ) {
    throw new StagedPackageArtifactProvenanceError("artifact-provenance-attestation-invalid")
  }
  return url
}

function readRunId(bundle) {
  if (typeof bundle !== "object" || bundle === null || Array.isArray(bundle)) {
    throw new StagedPackageArtifactProvenanceError("artifact-provenance-attestation-invalid")
  }
  const envelope = bundle.dsseEnvelope
  if (typeof envelope !== "object" || envelope === null || Array.isArray(envelope) || typeof envelope.payload !== "string") {
    throw new StagedPackageArtifactProvenanceError("artifact-provenance-attestation-invalid")
  }
  try {
    const statement = JSON.parse(Buffer.from(envelope.payload, "base64").toString("utf8"))
    const runId = statement?.predicate?.run?.id
    if (typeof runId !== "string" || !/^[1-9]\d{0,19}$/u.test(runId)) throw new TypeError("invalid")
    return runId
  } catch {
    throw new StagedPackageArtifactProvenanceError("artifact-provenance-attestation-invalid")
  }
}

function requestJson(url, limit) {
  return request(url, limit).then(({ bytes, contentType }) => {
    try {
      const decoded = contentType === "application/x-snappy"
        ? decodeSnappy(bytes, limit)
        : bytes
      return JSON.parse(decoded.toString("utf8"))
    } catch {
      throw new StagedPackageArtifactProvenanceError("artifact-provenance-network-invalid")
    }
  })
}

function requestBytes(url, limit) {
  return request(url, limit).then(({ bytes }) => bytes)
}

function request(url, limit) {
  if (!isApprovedOrigin(url)) throw new StagedPackageArtifactProvenanceError("artifact-provenance-network-invalid")
  return new Promise((resolve, reject) => {
    const request = https.get(url, {
      headers: {
        Accept: "application/vnd.github+json, application/json",
        "User-Agent": "persona-harness-staged-artifact-verifier",
      },
      timeout: REQUEST_TIMEOUT_MS,
    }, (response) => {
      const chunks = []
      let bytes = 0
      const contentLength = Number(response.headers["content-length"] ?? "0")
      if (response.statusCode !== 200 || !Number.isSafeInteger(contentLength) || contentLength < 0 || contentLength > limit) {
        response.resume()
        reject(new StagedPackageArtifactProvenanceError("artifact-provenance-unavailable"))
        return
      }
      response.on("data", (chunk) => {
        bytes += chunk.length
        if (bytes > limit) {
          request.destroy()
          reject(new StagedPackageArtifactProvenanceError("artifact-provenance-unavailable"))
          return
        }
        chunks.push(chunk)
      })
      response.on("end", () => resolve({
        bytes: Buffer.concat(chunks),
        contentType: String(response.headers["content-type"] ?? "").split(";")[0].toLowerCase(),
      }))
      response.on("error", () => reject(new StagedPackageArtifactProvenanceError("artifact-provenance-unavailable")))
    })
    request.on("timeout", () => request.destroy(new StagedPackageArtifactProvenanceError("artifact-provenance-unavailable")))
    request.on("error", () => reject(new StagedPackageArtifactProvenanceError("artifact-provenance-unavailable")))
  })
}

function decodeSnappy(bytes, limit) {
  if (readSnappyLength(bytes) > limit) throw new StagedPackageArtifactProvenanceError("artifact-provenance-unavailable")
  try {
    return uncompressSync(bytes)
  } catch {
    throw new StagedPackageArtifactProvenanceError("artifact-provenance-network-invalid")
  }
}

function readSnappyLength(bytes) {
  let value = 0
  for (let index = 0; index < 5 && index < bytes.length; index += 1) {
    const byte = bytes[index]
    if (byte === undefined) break
    value += (byte & 0x7f) * (2 ** (7 * index))
    if ((byte & 0x80) === 0 && Number.isSafeInteger(value) && value >= 0) return value
  }
  throw new StagedPackageArtifactProvenanceError("artifact-provenance-network-invalid")
}

function isApprovedOrigin(url) {
  return url.protocol === "https:" && (
    url.origin === STAGED_PACKAGE_ARTIFACT_REGISTRY_ORIGIN
    || url.origin === GITHUB_API_ORIGIN
    || url.hostname === GITHUB_BUNDLE_HOST
  )
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex")
}
