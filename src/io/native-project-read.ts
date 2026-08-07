import { createHash } from "node:crypto"
import { closeSync, constants, fstatSync, lstatSync, openSync, readFileSync, type BigIntStats } from "node:fs"
import { basename, isAbsolute, relative, resolve, sep } from "node:path"
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

type NativeArtifactRecord = {
  readonly architecture: "arm64" | "x64"
  readonly path: string
  readonly platform: "darwin" | "linux"
  readonly sha256: string
}

type NativeArtifact = NativeArtifactRecord & {
  readonly descriptor: number
}

type NativeManifest = {
  readonly artifacts: readonly NativeArtifactRecord[]
  readonly bridge: {
    readonly path: "native/project-read/ph_native_project_read_addon.c"
    readonly sha256: string
  }
  readonly header: {
    readonly path: "native/project-read/ph_native_project_read.h"
    readonly sha256: string
  }
  readonly schemaVersion: "persona-harness-native-project-read.1"
  readonly source: {
    readonly path: "native/project-read/ph_native_project_read.c"
    readonly sha256: string
  }
}

type NativeAddonRun = (
  args: readonly string[],
  input: Buffer | null,
  environment: readonly string[],
  maxBuffer: number,
  timeoutMs: number,
  rootDescriptor: number,
  parentDescriptor: number,
) => Buffer

type NativeRuntime = {
  readonly architecture: "arm64" | "x64"
  readonly platform: "darwin" | "linux"
  readonly run: NativeAddonRun
  readonly sha256: string
}

let loadedNativeRuntime: NativeRuntime | undefined

export class NativeProjectReadRuntimeError extends Error {
  readonly name = "NativeProjectReadRuntimeError"

  constructor() {
    super("source-read-runtime-unavailable")
  }
}

export type NativeProjectReadGuardMode = "no-follow-open" | "lstat-verified"

/**
 * How this module keeps a symlink from being opened in place of the path it was
 * asked for.
 *
 * `O_DIRECTORY` and `O_NOFOLLOW` do not exist on Windows, so opening with them
 * throws there and every project read fails — which surfaced as
 * `source-read-runtime-unavailable` and made `workflow finish` unusable on
 * Windows from 0.8.0-beta onward. `workflow-lifecycle-state.ts` already
 * degrades the same way for the same reason.
 *
 * `lstat-verified` inspects the path before opening and rejects a symlink, then
 * confirms the descriptor really is a directory. That is weaker than an atomic
 * `O_NOFOLLOW` open — a swap between the two calls is not excluded — but it is
 * strictly more than the last release that worked on Windows performed, since
 * 0.7.0 had no project read boundary at all.
 */
export function nativeProjectReadGuardMode(): NativeProjectReadGuardMode {
  return typeof constants.O_DIRECTORY === "number" && typeof constants.O_NOFOLLOW === "number"
    ? "no-follow-open"
    : "lstat-verified"
}

/** `O_NOFOLLOW` where the platform has it, and nothing where it does not. */
function noFollowFileFlag(): number {
  return typeof constants.O_NOFOLLOW === "number" ? constants.O_NOFOLLOW : 0
}

/**
 * Whether this platform and architecture are built at all.
 *
 * "no artifact exists for win32" and "the artifact for this platform failed to
 * load or did not match its digest" both raised
 * `NativeProjectReadRuntimeError`, so callers could not tell an unsupported
 * platform apart from a tampered or broken install. They are not the same
 * thing: the first is a fixed property of the release, the second is a signal
 * that must never be degraded around.
 *
 * This answers only the first question, and deliberately does not read, verify,
 * or load anything.
 */
export function nativeProjectReadPlatformSupported(): boolean {
  try {
    const manifest = parseManifest(readTrustedFile(MANIFEST_PATH))
    return manifest.artifacts.some(
      (candidate) => candidate.platform === process.platform && candidate.architecture === process.arch,
    )
  } catch {
    // An unreadable or malformed manifest is a broken install, not an
    // unsupported platform, so it must not be reported as one.
    return true
  }
}

