import { createHash } from "node:crypto"

export const STAGED_PACKAGE_ARTIFACT_PROVENANCE_SCHEMA = "staged-package-artifact-verification.1"
export const STAGED_PACKAGE_ARTIFACT_SCHEMA = "staged-package-artifact-binding.1"
export const STAGED_PACKAGE_ARTIFACT_PREDICATE_TYPE = "https://github.com/jyt6640/persona-harness/attestations/staged-package-artifact-binding.1"
export const STAGED_PACKAGE_ARTIFACT_REPOSITORY = "jyt6640/persona-harness"
export const STAGED_PACKAGE_ARTIFACT_REPOSITORY_ID = 1272008570
export const STAGED_PACKAGE_ARTIFACT_PACKAGE = "persona-harness"
export const STAGED_PACKAGE_ARTIFACT_REGISTRY_ORIGIN = "https://registry.npmjs.org"
export const STAGED_PACKAGE_ARTIFACT_WORKFLOW_PATH = ".github/workflows/staged-package-artifact-attestation.yml"
export const STAGED_PACKAGE_ARTIFACT_WORKFLOW_REF = `${STAGED_PACKAGE_ARTIFACT_REPOSITORY}/${STAGED_PACKAGE_ARTIFACT_WORKFLOW_PATH}@refs/heads/main`
export const STAGED_PACKAGE_ARTIFACT_WORKFLOW_ID = 314877981
export const STAGED_PACKAGE_ARTIFACT_CHANNELS = ["staging", "next"]

const EMPTY_SHA256 = "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
const MAX_SEMVER_LENGTH = 256
const STRICT_SEMVER = /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-(?:0|[1-9]\d*|[0-9A-Za-z-]*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|[0-9A-Za-z-]*[A-Za-z-][0-9A-Za-z-]*))*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/u
const SHA256 = /^sha256:[a-f0-9]{64}$/u
const SHA1 = /^[a-f0-9]{40}$/u
const COMMIT = /^[a-f0-9]{40}$/u
const INTEGRITY = /^sha512-[A-Za-z0-9+/=]+$/u
const IDENTIFIER = /^[1-9]\d{0,19}$/u
const SENSITIVE_VERSION = /(?:api[_-]?key|bearer|password|jdbc:|-----begin|sk-(?:live|test|proj)-|:\/\/[^/\s]+:[^/\s]+@)/iu

const FIXED_COMMAND_PLAN = [
  { id: "registry-index", method: "https-get", target: `${STAGED_PACKAGE_ARTIFACT_REGISTRY_ORIGIN}/${STAGED_PACKAGE_ARTIFACT_PACKAGE}` },
  { id: "registry-version", method: "https-get", target: `${STAGED_PACKAGE_ARTIFACT_REGISTRY_ORIGIN}/${STAGED_PACKAGE_ARTIFACT_PACKAGE}/<version>` },
  { id: "registry-tarball", method: "https-get", target: `${STAGED_PACKAGE_ARTIFACT_REGISTRY_ORIGIN}/${STAGED_PACKAGE_ARTIFACT_PACKAGE}/-/${STAGED_PACKAGE_ARTIFACT_PACKAGE}-<version>.tgz` },
]

export class StagedPackageArtifactProvenanceError extends Error {
  constructor(code) {
    super(code)
    this.code = code
    this.name = "StagedPackageArtifactProvenanceError"
  }
}

export function readStagedPackageArtifactSelection(channel, version) {
  if (!STAGED_PACKAGE_ARTIFACT_CHANNELS.includes(channel)) fail("artifact-provenance-channel-invalid")
  if (typeof version !== "string" || version.length === 0 || version.length > MAX_SEMVER_LENGTH || !STRICT_SEMVER.test(version) || SENSITIVE_VERSION.test(version)) {
    fail("artifact-provenance-version-invalid")
  }
  return { channel, version }
}

export function stagedPackageArtifactTarballUrl(version) {
  return `${STAGED_PACKAGE_ARTIFACT_REGISTRY_ORIGIN}/${STAGED_PACKAGE_ARTIFACT_PACKAGE}/-/${STAGED_PACKAGE_ARTIFACT_PACKAGE}-${version}.tgz`
}

export function readRegistryBindings(selection, registryIndex, registryVersion, tarball) {
  const index = record(registryIndex, "artifact-provenance-registry-invalid")
  const tags = record(index["dist-tags"], "artifact-provenance-registry-invalid")
  requirePolicy(tags[selection.channel] === selection.version, "artifact-provenance-tag-mismatch")

  const version = record(registryVersion, "artifact-provenance-registry-invalid")
  const dist = record(version.dist, "artifact-provenance-registry-invalid")
  requirePolicy(
    version.name === STAGED_PACKAGE_ARTIFACT_PACKAGE
      && version.version === selection.version
      && typeof version.gitHead === "string"
      && COMMIT.test(version.gitHead)
      && dist.tarball === stagedPackageArtifactTarballUrl(selection.version)
      && typeof dist.shasum === "string"
      && SHA1.test(dist.shasum)
      && typeof dist.integrity === "string"
      && INTEGRITY.test(dist.integrity),
    "artifact-provenance-registry-binding",
  )
  requirePolicy(tarball.packageName === STAGED_PACKAGE_ARTIFACT_PACKAGE && tarball.version === selection.version, "artifact-provenance-tarball-binding")
  requirePolicy(tarball.sha1 === dist.shasum && tarball.integrity === dist.integrity, "artifact-provenance-tarball-binding")
  return {
    gitHead: version.gitHead,
    integrity: dist.integrity,
    shasum: dist.shasum,
    tarballSha256: tarball.sha256,
  }
}

