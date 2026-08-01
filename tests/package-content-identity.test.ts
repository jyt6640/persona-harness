import { createHash } from "node:crypto"
import { gzipSync } from "node:zlib"

import { describe, expect, it } from "vitest"

import {
  PACKAGE_CONTENT_MAX_MEMBER_BYTES,
  PackageContentIdentityError,
  canonicalizePackageTarball,
  classifyPackageContentIdentity,
  readPackageContentIdentity,
} from "../scripts/package-content-identity.mjs"

const TAR_BLOCK_BYTES = 512

describe("package content identity", () => {
  it("normalizes safe member order and non-security tar metadata without exposing members", () => {
    // Given
    const original = tarball([
      entry("package/package.json", "{\"name\":\"persona-harness\",\"version\":\"0.8.0-beta.17\"}\n", 0o644),
      entry("package/bin/ph.mjs", "#!/usr/bin/env node\n", 0o755),
      entry("package/private-config", "private\n", 0o600),
    ], { gid: 0, mtime: 0, uid: 0 })
    const metadataVariant = tarball([
      entry("package/private-config", "private\n", 0o600),
      entry("package/bin/ph.mjs", "#!/usr/bin/env node\n", 0o755),
      entry("package/package.json", "{\"name\":\"persona-harness\",\"version\":\"0.8.0-beta.17\"}\n", 0o644),
    ], { gid: 42, mtime: 1234, uid: 42 })

    // When
    const originalIdentity = readPackageContentIdentity(original)
    const variantIdentity = readPackageContentIdentity(metadataVariant)

    // Then
    expect(sha256(original)).not.toBe(sha256(metadataVariant))
    expect(variantIdentity).toEqual(originalIdentity)
    expect(JSON.stringify(originalIdentity)).not.toContain("package/")
    expect(JSON.stringify(originalIdentity)).not.toContain("private")
    expect(originalIdentity).toMatchObject({
      entryCount: 3,
      modeCounts: { "0600": 1, "0644": 1, "0755": 1 },
      schemaVersion: "package-content-identity.1",
    })
  })

  it("classifies content and mode differences even when a path set would match", () => {
    // Given
    const canonical = readPackageContentIdentity(tarball([
      entry("package/package.json", "{\"name\":\"persona-harness\",\"version\":\"0.8.0-beta.17\"}\n", 0o644),
    ]))
    const changedContent = readPackageContentIdentity(tarball([
      entry("package/package.json", "{\"name\":\"persona-harness\",\"version\":\"0.8.0-beta.99\"}\n", 0o644),
    ]))
    const changedMode = readPackageContentIdentity(tarball([
      entry("package/package.json", "{\"name\":\"persona-harness\",\"version\":\"0.8.0-beta.17\"}\n", 0o600),
    ]))

    // When
    const contentClassification = classifyPackageContentIdentity(canonical, changedContent)
    const modeClassification = classifyPackageContentIdentity(canonical, changedMode)

    // Then
    expect(contentClassification).toBe("content-mismatch")
    expect(modeClassification).toBe("mode-mismatch")
  })

  it("rejects CRLF body drift and reports retained aggregate content and mode deltas without paths", () => {
    // Given
    const lf = readPackageContentIdentity(tarball([
      entry("package/package.json", "{\"name\":\"persona-harness\",\"version\":\"0.8.0-beta.17\"}\n", 0o644),
      entry("package/README.md", "line one\nline two\n", 0o644),
    ]))
    const crlf = readPackageContentIdentity(tarball([
      entry("package/package.json", "{\"name\":\"persona-harness\",\"version\":\"0.8.0-beta.17\"}\n", 0o644),
      entry("package/README.md", "line one\r\nline two\r\n", 0o644),
    ]))
    const retainedBeta16 = {
      contentSha256: "9bb1c7eaeceb79d198d7baafdaea9c8bc73cd8750209ea5aa76cfc46070e0832",
      entryCount: 1191,
      identitySha256: "9eac0bdc041e8e616bd6e4de3ba49e8490b8a269f3f0d3e520027833b927c332",
      modeCounts: { "0600": 296, "0644": 887, "0700": 7, "0755": 1 },
      schemaVersion: "package-content-identity.1",
    } as const
    const retainedBeta17 = {
      contentSha256: "d411a23a2343cd21e33ac30250ed903934968e214b7f198ccd0ea91a7d6bf580",
      entryCount: 1200,
      identitySha256: "5771dc973dd95e5d3f8b01a9e17becf3c17223b3d94aed692e5248e0c3054c5e",
      modeCounts: { "0600": 305, "0644": 887, "0700": 7, "0755": 1 },
      schemaVersion: "package-content-identity.1",
    } as const

    // When
    const crlfClassification = classifyPackageContentIdentity(lf, crlf)
    const retainedClassification = classifyPackageContentIdentity(retainedBeta16, retainedBeta17)

    // Then
    expect(crlfClassification).toBe("content-mismatch")
    expect(retainedClassification).toBe("entry-count-and-content-and-mode-mismatch")
    expect(retainedClassification).not.toContain("README")
  })

  it("emits one deterministic safe canonical tar from mode and metadata variants", () => {
    // Given
    const manifest = "{\"name\":\"persona-harness\",\"version\":\"0.8.0-beta.17\",\"bin\":{\"ph\":\"bin/ph.mjs\"}}\n"
    const first = tarball([
      entry("package/package.json", manifest, 0o600),
      entry("package/bin/ph.mjs", "#!/usr/bin/env node\n", 0o600),
      entry("package/lib/value.mjs", "export const value = 1\n", 0o700),
    ], { gid: 91, mtime: 999, uid: 91 })
    const second = tarball([
      entry("package/lib/value.mjs", "export const value = 1\n", 0o644),
      entry("package/package.json", manifest, 0o644),
      entry("package/bin/ph.mjs", "#!/usr/bin/env node\n", 0o755),
    ], { gid: 0, mtime: 0, uid: 0 })

    // When
    const canonicalFirst = canonicalizePackageTarball(first)
    const canonicalSecond = canonicalizePackageTarball(second)

    // Then
    expect(sha256(canonicalFirst.bytes)).toBe(sha256(canonicalSecond.bytes))
    expect(canonicalFirst.identity).toEqual(canonicalSecond.identity)
    expect(canonicalFirst.identity.modeCounts).toEqual({ "0644": 2, "0755": 1 })
    expect(readPackageContentIdentity(canonicalFirst.bytes)).toEqual(canonicalFirst.identity)
  })

  it.each([
    ["duplicate member", [entry("package/a.txt", "a\n", 0o644), entry("package/a.txt", "a\n", 0o644)]],
    ["traversal member", [entry("package/../outside.txt", "a\n", 0o644)]],
    ["absolute member", [entry("/package/outside.txt", "a\n", 0o644)]],
    ["PAX member", [entry("package/a.txt", "a\n", 0o644, "x")]],
    ["hard-link member", [entry("package/a.txt", "a\n", 0o644, "1")]],
    ["symlink member", [entry("package/a.txt", "a\n", 0o644, "2")]],
    ["device member", [entry("package/a.txt", "a\n", 0o644, "3")]],
    ["unsafe mode", [entry("package/a.txt", "a\n", 0o666)]],
  ])("fails closed for an unsafe %s", (_label, entries) => {
    // Given
    const archive = tarball(entries)

    // When
    const read = () => readPackageContentIdentity(archive)

    // Then
    expect(read).toThrow(PackageContentIdentityError)
    expect(read).toThrow("package-content-identity-archive")
  })

  it("fails closed for an oversized regular member", () => {
    // Given
    const archive = tarball([
      entry("package/oversized.bin", Buffer.alloc(PACKAGE_CONTENT_MAX_MEMBER_BYTES + 1), 0o644),
    ])

    // When
    const read = () => readPackageContentIdentity(archive)

    // Then
    expect(read).toThrow("package-content-identity-bounds")
  })

  it("rejects an identity shape with an unknown field", () => {
    // Given
    const identity = readPackageContentIdentity(tarball([
      entry("package/package.json", "{\"name\":\"persona-harness\",\"version\":\"0.8.0-beta.17\"}\n", 0o644),
    ]))

    // When
    const classify = () => classifyPackageContentIdentity(identity, { ...identity, unexpected: true })

    // Then
    expect(classify).toThrow("package-content-identity-shape")
  })
})