function openNoFollowDirectory(path: string): number {
  if (nativeProjectReadGuardMode() === "no-follow-open") {
    return openSync(path, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW)
  }
  const before = lstatSync(path, { bigint: true })
  if (!before.isDirectory() || before.isSymbolicLink()) {
    throw new NativeProjectReadRuntimeError()
  }
  const descriptor = openSync(path, constants.O_RDONLY)
  try {
    if (!fstatSync(descriptor, { bigint: true }).isDirectory()) {
      throw new NativeProjectReadRuntimeError()
    }
  } catch (error) {
    closeSync(descriptor)
    throw error instanceof NativeProjectReadRuntimeError ? error : new NativeProjectReadRuntimeError()
  }
  return descriptor
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

export type NativeProjectReadRootContext = {
  readonly anchor: "current" | "direct-child"
  readonly parent: NativeProjectReadIdentity
  readonly projectPath: string
  readonly root: NativeProjectReadIdentity
  readonly rootName: string
}

export type NativeProjectGitCommand = "head" | "index" | "prefix" | "status"
export type NativeProjectGradleCommand = "build" | "test"

export function inspectNativeProjectReadRuntime(): {
  readonly architecture: string
  readonly artifactSha256: string
  readonly availability: "ready"
  readonly platform: string
} {
  const runtime = nativeRuntime()
  return {
    architecture: process.arch,
    artifactSha256: runtime.sha256,
    availability: "ready",
    platform: process.platform,
  }
}

export function captureNativeProjectReadRootContext(
  projectDir: string,
  expectedRoot: NativeProjectReadIdentity,
  expectedParent?: NativeProjectReadIdentity,
): NativeProjectReadRootContext {
  const current = resolve(process.cwd())
  const projectPath = resolve(projectDir)
  const directChild = projectPath === current ? undefined : relative(current, projectPath)
  if (
    directChild !== undefined
    && (!validNativeRelativeRoot(directChild) || directChild.includes(sep) || directChild.includes("\\"))
  ) {
    throw new NativeProjectReadRuntimeError()
  }
  const anchor = directChild === undefined ? "current" : "direct-child"
  const rootName = directChild ?? basename(current)
  if (!validNativeRelativeRoot(rootName)) throw new NativeProjectReadRuntimeError()
  let parentDescriptor: number | undefined
  let rootDescriptor: number | undefined
  try {
    parentDescriptor = openNoFollowDirectory(
      anchor === "current" ? ".." : ".",
    )
    rootDescriptor = openNoFollowDirectory(
      anchor === "current" ? "." : rootName,
    )
    const rootStat = fstatSync(rootDescriptor, { bigint: true })
    const parentStat = fstatSync(parentDescriptor, { bigint: true })
    const root = nativeIdentity(rootStat)
    const parent = nativeIdentity(parentStat)
    if (
      !rootStat.isDirectory()
      || !parentStat.isDirectory()
      || !sameNativeLocation(root, expectedRoot)
      || (expectedParent !== undefined && !sameNativeLocation(parent, expectedParent))
    ) {
      throw new NativeProjectReadUnsafeError()
    }
    return { anchor, parent, projectPath, root, rootName }
  } catch (error) {
    if (error instanceof NativeProjectReadUnsafeError) throw error
    throw new NativeProjectReadRuntimeError()
  } finally {
    if (parentDescriptor !== undefined) closeSync(parentDescriptor)
    if (rootDescriptor !== undefined) closeSync(rootDescriptor)
  }
}

export function captureNativeProjectReadDirectChildIdentity(projectDir: string): NativeProjectReadIdentity {
  const selected = relative(resolve(process.cwd()), resolve(projectDir))
  if (
    !validNativeRelativeRoot(selected)
    || selected === "."
    || isAbsolute(selected)
    || selected.includes(sep)
  ) {
    throw new NativeProjectReadRuntimeError()
  }
  try {
    return parseNativeDirectoryResponse(runNative(["capture-root", selected], 128))
  } catch (error) {
    throw nativeError(error)
  }
}

export function readNativeProjectFile(
  relativePath: string,
  maxBytes: number,
  projectDir = process.cwd(),
  expectations: readonly NativeProjectReadExpectedPath[] = [],
  rootContext?: NativeProjectReadRootContext,
): Buffer {
  const root = nativeProjectRoot(projectDir, ".", expectations, rootContext)
  assertReadLimit(maxBytes)
  try {
    const invocation = nativeInvocation(["read", relativePath, String(maxBytes)], root, expectations, rootContext)
    return parseNativeReadResponse(runNative(invocation.args, maxBytes + 128, {}, invocation.input, rootContext)).bytes
  } catch (error) {
    throw nativeError(error)
  }
}

export function readNativeProjectFileWithIdentity(
  relativePath: string,
  maxBytes: number,
  projectDir = process.cwd(),
  expectations: readonly NativeProjectReadExpectedPath[] = [],
  rootContext?: NativeProjectReadRootContext,
): { readonly bytes: Buffer; readonly identity: NativeProjectReadIdentity } {
  const result = readNativeProjectFileWithIdentityResult(relativePath, maxBytes, projectDir, expectations, rootContext)
  if (result.kind === "absent") throw new NativeProjectReadRuntimeError()
  return result.value
}

export function readNativeProjectFileWithIdentityResult(
  relativePath: string,
  maxBytes: number,
  projectDir = process.cwd(),
  expectations: readonly NativeProjectReadExpectedPath[] = [],
  rootContext?: NativeProjectReadRootContext,
): NativeProjectReadFileResult {
  const root = nativeProjectRoot(projectDir, ".", expectations, rootContext)
  assertReadLimit(maxBytes)
  try {
    const invocation = nativeInvocation(["read", relativePath, String(maxBytes)], root, expectations, rootContext)
    return {
      kind: "ready",
      value: parseNativeReadResponse(runNative(invocation.args, maxBytes + 128, {}, invocation.input, rootContext)),
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
  rootContext?: NativeProjectReadRootContext,
): NativeProjectReadIdentity | undefined {
  const root = nativeProjectRoot(projectDir, ".", expectations, rootContext)
  try {
    const invocation = nativeInvocation(["directory", relativePath], root, expectations, rootContext)
    return parseNativeDirectoryResponse(runNative(invocation.args, 128, {}, invocation.input, rootContext))
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
  rootContext?: NativeProjectReadRootContext,
): readonly NativeProjectReadTreeEntry[] {
  return readNativeProjectTreeAt(".", options, projectDir, expectations, rootContext)
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
  rootContext?: NativeProjectReadRootContext,
): readonly NativeProjectReadTreeEntry[] {
  const root = nativeProjectRoot(projectDir, relativeRoot, expectations, rootContext)
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
    ], root, expectations, rootContext)
    return parseNativeTreeResponse(runNative(invocation.args, outputLimit, {}, invocation.input, rootContext))
  } catch (error) {
    throw nativeError(error)
  }
}

export function captureNativeGeneratedProjectTreeManifest(
  relativeRoot: "build/test-results/test" | "target/surefire-reports",
  projectDir: string,
  expectations: readonly NativeProjectReadExpectedPath[],
  rootContext?: NativeProjectReadRootContext,
): readonly NativeProjectReadTreeEntry[] | undefined {
  const root = nativeProjectRoot(projectDir, ".", expectations, rootContext)
  if (
    expectations.length !== 1
    || expectations[0]?.path !== "."
    || expectations[0]?.kind !== "directory"
  ) {
    throw new NativeProjectReadRuntimeError()
  }
  try {
    const invocation = nativeInvocation(["generated-manifest", relativeRoot], root, expectations, rootContext)
    return parseNativeTreeResponse(runNative(invocation.args, 2 * 1024 * 1024, {}, invocation.input, rootContext))
  } catch (error) {
    if (error instanceof NativeProjectReadProtocolError && error.code === "absent") return undefined
    throw nativeError(error)
  }
}

export function readNativeGeneratedProjectTree(
  relativeRoot: "build/test-results/test" | "target/surefire-reports",
  options: {
    readonly maxEntries: number
    readonly maxFileBytes: number
    readonly maxTotalBytes: number
  },
  projectDir: string,
  expectations: readonly NativeProjectReadExpectedPath[],
  rootContext?: NativeProjectReadRootContext,
): readonly NativeProjectReadTreeEntry[] | undefined {
  const root = nativeProjectRoot(projectDir, ".", expectations, rootContext)
  assertReadLimit(options.maxFileBytes)
  assertReadLimit(options.maxTotalBytes)
  if (!Number.isSafeInteger(options.maxEntries) || options.maxEntries <= 0) throw new NativeProjectReadRuntimeError()
  const outputLimit = options.maxTotalBytes + NATIVE_PROTOCOL_OVERHEAD_BYTES
  if (!Number.isSafeInteger(outputLimit) || outputLimit <= options.maxTotalBytes) throw new NativeProjectReadRuntimeError()
  try {
    const invocation = nativeInvocation([
      "generated-tree",
      relativeRoot,
      String(options.maxEntries),
      String(options.maxFileBytes),
      String(options.maxTotalBytes),
    ], root, expectations, rootContext)
    const prefix = `${relativeRoot}/`
    return parseNativeTreeResponse(runNative(invocation.args, outputLimit, {}, invocation.input, rootContext)).flatMap((entry) => {
      if (!entry.path.startsWith(prefix)) return []
      return [{ ...entry, path: entry.path.slice(prefix.length) }]
    })
  } catch (error) {
    if (error instanceof NativeProjectReadProtocolError && error.code === "absent") return undefined
    throw nativeError(error)
  }
}

export function runNativeProjectGit(
  command: NativeProjectGitCommand,
  projectDir = process.cwd(),
  expectations: readonly NativeProjectReadExpectedPath[] = [],
  rootContext?: NativeProjectReadRootContext,
): Buffer {
  const root = nativeProjectRoot(projectDir, ".", expectations, rootContext)
  try {
    const invocation = nativeInvocation(["git", command], root, expectations, rootContext)
    return parseNativeTextResponse(runNative(invocation.args, 4 * 1024 * 1024 + 128, {}, invocation.input, rootContext))
  } catch (error) {
    throw nativeError(error)
  }
}

export function runNativeProjectGradle(
  command: NativeProjectGradleCommand,
  timeoutMs: number,
  projectDir = process.cwd(),
  expectations: readonly NativeProjectReadExpectedPath[] = [],
  rootContext?: NativeProjectReadRootContext,
): NativeProjectReadCommandResult {
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0 || timeoutMs > 120_000) {
    throw new NativeProjectReadRuntimeError()
  }
  const root = nativeProjectRoot(projectDir, ".", expectations, rootContext)
  try {
    const invocation = nativeInvocation(["gradle", command, String(timeoutMs)], root, expectations, rootContext)
    return parseNativeCommandResponse(runNative(
      invocation.args,
      2 * 1024 * 1024 + 256,
      nativeGradleEnvironment(),
      invocation.input,
      rootContext,
      timeoutMs + NATIVE_RUNTIME_TIMEOUT_MS,
    ))
  } catch (error) {
    throw nativeError(error)
  }
}

