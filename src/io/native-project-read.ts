import { spawnSync } from "node:child_process"
import { createHash } from "node:crypto"
import { lstatSync, readFileSync } from "node:fs"
import { resolve, sep } from "node:path"
import process from "node:process"
import { fileURLToPath } from "node:url"

import { isRecord } from "../config/jsonc.js"
import {
  NativeProjectReadProtocolError,
  parseNativeCommandResponse,
  parseNativeDirectoryResponse,
  parseNativeReadResponse,
  parseNativeTextResponse,
  parseNativeTreeResponse,
  type NativeProjectReadIdentity,
  type NativeProjectReadCommandResult,
  type NativeProjectReadTreeEntry,
} from "./native-project-read-protocol.js"

export type {
  NativeProjectReadCommandResult,
  NativeProjectReadIdentity,
  NativeProjectReadTreeEntry,
} from "./native-project-read-protocol.js"

const MANIFEST_PATH = fileURLToPath(new URL("../../native/project-read/manifest.json", import.meta.url))
const PACKAGE_ROOT = resolve(fileURLToPath(new URL("../../", import.meta.url)))
const NATIVE_RUNTIME_TIMEOUT_MS = 10_000
const NATIVE_PROTOCOL_OVERHEAD_BYTES = 32 * 1024 * 1024

type NativeArtifact = {
  readonly architecture: "arm64" | "x64"
  readonly path: string
  readonly platform: "darwin" | "linux"
  readonly sha256: string
}

type NativeManifest = {
  readonly artifacts: readonly NativeArtifact[]
  readonly schemaVersion: "persona-harness-native-project-read.1"
}

export class NativeProjectReadRuntimeError extends Error {
  readonly name = "NativeProjectReadRuntimeError"

  constructor() {
    super("source-read-runtime-unavailable")
  }
}

export class NativeProjectReadLimitError extends Error {
  readonly name = "NativeProjectReadLimitError"

  constructor() {
    super("source-read-limit")
  }
}

export class NativeProjectReadUnsafeError extends Error {
  readonly name = "NativeProjectReadUnsafeError"

  constructor() {
    super("source-read-unsafe")
  }
}

export type NativeProjectReadFileResult =
  | { readonly kind: "absent" }
  | {
      readonly kind: "ready"
      readonly value: {
        readonly bytes: Buffer
        readonly identity: NativeProjectReadIdentity
      }
    }

export type NativeProjectReadExpectedPath = {
  readonly identity: NativeProjectReadIdentity
  readonly kind: "directory" | "file"
  readonly path: string
}

export type NativeProjectGitCommand = "head" | "index" | "prefix" | "status"
export type NativeProjectGradleCommand = "build" | "test"

export function inspectNativeProjectReadRuntime(): {
  readonly architecture: string
  readonly artifactSha256: string
  readonly availability: "ready"
  readonly platform: string
} {
  const artifact = nativeArtifact()
  return {
    architecture: process.arch,
    artifactSha256: artifact.sha256,
    availability: "ready",
    platform: process.platform,
  }
}

export function readNativeProjectFile(
  relativePath: string,
  maxBytes: number,
  projectDir = process.cwd(),
  expectations: readonly NativeProjectReadExpectedPath[] = [],
): Buffer {
  const root = nativeProjectRoot(projectDir)
  assertReadLimit(maxBytes)
  try {
    const invocation = nativeInvocation(["read", relativePath, String(maxBytes)], root, expectations)
    return parseNativeReadResponse(runNative(invocation.args, maxBytes + 128, {}, invocation.input)).bytes
  } catch (error) {
    throw nativeError(error)
  }
}

export function readNativeProjectFileWithIdentity(
  relativePath: string,
  maxBytes: number,
  projectDir = process.cwd(),
  expectations: readonly NativeProjectReadExpectedPath[] = [],
): { readonly bytes: Buffer; readonly identity: NativeProjectReadIdentity } {
  const result = readNativeProjectFileWithIdentityResult(relativePath, maxBytes, projectDir, expectations)
  if (result.kind === "absent") throw new NativeProjectReadRuntimeError()
  return result.value
}