type TarEntry = {
  readonly body: Buffer
  readonly mode: number
  readonly path: string
  readonly type: string
}

type TarMetadata = {
  readonly gid: number
  readonly mtime: number
  readonly uid: number
}

function entry(path: string, body: string | Buffer, mode: number, type = "0"): TarEntry {
  return {
    body: typeof body === "string" ? Buffer.from(body, "utf8") : body,
    mode,
    path,
    type,
  }
}

function tarball(entries: readonly TarEntry[], metadata: TarMetadata = { gid: 0, mtime: 0, uid: 0 }): Buffer {
  const blocks: Buffer[] = []
  for (const item of entries) {
    const header = Buffer.alloc(TAR_BLOCK_BYTES)
    writeText(header, 0, 100, item.path)
    writeOctal(header, 100, 8, item.mode)
    writeOctal(header, 108, 8, metadata.uid)
    writeOctal(header, 116, 8, metadata.gid)
    writeOctal(header, 124, 12, item.body.byteLength)
    writeOctal(header, 136, 12, metadata.mtime)
    header.fill(0x20, 148, 156)
    header[156] = item.type.charCodeAt(0)
    writeText(header, 257, 6, "ustar\0")
    writeText(header, 263, 2, "00")
    writeText(header, 265, 32, "owner")
    writeText(header, 297, 32, "group")
    writeOctal(header, 329, 8, 0)
    writeOctal(header, 337, 8, 0)
    writeChecksum(header)
    blocks.push(header, item.body)
    const padding = (TAR_BLOCK_BYTES - (item.body.byteLength % TAR_BLOCK_BYTES)) % TAR_BLOCK_BYTES
    if (padding > 0) blocks.push(Buffer.alloc(padding))
  }
  blocks.push(Buffer.alloc(TAR_BLOCK_BYTES * 2))
  return gzipSync(Buffer.concat(blocks))
}

function writeChecksum(header: Buffer): void {
  let checksum = 0
  for (const byte of header) checksum += byte
  const value = checksum.toString(8).padStart(6, "0")
  writeText(header, 148, 6, value)
  header[154] = 0
  header[155] = 0x20
}

function writeOctal(target: Buffer, offset: number, length: number, value: number): void {
  writeText(target, offset, length, `${value.toString(8).padStart(length - 1, "0")}\0`)
}

function writeText(target: Buffer, offset: number, length: number, value: string): void {
  const bytes = Buffer.from(value, "utf8")
  if (bytes.byteLength > length) throw new TypeError("tar test value exceeds field")
  bytes.copy(target, offset)
}

function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex")
}