function nativeProjectRoot(
  projectDir: string,
  relativeRoot: string,
  expectations: readonly NativeProjectReadExpectedPath[],
  rootContext?: NativeProjectReadRootContext,
): string {
  const current = resolve(process.cwd())
  const requested = resolve(projectDir)
  if (!validNativeRelativeRoot(relativeRoot)) throw new NativeProjectReadUnsafeError()
  if (rootContext !== undefined) {
    const selected = relative(current, requested)
    if (
      requested !== rootContext.projectPath
      || (rootContext.anchor === "current" && requested !== current)
      || (rootContext.anchor === "direct-child" && (
        selected !== rootContext.rootName
        || !validNativeRelativeRoot(selected)
        || selected.includes(sep)
        || selected.includes("\\")
      ))
    ) {
      throw new NativeProjectReadRuntimeError()
    }
    return relativeRoot
  }
  if (requested === current) return relativeRoot
  const selected = relative(current, requested)
  if (
    relativeRoot !== "."
    || isAbsolute(selected)
    || selected.includes("\\")
    || selected.includes(sep)
    || !validNativeRelativeRoot(selected)
    || !expectations.some((entry) => entry.path === "." && entry.kind === "directory")
  ) {
    throw new NativeProjectReadRuntimeError()
  }
  return selected
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
  rootContext?: NativeProjectReadRootContext,
  timeoutMs = NATIVE_RUNTIME_TIMEOUT_MS,
): Buffer {
  const runtime = nativeRuntime()
  let parentDescriptor: number | undefined
  let rootDescriptor: number | undefined
  try {
    if (rootContext !== undefined) {
      parentDescriptor = openNoFollowDirectory(
        rootContext.anchor === "current" ? ".." : ".",
      )
      rootDescriptor = openNoFollowDirectory(
        rootContext.anchor === "current" ? "." : rootContext.rootName,
      )
      const rootStat = fstatSync(rootDescriptor, { bigint: true })
      const parentStat = fstatSync(parentDescriptor, { bigint: true })
      const root = nativeIdentity(rootStat)
      const parent = nativeIdentity(parentStat)
      if (
        !rootStat.isDirectory()
        || !parentStat.isDirectory()
        || !sameNativeLocation(root, rootContext.root)
        || !sameNativeLocation(parent, rootContext.parent)
      ) {
        throw new NativeProjectReadUnsafeError()
      }
    }
    const result = runtime.run(
      ["ph-native-project-read", ...args],
      input ?? null,
      Object.entries(environment).map(([key, value]) => `${key}=${value}`),
      maxBuffer,
      timeoutMs,
      rootDescriptor ?? -1,
      parentDescriptor ?? -1,
    )
    if (!Buffer.isBuffer(result)) throw new NativeProjectReadRuntimeError()
    return result
  } finally {
    if (parentDescriptor !== undefined) closeSync(parentDescriptor)
    if (rootDescriptor !== undefined) closeSync(rootDescriptor)
  }
}

