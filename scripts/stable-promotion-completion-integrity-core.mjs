const SHA1_PATTERN = /^[a-f0-9]{40}$/iu
const SHA256_PATTERN = /^[a-f0-9]{64}$/iu
const SHA256_DIGEST_PATTERN = /^sha256:[a-f0-9]{64}$/iu
const INTEGRITY_PATTERN = /^sha512-[A-Za-z0-9+/=]+$/u
const SEMVER_PATTERN =
  /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-(?:0|[1-9]\d*|[0-9A-Za-z-]*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|[0-9A-Za-z-]*[A-Za-z-][0-9A-Za-z-]*))*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/u
const SENSITIVE_VERSION_PATTERN =
  /(?:sk[-_]?live[-_]|api[-_]?key|apikey|bearer|password|passwd|jdbc|pem|private[-_]?key|secret|https?:\/\/|[A-Za-z0-9._%+-]+:[^/@\s]+@)/iu
const MAX_VERSION_LENGTH = 128

const MATRIX_KEYS = [
  "closureBlocked",
  "forgedEvidenceBlocked",
  "malformedConfigBlocked",
  "noSensitiveOutput",
  "sourceCheckoutIndependent",
  "symlinkEvidenceBlocked",
  "workflowFinishBlocked",
]

const MATRIX_DIAGNOSTICS = {
  closureBlocked: "completion-closure-authority",
  forgedEvidenceBlocked: "completion-forged-evidence",
  malformedConfigBlocked: "completion-malformed-config",
  noSensitiveOutput: "completion-sensitive-output",
  sourceCheckoutIndependent: "completion-source-checkout",
  symlinkEvidenceBlocked: "completion-symlink-evidence",
  workflowFinishBlocked: "completion-finish-authority",
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function safeSha(value, pattern) {
  return typeof value === "string" && pattern.test(value) ? value.toLowerCase() : undefined
}

function safeVersion(value) {
  return typeof value === "string"
    && value.length <= MAX_VERSION_LENGTH
    && !SENSITIVE_VERSION_PATTERN.test(value)
    && SEMVER_PATTERN.test(value)
    ? value
    : undefined
}

function safeTag(value) {
  return value === "latest" || value === "next" ? value : undefined
}

function safePackageName(value) {
  return value === "persona-harness" ? value : undefined
}

function safeTarball(value) {
  if (!isRecord(value)) {
    return undefined
  }
  const packageName = safePackageName(value.packageName)
  const version = safeVersion(value.version)
  const sha1 = safeSha(value.sha1, SHA1_PATTERN)
  const sha256 = safeSha(value.sha256, SHA256_PATTERN)
  const integrity = typeof value.integrity === "string" && INTEGRITY_PATTERN.test(value.integrity)
    ? value.integrity
    : undefined
  return packageName === undefined || version === undefined || sha1 === undefined || sha256 === undefined || integrity === undefined
    ? undefined
    : { integrity, packageName, sha1, sha256, version }
}

function safeRegistry(value) {
  if (
    !isRecord(value)
    || value.schemaVersion !== "stable-promotion-registry-facts.1"
    || !isRecord(value.distTags)
  ) {
    return undefined
  }
  const packageName = safePackageName(value.packageName)
  const version = safeVersion(value.version)
  const gitHead = safeSha(value.gitHead, SHA1_PATTERN)
  const shasum = safeSha(value.shasum, SHA1_PATTERN)
  const integrity = typeof value.integrity === "string" && INTEGRITY_PATTERN.test(value.integrity)
    ? value.integrity
    : undefined
  const distTags = Object.fromEntries(
    Object.entries(value.distTags).flatMap(([tag, versionValue]) => {
      const safeTagValue = safeTag(tag)
      const safeVersionValue = safeVersion(versionValue)
      return safeTagValue === undefined || safeVersionValue === undefined ? [] : [[safeTagValue, safeVersionValue]]
    }),
  )
  return packageName === undefined || version === undefined || gitHead === undefined || shasum === undefined || integrity === undefined
    ? undefined
    : { distTags, gitHead, integrity, packageName, shasum, version }
}

function safeApproval(value) {
  if (!isRecord(value)) {
    return undefined
  }
  const decisionDigest = typeof value.decisionDigest === "string" && SHA256_DIGEST_PATTERN.test(value.decisionDigest)
    ? value.decisionDigest.toLowerCase()
    : undefined
  const packageVersion = safeVersion(value.packageVersion)
  const sourceHead = safeSha(value.sourceHead, SHA1_PATTERN)
  return value.schemaVersion === "stable-promotion-approval.1"
    && value.provider === "github-protected"
    && value.status === "approved"
    && decisionDigest !== undefined
    && packageVersion !== undefined
    && sourceHead !== undefined
    ? { decisionDigest, packageVersion, sourceHead }
    : undefined
}

function safeMatrix(value) {
  if (!isRecord(value)) {
    return undefined
  }
  const matrix = {}
  for (const key of MATRIX_KEYS) {
    if (typeof value[key] !== "boolean") {
      return undefined
    }
    matrix[key] = value[key]
  }
  return matrix
}

function diagnosticList(input) {
  const diagnostics = new Set()
  const sourceHead = safeSha(input.sourceHead, SHA1_PATTERN)
  const tarball = safeTarball(input.tarball)
  const registry = safeRegistry(input.registry)
  const approval = safeApproval(input.approval)
  const completionMatrix = safeMatrix(input.completionMatrix)
  const candidateTag = safeTag(input.candidateTag)

  if (sourceHead === undefined) diagnostics.add("source-head-invalid")
  if (tarball === undefined) diagnostics.add("tarball-provenance-invalid")
  if (registry === undefined) diagnostics.add("registry-facts-invalid")
  if (approval === undefined) diagnostics.add("approval-not-protected")
  if (completionMatrix === undefined) diagnostics.add("completion-matrix-invalid")
  if (candidateTag === undefined) diagnostics.add("registry-tag-invalid")

  if (sourceHead !== undefined && registry !== undefined && sourceHead !== registry.gitHead) {
    diagnostics.add("registry-git-head-mismatch")
  }
  if (sourceHead !== undefined && approval !== undefined && sourceHead !== approval.sourceHead) {
    diagnostics.add("approval-source-head-mismatch")
  }
  if (tarball !== undefined && registry !== undefined) {
    if (tarball.packageName !== registry.packageName || tarball.version !== registry.version) {
      diagnostics.add("registry-package-mismatch")
    }
    if (tarball.sha1 !== registry.shasum) {
      diagnostics.add("registry-shasum-mismatch")
    }
    if (tarball.integrity !== registry.integrity) {
      diagnostics.add("registry-integrity-mismatch")
    }
  }
  if (tarball !== undefined && approval !== undefined && tarball.version !== approval.packageVersion) {
    diagnostics.add("approval-package-version-mismatch")
  }
  if (tarball !== undefined && registry !== undefined && candidateTag !== undefined) {
    if (registry.distTags[candidateTag] !== tarball.version) {
      diagnostics.add("registry-dist-tag-mismatch")
    }
  }
  if (completionMatrix !== undefined) {
    for (const key of MATRIX_KEYS) {
      if (!completionMatrix[key]) {
        diagnostics.add(MATRIX_DIAGNOSTICS[key])
      }
    }
  }

  return {
    approval,
    candidateTag,
    completionMatrix,
    diagnostics: Array.from(diagnostics).sort(),
    registry,
    sourceHead,
    tarball,
  }
}

export function assessStablePromotionCompletionIntegrity(input) {
  const source = isRecord(input) ? input : {}
  const evaluated = diagnosticList(source)
  const status = evaluated.diagnostics.length === 0 ? "pass" : "blocked"
  return {
    approval: {
      decisionDigest: evaluated.approval?.decisionDigest ?? "unavailable",
      status: evaluated.approval === undefined ? "unavailable" : "recorded",
    },
    candidateTag: evaluated.candidateTag ?? "unavailable",
    completionMatrix: Object.fromEntries(
      MATRIX_KEYS.map((key) => [key, evaluated.completionMatrix?.[key] === true ? "blocked" : "unavailable"]),
    ),
    diagnostics: evaluated.diagnostics,
    durableEvidence: "required-before-closure",
    mode: "read-only",
    provenance: {
      registry: {
        gitHead: evaluated.registry?.gitHead ?? "unavailable",
        integrity: evaluated.registry?.integrity ?? "unavailable",
        version: evaluated.registry?.version ?? "unavailable",
      },
      sourceHead: evaluated.sourceHead ?? "unavailable",
      tarball: {
        integrity: evaluated.tarball?.integrity ?? "unavailable",
        sha1: evaluated.tarball?.sha1 ?? "unavailable",
        sha256: evaluated.tarball?.sha256 ?? "unavailable",
        version: evaluated.tarball?.version ?? "unavailable",
      },
    },
    schemaVersion: "stable-promotion-completion-integrity.1",
    stableMovement: "not-authorized",
    status,
  }
}
