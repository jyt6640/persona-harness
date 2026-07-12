import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmdirSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { dirname, join, relative } from "node:path"

import { writeFileAtomic } from "../io/atomic-file.js"

type Snapshot = {
  readonly bytes: Buffer | null
  readonly path: string
  readonly relativePath: string
}

export type AttachCommitOptions = {
  readonly onAfterCommitFile?: (relativePath: string) => void
}

function listFiles(root: string, relativeRoot: string): readonly string[] {
  const start = join(root, relativeRoot)
  if (!existsSync(start)) {
    return []
  }
  if (lstatSync(start).isSymbolicLink()) {
    throw new Error(`Attach staging boundary is symbolic-linked: ${relativeRoot}`)
  }
  if (lstatSync(start).isFile()) {
    return [relativeRoot]
  }
  const files: string[] = []
  const pending = [start]
  while (pending.length > 0) {
    const current = pending.pop()
    if (current === undefined) {
      continue
    }
    for (const entry of readdirSync(current).sort()) {
      const path = join(current, entry)
      const stat = lstatSync(path)
      if (stat.isSymbolicLink()) {
        throw new Error(`Attach staging contains a symbolic link: ${relative(root, path)}`)
      }
      if (stat.isDirectory()) {
        pending.push(path)
      } else if (stat.isFile()) {
        files.push(relative(root, path))
      }
    }
  }
  return files.sort()
}

function snapshot(projectDir: string, relativePath: string): Snapshot {
  const path = join(projectDir, relativePath)
  if (!existsSync(path)) {
    return { bytes: null, path, relativePath }
  }
  const stat = lstatSync(path)
  if (!stat.isFile() || stat.isSymbolicLink()) {
    throw new Error(`Attach target is not a regular file: ${relativePath}`)
  }
  return { bytes: readFileSync(path), path, relativePath }
}

function sameBytes(path: string, expected: Buffer | null): boolean {
  if (!existsSync(path)) {
    return expected === null
  }
  const stat = lstatSync(path)
  return stat.isFile() && !stat.isSymbolicLink() && expected !== null && readFileSync(path).equals(expected)
}

function removeEmptyParents(path: string, projectDir: string): void {
  let current = dirname(path)
  while (current.startsWith(projectDir) && current !== projectDir) {
    try {
      rmdirSync(current)
    } catch {
      return
    }
    current = dirname(current)
  }
}

function ensureParents(path: string, projectDir: string, createdDirs: Set<string>): void {
  const missing: string[] = []
  let current = dirname(path)
  while (current.startsWith(projectDir) && current !== projectDir && !existsSync(current)) {
    missing.push(current)
    current = dirname(current)
  }
  mkdirSync(dirname(path), { recursive: true })
  for (const dir of missing) {
    createdDirs.add(dir)
  }
}

export function commitAttachTree(
  projectDir: string,
  stagingDir: string,
  roots: readonly string[],
  options: AttachCommitOptions = {},
): void {
  const relativePaths = [...new Set(roots.flatMap((root) => listFiles(stagingDir, root)))].sort()
  const snapshots = relativePaths.map((path) => snapshot(projectDir, path))
  const written = new Map<string, Buffer>()
  const createdDirs = new Set<string>()
  try {
    for (const original of snapshots) {
      if (!sameBytes(original.path, original.bytes)) {
        throw new Error(`Attach target changed before commit: ${original.relativePath}`)
      }
      const next = readFileSync(join(stagingDir, original.relativePath))
      ensureParents(original.path, projectDir, createdDirs)
      writeFileAtomic(original.path, next.toString("utf8"))
      written.set(original.relativePath, next)
      options.onAfterCommitFile?.(original.relativePath)
    }
  } catch (error) {
    for (const original of [...snapshots].reverse()) {
      const next = written.get(original.relativePath)
      if (next === undefined || !sameBytes(original.path, next)) {
        continue
      }
      if (original.bytes === null) {
        rmSync(original.path, { force: true })
        removeEmptyParents(original.path, projectDir)
      } else {
        writeFileAtomic(original.path, original.bytes.toString("utf8"))
      }
    }
    for (const dir of [...createdDirs].sort((left, right) => right.length - left.length)) {
      try {
        rmdirSync(dir)
      } catch {
        // Preserve directories that contain concurrent or pre-existing material.
      }
    }
    throw error
  }
}
