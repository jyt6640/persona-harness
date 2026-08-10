import { createHash } from "node:crypto"
import { TextDecoder } from "node:util"
import { gunzipSync, gzipSync } from "node:zlib"

export const PACKAGE_CONTENT_IDENTITY_SCHEMA_VERSION = "package-content-identity.1"
export const MAX_PACKAGE_CONTENT_TARBALL_BYTES = 20 * 1024 * 1024
export const PACKAGE_CONTENT_MAX_MEMBER_BYTES = 8 * 1024 * 1024
export const PACKAGE_CONTENT_MAX_MANIFEST_BYTES = 64 * 1024

const MAX_UNPACKED_BYTES = 64 * 1024 * 1024
const TAR_BLOCK_BYTES = 512
const PACKAGE_PREFIX = "package/"
const SHA256 = /^[0-9a-f]{64}$/u
const ALLOWED_MODES = new Set([0o600, 0o644, 0o700, 0o755])
const CANONICAL_MODES = Object.freeze({ executable: 0o755, regular: 0o644 })
const UTF8 = new TextDecoder("utf-8", { fatal: true })

export class PackageContentIdentityError extends Error {
  constructor(code) {
    super(code)
    this.code = code
    this.name = "PackageContentIdentityError"
  }
}

export function readPackageContentIdentity(bytes) {
  return readPackageTarball(bytes).identity
}

export function assertWindowsPackageInstallSurface(bytes) {
  readPackageTarball(bytes)
}

export function readPackageTarball(bytes) {
  const members = readMembers(bytes)
  const manifest = readManifest(members)
  assertWindowsInstallSurface(members, manifest)
  return {
    identity: createIdentity(members),
    manifest: manifest.identity,
  }
}

export function canonicalizePackageTarball(bytes) {
  const members = readMembers(bytes)
  const manifest = readManifest(members)
  assertWindowsInstallSurface(members, manifest)
  const canonicalMembers = members
    .map((member) => ({
      ...member,
      mode: manifest.executablePaths.has(member.path.slice(PACKAGE_PREFIX.length))
        ? CANONICAL_MODES.executable
        : CANONICAL_MODES.regular,
    }))
    .sort(compareMembers)
  const archive = writeCanonicalArchive(canonicalMembers)
  const compressed = Buffer.from(gzipSync(archive, { level: 9, mtime: 0 }))
  if (compressed.byteLength < 10) fail("package-content-identity-archive")
  compressed[3] = 0
  compressed.fill(0, 4, 8)
  compressed[9] = 255
  return {
    bytes: compressed,
    identity: createIdentity(canonicalMembers),
    manifest: manifest.identity,
  }
}

export function classifyPackageContentIdentity(expected, observed) {
  const left = parseIdentity(expected)
  const right = parseIdentity(observed)
  const mismatches = []
  if (left.entryCount !== right.entryCount) mismatches.push("entry-count")
  const sameContent = left.contentSha256 === right.contentSha256
  const sameModes = sameModeCounts(left.modeCounts, right.modeCounts)
  if (!sameContent) mismatches.push("content")
  if (!sameModes) mismatches.push("mode")
  if (mismatches.length === 0 && left.identitySha256 === right.identitySha256) return "match"
  if (mismatches.length === 0) return "structure-mismatch"
  return `${mismatches.join("-and-")}-mismatch`
}

export function assertPackageContentIdentity(value) {
  return parseIdentity(value)
}