function nativeInvocation(
  body: readonly string[],
  root: string,
  expectations: readonly NativeProjectReadExpectedPath[],
  rootContext?: NativeProjectReadRootContext,
): { readonly args: readonly string[]; readonly input?: Buffer } {
  const input = nativeExpectationInput(expectations)
  return {
    args: [
      ...body,
      ...(input === undefined ? [] : ["--expect-stdin"]),
      ...(rootContext === undefined ? [] : [
        "--root-fds",
        "3",
        "4",
        rootContext.rootName,
        rootContext.parent.dev,
        rootContext.parent.ino,
      ]),
      "--root",
      root,
    ],
    ...(input === undefined ? {} : { input }),
  }
}

function nativeIdentity(stat: BigIntStats): NativeProjectReadIdentity {
  return {
    ctimeNs: stat.ctimeNs.toString(),
    dev: stat.dev.toString(),
    ino: stat.ino.toString(),
    mode: Number(stat.mode & 0o777n).toString(8).padStart(4, "0"),
    mtimeNs: stat.mtimeNs.toString(),
    size: stat.size.toString(),
  }
}

function sameNativeLocation(left: NativeProjectReadIdentity, right: NativeProjectReadIdentity): boolean {
  return left.dev === right.dev && left.ino === right.ino && left.mode === right.mode
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
    const mode = parseNativeMode(entry.identity.mode)
    const size = parseNativeIdentityInteger(entry.identity.size)
    const mtimeNs = parseNativeIdentityInteger(entry.identity.mtimeNs)
    const ctimeNs = parseNativeIdentityInteger(entry.identity.ctimeNs)
    return { bytes, ctimeNs, dev, ino, kind: entry.kind === "directory" ? 1 : 2, mode, mtimeNs, size }
  })
  const size = 4 + entries.reduce((total, entry) => total + 2 + entry.bytes.byteLength + 1 + (8 * 6), 0)
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
    input.writeBigUInt64LE(entry.mode, offset)
    offset += 8
    input.writeBigUInt64LE(entry.size, offset)
    offset += 8
    input.writeBigUInt64LE(entry.mtimeNs, offset)
    offset += 8
    input.writeBigUInt64LE(entry.ctimeNs, offset)
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

