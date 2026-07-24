import { inflateRawSync } from "node:zlib"

import { ConsumerAuthorityArtifactFetchError } from "./consumer-authority-artifact-error.mjs"

const MAX_ARCHIVE_BYTES = 8 * 1024 * 1024
const MAX_MEMBER_BYTES = 1024 * 1024
const EXPECTED_MEMBERS = ["bundle.json", "predicate.json", "receipt.json"]

export function extractOriginalArtifactMembers(archive) {
  try {
    return extractOriginalArtifactMembersUnchecked(archive)
  } catch (error) {
    if (error instanceof ConsumerAuthorityArtifactFetchError) throw error
    throw archiveError()
  }
}

function extractOriginalArtifactMembersUnchecked(archive) {
  if (!Buffer.isBuffer(archive) || archive.byteLength === 0 || archive.byteLength > MAX_ARCHIVE_BYTES) {
    throw archiveError()
  }
  const directory = readCentralDirectory(archive)
  const entries = []
  let offset = directory.offset
  for (let count = 0; count < directory.count; count += 1) {
    const entry = readCentralEntry(archive, offset)
    entries.push(entry.value)
    offset = entry.nextOffset
  }
  if (
    offset !== directory.offset + directory.size
    || entries.length !== EXPECTED_MEMBERS.length
    || new Set(entries.map((entry) => entry.name)).size !== EXPECTED_MEMBERS.length
  ) {
    throw archiveError()
  }
  const values = new Map(entries.map((entry) => [entry.name, readLocalMember(archive, entry)]))
  const bundle = values.get("bundle.json")
  const predicate = values.get("predicate.json")
  const receipt = values.get("receipt.json")
  if (bundle === undefined || predicate === undefined || receipt === undefined) throw archiveError()
  return { bundle, predicate, receipt }
}

function readCentralDirectory(archive) {
  const lowerBound = Math.max(0, archive.length - 65_557)
  for (let offset = archive.length - 22; offset >= lowerBound; offset -= 1) {
    if (archive.readUInt32LE(offset) !== 0x06054b50) continue
    const count = archive.readUInt16LE(offset + 10)
    const size = archive.readUInt32LE(offset + 12)
    const directoryOffset = archive.readUInt32LE(offset + 16)
    const commentLength = archive.readUInt16LE(offset + 20)
    if (offset + 22 + commentLength !== archive.length || count !== EXPECTED_MEMBERS.length || directoryOffset + size > offset) {
      break
    }
    return { count, offset: directoryOffset, size }
  }
  throw archiveError()
}

function readCentralEntry(archive, offset) {
  if (archive.readUInt32LE(offset) !== 0x02014b50) throw archiveError()
  const flags = archive.readUInt16LE(offset + 8)
  const method = archive.readUInt16LE(offset + 10)
  const compressedSize = archive.readUInt32LE(offset + 20)
  const uncompressedSize = archive.readUInt32LE(offset + 24)
  const nameLength = archive.readUInt16LE(offset + 28)
  const extraLength = archive.readUInt16LE(offset + 30)
  const commentLength = archive.readUInt16LE(offset + 32)
  const localOffset = archive.readUInt32LE(offset + 42)
  const nextOffset = offset + 46 + nameLength + extraLength + commentLength
  if (nextOffset > archive.length || (flags & 1) !== 0 || ![0, 8].includes(method) || uncompressedSize > MAX_MEMBER_BYTES) {
    throw archiveError()
  }
  const rawName = archive.subarray(offset + 46, offset + 46 + nameLength).toString("utf8")
  const name = normalizeMemberName(rawName)
  if (name === undefined) throw archiveError()
  return {
    nextOffset,
    value: { compressedSize, flags, localOffset, method, name, rawName, uncompressedSize },
  }
}

function readLocalMember(archive, entry) {
  if (entry.localOffset + 30 > archive.length || archive.readUInt32LE(entry.localOffset) !== 0x04034b50) throw archiveError()
  const flags = archive.readUInt16LE(entry.localOffset + 6)
  const method = archive.readUInt16LE(entry.localOffset + 8)
  const compressedSize = archive.readUInt32LE(entry.localOffset + 18)
  const uncompressedSize = archive.readUInt32LE(entry.localOffset + 22)
  const nameLength = archive.readUInt16LE(entry.localOffset + 26)
  const extraLength = archive.readUInt16LE(entry.localOffset + 28)
  const nameStart = entry.localOffset + 30
  const start = nameStart + nameLength + extraLength
  const end = start + entry.compressedSize
  const localName = archive.subarray(nameStart, nameStart + nameLength).toString("utf8")
  if (
    end > archive.length
    || flags !== entry.flags
    || method !== entry.method
    || localName !== entry.rawName
    || ((flags & 8) === 0 && (compressedSize !== entry.compressedSize || uncompressedSize !== entry.uncompressedSize))
  ) {
    throw archiveError()
  }
  try {
    const decoded = entry.method === 0
      ? archive.subarray(start, end)
      : inflateRawSync(archive.subarray(start, end), { maxOutputLength: MAX_MEMBER_BYTES + 1 })
    if (decoded.byteLength !== entry.uncompressedSize || decoded.byteLength === 0 || decoded.byteLength > MAX_MEMBER_BYTES) throw archiveError()
    return decoded
  } catch (error) {
    if (error instanceof ConsumerAuthorityArtifactFetchError) throw error
    throw archiveError()
  }
}

function normalizeMemberName(value) {
  const prefix = ".project-finish-attestation-artifacts/"
  const name = value.startsWith(prefix) ? value.slice(prefix.length) : value
  return EXPECTED_MEMBERS.includes(name) && !value.includes("\\") && !value.includes("..") ? name : undefined
}

function archiveError() {
  return new ConsumerAuthorityArtifactFetchError("authority-fetch-archive")
}