export function readNativeProjectFileWithIdentityResult(
  relativePath: string,
  maxBytes: number,
  projectDir = process.cwd(),
  expectations: readonly NativeProjectReadExpectedPath[] = [],
): NativeProjectReadFileResult {
  const root = nativeProjectRoot(projectDir)
  assertReadLimit(maxBytes)
  try {
    const invocation = nativeInvocation(["read", relativePath, String(maxBytes)], root, expectations)
    return {
      kind: "ready",
      value: parseNativeReadResponse(runNative(invocation.args, maxBytes + 128, {}, invocation.input)),
    }
  } catch (error) {
    if (error instanceof NativeProjectReadProtocolError && error.code === "absent") return { kind: "absent" }
    throw nativeError(error)
  }
}

export function readNativeProjectDirectoryIdentity(
  relativePath: string,
  projectDir = process.cwd(),
  expectations: readonly NativeProjectReadExpectedPath[] = [],
): NativeProjectReadIdentity | undefined {
  const root = nativeProjectRoot(projectDir)
  try {
    const invocation = nativeInvocation(["directory", relativePath], root, expectations)
    return parseNativeDirectoryResponse(runNative(invocation.args, 128, {}, invocation.input))
  } catch (error) {
    if (error instanceof NativeProjectReadProtocolError && error.code === "absent") return undefined
    throw nativeError(error)
  }
}

export function readNativeProjectTree(
  options: {
    readonly excludedRoots: readonly string[]
    readonly maxEntries: number
    readonly maxFileBytes: number
    readonly maxTotalBytes: number
  },
  projectDir = process.cwd(),
  expectations: readonly NativeProjectReadExpectedPath[] = [],
): readonly NativeProjectReadTreeEntry[] {
  return readNativeProjectTreeAt(".", options, projectDir, expectations)
}

export function readNativeProjectTreeAt(
  relativeRoot: string,
  options: {
    readonly excludedRoots: readonly string[]
    readonly maxEntries: number
    readonly maxFileBytes: number
    readonly maxTotalBytes: number
  },
  projectDir = process.cwd(),
  expectations: readonly NativeProjectReadExpectedPath[] = [],
): readonly NativeProjectReadTreeEntry[] {
  const root = nativeProjectRoot(projectDir, relativeRoot)
  assertReadLimit(options.maxFileBytes)
  assertReadLimit(options.maxTotalBytes)
  if (!Number.isSafeInteger(options.maxEntries) || options.maxEntries <= 0) throw new NativeProjectReadRuntimeError()
  const outputLimit = options.maxTotalBytes + NATIVE_PROTOCOL_OVERHEAD_BYTES
  if (!Number.isSafeInteger(outputLimit) || outputLimit <= options.maxTotalBytes) throw new NativeProjectReadRuntimeError()
  try {
    const invocation = nativeInvocation([
      "tree",
      String(options.maxEntries),
      String(options.maxFileBytes),
      String(options.maxTotalBytes),
      ...options.excludedRoots,
    ], root, expectations)
    return parseNativeTreeResponse(runNative(invocation.args, outputLimit, {}, invocation.input))
  } catch (error) {
    throw nativeError(error)
  }
}

export function runNativeProjectGit(
  command: NativeProjectGitCommand,
  projectDir = process.cwd(),
): Buffer {
  const root = nativeProjectRoot(projectDir)
  try {
    return parseNativeTextResponse(runNative(["git", command, "--root", root], 4 * 1024 * 1024 + 128))
  } catch (error) {
    throw nativeError(error)
  }
}

export function runNativeProjectGradle(
  command: NativeProjectGradleCommand,
  timeoutMs: number,
  projectDir = process.cwd(),
): NativeProjectReadCommandResult {
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0 || timeoutMs > 120_000) {
    throw new NativeProjectReadRuntimeError()
  }
  const root = nativeProjectRoot(projectDir)
  try {
    return parseNativeCommandResponse(runNative(
      ["gradle", command, String(timeoutMs), "--root", root],
      2 * 1024 * 1024 + 256,
      nativeGradleEnvironment(),
    ))
  } catch (error) {
    throw nativeError(error)
  }
}

