import { createHash } from "node:crypto"
import https from "node:https"
import {
  chmodSync,
  closeSync,
  constants,
  fstatSync,
  fsyncSync,
  lstatSync,
  mkdtempSync,
  openSync,
  readSync,
  renameSync,
  rmSync,
  unlinkSync,
  writeSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { extractOriginalArtifactMembers } from "./consumer-authority-artifact-archive.mjs"
import {
  canonicalExternalAttestationCommandPlan,
  renderExternalAttestationVerifyArguments,
} from "./consumer-authority-external-attestation-command-plan.mjs"
import {
  ExternalArtifactTransportPlanError,
  renderExternalArtifactTransportRequest,
} from "./consumer-authority-external-artifact-transport-plan.mjs"

const API_ORIGIN = "https://api.github.com"
const MAX_TIMEOUT_MS = 15_000
const REDIRECT_HOSTS = new Set([
  "pipelines.actions.githubusercontent.com",
  "results-receiver.actions.githubusercontent.com",
])

export class ExternalObserverArtifactError extends Error {
  constructor(code) {
    super(code)
    this.code = code
  }
}

export async function prepareExternalObserverArtifact(input, credential) {
  return prepareExternalObserverArtifactInternal(input, credential, {})
}

// Test-only hooks keep the shipped observer entrypoint free of caller-provided
// transport, output, and timeout controls.
export async function prepareExternalObserverArtifactForTest(input, credential, hooks) {
  return prepareExternalObserverArtifactInternal(input, credential, parseTestHooks(hooks))
}

async function prepareExternalObserverArtifactInternal(input, credential, options) {
  const preparedInput = parseInput(input)
  const token = parseCredential(credential)
  const timeoutMs = options.timeoutMs ?? MAX_TIMEOUT_MS
  const request = options.request ?? requestExternalArtifact
  const createPrivateRoot = options.createPrivateRoot ?? defaultPrivateRoot
  let reservation
  let rendered
  try {
    rendered = renderExternalArtifactTransportRequest(
      preparedInput.transportPlan,
      preparedInput.topology,
      preparedInput.artifact,
    )
    reservation = reservePrivateOutput(createPrivateRoot)
    const initial = await withinDeadline(
      request(rendered.url, { ...rendered.headers, Authorization: `Bearer ${token}` }, timeoutMs),
      timeoutMs,
    )
    const final = await resolveResponse(initial, request, rendered.headers, timeoutMs)
    const archive = await streamValidatedArchive(final, rendered.artifact, reservation, timeoutMs)
    const members = extractMembers(archive)
    writePromotedPrivateFile(reservation, "bundle.json", members.bundle)
    const verifyArguments = renderExternalAttestationVerifyArguments(
      preparedInput.attestationPlan,
      rendered.topology,
      { bundlePath: join(reservation.root.path, "bundle.json"), subjectPath: join(reservation.root.path, "original.zip") },
    )
    return createPreparedArtifact(reservation, verifyArguments)
  } catch (error) {
    if (reservation !== undefined) cleanupReservation(reservation)
    if (error instanceof ExternalObserverArtifactError) throw error
    if (error instanceof ExternalArtifactTransportPlanError) {
      throw new ExternalObserverArtifactError("external-artifact-transport-input")
    }
    throw new ExternalObserverArtifactError("external-artifact-transport-network")
  }
}

function parseTestHooks(value) {
  if (!isRecord(value) || !onlyKnownKeys(value, ["createPrivateRoot", "request", "timeoutMs"])) {
    throw new ExternalObserverArtifactError("external-artifact-transport-input")
  }
  if (typeof value.request !== "function" || (value.createPrivateRoot !== undefined && typeof value.createPrivateRoot !== "function")) {
    throw new ExternalObserverArtifactError("external-artifact-transport-input")
  }
  return {
    createPrivateRoot: value.createPrivateRoot ?? defaultPrivateRoot,
    request: value.request,
    timeoutMs: value.timeoutMs === undefined ? MAX_TIMEOUT_MS : parseTimeout(value.timeoutMs),
  }
}

function parseInput(value) {
  if (!isRecord(value) || !sameKeys(value, ["artifact", "attestationPlan", "topology", "transportPlan"])) {
    throw new ExternalObserverArtifactError("external-artifact-transport-input")
  }
  return value
}

function parseCredential(value) {
  if (typeof value !== "string" || !/^[A-Za-z0-9._-]{1,4096}$/u.test(value)) {
    throw new ExternalObserverArtifactError("external-artifact-transport-credential")
  }
  return value
}

function parseTimeout(value) {
  if (value === undefined) return MAX_TIMEOUT_MS
  if (!Number.isSafeInteger(value) || value <= 0 || value > MAX_TIMEOUT_MS) {
    throw new ExternalObserverArtifactError("external-artifact-transport-input")
  }
  return value
}

async function resolveResponse(initial, request, headers, timeoutMs) {
  const first = parseResponse(initial)
  if (first.statusCode !== 302) return first
  const redirect = parseRedirect(first.headers.location)
  discardResponseBody(first.body)
  const next = await withinDeadline(request(redirect, headers, timeoutMs), timeoutMs)
  const second = parseResponse(next)
  if (second.statusCode === 302) throw new ExternalObserverArtifactError("external-artifact-transport-redirect")
  return second
}

async function streamValidatedArchive(response, artifact, reservation, timeoutMs) {
  if (response.statusCode !== 200) throw new ExternalObserverArtifactError("external-artifact-transport-status")
  if (!allowedContentType(response.headers["content-type"])) {
    throw new ExternalObserverArtifactError("external-artifact-transport-content-type")
  }
  const contentLength = parseContentLength(response.headers["content-length"])
  if (contentLength !== artifact.expectedByteLength) {
    throw new ExternalObserverArtifactError("external-artifact-transport-byte-count")
  }
  const pending = reservePrivateFile(reservation, "original.zip.pending")
  const hash = createHash("sha256")
  let first = Buffer.alloc(0)
  let bytes = 0
  try {
    await withinDeadline((async () => {
      for await (const chunk of response.body) {
        if (!Buffer.isBuffer(chunk)) throw new ExternalObserverArtifactError("external-artifact-transport-response")
        bytes += chunk.byteLength
        if (bytes > artifact.expectedByteLength) throw new ExternalObserverArtifactError("external-artifact-transport-byte-count")
        if (first.byteLength < 4) first = Buffer.concat([first, chunk]).subarray(0, 4)
        hash.update(chunk)
        writeAll(pending.descriptor, chunk)
      }
    })(), timeoutMs)
    fsyncSync(pending.descriptor)
    assertReservedFile(reservation, pending)
    assertFileByteCount(pending.descriptor, bytes)
    refreshReservedFile(pending)
    if (bytes !== artifact.expectedByteLength) throw new ExternalObserverArtifactError("external-artifact-transport-byte-count")
    if (`sha256:${hash.digest("hex")}` !== artifact.expectedSha256) throw new ExternalObserverArtifactError("external-artifact-transport-digest")
    if (first.byteLength !== 4 || first.readUInt32LE(0) !== 0x04034b50) throw new ExternalObserverArtifactError("external-artifact-transport-archive")
    promotePrivateFile(reservation, pending, "original.zip")
    return readReservedFile(reservation, "original.zip")
  } catch (error) {
    closeQuietly(pending.descriptor)
    unlinkQuietly(reservation.root.path, pending.name)
    if (error instanceof ExternalObserverArtifactError) throw error
    throw new ExternalObserverArtifactError("external-artifact-transport-response")
  }
}

function extractMembers(archive) {
  try {
    return extractOriginalArtifactMembers(archive)
  } catch {
    throw new ExternalObserverArtifactError("external-artifact-transport-archive")
  }
}

function createPreparedArtifact(reservation, verifyArguments) {
  let closed = false
  const assertOpen = () => {
    if (closed) throw new ExternalObserverArtifactError("external-artifact-transport-output")
    assertReservation(reservation)
  }
  return {
    bundlePath: join(reservation.root.path, "bundle.json"),
    cleanup: () => {
      if (closed) return
      closed = true
      cleanupReservation(reservation)
    },
    outputRoot: reservation.root.path,
    publicResult: {
      artifactAccess: true,
      authorityEligible: false,
      code: "external-artifact-transport-validated",
      crypto: "not-run",
      state: "ready",
    },
    readBundle: () => {
      assertOpen()
      return readReservedFile(reservation, "bundle.json")
    },
    readSubject: () => {
      assertOpen()
      return readReservedFile(reservation, "original.zip")
    },
    subjectPath: join(reservation.root.path, "original.zip"),
    verifyArguments,
  }
}

function reservePrivateOutput(createPrivateRoot) {
  const rootPath = createPrivateRoot()
  const root = capturePrivateDirectory(rootPath)
  return { closed: false, root }
}

function defaultPrivateRoot() {
  const root = mkdtempSync(join(tmpdir(), "persona-external-observer-artifact-"))
  chmodSync(root, 0o700)
  return root
}

function capturePrivateDirectory(path) {
  try {
    if (typeof path !== "string" || path.length === 0) throw new ExternalObserverArtifactError("external-artifact-transport-output")
    const stat = lstatSync(path, { bigint: true })
    if (!stat.isDirectory() || stat.isSymbolicLink()) throw new ExternalObserverArtifactError("external-artifact-transport-output")
    return { identity: location(stat), path }
  } catch (error) {
    if (error instanceof ExternalObserverArtifactError) throw error
    throw new ExternalObserverArtifactError("external-artifact-transport-output")
  }
}

function reservePrivateFile(reservation, name) {
  assertReservation(reservation)
  const path = join(reservation.root.path, name)
  let descriptor
  try {
    descriptor = openSync(path, constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW | constants.O_WRONLY, 0o600)
    const stat = fstatSync(descriptor, { bigint: true })
    const current = lstatSync(path, { bigint: true })
    if (!stat.isFile() || stat.size !== 0n || current.isSymbolicLink() || !sameIdentity(stat, current)) {
      throw new ExternalObserverArtifactError("external-artifact-transport-output")
    }
    return { descriptor, identity: identity(stat), name }
  } catch (error) {
    if (descriptor !== undefined) closeQuietly(descriptor)
    if (error instanceof ExternalObserverArtifactError) throw error
    throw new ExternalObserverArtifactError("external-artifact-transport-output")
  }
}

function writePromotedPrivateFile(reservation, name, bytes) {
  const pending = reservePrivateFile(reservation, `${name}.pending`)
  try {
    writeAll(pending.descriptor, bytes)
    fsyncSync(pending.descriptor)
    assertReservedFile(reservation, pending)
    assertFileByteCount(pending.descriptor, bytes.byteLength)
    refreshReservedFile(pending)
    promotePrivateFile(reservation, pending, name)
  } catch (error) {
    closeQuietly(pending.descriptor)
    unlinkQuietly(reservation.root.path, pending.name)
    if (error instanceof ExternalObserverArtifactError) throw error
    throw new ExternalObserverArtifactError("external-artifact-transport-output")
  }
}

function promotePrivateFile(reservation, pending, finalName) {
  assertReservedFile(reservation, pending)
  closeQuietly(pending.descriptor)
  const source = join(reservation.root.path, pending.name)
  const target = join(reservation.root.path, finalName)
  try {
    assertReservation(reservation)
    assertLeafAbsent(target)
    renameSync(source, target)
    const current = lstatSync(target, { bigint: true })
    if (!current.isFile() || current.isSymbolicLink() || !sameLocation(pending.identity, current)) {
      throw new ExternalObserverArtifactError("external-artifact-transport-output")
    }
    assertReservation(reservation)
  } catch (error) {
    if (error instanceof ExternalObserverArtifactError) throw error
    throw new ExternalObserverArtifactError("external-artifact-transport-output")
  }
}

function readReservedFile(reservation, name) {
  assertReservation(reservation)
  const path = join(reservation.root.path, name)
  let descriptor
  try {
    descriptor = openSync(path, constants.O_NOFOLLOW | constants.O_RDONLY)
    const opened = fstatSync(descriptor, { bigint: true })
    const current = lstatSync(path, { bigint: true })
    if (!opened.isFile() || !current.isFile() || current.isSymbolicLink() || current.size <= 0n || !sameIdentity(opened, current)) {
      throw new ExternalObserverArtifactError("external-artifact-transport-output")
    }
    const size = Number(opened.size)
    if (!Number.isSafeInteger(size) || size <= 0) throw new ExternalObserverArtifactError("external-artifact-transport-output")
    const bytes = Buffer.alloc(size)
    let offset = 0
    while (offset < bytes.byteLength) {
      const read = readSync(descriptor, bytes, offset, bytes.byteLength - offset, offset)
      if (!Number.isSafeInteger(read) || read <= 0) throw new ExternalObserverArtifactError("external-artifact-transport-output")
      offset += read
    }
    assertReservation(reservation)
    const after = lstatSync(path, { bigint: true })
    if (!after.isFile() || after.isSymbolicLink() || !sameIdentity(opened, after)) {
      throw new ExternalObserverArtifactError("external-artifact-transport-output")
    }
    return bytes
  } catch (error) {
    if (error instanceof ExternalObserverArtifactError) throw error
    throw new ExternalObserverArtifactError("external-artifact-transport-output")
  } finally {
    if (descriptor !== undefined) closeQuietly(descriptor)
  }
}

function assertReservedFile(reservation, file) {
  assertReservation(reservation)
  const descriptor = fstatSync(file.descriptor, { bigint: true })
  const current = lstatSync(join(reservation.root.path, file.name), { bigint: true })
  if (!descriptor.isFile() || !current.isFile() || current.isSymbolicLink() || !sameLocation(file.identity, descriptor) || !sameLocation(descriptor, current)) {
    throw new ExternalObserverArtifactError("external-artifact-transport-output")
  }
}

function refreshReservedFile(file) {
  file.identity = identity(fstatSync(file.descriptor, { bigint: true }))
}

function assertFileByteCount(descriptor, expected) {
  const stat = fstatSync(descriptor, { bigint: true })
  if (!stat.isFile() || stat.size !== BigInt(expected)) {
    throw new ExternalObserverArtifactError("external-artifact-transport-output")
  }
}

function assertLeafAbsent(path) {
  try {
    lstatSync(path, { bigint: true })
  } catch (error) {
    if (error !== null && typeof error === "object" && "code" in error && error.code === "ENOENT") return
    throw new ExternalObserverArtifactError("external-artifact-transport-output")
  }
  throw new ExternalObserverArtifactError("external-artifact-transport-output")
}

function assertReservation(reservation) {
  if (!isRecord(reservation) || reservation.closed || !isRecord(reservation.root)) {
    throw new ExternalObserverArtifactError("external-artifact-transport-output")
  }
  const current = lstatSync(reservation.root.path, { bigint: true })
  if (!current.isDirectory() || current.isSymbolicLink() || !sameLocation(reservation.root.identity, current)) {
    throw new ExternalObserverArtifactError("external-artifact-transport-output")
  }
}

function cleanupReservation(reservation) {
  if (!isRecord(reservation) || reservation.closed) return
  reservation.closed = true
  try {
    assertReservation({ ...reservation, closed: false })
    rmSync(reservation.root.path, { force: true, recursive: true })
  } catch {
    // An untrusted replacement must never be followed during cleanup.
  }
}

function parseResponse(value) {
  if (!isRecord(value) || !isRecord(value.headers) || !isAsyncIterable(value.body) || !Number.isSafeInteger(value.statusCode)) {
    throw new ExternalObserverArtifactError("external-artifact-transport-response")
  }
  return {
    body: value.body,
    headers: normalizedHeaders(value.headers),
    statusCode: value.statusCode,
  }
}

function parseRedirect(value) {
  try {
    if (typeof value !== "string" || value.length === 0 || value.length > 4096) throw new Error("redirect")
    const authority = /^https:\/\/([^/?#]+)/iu.exec(value)?.[1]
    if (authority === undefined || authority.includes("@") || authority.includes(":")) throw new Error("redirect")
    const url = new URL(value)
    if (
      url.protocol !== "https:"
      || url.port !== ""
      || url.username !== ""
      || url.password !== ""
      || !isRedirectHost(url.hostname)
      || authority !== url.hostname
    ) throw new Error("redirect")
    return url
  } catch {
    throw new ExternalObserverArtifactError("external-artifact-transport-redirect")
  }
}

function allowedContentType(value) {
  if (typeof value !== "string") return false
  const normalized = value.split(";", 1)[0]?.trim().toLowerCase()
  return normalized === "application/octet-stream" || normalized === "application/zip"
}

function parseContentLength(value) {
  if (typeof value !== "string" || !/^[1-9][0-9]{0,7}$/u.test(value)) return undefined
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) ? parsed : undefined
}

function isRedirectHost(hostname) {
  if (REDIRECT_HOSTS.has(hostname)) return true
  const labels = hostname.split(".")
  return labels.length === 5
    && /^[a-z0-9-]{1,63}$/u.test(labels[0] ?? "")
    && labels.slice(1).join(".") === "blob.core.windows.net"
}

function normalizedHeaders(value) {
  const headers = {}
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry !== "string") throw new ExternalObserverArtifactError("external-artifact-transport-response")
    headers[key.toLowerCase()] = entry
  }
  return headers
}