function parseNativeMode(value: string): bigint {
  if (!/^[0-7]{4}$/u.test(value)) throw new NativeProjectReadRuntimeError()
  return BigInt(`0o${value}`)
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
  const sourcePath = resolve(PACKAGE_ROOT, manifest.source.path)
  if (!sourcePath.startsWith(PACKAGE_ROOT + sep)) throw new NativeProjectReadRuntimeError()
  const source = readTrustedFile(sourcePath)
  if ("sha256:" + createHash("sha256").update(source).digest("hex") !== manifest.source.sha256) {
    throw new NativeProjectReadRuntimeError()
  }
  const bridgePath = resolve(PACKAGE_ROOT, manifest.bridge.path)
  if (!bridgePath.startsWith(PACKAGE_ROOT + sep)) throw new NativeProjectReadRuntimeError()
  const bridge = readTrustedFile(bridgePath)
  if ("sha256:" + createHash("sha256").update(bridge).digest("hex") !== manifest.bridge.sha256) {
    throw new NativeProjectReadRuntimeError()
  }
  const headerPath = resolve(PACKAGE_ROOT, manifest.header.path)
  if (!headerPath.startsWith(PACKAGE_ROOT + sep)) throw new NativeProjectReadRuntimeError()
  const header = readTrustedFile(headerPath)
  if ("sha256:" + createHash("sha256").update(header).digest("hex") !== manifest.header.sha256) {
    throw new NativeProjectReadRuntimeError()
  }
  const artifact = manifest.artifacts.find((candidate) => candidate.platform === process.platform && candidate.architecture === process.arch)
  if (artifact === undefined) throw new NativeProjectReadRuntimeError()
  const artifactPath = resolve(PACKAGE_ROOT, artifact.path)
  if (!artifactPath.startsWith(PACKAGE_ROOT + sep)) throw new NativeProjectReadRuntimeError()
  const opened = openTrustedFile(artifactPath)
  if ("sha256:" + createHash("sha256").update(opened.bytes).digest("hex") !== artifact.sha256) {
    closeSync(opened.descriptor)
    throw new NativeProjectReadRuntimeError()
  }
  return { ...artifact, descriptor: opened.descriptor, path: artifactPath }
}