function nativeProjectRoot(projectDir: string, relativeRoot = "."): string {
  const current = resolve(process.cwd())
  const requested = resolve(projectDir)
  if (!validNativeRelativeRoot(relativeRoot)) throw new NativeProjectReadUnsafeError()
  if (requested !== current) throw new NativeProjectReadRuntimeError()
  return relativeRoot
}

function validNativeRelativeRoot(value: string): boolean {
  return value === "." || (
    value.length > 0
    && !value.startsWith("/")
    && !value.includes("\\")
    && value.split("/").every((segment) => segment.length > 0 && segment !== "." && segment !== "..")
  )
}

function assertReadLimit(value: number): void {
  if (!Number.isSafeInteger(value) || value <= 0 || value > 64 * 1024 * 1024) {
    throw new NativeProjectReadRuntimeError()
  }
}

function runNative(
  args: readonly string[],
  maxBuffer: number,
  environment: Readonly<Record<string, string>> = {},
  input?: Buffer,
): Buffer {
  const artifact = nativeArtifact()
  const result = spawnSync(artifact.path, args, {
    encoding: "buffer",
    env: environment,
    ...(input === undefined ? {} : { input }),
    maxBuffer,
    shell: false,
    stdio: input === undefined ? ["ignore", "pipe", "ignore"] : ["pipe", "pipe", "ignore"],
    timeout: NATIVE_RUNTIME_TIMEOUT_MS,
  })
  if (result.error !== undefined || result.status !== 0 || !Buffer.isBuffer(result.stdout)) {
    throw new NativeProjectReadRuntimeError()
  }
  return result.stdout
}

function nativeInvocation(
  body: readonly string[],
  root: string,
  expectations: readonly NativeProjectReadExpectedPath[],
): { readonly args: readonly string[]; readonly input?: Buffer } {
  const input = nativeExpectationInput(expectations)
  return {
    args: [...body, ...(input === undefined ? [] : ["--expect-stdin"]), "--root", root],
    ...(input === undefined ? {} : { input }),
  }
}

function nativeExpectationInput(
  expectations: readonly NativeProjectReadExpectedPath[],
): Buffer | undefined {
  if (expectations.length === 0) return undefined
  if (expectations.length > 20_000) throw new NativeProjectReadRuntimeError()
  const seen = new Set<string>()
  const entries = [...expectations].sort((left, right) => left.path.localeCompare(right.path)).map((entry) => {
    if (!validExpectedPath(entry.path) || seen.has(entry.path)) throw new NativeProjectReadRuntimeError()
    seen.add(entry.path)
    const bytes = Buffer.from(entry.path, "utf8")
    if (bytes.byteLength === 0 || bytes.byteLength > 1024) throw new NativeProjectReadRuntimeError()
    const dev = parseNativeIdentityInteger(entry.identity.dev)
    const ino = parseNativeIdentityInteger(entry.identity.ino)
    return { bytes, dev, ino, kind: entry.kind === "directory" ? 1 : 2 }
  })
  const size = 4 + entries.reduce((total, entry) => total + 2 + entry.bytes.byteLength + 1 + 8 + 8, 0)
  if (!Number.isSafeInteger(size) || size > 4 * 1024 * 1024) throw new NativeProjectReadRuntimeError()
  const input = Buffer.allocUnsafe(size)
  let offset = 0
  input.writeUInt32LE(entries.length, offset)
  offset += 4
  for (const entry of entries) {
    input.writeUInt16LE(entry.bytes.byteLength, offset)
    offset += 2
    entry.bytes.copy(input, offset)
    offset += entry.bytes.byteLength
    input[offset] = entry.kind
    offset += 1
    input.writeBigUInt64LE(entry.dev, offset)
    offset += 8
    input.writeBigUInt64LE(entry.ino, offset)
    offset += 8
  }
  return input
}

function validExpectedPath(value: string): boolean {
  return value === "." || (
    value.length > 0
    && !value.startsWith("/")
    && !value.includes("\\")
    && value.split("/").every((segment) => segment.length > 0 && segment !== "." && segment !== "..")
  )
}

function parseNativeIdentityInteger(value: string): bigint {
  if (!/^(?:0|[1-9][0-9]*)$/u.test(value)) throw new NativeProjectReadRuntimeError()
  try {
    return BigInt(value)
  } catch {
    throw new NativeProjectReadRuntimeError()
  }
}