function requestExternalArtifact(url, headers, timeoutMs) {
  return new Promise((resolve, reject) => {
    if (!(url instanceof URL) || url.protocol !== "https:" || url.port !== "" || url.username !== "" || url.password !== "") {
      reject(new ExternalObserverArtifactError("external-artifact-transport-network"))
      return
    }
    if (url.origin !== API_ORIGIN && !isRedirectHost(url.hostname)) {
      reject(new ExternalObserverArtifactError("external-artifact-transport-network"))
      return
    }
    const request = https.get(url, { headers, timeout: timeoutMs }, (response) => {
      resolve({ body: response, headers: responseHeaders(response.headers), statusCode: response.statusCode ?? 0 })
    })
    request.on("timeout", () => request.destroy(new ExternalObserverArtifactError("external-artifact-transport-timeout")))
    request.on("error", () => reject(new ExternalObserverArtifactError("external-artifact-transport-network")))
  })
}

function responseHeaders(value) {
  const headers = {}
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === "string") headers[key] = entry
    else if (Array.isArray(entry) && entry.length === 1 && typeof entry[0] === "string") headers[key] = entry[0]
  }
  return headers
}

function withinDeadline(promise, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new ExternalObserverArtifactError("external-artifact-transport-timeout")), timeoutMs)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error) => {
        clearTimeout(timer)
        reject(error)
      },
    )
  })
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

