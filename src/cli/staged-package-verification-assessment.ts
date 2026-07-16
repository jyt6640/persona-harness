import {
  INSTALLED_CHECKS,
  type InstalledCheck,
  type JsonRecord,
  type StagedPackageVerificationAssessment,
  type VerifiedInstalled,
  type VerifiedPlan,
  type VerifiedPreflight,
  type VerifiedProvenance,
  type VerifiedRegistry,
  type VerifiedTarball,
} from "./staged-package-verification-types.js"

const SHA1_PATTERN = /^[a-f0-9]{40}$/iu
const SHA256_PATTERN = /^sha256:[a-f0-9]{64}$/iu
const INTEGRITY_PATTERN = /^sha512-[A-Za-z0-9+/=]+$/u
const SEMVER_PATTERN =
  /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-(?:0|[1-9]\d*|[0-9A-Za-z-]*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|[0-9A-Za-z-]*[A-Za-z-][0-9A-Za-z-]*))*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/u
const SENSITIVE_PATTERN =
  /(?:sk[-_]?live[-_]|api[-_]?key|apikey|bearer|password|passwd|jdbc|pem|private[-_]?key|secret|https?:\/\/|[A-Za-z0-9._%+-]+:[^/@\s]+@)/iu
const MAX_VERSION_LENGTH = 128

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function safeSha(value: unknown): string | undefined {
  return typeof value === "string" && SHA1_PATTERN.test(value) ? value.toLowerCase() : undefined
}

function safeDigest(value: unknown): string | undefined {
  return typeof value === "string" && SHA256_PATTERN.test(value) ? value.toLowerCase() : undefined
}

function safeIntegrity(value: unknown): string | undefined {
  return typeof value === "string" && INTEGRITY_PATTERN.test(value) ? value : undefined
}

function safeVersion(value: unknown): string | undefined {
  return typeof value === "string"
    && value.length <= MAX_VERSION_LENGTH
    && !SENSITIVE_PATTERN.test(value)
    && SEMVER_PATTERN.test(value)
    ? value
    : undefined
}

function safePackageName(value: unknown): "persona-harness" | undefined {
  return value === "persona-harness" ? value : undefined
}

function safeSourceTag(value: unknown): string | undefined {
  return typeof value === "string"
    && value.length <= MAX_VERSION_LENGTH + 1
    && !SENSITIVE_PATTERN.test(value)
    && /^v(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:[-+][0-9A-Za-z.-]+)?$/u.test(value)
    ? value
    : undefined
}

function safePlan(value: unknown): VerifiedPlan | undefined {
  if (!isRecord(value) || value["schemaVersion"] !== "staged-package-plan.1") return undefined
  const canonicalMainHead = safeSha(value["canonicalMainHead"])
  const packageName = safePackageName(value["packageName"])
  const packageVersion = safeVersion(value["packageVersion"])
  const sourceHead = safeSha(value["sourceHead"])
  const sourceTag = safeSourceTag(value["sourceTag"])
  const stagedTag = value["stagedTag"] === "latest" || value["stagedTag"] === "next" ? value["stagedTag"] : undefined
  if (
    canonicalMainHead === undefined
    || packageName === undefined
    || packageVersion === undefined
    || value["promotionTarget"] !== "latest"
    || sourceHead === undefined
    || sourceTag === undefined
    || stagedTag === undefined
  ) {
    return undefined
  }
  return { canonicalMainHead, packageName, packageVersion, promotionTarget: "latest", sourceHead, sourceTag, stagedTag }
}

function safePreflight(value: unknown): VerifiedPreflight | undefined {
  if (!isRecord(value) || value["schemaVersion"] !== "staged-package-preflight.1") return undefined
  const exactVersion = value["exactVersion"] === "absent" || value["exactVersion"] === "present"
    ? value["exactVersion"]
    : undefined
  const outputDigest = safeDigest(value["outputDigest"])
  const packageName = safePackageName(value["packageName"])
  const version = safeVersion(value["version"])
  return exactVersion === undefined || outputDigest === undefined || packageName === undefined || version === undefined
    ? undefined
    : { exactVersion, outputDigest, packageName, version }
}

function safeRegistry(value: unknown): VerifiedRegistry | undefined {
  if (!isRecord(value) || value["schemaVersion"] !== "staged-package-registry-facts.1" || !isRecord(value["distTags"])) {
    return undefined
  }
  const packageName = safePackageName(value["packageName"])
  const version = safeVersion(value["version"])
  const gitHead = safeSha(value["gitHead"])
  const shasum = safeSha(value["shasum"])
  const integrity = safeIntegrity(value["integrity"])
  const latest = safeVersion(value["distTags"]["latest"])
  const next = safeVersion(value["distTags"]["next"])
  return packageName === undefined
    || version === undefined
    || gitHead === undefined
    || shasum === undefined
    || integrity === undefined
    || latest === undefined
    || next === undefined
    ? undefined
    : { distTags: { latest, next }, gitHead, integrity, packageName, shasum, version }
}