export function verifyStagedPackageArtifactStatement(input) {
  const statement = record(input.statement, "artifact-provenance-statement-invalid")
  const predicate = exactRecord(
    statement.predicate,
    ["authorityBoundary", "authorityEligible", "command", "expectedTag", "expiresAt", "issuedAt", "nonce", "package", "predicateType", "registry", "run", "schemaVersion", "source", "subject", "tagState", "tarball"],
    "artifact-provenance-statement-invalid",
  )
  requirePolicy(
    statement._type === "https://in-toto.io/Statement/v1"
      && statement.predicateType === STAGED_PACKAGE_ARTIFACT_PREDICATE_TYPE
      && predicate.predicateType === STAGED_PACKAGE_ARTIFACT_PREDICATE_TYPE
      && predicate.schemaVersion === STAGED_PACKAGE_ARTIFACT_SCHEMA
      && predicate.authorityBoundary === "producer-only-diagnostic"
      && predicate.authorityEligible === false
      && predicate.tagState === "deferred"
      && predicate.expectedTag === `v${input.selection.version}`,
    "artifact-provenance-statement-policy",
  )
  requireStatementSubject(statement.subject, input.tarball.sha256)
  requirePredicateSubject(predicate.subject, input.tarball.sha256)
  requirePackage(predicate.package, input.selection.version)
  requireRegistry(predicate.registry, input.selection, input.registry, input.tarball)
  requireTarball(predicate.tarball, input.tarball)
  const sourceHead = requireSource(predicate.source, input.registry.gitHead)
  requireCommand(predicate.command)
  requireRun(predicate.run, sourceHead, input.actionRun)
  requireLifecycle(predicate.issuedAt, predicate.expiresAt, input.now)
  requirePolicy(
    predicate.nonce === `staged-package-artifact-${predicate.run.id}-${predicate.run.attempt}-${input.tarball.sha256.slice("sha256:".length, "sha256:".length + 16)}`,
    "artifact-provenance-replay",
  )
  requirePolicy(input.attestationRepositoryId === STAGED_PACKAGE_ARTIFACT_REPOSITORY_ID, "artifact-provenance-repository")
  return { sourceHead, subjectDigest: input.tarball.sha256 }
}

function requireStatementSubject(value, digest) {
  requirePolicy(
    Array.isArray(value)
      && value.length === 1
      && record(value[0], "artifact-provenance-statement-invalid").name === "package.tgz"
      && record(record(value[0], "artifact-provenance-statement-invalid").digest, "artifact-provenance-statement-invalid").sha256 === digest.slice("sha256:".length),
    "artifact-provenance-subject-binding",
  )
}

function requirePredicateSubject(value, digest) {
  const subject = exactRecord(value, ["digest", "name"], "artifact-provenance-statement-invalid")
  requirePolicy(
    subject.name === "package.tgz"
      && exactRecord(subject.digest, ["sha256"], "artifact-provenance-statement-invalid").sha256 === digest.slice("sha256:".length),
    "artifact-provenance-subject-binding",
  )
}

function requirePackage(value, version) {
  const packageFacts = exactRecord(value, ["name", "version"], "artifact-provenance-statement-invalid")
  requirePolicy(packageFacts.name === STAGED_PACKAGE_ARTIFACT_PACKAGE && packageFacts.version === version, "artifact-provenance-package-binding")
}

function requireRegistry(value, selection, registry, tarball) {
  const facts = exactRecord(value, ["gitHead", "integrity", "origin", "selectedTag", "shasum"], "artifact-provenance-statement-invalid")
  requirePolicy(
    facts.origin === STAGED_PACKAGE_ARTIFACT_REGISTRY_ORIGIN
      && facts.selectedTag === selection.channel
      && facts.gitHead === registry.gitHead
      && facts.shasum === registry.shasum
      && facts.integrity === registry.integrity,
    "artifact-provenance-registry-binding",
  )
  requirePolicy(tarball.sha1 === facts.shasum && tarball.integrity === facts.integrity && tarball.sha256 === registry.tarballSha256, "artifact-provenance-tarball-binding")
}

function requireTarball(value, tarball) {
  const facts = exactRecord(value, ["integrity", "packageName", "sha1", "sha256", "size", "version"], "artifact-provenance-statement-invalid")
  requirePolicy(
    facts.integrity === tarball.integrity
      && facts.packageName === tarball.packageName
      && facts.sha1 === tarball.sha1
      && facts.sha256 === tarball.sha256
      && facts.size === tarball.size
      && facts.version === tarball.version,
    "artifact-provenance-tarball-binding",
  )
}

