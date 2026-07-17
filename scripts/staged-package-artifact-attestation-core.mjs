import { createHash } from "node:crypto"

import { readStagedTarballFacts, StagedTarballError } from "./staged-package-artifact-tarball.mjs"

export const STAGED_PACKAGE_ARTIFACT_SCHEMA = "staged-package-artifact-binding.1"
export const STAGED_PACKAGE_ARTIFACT_PREDICATE_TYPE = "https://github.com/jyt6640/persona-harness/attestations/staged-package-artifact-binding.1"
export const STAGED_PACKAGE_ARTIFACT_COMMAND_CATALOG_ID = "persona-harness-staged-package-artifact-producer.1"
export const STAGED_PACKAGE_ARTIFACT_REPOSITORY = "jyt6640/persona-harness"
export const STAGED_PACKAGE_ARTIFACT_REPOSITORY_ID = 1272008570
export const STAGED_PACKAGE_ARTIFACT_PACKAGE = "persona-harness"
export const STAGED_PACKAGE_ARTIFACT_REGISTRY_ORIGIN = "https://registry.npmjs.org"
export const STAGED_PACKAGE_ARTIFACT_WORKFLOW_PATH = ".github/workflows/staged-package-artifact-attestation.yml"
export const STAGED_PACKAGE_ARTIFACT_WORKFLOW_REF = `${STAGED_PACKAGE_ARTIFACT_REPOSITORY}/${STAGED_PACKAGE_ARTIFACT_WORKFLOW_PATH}@refs/heads/main`
export const STAGED_PACKAGE_ARTIFACT_CHANNELS = ["staging", "next"]

const MAX_SEMVER_LENGTH = 256
const STRICT_SEMVER = /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-(?:0|[1-9]\d*|[0-9A-Za-z-]*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|[0-9A-Za-z-]*[A-Za-z-][0-9A-Za-z-]*))*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/u
const SHA256 = /^sha256:[0-9a-f]{64}$/u
const SHA1 = /^[0-9a-f]{40}$/u
const SHA512_INTEGRITY = /^sha512-[A-Za-z0-9+/=]+$/u
const GITHUB_ID = /^[1-9]\d{0,19}$/u

export const FIXED_STAGED_PACKAGE_ARTIFACT_COMMAND_PLAN = [
  { id: "registry-index", method: "https-get", target: `${STAGED_PACKAGE_ARTIFACT_REGISTRY_ORIGIN}/${STAGED_PACKAGE_ARTIFACT_PACKAGE}` },
  { id: "registry-version", method: "https-get", target: `${STAGED_PACKAGE_ARTIFACT_REGISTRY_ORIGIN}/${STAGED_PACKAGE_ARTIFACT_PACKAGE}/<version>` },
  { id: "registry-tarball", method: "https-get", target: `${STAGED_PACKAGE_ARTIFACT_REGISTRY_ORIGIN}/${STAGED_PACKAGE_ARTIFACT_PACKAGE}/-/${STAGED_PACKAGE_ARTIFACT_PACKAGE}-<version>.tgz` },
]

export class StagedPackageArtifactProducerError extends Error {
  constructor(code) {
    super(code)
    this.code = code
    this.name = "StagedPackageArtifactProducerError"
  }
}

export function stagedPackageTarballUrl(version) {
  if (!isStrictSemver(version)) throw new StagedPackageArtifactProducerError("staged-producer-version-invalid")
  return `${STAGED_PACKAGE_ARTIFACT_REGISTRY_ORIGIN}/${STAGED_PACKAGE_ARTIFACT_PACKAGE}/-/${STAGED_PACKAGE_ARTIFACT_PACKAGE}-${version}.tgz`
}