function nativeRuntime(): NativeRuntime {
  if (loadedNativeRuntime !== undefined) return loadedNativeRuntime
  const artifact = nativeArtifact()
  try {
    const nativeModule: { exports: unknown } = { exports: {} }
    process.dlopen(nativeModule, nativeAddonDescriptorPath(artifact.descriptor))
    const run = parseNativeAddonRun(nativeModule.exports)
    loadedNativeRuntime = {
      architecture: artifact.architecture,
      platform: artifact.platform,
      run,
      sha256: artifact.sha256,
    }
    return loadedNativeRuntime
  } catch (error) {
    if (error instanceof NativeProjectReadRuntimeError) throw error
    throw new NativeProjectReadRuntimeError()
  } finally {
    closeSync(artifact.descriptor)
  }
}

function nativeAddonDescriptorPath(descriptor: number): string {
  if (process.platform === "darwin") return `/dev/fd/${descriptor}`
  if (process.platform === "linux") return `/proc/self/fd/${descriptor}`
  throw new NativeProjectReadRuntimeError()
}

function readTrustedFile(path: string): Buffer {
  const opened = openTrustedFile(path)
  try {
    return opened.bytes
  } finally {
    closeSync(opened.descriptor)
  }
}

function openTrustedFile(path: string): { readonly bytes: Buffer; readonly descriptor: number } {
  let descriptor: number | undefined
  try {
    const before = lstatSync(path, { bigint: true })
    if (!before.isFile() || before.isSymbolicLink()) throw new NativeProjectReadRuntimeError()
    descriptor = openSync(path, constants.O_RDONLY | noFollowFileFlag())
    const opened = fstatSync(descriptor, { bigint: true })
    const bytes = readFileSync(descriptor)
    const afterRead = fstatSync(descriptor, { bigint: true })
    const afterPath = lstatSync(path, { bigint: true })
    if (
      !opened.isFile()
      || !sameTrustedFileIdentity(before, opened)
      || !sameTrustedFileIdentity(opened, afterRead)
      || !sameTrustedFileIdentity(afterRead, afterPath)
    ) {
      throw new NativeProjectReadRuntimeError()
    }
    return { bytes, descriptor }
  } catch (error) {
    if (descriptor !== undefined) closeSync(descriptor)
    if (error instanceof NativeProjectReadRuntimeError) throw error
    throw new NativeProjectReadRuntimeError()
  }
}

function sameTrustedFileIdentity(left: BigIntStats, right: BigIntStats): boolean {
  return left.dev === right.dev
    && left.ino === right.ino
    && left.mode === right.mode
    && left.size === right.size
    && left.mtimeNs === right.mtimeNs
    && left.ctimeNs === right.ctimeNs
}

