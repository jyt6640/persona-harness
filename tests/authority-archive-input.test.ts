import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import { canonicalAuthorityArchivePath, readExplicitAuthorityArchive } from "../src/cli/authority-archive-input.js"

describe("authority archive input", () => {
  it("canonicalizes only the root-owned Darwin system temporary alias", () => {
    expect(canonicalAuthorityArchivePath("/tmp/attestation/original.zip", {
      darwinTemporaryAlias: {
        gid: 0n,
        isSymbolicLink: true,
        target: "private/tmp",
        uid: 0n,
      },
      platform: "darwin",
    })).toBe("/private/tmp/attestation/original.zip")
  })

  it("rejects a Darwin temporary alias that is not root-owned", () => {
    expect(canonicalAuthorityArchivePath("/tmp/attestation/original.zip", {
      darwinTemporaryAlias: {
        gid: 501n,
        isSymbolicLink: true,
        target: "private/tmp",
        uid: 501n,
      },
      platform: "darwin",
    })).toBeUndefined()
  })

  it("rejects a root-owned Darwin alias with a different target", () => {
    expect(canonicalAuthorityArchivePath("/tmp/attestation/original.zip", {
      darwinTemporaryAlias: {
        gid: 0n,
        isSymbolicLink: true,
        target: "elsewhere/tmp",
        uid: 0n,
      },
      platform: "darwin",
    })).toBeUndefined()
  })

  it("does not treat a lookalike path as the Darwin system temporary alias", () => {
    expect(canonicalAuthorityArchivePath("/tmp-attestation/original.zip", {
      platform: "darwin",
    })).toBe("/tmp-attestation/original.zip")
  })

  it("leaves non-Darwin archive paths unchanged", () => {
    expect(canonicalAuthorityArchivePath("/tmp/attestation/original.zip", {
      platform: "linux",
    })).toBe("/tmp/attestation/original.zip")
  })

  const darwinIt = process.platform === "darwin" ? it : it.skip

  darwinIt("reads a regular archive supplied through the Darwin system temporary alias", () => {
    const root = mkdtempSync("/tmp/persona-harness-authority-archive-")
    const archivePath = join(root, "original.zip")
    const archive = Buffer.from("archive-input", "utf8")
    try {
      writeFileSync(archivePath, archive)
      expect(readExplicitAuthorityArchive(archivePath)).toEqual(archive)
    } finally {
      rmSync(root, { force: true, recursive: true })
    }
  })
})