export function createStagedPackageArtifactPredicate(input) {
  const channel = readChannel(input?.channel)
  const version = readVersion(input?.version)
  const context = validateStagedPackageArtifactContext(input?.context)
  readFixedCommandPlan(input?.commandPlan)
  readRegistryIndex(input?.registryIndex, channel, version)
  const registry = readRegistryVersion(input?.registryVersion, version, context.sourceHead)
  if (registry.tarball !== stagedPackageTarballUrl(version)) {
    throw new StagedPackageArtifactProducerError("staged-producer-tarball-url")
  }

  let tarball
  try {
    tarball = readStagedTarballFacts(input?.tarballBytes, STAGED_PACKAGE_ARTIFACT_PACKAGE, version)
  } catch (error) {
    if (error instanceof StagedTarballError) throw new StagedPackageArtifactProducerError(error.code)
    throw error
  }
  if (tarball.sha1 !== registry.shasum) throw new StagedPackageArtifactProducerError("staged-producer-tarball-shasum")
  if (tarball.integrity !== registry.integrity) throw new StagedPackageArtifactProducerError("staged-producer-tarball-integrity")

  const issuedAt = readIssuedAt(input?.now)
  const expiresAt = new Date(issuedAt.getTime() + 2 * 60 * 60 * 1000).toISOString()
  const commandPlanDigest = sha256(canonicalJson(FIXED_STAGED_PACKAGE_ARTIFACT_COMMAND_PLAN))
  const predicate = {
    authorityBoundary: "producer-only-diagnostic",
    authorityEligible: false,
    command: {
      catalogId: STAGED_PACKAGE_ARTIFACT_COMMAND_CATALOG_ID,
      plan: FIXED_STAGED_PACKAGE_ARTIFACT_COMMAND_PLAN,
      planDigest: commandPlanDigest,
    },
    expectedTag: `v${version}`,
    expiresAt,
    issuedAt: issuedAt.toISOString(),
    nonce: `staged-package-artifact-${context.runId}-${context.runAttempt}-${tarball.sha256.slice("sha256:".length, "sha256:".length + 16)}`,
    package: {
      name: STAGED_PACKAGE_ARTIFACT_PACKAGE,
      version,
    },
    predicateType: STAGED_PACKAGE_ARTIFACT_PREDICATE_TYPE,
    registry: {
      gitHead: registry.gitHead,
      integrity: registry.integrity,
      origin: STAGED_PACKAGE_ARTIFACT_REGISTRY_ORIGIN,
      selectedTag: channel,
      shasum: registry.shasum,
    },
    run: {
      attempt: context.runAttempt,
      event: context.event,
      id: context.runId,
      repository: context.repository,
      repositoryId: context.repositoryId,
      runner: {
        environment: context.runnerEnvironment,
        label: context.runnerLabel,
        os: context.runnerOs,
      },
      workflow: {
        ref: context.workflowRef,
        sha: context.workflowSha,
      },
    },
    schemaVersion: STAGED_PACKAGE_ARTIFACT_SCHEMA,
    source: {
      canonicalMainHead: context.canonicalMainHead,
      cleanStatusDigest: context.cleanStatusDigest,
      head: context.sourceHead,
      identity: context.sourceIdentity,
    },
    subject: {
      digest: { sha256: tarball.sha256.slice("sha256:".length) },
      name: "package.tgz",
    },
    tagState: "deferred",
    tarball,
  }

  return { predicate, tarballBytes: Buffer.from(input.tarballBytes) }
}

function readChannel(value) {
  if (!STAGED_PACKAGE_ARTIFACT_CHANNELS.includes(value)) {
    throw new StagedPackageArtifactProducerError("staged-producer-channel-invalid")
  }
  return value
}

function readVersion(value) {
  if (!isStrictSemver(value)) throw new StagedPackageArtifactProducerError("staged-producer-version-invalid")
  return value
}

