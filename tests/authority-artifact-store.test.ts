import { createHash } from "node:crypto"
import { existsSync, mkdtempSync, rmSync, symlinkSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import {
  readAuthorityArtifact,
  writeAuthorityArtifact,
} from "../src/cli/authority-artifact-store.js"

const stores: string[] = []

afterEach(() => {
  for (const store of stores.splice(0)) rmSync(store, { force: true, recursive: true })
})

describe("consumer authority original artifact store", () => {
  it("persists only a bounded original archive whose digest and exact members revalidate", () => {
    const storeRoot = store()
    const archive = archiveFor({
      "bundle.json": Buffer.from("bundle", "utf8"),
      "predicate.json": Buffer.from("predicate", "utf8"),
      "receipt.json": Buffer.from("receipt", "utf8"),
    })

    const written = writeAuthorityArtifact({
      archive,
      artifactDigest: `sha256:${createHash("sha256").update(archive).digest("hex")}`,
      fetchedAt: "2026-07-24T00:00:00.000Z",
      repositoryId: 987654321,
      runId: "10",
      sourceHead: "a".repeat(40),
    }, { storeRoot })

    expect(written).toBe(true)
    expect(readAuthorityArtifact(987654321, { storeRoot })).toMatchObject({
      state: "ready",
      value: {
        artifactDigest: `sha256:${createHash("sha256").update(archive).digest("hex")}`,
        repositoryId: 987654321,
        runId: "10",
        sourceHead: "a".repeat(40),
      },
    })
  })

  it("fails closed for a substituted digest or malformed archive without creating usable evidence", () => {
    const storeRoot = store()
    const archive = Buffer.from("not-a-zip", "utf8")

    expect(writeAuthorityArtifact({
      archive,
      artifactDigest: "sha256:0".repeat(1),
      fetchedAt: "2026-07-24T00:00:00.000Z",
      repositoryId: 987654321,
      runId: "10",
      sourceHead: "a".repeat(40),
    }, { storeRoot })).toBe(false)
    expect(readAuthorityArtifact(987654321, { storeRoot }).state).toBe("missing")
  })

  it("does not follow a user-store root symlink while writing fetched evidence", () => {
    const parent = store()
    const outside = store()
    const unsafeRoot = join(parent, "unsafe-root")
    const archive = archiveFor({
      "bundle.json": Buffer.from("bundle", "utf8"),
      "predicate.json": Buffer.from("predicate", "utf8"),
      "receipt.json": Buffer.from("receipt", "utf8"),
    })
    symlinkSync(outside, unsafeRoot, "dir")

    expect(writeAuthorityArtifact({
      archive,
      artifactDigest: `sha256:${createHash("sha256").update(archive).digest("hex")}`,
      fetchedAt: "2026-07-24T00:00:00.000Z",
      repositoryId: 987654321,
      runId: "10",
      sourceHead: "a".repeat(40),
    }, { storeRoot: unsafeRoot })).toBe(false)
    expect(existsSync(join(outside, "consumer-authority-artifact-987654321.json"))).toBe(false)
  })
})

function store(): string {
  const root = mkdtempSync(join(tmpdir(), "persona-authority-artifact-store-"))
  stores.push(root)
  return root
}

function archiveFor(members: Readonly<Record<string, Buffer>>): Buffer {
  const localParts: Buffer[] = []
  const centralParts: Buffer[] = []
  let offset = 0
  for (const [name, bytes] of Object.entries(members)) {
    const encodedName = Buffer.from(name, "utf8")
    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4)
    local.writeUInt32LE(bytes.byteLength, 18)
    local.writeUInt32LE(bytes.byteLength, 22)
    local.writeUInt16LE(encodedName.byteLength, 26)
    localParts.push(local, encodedName, bytes)

    const central = Buffer.alloc(46)
    central.writeUInt32LE(0x02014b50, 0)
    central.writeUInt16LE(20, 4)
    central.writeUInt16LE(20, 6)
    central.writeUInt32LE(bytes.byteLength, 20)
    central.writeUInt32LE(bytes.byteLength, 24)
    central.writeUInt16LE(encodedName.byteLength, 28)
    central.writeUInt32LE(offset, 42)
    centralParts.push(central, encodedName)
    offset += local.byteLength + encodedName.byteLength + bytes.byteLength
  }
  const centralDirectory = Buffer.concat(centralParts)
  const footer = Buffer.alloc(22)
  footer.writeUInt32LE(0x06054b50, 0)
  footer.writeUInt16LE(Object.keys(members).length, 8)
  footer.writeUInt16LE(Object.keys(members).length, 10)
  footer.writeUInt32LE(centralDirectory.byteLength, 12)
  footer.writeUInt32LE(offset, 16)
  return Buffer.concat([...localParts, centralDirectory, footer])
}
