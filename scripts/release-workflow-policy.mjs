import { readFile } from "node:fs/promises"
import { pathToFileURL } from "node:url"

const CANONICAL_MAIN_REF = "refs/heads/main"
const MAX_SEMVER_LENGTH = 256
const VALID_DIST_TAGS = new Set(["staging", "next", "latest"])
const REQUIRED_APPROVAL_SCOPES = {
  staging: "staging-only",
  next: "next-promotion-approved",
  latest: "ga-approved",
}
const VALID_RELEASE_TARGETS = new Set(["main", "refs/heads/main"])
const STRICT_SEMVER = /^(?<major>0|[1-9]\d*)\.(?<minor>0|[1-9]\d*)\.(?<patch>0|[1-9]\d*)(?:-(?<prerelease>(?:0|[1-9]\d*|[0-9A-Za-z-]*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|[0-9A-Za-z-]*[A-Za-z-][0-9A-Za-z-]*))*))?(?:\+(?<build>[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/u

function success(extra = {}) {
  return { ok: true, ...extra }
}

function failure(code, message) {
  return { code, message, ok: false }
}

export function checkCanonicalMainSource({ canonicalMainSha, isAncestor, ref, sha }) {
  if (ref !== CANONICAL_MAIN_REF) {
    return failure("canonical-main-ref", `Source ref must be ${CANONICAL_MAIN_REF}; got ${ref}.`)
  }
  if (sha !== canonicalMainSha) {
    return failure("canonical-main-sha", `Source SHA ${sha} is not the current canonical main SHA ${canonicalMainSha}.`)
  }
  if (!isAncestor) {
    return failure("canonical-main-ancestry", "Source SHA is not an ancestor of canonical main.")
  }
  return success()
}

export function checkTagSource({ canonicalMainSha, isAncestor, packageVersion, sha, tagCommit, tagName }) {
  const expectedTag = `v${packageVersion}`
  if (tagName !== expectedTag) {
    return failure("release-tag-version", `Tag ${tagName} does not match package version ${packageVersion}.`)
  }
  if (tagCommit !== sha) {
    return failure("release-tag-commit", `Resolved tag commit ${tagCommit} does not match workflow SHA ${sha}.`)
  }
  if (!isAncestor) {
    return failure("release-tag-ancestry", `Tag commit ${tagCommit} is not an ancestor of canonical main ${canonicalMainSha}.`)
  }
  return success()
}

export function checkDistTagCompatibility({ approvalScope, distTag, version }) {
  const semver = parseStrictSemver(version)
  if (semver === undefined) {
    return failure("version-semver", "Package version must be bounded strict SemVer.")
  }
  if (!VALID_DIST_TAGS.has(distTag)) {
    return failure("dist-tag-unsupported", `Unsupported npm dist-tag ${distTag}; expected staging, next, or latest.`)
  }
  const requiredApprovalScope = REQUIRED_APPROVAL_SCOPES[distTag]
  if (approvalScope !== requiredApprovalScope) {
    return failure(
      `dist-tag-${distTag}-approval`,
      `Dist-tag ${distTag} requires approval scope ${requiredApprovalScope}.`,
    )
  }
  if (distTag === "staging" && !semver.prerelease) {
    return failure("dist-tag-staging-stable", `Stable version ${version} cannot use staging.`)
  }
  if (distTag === "latest" && semver.prerelease) {
    return failure("dist-tag-prerelease-latest", `Prerelease version ${version} cannot use latest.`)
  }
  if (distTag === "next" && !semver.prerelease) {
    return failure("dist-tag-stable-next", `Stable version ${version} cannot use next.`)
  }
  return success()
}

function parseStrictSemver(value) {
  if (typeof value !== "string" || value.length === 0 || value.length > MAX_SEMVER_LENGTH) {
    return undefined
  }
  const match = STRICT_SEMVER.exec(value)
  if (match === null || match[0] !== value) {
    return undefined
  }
  return { prerelease: match.groups?.["prerelease"] !== undefined }
}

export function checkRegistryMetadata({ distTag, distTagsText, expectedHead, expectedVersion, metadata }) {
  if (metadata.version !== expectedVersion) {
    return failure("registry-version", `Registry version ${metadata.version} does not match ${expectedVersion}.`)
  }
  if (metadata.gitHead !== expectedHead) {
    return failure("registry-git-head", `Registry gitHead ${metadata.gitHead} does not match ${expectedHead}.`)
  }
  if (typeof metadata["dist.shasum"] !== "string" || metadata["dist.shasum"].length === 0) {
    return failure("registry-shasum", "Registry metadata is missing dist.shasum.")
  }
  if (!isIntegrity(metadata["dist.integrity"])) {
    return failure("registry-integrity", "Registry metadata is missing a valid dist.integrity.")
  }
  const expectedTagLine = `${distTag}: ${expectedVersion}`
  const hasTag = distTagsText.split(/\r?\n/u).some((line) => line.trim() === expectedTagLine)
  if (!hasTag) {
    return failure("registry-dist-tag", `Registry dist-tag output does not contain ${expectedTagLine}.`)
  }
  return success()
}

export function checkReleaseState({ expectedCommit, expectedPrerelease, expectedTag, release, tagCommit }) {
  if (release === null) {
    return success({ action: "create" })
  }
  if (release.tagName !== expectedTag) {
    return failure("release-tag", `Existing release tag ${release.tagName} does not match ${expectedTag}.`)
  }
  if (release.name !== expectedTag) {
    return failure("release-title", `Existing release title ${release.name} does not match ${expectedTag}.`)
  }
  if (release.isPrerelease !== expectedPrerelease) {
    return failure("release-prerelease", `Existing release prerelease state does not match ${expectedPrerelease}.`)
  }
  if (tagCommit !== expectedCommit) {
    return failure("release-tag-commit", `Existing release tag resolves to ${tagCommit}, expected ${expectedCommit}.`)
  }
  const target = release.targetCommitish
  if (target !== expectedCommit && !VALID_RELEASE_TARGETS.has(target)) {
    return failure("release-target", `Existing release target ${target} is not canonical main or ${expectedCommit}.`)
  }
  return success({ action: "already-valid" })
}

function isIntegrity(value) {
  return typeof value === "string" && /^sha(?:1|256|384|512)-[A-Za-z0-9+/=]+$/u.test(value)
}

function readArg(name) {
  const index = process.argv.indexOf(name)
  if (index === -1) {
    return undefined
  }
  const value = process.argv[index + 1]
  if (value === undefined || value.startsWith("--")) {
    throw new Error(`${name} requires a value`)
  }
  return value
}

function requiredArg(name) {
  const value = readArg(name)
  if (value === undefined) {
    throw new Error(`${name} is required`)
  }
  return value
}

function booleanArg(name) {
  const value = requiredArg(name)
  if (value !== "true" && value !== "false") {
    throw new Error(`${name} must be true or false`)
  }
  return value === "true"
}

function printResult(result) {
  if (!result.ok) {
    console.error(`[${result.code}] ${result.message}`)
    process.exitCode = 1
    return
  }
  console.log(JSON.stringify(result))
}

async function main() {
  const command = process.argv[2]
  if (command === "canonical-main") {
    printResult(checkCanonicalMainSource({
      canonicalMainSha: requiredArg("--canonical-main-sha"),
      isAncestor: booleanArg("--is-ancestor"),
      ref: requiredArg("--ref"),
      sha: requiredArg("--sha"),
    }))
    return
  }
  if (command === "tag-source") {
    printResult(checkTagSource({
      canonicalMainSha: requiredArg("--canonical-main-sha"),
      isAncestor: booleanArg("--is-ancestor"),
      packageVersion: requiredArg("--version"),
      sha: requiredArg("--sha"),
      tagCommit: requiredArg("--tag-commit"),
      tagName: requiredArg("--tag"),
    }))
    return
  }
  if (command === "dist-tag") {
    printResult(checkDistTagCompatibility({
      approvalScope: requiredArg("--approval-scope"),
      distTag: requiredArg("--dist-tag"),
      version: requiredArg("--version"),
    }))
    return
  }
  if (command === "registry") {
    const metadata = JSON.parse(await readFile(requiredArg("--metadata"), "utf8"))
    const distTagsText = await readFile(requiredArg("--dist-tags"), "utf8")
    printResult(checkRegistryMetadata({
      distTag: requiredArg("--dist-tag"),
      distTagsText,
      expectedHead: requiredArg("--expected-head"),
      expectedVersion: requiredArg("--expected-version"),
      metadata,
    }))
    return
  }
  if (command === "release-state") {
    const release = JSON.parse(await readFile(requiredArg("--release"), "utf8"))
    printResult(checkReleaseState({
      expectedCommit: requiredArg("--expected-commit"),
      expectedPrerelease: booleanArg("--expected-prerelease"),
      expectedTag: requiredArg("--tag"),
      release,
      tagCommit: requiredArg("--tag-commit"),
    }))
    return
  }
  throw new Error(`Unknown release workflow policy command: ${command ?? "<missing>"}`)
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
}