function readMembers(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.byteLength === 0 || bytes.byteLength > MAX_PACKAGE_CONTENT_TARBALL_BYTES) {
    fail("package-content-identity-bounds")
  }
  let archive
  try {
    archive = gunzipSync(bytes, { maxOutputLength: MAX_UNPACKED_BYTES })
  } catch {
    fail("package-content-identity-archive")
  }
  const members = []
  const paths = new Set()
  let offset = 0
  let totalBytes = 0
  let terminated = false
  while (offset + TAR_BLOCK_BYTES <= archive.byteLength) {
    const header = archive.subarray(offset, offset + TAR_BLOCK_BYTES)
    if (isZeroBlock(header)) {
      if (archive.byteLength - offset < TAR_BLOCK_BYTES * 2 || !archive.subarray(offset).every((byte) => byte === 0)) {
        fail("package-content-identity-archive")
      }
      terminated = true
      break
    }
    verifyChecksum(header)
    if (!isUstarHeader(header) || !isRegularType(header[156] ?? 0)) fail("package-content-identity-archive")
    if (readText(header.subarray(157, 257)) !== "") fail("package-content-identity-archive")
    const path = readMemberPath(header)
    const mode = readOctal(header.subarray(100, 108))
    const size = readOctal(header.subarray(124, 136))
    readOctal(header.subarray(108, 116))
    readOctal(header.subarray(116, 124))
    readOctal(header.subarray(136, 148))
    if (!ALLOWED_MODES.has(mode) || size > PACKAGE_CONTENT_MAX_MEMBER_BYTES) {
      fail(size > PACKAGE_CONTENT_MAX_MEMBER_BYTES ? "package-content-identity-bounds" : "package-content-identity-archive")
    }
    const bodyStart = offset + TAR_BLOCK_BYTES
    const bodyEnd = bodyStart + size
    const nextOffset = bodyStart + Math.ceil(size / TAR_BLOCK_BYTES) * TAR_BLOCK_BYTES
    if (bodyEnd > archive.byteLength || nextOffset > archive.byteLength || paths.has(path)) fail("package-content-identity-archive")
    totalBytes += size
    if (totalBytes > MAX_UNPACKED_BYTES) fail("package-content-identity-bounds")
    paths.add(path)
    members.push({ body: Buffer.from(archive.subarray(bodyStart, bodyEnd)), mode, path, size })
    offset = nextOffset
  }
  if (!terminated || members.length === 0) fail("package-content-identity-archive")
  return members
}

function readManifest(members) {
  const manifestMember = members.find((member) => member.path === "package/package.json")
  if (manifestMember === undefined || manifestMember.size === 0 || manifestMember.size > PACKAGE_CONTENT_MAX_MANIFEST_BYTES) {
    fail("package-content-identity-manifest")
  }
  let manifest
  try {
    manifest = JSON.parse(UTF8.decode(manifestMember.body))
  } catch {
    fail("package-content-identity-manifest")
  }
  if (!isRecord(manifest) || typeof manifest.name !== "string" || typeof manifest.version !== "string") {
    fail("package-content-identity-manifest")
  }
  const memberPaths = new Set(members.map((member) => member.path.slice(PACKAGE_PREFIX.length)))
  const executablePaths = readExecutablePaths(manifest.bin, memberPaths)
  return {
    bin: manifest.bin,
    executablePaths,
    identity: { name: manifest.name, version: manifest.version },
  }
}

function assertWindowsInstallSurface(members, manifest) {
  const canonicalPaths = new Set()
  for (const member of members) {
    const path = canonicalWindowsPath(member.path.slice(PACKAGE_PREFIX.length))
    if (canonicalPaths.has(path)) fail("package-content-identity-windows-surface")
    canonicalPaths.add(path)
  }

  for (const path of canonicalPaths) {
    const segments = path.split("/")
    for (let index = 1; index < segments.length; index += 1) {
      if (canonicalPaths.has(segments.slice(0, index).join("/"))) {
        fail("package-content-identity-windows-surface")
      }
    }
  }

  const binNames = readBinNames(manifest.bin, manifest.identity.name)
  const shimNames = new Set()
  for (const name of binNames) {
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/u.test(name) || /\.(?:bat|cmd|exe|ps1)$/iu.test(name)) {
      fail("package-content-identity-windows-surface")
    }
    for (const shimName of [name, `${name}.cmd`, `${name}.ps1`]) {
      const canonicalName = canonicalWindowsSegment(shimName)
      if (shimNames.has(canonicalName)) fail("package-content-identity-windows-surface")
      shimNames.add(canonicalName)
    }
  }
}

function readBinNames(value, packageName) {
  if (value === undefined) return []
  if (typeof value === "string") {
    if (typeof packageName !== "string") fail("package-content-identity-windows-surface")
    const name = packageName.startsWith("@") ? packageName.slice(packageName.indexOf("/") + 1) : packageName
    if (name.length === 0 || name.includes("/")) fail("package-content-identity-windows-surface")
    return [name]
  }
  if (!isRecord(value)) fail("package-content-identity-windows-surface")
  const names = Object.keys(value)
  if (names.length === 0) fail("package-content-identity-windows-surface")
  return names
}

function canonicalWindowsPath(path) {
  return path.split("/").map(canonicalWindowsSegment).join("/")
}