function safeTarball(value: unknown): VerifiedTarball | undefined {
  if (!isRecord(value)) return undefined
  const packageName = safePackageName(value["packageName"])
  const version = safeVersion(value["version"])
  const sha1 = safeSha(value["sha1"])
  const sha256 = typeof value["sha256"] === "string" ? safeDigest(`sha256:${value["sha256"]}`) : undefined
  const integrity = safeIntegrity(value["integrity"])
  return packageName === undefined || version === undefined || sha1 === undefined || sha256 === undefined || integrity === undefined
    ? undefined
    : { integrity, packageName, sha1, sha256: sha256.slice("sha256:".length), version }
}

function safeProvenance(value: unknown): VerifiedProvenance | undefined {
  if (!isRecord(value)) return undefined
  const outputDigest = safeDigest(value["outputDigest"])
  const status = value["status"] === "unverified" || value["status"] === "verified" ? value["status"] : undefined
  return value["method"] !== "npm-audit-signatures" || outputDigest === undefined || status === undefined
    ? undefined
    : { method: "npm-audit-signatures", outputDigest, status }
}

function safeInstalled(value: unknown): VerifiedInstalled | undefined {
  if (!isRecord(value)) return undefined
  const authorityBlocked = value["authorityBlocked"]
  const cliHelp = value["cliHelp"]
  const closureAuthorityParity = value["closureAuthorityParity"]
  const exactVersion = value["exactVersion"]
  const npmTest = value["npmTest"]
  const sourceCheckoutIndependent = value["sourceCheckoutIndependent"]
  const version = value["version"]
  const workflowHelp = value["workflowHelp"]
  return typeof authorityBlocked !== "boolean"
    || typeof cliHelp !== "boolean"
    || typeof closureAuthorityParity !== "boolean"
    || typeof exactVersion !== "boolean"
    || typeof npmTest !== "boolean"
    || typeof sourceCheckoutIndependent !== "boolean"
    || typeof version !== "boolean"
    || typeof workflowHelp !== "boolean"
    ? undefined
    : {
        authorityBlocked,
        cliHelp,
        closureAuthorityParity,
        exactVersion,
        npmTest,
        sourceCheckoutIndependent,
        version,
        workflowHelp,
      }
}

function installedDiagnosticName(check: InstalledCheck): string {
  switch (check) {
    case "authorityBlocked":
      return "authority-boundary"
    case "cliHelp":
      return "cli-help"
    case "closureAuthorityParity":
      return "closure-authority-parity"
    case "exactVersion":
      return "exact-version"
    case "npmTest":
      return "npm-test"
    case "sourceCheckoutIndependent":
      return "source-checkout"
    case "version":
      return "version"
    case "workflowHelp":
      return "workflow-help"
  }
}

export function assessStagedPackageVerificationInput(input: unknown): StagedPackageVerificationAssessment {
  const source = isRecord(input) ? input : {}
  const plan = safePlan(source["plan"])
  const preflight = safePreflight(source["preflight"])
  const registry = safeRegistry(source["registry"])
  const tarball = safeTarball(source["tarball"])
  const provenance = safeProvenance(source["provenance"])
  const installed = safeInstalled(source["installed"])
  const diagnostics = new Set<string>()

  if (plan === undefined) diagnostics.add("staged-plan-invalid")
  if (preflight === undefined) diagnostics.add("existing-version-preflight-invalid")
  if (registry === undefined) diagnostics.add("registry-facts-invalid")
  if (tarball === undefined) diagnostics.add("tarball-provenance-invalid")
  if (provenance === undefined || provenance.status !== "verified") diagnostics.add("provenance-unverified")
  if (installed === undefined) diagnostics.add("installed-black-box-invalid")

  if (plan !== undefined) {
    if (plan.sourceHead !== plan.canonicalMainHead) diagnostics.add("source-main-mismatch")
    if (plan.sourceTag !== `v${plan.packageVersion}`) diagnostics.add("source-tag-version-mismatch")
    if (plan.stagedTag !== "next") diagnostics.add("staged-tag-invalid")
  }
  if (plan !== undefined && preflight !== undefined) {
    if (preflight.packageName !== plan.packageName || preflight.version !== plan.packageVersion) {
      diagnostics.add("existing-version-preflight-mismatch")
    }
    if (preflight.exactVersion === "present") diagnostics.add("existing-version-present")
  }
  if (plan !== undefined && registry !== undefined) {
    if (registry.packageName !== plan.packageName || registry.version !== plan.packageVersion) {
      diagnostics.add("registry-package-mismatch")
    }
    if (registry.gitHead !== plan.sourceHead) diagnostics.add("registry-git-head-mismatch")
    if (registry.distTags.next !== plan.packageVersion) diagnostics.add("staged-dist-tag-mismatch")
  }
  if (tarball !== undefined && registry !== undefined) {
    if (tarball.packageName !== registry.packageName || tarball.version !== registry.version) {
      diagnostics.add("tarball-package-mismatch")
    }
    if (tarball.sha1 !== registry.shasum) diagnostics.add("registry-shasum-mismatch")
    if (tarball.integrity !== registry.integrity) diagnostics.add("registry-integrity-mismatch")
  }
  if (installed !== undefined) {
    for (const check of INSTALLED_CHECKS) {
      if (!installed[check]) diagnostics.add(`installed-${installedDiagnosticName(check)}-failed`)
    }
  }

  return {
    diagnostics: Array.from(diagnostics).sort(),
    installed,
    plan,
    preflight,
    provenance,
    registry,
    tarball,
  }
}