function parseManifest(bytes: Buffer): NativeManifest {
  try {
    const parsed: unknown = JSON.parse(bytes.toString("utf8"))
    if (!isRecord(parsed) || parsed["schemaVersion"] !== "persona-harness-native-project-read.1" || !Array.isArray(parsed["artifacts"])) {
      throw new NativeProjectReadRuntimeError()
    }
    const source = parseNativeSource(parsed["source"])
    const bridge = parseNativeBridge(parsed["bridge"])
    const header = parseNativeHeader(parsed["header"])
    if (source === undefined || bridge === undefined || header === undefined) {
      throw new NativeProjectReadRuntimeError()
    }
    const artifacts: NativeArtifactRecord[] = []
    for (const candidate of parsed["artifacts"]) {
      const artifact = parseArtifact(candidate)
      if (artifact === undefined) throw new NativeProjectReadRuntimeError()
      artifacts.push(artifact)
    }
    const labels = new Set(artifacts.map((artifact) => artifact.platform + "-" + artifact.architecture))
    if (artifacts.length !== 4 || labels.size !== artifacts.length) throw new NativeProjectReadRuntimeError()
    return { artifacts, bridge, header, schemaVersion: "persona-harness-native-project-read.1", source }
  } catch (error) {
    if (error instanceof NativeProjectReadRuntimeError) throw error
    throw new NativeProjectReadRuntimeError()
  }
}

function parseNativeAddonRun(value: unknown): NativeAddonRun {
  if (!isRecord(value)) throw new NativeProjectReadRuntimeError()
  const run = value["run"]
  if (typeof run !== "function") throw new NativeProjectReadRuntimeError()
  return (
    args,
    input,
    environment,
    maxBuffer,
    timeoutMs,
    rootDescriptor,
    parentDescriptor,
  ) => {
    const result: unknown = Reflect.apply(run, value, [
      args,
      input,
      environment,
      maxBuffer,
      timeoutMs,
      rootDescriptor,
      parentDescriptor,
    ])
    if (!Buffer.isBuffer(result)) throw new NativeProjectReadRuntimeError()
    return result
  }
}

function parseNativeBridge(value: unknown): NativeManifest["bridge"] | undefined {
  if (!isRecord(value)) return undefined
  const path = value["path"]
  const sha256 = value["sha256"]
  if (
    path !== "native/project-read/ph_native_project_read_addon.c"
    || typeof sha256 !== "string"
    || !/^sha256:[a-f0-9]{64}$/u.test(sha256)
  ) {
    return undefined
  }
  return { path, sha256 }
}

function parseNativeHeader(value: unknown): NativeManifest["header"] | undefined {
  if (!isRecord(value)) return undefined
  const path = value["path"]
  const sha256 = value["sha256"]
  if (
    path !== "native/project-read/ph_native_project_read.h"
    || typeof sha256 !== "string"
    || !/^sha256:[a-f0-9]{64}$/u.test(sha256)
  ) {
    return undefined
  }
  return { path, sha256 }
}

function parseNativeSource(value: unknown): NativeManifest["source"] | undefined {
  if (!isRecord(value)) return undefined
  const path = value["path"]
  const sha256 = value["sha256"]
  if (
    path !== "native/project-read/ph_native_project_read.c"
    || typeof sha256 !== "string"
    || !/^sha256:[a-f0-9]{64}$/u.test(sha256)
  ) {
    return undefined
  }
  return { path, sha256 }
}

function parseArtifact(value: unknown): NativeArtifactRecord | undefined {
  if (!isRecord(value)) return undefined
  const platform = value["platform"]
  const architecture = value["architecture"]
  const path = value["path"]
  const sha256 = value["sha256"]
  if (
    (platform !== "darwin" && platform !== "linux")
    || (architecture !== "arm64" && architecture !== "x64")
    || typeof path !== "string"
    || !validArtifactPath(path, platform, architecture)
    || typeof sha256 !== "string"
    || !/^sha256:[a-f0-9]{64}$/u.test(sha256)
  ) {
    return undefined
  }
  return { architecture, path, platform, sha256 }
}

function validArtifactPath(
  value: string,
  platform: NativeArtifactRecord["platform"],
  architecture: NativeArtifactRecord["architecture"],
): boolean {
  return value === `native/project-read/bin/${platform}-${architecture}/ph-native-project-read.node`
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
