import { spawnSync } from "node:child_process"
import { createHash } from "node:crypto"
import { lstatSync, readFileSync } from "node:fs"
import { resolve, sep } from "node:path"
import process from "node:process"
import { fileURLToPath } from "node:url"

import { isRecord } from "../config/jsonc.js"
import {
  NativeProjectReadProtocolError,
  parseNativeDirectoryResponse,
  parseNativeReadResponse,
  parseNativeTreeResponse,
  type NativeProjectReadIdentity,
  type NativeProjectReadTreeEntry,
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

export type NativeProjectReadFileResult =
  | { readonly kind: "absent" }
  | {
      readonly kind: "ready"
      readonly value: {
        readonly bytes: Buffer
        readonly identity: NativeProjectReadIdentity
      }
    }

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

export function readNativeProjectFile(relativePath: string, maxBytes: number, projectDir = process.cwd()): Buffer {
  assertProjectCapability(projectDir)
  assertReadLimit(maxBytes)
  try {
    return parseNativeReadResponse(runNative(["read", relativePath, String(maxBytes)], maxBytes + 128)).bytes
  } catch (error) {
    throw nativeError(error)
  }
}

export function readNativeProjectFileWithIdentity(
  relativePath: string,
  maxBytes: number,
  projectDir = process.cwd(),
): { readonly bytes: Buffer; readonly identity: NativeProjectReadIdentity } {
  const result = readNativeProjectFileWithIdentityResult(relativePath, maxBytes, projectDir)
  if (result.kind === "absent") throw new NativeProjectReadRuntimeError()
  return result.value
}

export function readNativeProjectFileWithIdentityResult(
  relativePath: string,
  maxBytes: number,
  projectDir = process.cwd(),
): NativeProjectReadFileResult {
  assertProjectCapability(projectDir)
  assertReadLimit(maxBytes)
  try {
    return {
      kind: "ready",
      value: parseNativeReadResponse(runNative(["read", relativePath, String(maxBytes)], maxBytes + 128)),
    }
  } catch (error) {
    if (error instanceof NativeProjectReadProtocolError && error.code === "absent") return { kind: "absent" }
    throw nativeError(error)
  }
}

export function readNativeProjectDirectoryIdentity(
  relativePath: string,
  projectDir = process.cwd(),
): NativeProjectReadIdentity | undefined {
  assertProjectCapability(projectDir)
  try {
    return parseNativeDirectoryResponse(runNative(["directory", relativePath], 128))
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
): readonly NativeProjectReadTreeEntry[] {
  assertProjectCapability(projectDir)
  assertReadLimit(options.maxFileBytes)
  assertReadLimit(options.maxTotalBytes)
  if (!Number.isSafeInteger(options.maxEntries) || options.maxEntries <= 0) throw new NativeProjectReadRuntimeError()
  const outputLimit = options.maxTotalBytes + NATIVE_PROTOCOL_OVERHEAD_BYTES
  if (!Number.isSafeInteger(outputLimit) || outputLimit <= options.maxTotalBytes) throw new NativeProjectReadRuntimeError()
  try {
    return parseNativeTreeResponse(runNative([
      "tree",
      String(options.maxEntries),
      String(options.maxFileBytes),
      String(options.maxTotalBytes),
      ...options.excludedRoots,
    ], outputLimit))
  } catch (error) {
    throw nativeError(error)
  }
}

function assertProjectCapability(projectDir: string): void {
  if (resolve(projectDir) !== resolve(process.cwd())) throw new NativeProjectReadRuntimeError()
}

function assertReadLimit(value: number): void {
  if (!Number.isSafeInteger(value) || value <= 0 || value > 64 * 1024 * 1024) {
    throw new NativeProjectReadRuntimeError()
  }
}

function runNative(args: readonly string[], maxBuffer: number): Buffer {
  const artifact = nativeArtifact()
  const result = spawnSync(artifact.path, args, {
    encoding: "buffer",
    env: {},
    maxBuffer,
    shell: false,
    stdio: ["ignore", "pipe", "ignore"],
    timeout: NATIVE_RUNTIME_TIMEOUT_MS,
  })
  if (result.error !== undefined || result.status !== 0 || !Buffer.isBuffer(result.stdout)) {
    throw new NativeProjectReadRuntimeError()
  }
  return result.stdout
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

function nativeError(error: unknown): NativeProjectReadRuntimeError | NativeProjectReadLimitError {
  if (error instanceof NativeProjectReadProtocolError && error.code === "limit") return new NativeProjectReadLimitError()
  return new NativeProjectReadRuntimeError()
}