export function validateStagedPackageArtifactContext(value) {
  if (!isRecord(value)) throw new StagedPackageArtifactProducerError("staged-producer-context-invalid")
  const required = [
    ["repository", STAGED_PACKAGE_ARTIFACT_REPOSITORY],
    ["repositoryId", String(STAGED_PACKAGE_ARTIFACT_REPOSITORY_ID)],
    ["ref", "refs/heads/main"],
    ["event", "workflow_dispatch"],
    ["workflowRef", STAGED_PACKAGE_ARTIFACT_WORKFLOW_REF],
    ["runnerEnvironment", "github-hosted"],
    ["runnerLabel", "ubuntu-latest"],
    ["runnerOs", "Linux"],
  ]
  if (required.some(([key, expected]) => value[key] !== expected)) {
    throw new StagedPackageArtifactProducerError("staged-producer-context-policy")
  }
  if (
    !isSha(value.sourceHead)
    || value.contextHead !== value.sourceHead
    || value.canonicalMainHead !== value.sourceHead
    || !isSha(value.workflowSha)
    || !isDigest(value.cleanStatusDigest)
    || !isIdentifier(value.runId)
    || !isPositiveInteger(value.runAttempt)
    || !isRecord(value.sourceIdentity)
    || value.sourceIdentity.repositoryHead !== value.sourceHead
    || !isDigest(value.sourceIdentity.contentDigest)
  ) {
    throw new StagedPackageArtifactProducerError("staged-producer-context-binding")
  }
  return {
    canonicalMainHead: value.canonicalMainHead,
    cleanStatusDigest: value.cleanStatusDigest,
    event: value.event,
    repository: value.repository,
    repositoryId: Number(value.repositoryId),
    ref: value.ref,
    runAttempt: Number(value.runAttempt),
    runId: value.runId,
    runnerEnvironment: value.runnerEnvironment,
    runnerLabel: value.runnerLabel,
    runnerOs: value.runnerOs,
    sourceHead: value.sourceHead,
    sourceIdentity: value.sourceIdentity,
    workflowRef: value.workflowRef,
    workflowSha: value.workflowSha,
  }
}

function readFixedCommandPlan(value) {
  if (canonicalJson(value) !== canonicalJson(FIXED_STAGED_PACKAGE_ARTIFACT_COMMAND_PLAN)) {
    throw new StagedPackageArtifactProducerError("staged-producer-command-plan")
  }
}

function readRegistryIndex(value, channel, version) {
  if (!isRecord(value) || !isRecord(value["dist-tags"]) || value["dist-tags"][channel] !== version) {
    throw new StagedPackageArtifactProducerError("staged-producer-tag-mapping")
  }
}

function readRegistryVersion(value, version, sourceHead) {
  if (!isRecord(value) || value.name !== STAGED_PACKAGE_ARTIFACT_PACKAGE || value.version !== version || value.gitHead !== sourceHead || !isSha(value.gitHead)) {
    throw new StagedPackageArtifactProducerError("staged-producer-registry-binding")
  }
  if (!isRecord(value.dist) || typeof value.dist.tarball !== "string" || !isSha1(value.dist.shasum) || !isIntegrity(value.dist.integrity)) {
    throw new StagedPackageArtifactProducerError("staged-producer-registry-binding")
  }
  return {
    gitHead: value.gitHead,
    integrity: value.dist.integrity,
    shasum: value.dist.shasum,
    tarball: value.dist.tarball,
  }
}

function readIssuedAt(value) {
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) {
    throw new StagedPackageArtifactProducerError("staged-producer-time-invalid")
  }
  return value
}

function isStrictSemver(value) {
  return typeof value === "string" && value.length > 0 && value.length <= MAX_SEMVER_LENGTH && STRICT_SEMVER.test(value)
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isSha(value) {
  return typeof value === "string" && /^[0-9a-f]{40}$/u.test(value)
}

function isDigest(value) {
  return typeof value === "string" && SHA256.test(value)
}

function isSha1(value) {
  return typeof value === "string" && SHA1.test(value)
}

function isIntegrity(value) {
  return typeof value === "string" && SHA512_INTEGRITY.test(value)
}

function isIdentifier(value) {
  return typeof value === "string" && GITHUB_ID.test(value)
}

function isPositiveInteger(value) {
  return typeof value === "string" && GITHUB_ID.test(value) && Number.isSafeInteger(Number(value))
}

function canonicalJson(value) {
  return JSON.stringify(sortKeys(value))
}

function sortKeys(value) {
  if (Array.isArray(value)) return value.map(sortKeys)
  if (isRecord(value)) {
    return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => [key, sortKeys(item)]))
  }
  return value
}

function sha256(value) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`
}
