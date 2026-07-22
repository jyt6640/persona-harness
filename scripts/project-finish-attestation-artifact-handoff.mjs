import {
  closeSync,
  constants,
  fstatSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  realpathSync,
  writeFileSync,
} from "node:fs"
import { basename, dirname, isAbsolute, join, relative } from "node:path"
import { pathToFileURL } from "node:url"

const ARTIFACT_DIRECTORY = ".project-finish-attestation-artifacts"
const FAILURE_DIRECTORY = ".project-finish-attestation-failure"
const BUNDLE_ENVIRONMENT_KEY = "PROJECT_FINISH_ATTESTATION_BUNDLE_PATH"
const MAX_ARTIFACT_BYTES = 1024 * 1024
const UNSIGNED_FILES = ["predicate.json", "receipt.json"]
const SIGNED_FILES = ["bundle.json", ...UNSIGNED_FILES]
const FAILURE_CODE = "project-finish-producer-artifact-handoff"

export function verifyProjectFinishAttestationArtifactHandoff({
  environment = process.env,
  phase,
} = {}) {
  try {
    if (phase !== "unsigned" && phase !== "signed") throw new HandoffError()
    const workspace = captureWorkspace(environment)
    verifyArtifactDirectory(workspace, phase === "signed" ? SIGNED_FILES : UNSIGNED_FILES)
    return { kind: "ready" }
  } catch {
    return { code: FAILURE_CODE, kind: "blocked" }
  }
}

export function collectProjectFinishAttestationBundle({ environment = process.env } = {}) {
  let workspace
  try {
    workspace = captureWorkspace(environment)
    const artifactDirectory = verifyArtifactDirectory(workspace, UNSIGNED_FILES)
    const sourcePath = requiredAbsoluteEnvironment(environment, BUNDLE_ENVIRONMENT_KEY)
    const sourceParent = captureCanonicalDirectory(dirname(sourcePath))
    const canonicalSourcePath = join(sourceParent.realpath, basename(sourcePath))
    if (canonicalSourcePath !== sourcePath || isContained(artifactDirectory.realpath, canonicalSourcePath)) {
      throw new HandoffError()
    }
    const bundle = readNoFollowFile(canonicalSourcePath, MAX_ARTIFACT_BYTES, sourceParent)
    if (!sameDirectory(workspace) || !sameDirectory(artifactDirectory)) throw new HandoffError()
    writeNewNoFollowFile(join(artifactDirectory.realpath, "bundle.json"), bundle.bytes, artifactDirectory)
    verifyArtifactDirectory(workspace, SIGNED_FILES)
    return { kind: "ready" }
  } catch {
    if (workspace !== undefined) writeFailureDiagnostic(workspace)
    return { code: FAILURE_CODE, kind: "blocked" }
  }
}

async function main() {
  const mode = process.argv[2]
  const result = mode === "--collect"
    ? collectProjectFinishAttestationBundle()
    : mode === "--verify-signed"
      ? verifyProjectFinishAttestationArtifactHandoff({ phase: "signed" })
      : mode === "--verify-unsigned"
        ? verifyProjectFinishAttestationArtifactHandoff({ phase: "unsigned" })
        : { code: FAILURE_CODE, kind: "blocked" }

  if (result.kind === "ready") return
  try {
    writeFailureDiagnostic(captureWorkspace(process.env))
  } catch {
    // A missing or unsafe runner root cannot receive a diagnostic artifact.
  }
  process.stderr.write(`${FAILURE_CODE}\n`)
  process.exitCode = 1
}

function captureWorkspace(environment) {
  const workspacePath = requiredAbsoluteEnvironment(environment, "GITHUB_WORKSPACE")
  return captureCanonicalDirectory(workspacePath)
}

function verifyArtifactDirectory(workspace, expectedFiles) {
  if (!sameDirectory(workspace)) throw new HandoffError()
  const artifactPath = join(workspace.realpath, ARTIFACT_DIRECTORY)
  if (!isContained(workspace.realpath, artifactPath)) throw new HandoffError()
  const artifactDirectory = captureCanonicalDirectory(artifactPath)
  const names = readdirSync(artifactDirectory.realpath).sort()
  if (names.length !== expectedFiles.length || names.some((name, index) => name !== expectedFiles[index])) {
    throw new HandoffError()
  }
  for (const name of expectedFiles) {
    readNoFollowFile(join(artifactDirectory.realpath, name), MAX_ARTIFACT_BYTES, artifactDirectory)
  }
  if (!sameDirectory(workspace) || !sameDirectory(artifactDirectory)) throw new HandoffError()
  return artifactDirectory
}