function canonicalWindowsSegment(segment) {
  if (
    typeof segment !== "string"
    || segment.length === 0
    || segment.length > 255
    || /[<>:"\\\\|?*\u0000-\u001f]/u.test(segment)
  ) {
    fail("package-content-identity-windows-surface")
  }
  const trimmed = segment.replace(/[. ]+$/u, "")
  if (trimmed.length === 0 || /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/iu.test(trimmed)) {
    fail("package-content-identity-windows-surface")
  }
  return trimmed.normalize("NFC").toLowerCase()
}

function readExecutablePaths(value, memberPaths) {
  if (value === undefined) return new Set()
  const candidates = typeof value === "string"
    ? [value]
    : isRecord(value)
      ? Object.values(value)
      : undefined
  if (candidates === undefined || candidates.length === 0 || candidates.some((candidate) => typeof candidate !== "string" || !isSafePackagePath(candidate))) {
    fail("package-content-identity-manifest")
  }
  const executablePaths = new Set(candidates)
  if ([...executablePaths].some((candidate) => !memberPaths.has(candidate))) fail("package-content-identity-manifest")
  return executablePaths
}

function createIdentity(members) {
  const normalized = [...members]
    .sort(compareMembers)
    .map((member) => ({
      mode: formatMode(member.mode),
      path: member.path.slice(PACKAGE_PREFIX.length),
      sha256: sha256(member.body),
      size: member.size,
      type: "regular",
    }))
  const counts = new Map()
  for (const member of normalized) counts.set(member.mode, (counts.get(member.mode) ?? 0) + 1)
  const modeCounts = Object.fromEntries(
    [...counts.entries()]
      .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0),
  )
  return {
    contentSha256: digestProjection(normalized.map((member) => [member.path, member.size, member.sha256])),
    entryCount: normalized.length,
    identitySha256: digestProjection(normalized.map((member) => [member.path, member.type, member.mode, member.size, member.sha256])),
    modeCounts,
    schemaVersion: PACKAGE_CONTENT_IDENTITY_SCHEMA_VERSION,
  }
}

function parseIdentity(value) {
  if (!isRecord(value) || !hasExactKeys(value, ["contentSha256", "entryCount", "identitySha256", "modeCounts", "schemaVersion"]) || value.schemaVersion !== PACKAGE_CONTENT_IDENTITY_SCHEMA_VERSION) {
    fail("package-content-identity-shape")
  }
  if (!Number.isSafeInteger(value.entryCount) || value.entryCount < 1 || !isSha256(value.contentSha256) || !isSha256(value.identitySha256)) {
    fail("package-content-identity-shape")
  }
  if (!isRecord(value.modeCounts)) fail("package-content-identity-shape")
  const entries = Object.entries(value.modeCounts)
  if (entries.length === 0 || entries.some(([mode, count]) => !["0600", "0644", "0700", "0755"].includes(mode) || !Number.isSafeInteger(count) || count < 1)) {
    fail("package-content-identity-shape")
  }
  if (entries.reduce((total, [, count]) => total + count, 0) !== value.entryCount) fail("package-content-identity-shape")
  return value
}

function sameModeCounts(left, right) {
  const leftEntries = Object.entries(left).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
  const rightEntries = Object.entries(right).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
  return leftEntries.length === rightEntries.length && leftEntries.every(([mode, count], index) => rightEntries[index]?.[0] === mode && rightEntries[index]?.[1] === count)
}

function readMemberPath(header) {
  const name = readText(header.subarray(0, 100))
  const prefix = readText(header.subarray(345, 500))
  const path = prefix === "" ? name : `${prefix}/${name}`
  if (!path.startsWith(PACKAGE_PREFIX) || !isSafePackagePath(path.slice(PACKAGE_PREFIX.length))) fail("package-content-identity-archive")
  return path
}