function location(stat) {
  return { dev: stat.dev.toString(), ino: stat.ino.toString(), mode: stat.mode.toString() }
}

function sameIdentity(left, right) {
  const expected = typeof left.dev === "bigint" ? identity(left) : left
  const current = typeof right.dev === "bigint" ? identity(right) : right
  return expected.ctimeNs === current.ctimeNs
    && expected.dev === current.dev
    && expected.ino === current.ino
    && expected.mode === current.mode
    && expected.mtimeNs === current.mtimeNs
    && expected.size === current.size
}

function sameLocation(left, right) {
  const expected = typeof left.dev === "bigint" ? location(left) : left
  const current = typeof right.dev === "bigint" ? location(right) : right
  return expected.dev === current.dev && expected.ino === current.ino && expected.mode === current.mode
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function sameKeys(value, expected) {
  const actual = Object.keys(value).sort()
  const sortedExpected = [...expected].sort()
  return actual.length === sortedExpected.length && actual.every((key, index) => key === sortedExpected[index])
}

function onlyKnownKeys(value, expected) {
  const allowed = new Set(expected)
  return Object.keys(value).every((key) => allowed.has(key))
}

function isAsyncIterable(value) {
  return value !== null && typeof value === "object" && Symbol.asyncIterator in value
}

function discardResponseBody(body) {
  if (body !== null && typeof body === "object" && typeof body.resume === "function") body.resume()
}

function closeQuietly(descriptor) {
  try {
    closeSync(descriptor)
  } catch {
    // A blocked observer output never relies on descriptor cleanup for authority.
  }
}

function writeAll(descriptor, bytes) {
  let offset = 0
  while (offset < bytes.byteLength) {
    const written = writeSync(descriptor, bytes, offset, bytes.byteLength - offset)
    if (!Number.isSafeInteger(written) || written <= 0) {
      throw new ExternalObserverArtifactError("external-artifact-transport-output")
    }
    offset += written
  }
}

function unlinkQuietly(root, name) {
  try {
    const current = lstatSync(root, { bigint: true })
    if (!current.isDirectory() || current.isSymbolicLink()) return
    unlinkSync(join(root, name))
  } catch {
    // A missing or replaced temporary leaf remains non-authoritative.
  }
}
