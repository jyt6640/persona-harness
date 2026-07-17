import { createHash } from "node:crypto"
import { gunzipSync } from "node:zlib"

export const MAX_STAGED_TARBALL_BYTES = 20 * 1024 * 1024
const MAX_UNPACKED_BYTES = 64 * 1024 * 1024
const MAX_PACKAGE_MANIFEST_BYTES = 64 * 1024
const TAR_BLOCK_BYTES = 512

export class StagedTarballError extends Error {
  constructor(code) {
    super(code)
    this.code = code
    this.name = "StagedTarballError"
  }
}

export function readStagedTarballFacts(bytes, expectedName, expectedVersion) {
  if (!Buffer.isBuffer(bytes) || bytes.byteLength === 0 || bytes.byteLength > MAX_STAGED_TARBALL_BYTES) {
    throw new StagedTarballError("staged-producer-tarball-bounds")
  }

  const manifest = readPackedManifest(bytes)
  if (manifest.name !== expectedName || manifest.version !== expectedVersion) {
    throw new StagedTarballError("staged-producer-packed-manifest-mismatch")
  }

  return {
    integrity: `sha512-${createHash("sha512").update(bytes).digest("base64")}`,
    packageName: manifest.name,
    sha1: createHash("sha1").update(bytes).digest("hex"),
    sha256: `sha256:${createHash("sha256").update(bytes).digest("hex")}`,
    size: bytes.byteLength,
    version: manifest.version,
  }
}

function readPackedManifest(bytes) {
  let archive
  try {
    archive = gunzipSync(bytes, { maxOutputLength: MAX_UNPACKED_BYTES })
  } catch {
    throw new StagedTarballError("staged-producer-tarball-format")
  }

  for (let offset = 0; offset + TAR_BLOCK_BYTES <= archive.byteLength;) {
    const header = archive.subarray(offset, offset + TAR_BLOCK_BYTES)
    if (header.every((byte) => byte === 0)) break

    const size = readTarSize(header)
    const path = readTarPath(header)
    const type = header[156] ?? 0
    const bodyStart = offset + TAR_BLOCK_BYTES
    const bodyEnd = bodyStart + size
    const nextOffset = bodyStart + Math.ceil(size / TAR_BLOCK_BYTES) * TAR_BLOCK_BYTES
    if (bodyEnd > archive.byteLength || nextOffset > archive.byteLength) {
      throw new StagedTarballError("staged-producer-tarball-format")
    }

    if (path === "package/package.json") {
      if (type !== 0 && type !== 48) throw new StagedTarballError("staged-producer-tarball-format")
      if (size === 0 || size > MAX_PACKAGE_MANIFEST_BYTES) throw new StagedTarballError("staged-producer-packed-manifest-bounds")
      return readPackageManifest(archive.subarray(bodyStart, bodyEnd))
    }
    offset = nextOffset
  }
  throw new StagedTarballError("staged-producer-packed-manifest-missing")
}

function readTarSize(header) {
  const text = readTarText(header.subarray(124, 136)).trim()
  if (!/^[0-7]+$/u.test(text)) throw new StagedTarballError("staged-producer-tarball-format")
  const size = Number.parseInt(text, 8)
  if (!Number.isSafeInteger(size) || size < 0) throw new StagedTarballError("staged-producer-tarball-format")
  return size
}

function readTarPath(header) {
  const name = readTarText(header.subarray(0, 100))
  const prefix = readTarText(header.subarray(345, 500))
  const path = prefix === "" ? name : `${prefix}/${name}`
  if (
    path === ""
    || path.includes("\0")
    || path.includes("\\")
    || path.startsWith("/")
    || path.split("/").some((part) => part === "" || part === "." || part === "..")
  ) {
    throw new StagedTarballError("staged-producer-tarball-format")
  }
  return path
}

function readTarText(bytes) {
  const zero = bytes.indexOf(0)
  return bytes.subarray(0, zero === -1 ? bytes.byteLength : zero).toString("utf8")
}

function readPackageManifest(bytes) {
  let value
  try {
    value = JSON.parse(bytes.toString("utf8"))
  } catch {
    throw new StagedTarballError("staged-producer-packed-manifest-format")
  }
  if (!isRecord(value) || typeof value.name !== "string" || typeof value.version !== "string") {
    throw new StagedTarballError("staged-producer-packed-manifest-format")
  }
  return { name: value.name, version: value.version }
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
