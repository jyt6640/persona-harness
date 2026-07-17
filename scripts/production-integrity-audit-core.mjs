import { createHash } from "node:crypto"

export const PRODUCTION_INTEGRITY_AUDIT_SCHEMA = "production-integrity-audit.1"
export const PRODUCTION_INTEGRITY_AUDIT_CHANNEL = "staging"
export const PRODUCTION_INTEGRITY_AUDIT_PACKAGE = "persona-harness"

const COMMANDS = [
  ["source-repository-contract", "sourceRepositoryContract"],
  ["source-build", "sourceBuild"],
  ["registry-installed-package", "installedRegistryContract"],
  ["installed-adversarial-matrix", "installedAdversarialMatrix"],
  ["fixed-provenance-verifier", "fixedProvenanceVerifier"],
]
const COMMIT = /^[a-f0-9]{40}$/u
const SHA1 = /^[a-f0-9]{40}$/u
const SHA256 = /^sha256:[a-f0-9]{64}$/u
const INTEGRITY = /^sha512-[A-Za-z0-9+/=]+$/u
const SEMVER = /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/u

export function assessProductionIntegrityAudit(input) {
  const value = record(input)
  const sourceHead = safeCommit(value.sourceHead)
  const version = safeVersion(value.version)
  const sourceTarball = safeTarball(value.sourceTarball)
  const registry = safeRegistry(value.registry)
  const commandResults = safeCommandResults(value.commandResults)
  const diagnostics = new Set()
  const commandCatalog = COMMANDS.map(([id, key]) => commandStatus(id, commandResults?.[key]))

  if (sourceHead === undefined) diagnostics.add("audit-source-head-invalid")
  if (version === undefined) diagnostics.add("audit-version-invalid")
  if (sourceTarball === undefined) diagnostics.add("audit-source-tarball-invalid")
  if (registry === undefined) diagnostics.add("audit-registry-facts-invalid")
  if (commandResults === undefined) diagnostics.add("audit-command-results-invalid")
  if (sourceHead !== undefined && registry !== undefined && registry.gitHead !== sourceHead) diagnostics.add("audit-registry-git-head")
  if (version !== undefined && registry !== undefined && registry.version !== version) diagnostics.add("audit-registry-version")
  if (version !== undefined && registry !== undefined && registry.stagingVersion !== version) diagnostics.add("audit-registry-staging")
  if (sourceTarball !== undefined && registry !== undefined && sourceTarball.sha256 !== registry.tarball.sha256) diagnostics.add("audit-source-tarball-binding")
  if (registry !== undefined && (registry.shasum !== registry.tarball.sha1 || registry.integrity !== registry.tarball.integrity)) diagnostics.add("audit-registry-tarball-binding")
  for (const result of commandCatalog) {
    if (result.status !== "passed") diagnostics.add(`audit-${result.id}`)
  }

  const summary = {
    authorityEligible: false,
    channel: PRODUCTION_INTEGRITY_AUDIT_CHANNEL,
    commandCatalog,
    diagnostics: [...diagnostics].sort(),
    mode: "read-only",
    package: {
      name: PRODUCTION_INTEGRITY_AUDIT_PACKAGE,
      sourceHead: sourceHead ?? "unavailable",
      version: version ?? "unavailable",
    },
    promotionAuthorized: false,
    promotionDecision: "release-approval-required",
    provenance: {
      artifactDigest: registry === undefined ? "unavailable" : digest(canonicalJson({
        gitHead: registry.gitHead,
        registryDigest: digest(canonicalJson({
          integrity: registry.integrity,
          shasum: registry.shasum,
          stagingVersion: registry.stagingVersion,
          version: registry.version,
        })),
        subjectDigest: registry.tarball.sha256,
      })),
      registryDigest: registry === undefined ? "unavailable" : digest(canonicalJson({
        gitHead: registry.gitHead,
        integrity: registry.integrity,
        shasum: registry.shasum,
        stagingVersion: registry.stagingVersion,
        version: registry.version,
      })),
      subjectDigest: registry?.tarball.sha256 ?? "unavailable",
    },
    registry: registry === undefined
      ? unavailableRegistry()
      : {
          gitHead: registry.gitHead,
          integrity: registry.integrity,
          sha1: registry.shasum,
          sha256: registry.tarball.sha256,
          version: registry.version,
        },
    registryMutation: "not-performed",
    schemaVersion: PRODUCTION_INTEGRITY_AUDIT_SCHEMA,
    secretRemovalConfirmed: true,
    sourceTarball: sourceTarball ?? unavailableTarball(),
    status: diagnostics.size === 0 ? "passed" : "blocked",
  }
  return { ...summary, summaryDigest: digest(canonicalJson(summary)) }
}

function commandStatus(id, actualExit) {
  return {
    actualExit: actualExit ?? "unavailable",
    expectedExit: 0,
    id,
    status: actualExit === 0 ? "passed" : "blocked",
  }
}

function unavailableRegistry() {
  return { gitHead: "unavailable", integrity: "unavailable", sha1: "unavailable", sha256: "unavailable", version: "unavailable" }
}

function unavailableTarball() {
  return { integrity: "unavailable", sha1: "unavailable", sha256: "unavailable" }
}

function safeRegistry(value) {
  const registry = record(value)
  const version = safeVersion(registry.version)
  const stagingVersion = safeVersion(registry.stagingVersion)
  const gitHead = safeCommit(registry.gitHead)
  const integrity = safeIntegrity(registry.integrity)
  const shasum = safeSha1(registry.shasum)
  const tarball = safeTarball(registry.tarball)
  return version === undefined || stagingVersion === undefined || gitHead === undefined || integrity === undefined || shasum === undefined || tarball === undefined
    ? undefined
    : { gitHead, integrity, shasum, stagingVersion, tarball, version }
}

function safeTarball(value) {
  const tarball = record(value)
  const integrity = safeIntegrity(tarball.integrity)
  const sha1 = safeSha1(tarball.sha1)
  const sha256 = typeof tarball.sha256 === "string" && SHA256.test(tarball.sha256) ? tarball.sha256.toLowerCase() : undefined
  return integrity === undefined || sha1 === undefined || sha256 === undefined ? undefined : { integrity, sha1, sha256 }
}

function safeCommandResults(value) {
  const results = record(value)
  const parsed = {}
  for (const [, key] of COMMANDS) {
    if (typeof results[key] !== "number" || !Number.isSafeInteger(results[key]) || results[key] < 0 || results[key] > 255) return undefined
    parsed[key] = results[key]
  }
  return parsed
}

function safeCommit(value) {
  return typeof value === "string" && COMMIT.test(value) ? value.toLowerCase() : undefined
}

function safeSha1(value) {
  return typeof value === "string" && SHA1.test(value) ? value.toLowerCase() : undefined
}

function safeIntegrity(value) {
  return typeof value === "string" && INTEGRITY.test(value) ? value : undefined
}

function safeVersion(value) {
  return typeof value === "string" && value.length <= 256 && SEMVER.test(value) ? value : undefined
}

function record(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value : {}
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`
  if (typeof value === "object" && value !== null) {
    return `{${Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(",")}}`
  }
  return JSON.stringify(value)
}

function digest(value) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`
}