function writeCanonicalArchive(members) {
  const blocks = []
  for (const member of members) {
    const header = Buffer.alloc(TAR_BLOCK_BYTES)
    writeMemberPath(header, member.path)
    writeOctal(header, 100, 8, member.mode)
    writeOctal(header, 108, 8, 0)
    writeOctal(header, 116, 8, 0)
    writeOctal(header, 124, 12, member.size)
    writeOctal(header, 136, 12, 0)
    header.fill(0x20, 148, 156)
    header[156] = 0
    header.write("ustar\0", 257, "ascii")
    header.write("00", 263, "ascii")
    writeOctal(header, 329, 8, 0)
    writeOctal(header, 337, 8, 0)
    let checksum = 0
    for (const byte of header) checksum += byte
    writeOctal(header, 148, 8, checksum)
    blocks.push(header, member.body)
    const padding = (TAR_BLOCK_BYTES - (member.size % TAR_BLOCK_BYTES)) % TAR_BLOCK_BYTES
    if (padding > 0) blocks.push(Buffer.alloc(padding))
  }
  blocks.push(Buffer.alloc(TAR_BLOCK_BYTES * 2))
  const archive = Buffer.concat(blocks)
  if (archive.byteLength > MAX_UNPACKED_BYTES) fail("package-content-identity-bounds")
  return archive
}

function writeMemberPath(header, path) {
  const bytes = Buffer.from(path, "utf8")
  if (bytes.byteLength <= 100) {
    bytes.copy(header, 0)
    return
  }
  let split = path.lastIndexOf("/")
  while (split > 0) {
    const prefix = Buffer.from(path.slice(0, split), "utf8")
    const name = Buffer.from(path.slice(split + 1), "utf8")
    if (prefix.byteLength <= 155 && name.byteLength <= 100) {
      name.copy(header, 0)
      prefix.copy(header, 345)
      return
    }
    split = path.lastIndexOf("/", split - 1)
  }
  fail("package-content-identity-archive")
}

function writeOctal(header, offset, length, value) {
  const text = value.toString(8)
  if (!Number.isSafeInteger(value) || value < 0 || text.length > length - 1) fail("package-content-identity-archive")
  header.write(`${text.padStart(length - 1, "0")}\0`, offset, "ascii")
}

function isSafePackagePath(path) {
  return path.length > 0
    && path.length <= 4096
    && !path.includes("\\")
    && !path.split("/").some((part) => part === "" || part === "." || part === ".." || /[\u0000-\u001f\u007f]/u.test(part))
}

function readText(bytes) {
  const end = bytes.indexOf(0)
  const data = bytes.subarray(0, end === -1 ? bytes.byteLength : end)
  if (!bytes.subarray(data.byteLength).every((byte) => byte === 0)) fail("package-content-identity-archive")
  try {
    return UTF8.decode(data)
  } catch {
    fail("package-content-identity-archive")
  }
}

function readOctal(bytes) {
  const terminator = bytes.findIndex((byte) => byte === 0)
  const numberBytes = terminator === -1 ? bytes : bytes.subarray(0, terminator)
  if (terminator !== -1 && !bytes.subarray(terminator + 1).every((byte) => byte === 0 || byte === 0x20)) {
    fail("package-content-identity-archive")
  }
  const text = Buffer.from(numberBytes).toString("ascii").trim()
  if (text === "") return 0
  if (!/^[0-7]+$/u.test(text)) fail("package-content-identity-archive")
  const value = Number.parseInt(text, 8)
  if (!Number.isSafeInteger(value) || value < 0) fail("package-content-identity-archive")
  return value
}

function verifyChecksum(header) {
  const expected = readOctal(header.subarray(148, 156))
  let actual = 0
  for (let index = 0; index < header.byteLength; index += 1) actual += index >= 148 && index < 156 ? 0x20 : header[index] ?? 0
  if (expected !== actual) fail("package-content-identity-archive")
}

function isUstarHeader(header) {
  const magic = header.subarray(257, 263).toString("ascii")
  return magic === "ustar\0" || magic === "ustar "
}

function isRegularType(type) {
  return type === 0 || type === 48
}

function isZeroBlock(bytes) {
  return bytes.every((byte) => byte === 0)
}

function formatMode(mode) {
  return `0${mode.toString(8).padStart(3, "0")}`
}

function compareMembers(left, right) {
  return left.path < right.path ? -1 : left.path > right.path ? 1 : 0
}

function digestProjection(value) {
  return sha256(Buffer.from(`${JSON.stringify(value)}\n`, "utf8"))
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex")
}

function isSha256(value) {
  return typeof value === "string" && SHA256.test(value)
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function hasExactKeys(value, keys) {
  const actual = Object.keys(value).sort()
  const expected = [...keys].sort()
  return actual.length === expected.length && actual.every((key, index) => key === expected[index])
}

function fail(code) {
  throw new PackageContentIdentityError(code)
}