function nativeGradleEnvironment(): Readonly<Record<string, string>> {
  const environment: Record<string, string> = {}
  for (const key of ["HOME", "JAVA_HOME", "PATH", "TMPDIR"] as const) {
    const value = process.env[key]
    if (typeof value === "string" && value.length > 0 && value.length <= 8 * 1024 && !/[\u0000\r\n]/u.test(value)) {
      environment[key] = value
    }
  }
  return environment
}

function nativeArtifact(): NativeArtifact {
  const manifest = parseManifest(readTrustedFile(MANIFEST_PATH))
  const artifact = manifest.artifacts.find((candidate) => candidate.platform === process.platform && candidate.architecture === process.arch)
  if (artifact === undefined) throw new NativeProjectReadRuntimeError()
  const artifactPath = resolve(PACKAGE_ROOT, artifact.path)
  if (!artifactPath.startsWith(PACKAGE_ROOT + sep)) throw new NativeProjectReadRuntimeError()
  const bytes = readTrustedFile(artifactPath)
  if ("sha256:" + createHash("sha256").update(bytes).digest("hex") !== artifact.sha256) {
    throw new NativeProjectReadRuntimeError()
  }
  return { ...artifact, path: artifactPath }
}

function readTrustedFile(path: string): Buffer {
  try {
    const stat = lstatSync(path, { bigint: true })
    if (!stat.isFile() || stat.isSymbolicLink()) throw new NativeProjectReadRuntimeError()
    return readFileSync(path)
  } catch (error) {
    if (error instanceof NativeProjectReadRuntimeError) throw error
    throw new NativeProjectReadRuntimeError()
  }
}

function parseManifest(bytes: Buffer): NativeManifest {
  try {
    const parsed: unknown = JSON.parse(bytes.toString("utf8"))
    if (!isRecord(parsed) || parsed["schemaVersion"] !== "persona-harness-native-project-read.1" || !Array.isArray(parsed["artifacts"])) {
      throw new NativeProjectReadRuntimeError()
    }
    const artifacts: NativeArtifact[] = []
    for (const candidate of parsed["artifacts"]) {
      const artifact = parseArtifact(candidate)
      if (artifact === undefined) throw new NativeProjectReadRuntimeError()
      artifacts.push(artifact)
    }
    const labels = new Set(artifacts.map((artifact) => artifact.platform + "-" + artifact.architecture))
    if (artifacts.length !== 4 || labels.size !== artifacts.length) throw new NativeProjectReadRuntimeError()
    return { artifacts, schemaVersion: "persona-harness-native-project-read.1" }
  } catch (error) {
    if (error instanceof NativeProjectReadRuntimeError) throw error
    throw new NativeProjectReadRuntimeError()
  }
}

function parseArtifact(value: unknown): NativeArtifact | undefined {
  if (!isRecord(value)) return undefined
  const platform = value["platform"]
  const architecture = value["architecture"]
  const path = value["path"]
  const sha256 = value["sha256"]
  if (
    (platform !== "darwin" && platform !== "linux")
    || (architecture !== "arm64" && architecture !== "x64")
    || typeof path !== "string"
    || !validArtifactPath(path)
    || typeof sha256 !== "string"
    || !/^sha256:[a-f0-9]{64}$/u.test(sha256)
  ) {
    return undefined
  }
  return { architecture, path, platform, sha256 }
}

function validArtifactPath(value: string): boolean {
  return value.startsWith("native/project-read/bin/")
    && !value.includes("\\")
    && value.split("/").every((segment) => segment.length > 0 && segment !== "." && segment !== "..")
}

function nativeError(
  error: unknown,
): NativeProjectReadLimitError | NativeProjectReadRuntimeError | NativeProjectReadUnsafeError {
  if (error instanceof NativeProjectReadProtocolError && error.code === "limit") return new NativeProjectReadLimitError()
  if (
    error instanceof NativeProjectReadProtocolError
    && (error.code === "invalid" || error.code === "unsafe")
  ) {
    return new NativeProjectReadUnsafeError()
  }
  return new NativeProjectReadRuntimeError()
}
