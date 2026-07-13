import { existsSync, lstatSync, mkdirSync, rmSync, rmdirSync } from "node:fs"
import { randomUUID } from "node:crypto"

import { INIT_OWNERSHIP_MARKER, sha256Bytes, type InitManifest } from "./init-manifest.js"
import { writeFileAtomic } from "../io/atomic-file.js"
import {
  ensureParents,
  readSnapshot,
  removeEmptyParents,
  safeProjectPath,
  sameIdentity,
  writeNewFile,
  type FileSnapshot,
  type WrittenFile,
} from "./init-transaction-io.js"

function backupFileName(index: number, relativePath: string): string {
  const safe = relativePath.replace(/[^a-zA-Z0-9._-]/gu, "_")
  return `${String(index).padStart(3, "0")}-${safe}`
}

export function writeBackup(
  projectDir: string,
  previous: readonly FileSnapshot[],
  sourceManifest: InitManifest | null,
  createdDirs: Set<string>,
): { readonly relativePath: string; readonly ownedFiles: readonly string[] } | null {
  const changed = previous.filter((entry) => entry.bytes !== null)
  if (changed.length === 0) {
    return null
  }
  const backupRelative = `.persona/.init-backups/run-${randomUUID()}`
  const backupAbsolute = safeProjectPath(projectDir, backupRelative)
  ensureParents(projectDir, ".persona/.init-backups/placeholder", createdDirs)
  const ownedFiles: string[] = []
  let backupDirectoryCreated = false
  try {
    mkdirSync(backupAbsolute)
    backupDirectoryCreated = true
    const entries = changed.map((entry, index) => {
      const fileRelative = `${backupRelative}/files/${backupFileName(index, entry.relativePath)}`
      const fileAbsolute = safeProjectPath(projectDir, fileRelative)
      ensureParents(projectDir, fileRelative, createdDirs)
      ownedFiles.push(fileRelative)
      writeNewFile(fileAbsolute, entry.bytes ?? Buffer.alloc(0))
      return { path: entry.relativePath, digest: sha256Bytes(entry.bytes ?? Buffer.alloc(0)), backupPath: fileRelative }
    })
    const manifestBody = {
      schema: "persona-harness.init-backup.v1",
      marker: INIT_OWNERSHIP_MARKER,
      sourceManifestDigest: sourceManifest?.manifestDigest ?? null,
      files: entries,
    }
    const manifest = {
      ...manifestBody,
      manifestDigest: sha256Bytes(Buffer.from(JSON.stringify(manifestBody), "utf8")),
    }
    const manifestRelative = `${backupRelative}/manifest.json`
    const manifestAbsolute = safeProjectPath(projectDir, manifestRelative)
    ownedFiles.push(manifestRelative)
    writeNewFile(manifestAbsolute, Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, "utf8"))
    ownedFiles.push(backupRelative)
    return { relativePath: backupRelative, ownedFiles }
  } catch (error) {
    cleanupOwnedFiles(projectDir, backupDirectoryCreated ? [...ownedFiles, backupRelative] : ownedFiles)
    throw error
  }
}

export function cleanupOwnedFiles(projectDir: string, paths: readonly string[]): void {
  for (const relativePath of [...paths].sort((left, right) => right.length - left.length)) {
    let path: string
    try {
      path = safeProjectPath(projectDir, relativePath)
    } catch (error) {
      if (!(error instanceof Error)) {
        throw error
      }
      continue
    }
    if (!existsSync(path)) {
      continue
    }
    try {
      if (lstatSync(path).isDirectory()) {
        rmdirSync(path)
      } else {
        rmSync(path, { force: true })
      }
      removeEmptyParents(path, projectDir)
    } catch (error) {
      if (!(error instanceof Error)) {
        throw error
      }
    }
  }
}

export function rollback(
  projectDir: string,
  written: readonly WrittenFile[],
  createdDirs: Set<string>,
): void {
  for (const entry of [...written].reverse()) {
    let current: FileSnapshot
    try {
      current = readSnapshot(projectDir, entry.snapshot.relativePath)
    } catch (error) {
      if (!(error instanceof Error)) {
        throw error
      }
      continue
    }
    if (!sameIdentity(current.identity, entry.identity) || current.bytes === null || !current.bytes.equals(entry.nextBytes)) {
      continue
    }
    if (entry.snapshot.bytes === null) {
      rmSync(entry.snapshot.path, { force: true })
      removeEmptyParents(entry.snapshot.path, projectDir)
    } else {
      writeFileAtomic(entry.snapshot.path, entry.snapshot.bytes.toString("utf8"))
    }
  }
  for (const directory of [...createdDirs].sort((left, right) => right.length - left.length)) {
    try {
      rmdirSync(directory)
    } catch (error) {
      if (!(error instanceof Error)) {
        throw error
      }
    }
  }
}