function requireSource(value, gitHead) {
  const source = exactRecord(value, ["canonicalMainHead", "cleanStatusDigest", "head", "identity"], "artifact-provenance-statement-invalid")
  const identity = exactRecord(source.identity, ["contentDigest", "entryCount", "exclusions", "gitStatusDigest", "repositoryHead", "schemaVersion", "trackedEntryCount", "trackedIndexDigest", "untrackedEntryCount"], "artifact-provenance-statement-invalid")
  requirePolicy(
    source.head === gitHead
      && source.canonicalMainHead === gitHead
      && source.cleanStatusDigest === EMPTY_SHA256
      && identity.schemaVersion === "source-identity.1"
      && identity.repositoryHead === gitHead
      && isDigest(identity.contentDigest)
      && isDigest(identity.gitStatusDigest)
      && isDigest(identity.trackedIndexDigest)
      && isCount(identity.entryCount)
      && isCount(identity.trackedEntryCount)
      && isCount(identity.untrackedEntryCount)
      && canonicalJson(identity.exclusions) === canonicalJson([".git/**", ".gradle/**", "build/**", "node_modules/**", "<configured-evidence>/**"]),
    "artifact-provenance-source-binding",
  )
  return source.head
}

function requireCommand(value) {
  const command = exactRecord(value, ["catalogId", "plan", "planDigest"], "artifact-provenance-statement-invalid")
  requirePolicy(
    command.catalogId === "persona-harness-staged-package-artifact-producer.1"
      && canonicalJson(command.plan) === canonicalJson(FIXED_COMMAND_PLAN)
      && command.planDigest === sha256(canonicalJson(FIXED_COMMAND_PLAN)),
    "artifact-provenance-command-binding",
  )
}

function requireRun(value, sourceHead, actionRun) {
  const run = exactRecord(value, ["attempt", "event", "id", "repository", "repositoryId", "runner", "workflow"], "artifact-provenance-statement-invalid")
  const runner = exactRecord(run.runner, ["environment", "label", "os"], "artifact-provenance-statement-invalid")
  const workflow = exactRecord(run.workflow, ["ref", "sha"], "artifact-provenance-statement-invalid")
  requirePolicy(
    typeof run.id === "string"
      && IDENTIFIER.test(run.id)
      && run.attempt === 1
      && run.event === "workflow_dispatch"
      && run.repository === STAGED_PACKAGE_ARTIFACT_REPOSITORY
      && run.repositoryId === STAGED_PACKAGE_ARTIFACT_REPOSITORY_ID
      && runner.environment === "github-hosted"
      && runner.label === "ubuntu-latest"
      && runner.os === "Linux"
      && workflow.ref === STAGED_PACKAGE_ARTIFACT_WORKFLOW_REF
      && workflow.sha === sourceHead,
    "artifact-provenance-run-binding",
  )
  const observed = record(actionRun, "artifact-provenance-run-invalid")
  const repository = record(observed.repository, "artifact-provenance-run-invalid")
  requirePolicy(
    String(observed.id) === run.id
      && observed.run_attempt === run.attempt
      && observed.event === run.event
      && observed.head_branch === "main"
      && observed.head_sha === sourceHead
      && observed.path === STAGED_PACKAGE_ARTIFACT_WORKFLOW_PATH
      && observed.workflow_id === STAGED_PACKAGE_ARTIFACT_WORKFLOW_ID
      && observed.status === "completed"
      && observed.conclusion === "success"
      && repository.full_name === STAGED_PACKAGE_ARTIFACT_REPOSITORY
      && repository.id === STAGED_PACKAGE_ARTIFACT_REPOSITORY_ID,
    "artifact-provenance-run-binding",
  )
}

function requireLifecycle(issuedAt, expiresAt, now) {
  const issued = typeof issuedAt === "string" ? Date.parse(issuedAt) : Number.NaN
  const expires = typeof expiresAt === "string" ? Date.parse(expiresAt) : Number.NaN
  requirePolicy(Number.isFinite(issued) && Number.isFinite(expires) && expires > issued && expires - issued <= 2 * 60 * 60 * 1000, "artifact-provenance-lifecycle-invalid")
  requirePolicy(now instanceof Date && Number.isFinite(now.getTime()) && now.getTime() >= issued && now.getTime() < expires, "artifact-provenance-expired")
}

function exactRecord(value, keys, code) {
  const result = record(value, code)
  requirePolicy(Object.keys(result).length === keys.length && Object.keys(result).every((key) => keys.includes(key)), code)
  return result
}

function record(value, code) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) fail(code)
  return value
}

function isDigest(value) {
  return typeof value === "string" && SHA256.test(value)
}

function isCount(value) {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`
  if (typeof value === "object" && value !== null) {
    return `{${Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(",")}}`
  }
  return JSON.stringify(value)
}

function sha256(value) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`
}

function requirePolicy(condition, code) {
  if (!condition) fail(code)
}

function fail(code) {
  throw new StagedPackageArtifactProvenanceError(code)
}