function readNoFollowFile(path, maxBytes, parentDirectory) {
  if (parentDirectory !== undefined && !sameDirectory(parentDirectory)) throw new HandoffError()
  let descriptor
  try {
    descriptor = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW)
    const before = fstatSync(descriptor, { bigint: true })
    if (!before.isFile() || before.size <= 0n || before.size > BigInt(maxBytes)) throw new HandoffError()
    const bytes = readFileSync(descriptor)
    const after = fstatSync(descriptor, { bigint: true })
    const current = lstatSync(path, { bigint: true })
    if (
      !after.isFile()
      || !current.isFile()
      || current.isSymbolicLink()
      || !sameIdentity(before, after)
      || !sameIdentity(after, current)
      || bytes.byteLength !== Number(after.size)
    ) {
      throw new HandoffError()
    }
    if (parentDirectory !== undefined && !sameDirectory(parentDirectory)) throw new HandoffError()
    return { bytes, identity: identity(after) }
  } catch (error) {
    if (error instanceof HandoffError) throw error
    throw new HandoffError()
  } finally {
    if (descriptor !== undefined) closeSync(descriptor)
  }
}

function writeNewNoFollowFile(path, bytes, parentDirectory) {
  let descriptor
  try {
    if (parentDirectory !== undefined && !sameDirectory(parentDirectory)) throw new HandoffError()
    descriptor = openSync(
      path,
      constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
      0o600,
    )
    writeFileSync(descriptor, bytes)
    const written = fstatSync(descriptor, { bigint: true })
    const current = lstatSync(path, { bigint: true })
    if (
      !written.isFile()
      || !current.isFile()
      || current.isSymbolicLink()
      || !sameIdentity(written, current)
      || written.size !== BigInt(bytes.byteLength)
    ) {
      throw new HandoffError()
    }
    if (parentDirectory !== undefined && !sameDirectory(parentDirectory)) throw new HandoffError()
  } catch (error) {
    if (error instanceof HandoffError) throw error
    throw new HandoffError()
  } finally {
    if (descriptor !== undefined) closeSync(descriptor)
  }
}

function writeFailureDiagnostic(workspace) {
  try {
    if (!sameDirectory(workspace)) return
    const path = join(workspace.realpath, FAILURE_DIRECTORY)
    if (!isContained(workspace.realpath, path)) return
    mkdirSync(path, { mode: 0o700 })
    const directory = captureCanonicalDirectory(path)
    if (!sameDirectory(workspace)) return
    writeNewNoFollowFile(
      join(directory.realpath, "failure-diagnostic.json"),
      Buffer.from(`${JSON.stringify({ code: FAILURE_CODE, schemaVersion: "project-finish-attestation-producer-diagnostic.1" })}\n`, "utf8"),
      directory,
    )
  } catch {
    // Failure diagnostics are supplementary and must never widen a blocked path.
  }
}

function captureCanonicalDirectory(path) {
  try {
    const before = lstatSync(path, { bigint: true })
    if (!before.isDirectory() || before.isSymbolicLink()) throw new HandoffError()
    const resolved = realpathSync(path)
    if (resolved !== path) throw new HandoffError()
    const after = lstatSync(path, { bigint: true })
    if (!after.isDirectory() || after.isSymbolicLink() || !sameLocation(before, after)) throw new HandoffError()
    return { identity: identity(after), realpath: resolved }
  } catch (error) {
    if (error instanceof HandoffError) throw error
    throw new HandoffError()
  }
}

function sameDirectory(expected) {
  if (expected === undefined || typeof expected.realpath !== "string" || expected.identity === undefined) return false
  try {
    const current = lstatSync(expected.realpath, { bigint: true })
    return current.isDirectory()
      && !current.isSymbolicLink()
      && realpathSync(expected.realpath) === expected.realpath
      && sameLocation(expected.identity, current)
  } catch {
    return false
  }
}

function requiredAbsoluteEnvironment(environment, key) {
  const value = environment[key]
  if (typeof value !== "string" || value.length === 0 || value.length > 1024 || /[\u0000\r\n]/u.test(value) || !isAbsolute(value)) {
    throw new HandoffError()
  }
  return value
}

function isContained(root, candidate) {
  const path = relative(root, candidate)
  return path === "" || (!path.startsWith("..") && !isAbsolute(path))
}

function identity(stat) {
  return {
    ctimeNs: stat.ctimeNs.toString(),
    dev: stat.dev.toString(),
    ino: stat.ino.toString(),
    mode: stat.mode.toString(),
    mtimeNs: stat.mtimeNs.toString(),
    size: stat.size.toString(),
  }
}

function sameIdentity(left, right) {
  const leftIdentity = typeof left.dev === "bigint" ? identity(left) : left
  const rightIdentity = typeof right.dev === "bigint" ? identity(right) : right
  return leftIdentity.ctimeNs === rightIdentity.ctimeNs
    && leftIdentity.dev === rightIdentity.dev
    && leftIdentity.ino === rightIdentity.ino
    && leftIdentity.mode === rightIdentity.mode
    && leftIdentity.mtimeNs === rightIdentity.mtimeNs
    && leftIdentity.size === rightIdentity.size
}

function sameLocation(left, right) {
  const leftIdentity = typeof left.dev === "bigint" ? identity(left) : left
  const rightIdentity = typeof right.dev === "bigint" ? identity(right) : right
  return leftIdentity.dev === rightIdentity.dev
    && leftIdentity.ino === rightIdentity.ino
    && leftIdentity.mode === rightIdentity.mode
}

class HandoffError extends Error {}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main()
}
