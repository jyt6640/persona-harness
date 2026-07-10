import { createHash, randomUUID } from "node:crypto"
import {
  linkSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  rmdirSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from "node:fs"
import { dirname, isAbsolute, join, relative, sep } from "node:path"

import { assertGoWorkflowBoundary, type GoWorkflowBoundary } from "./go-boundary.js"
import { GoWorkflowConflictError } from "./go-conflict.js"

export type ExclusiveCreatedFile = {
  readonly contentHash: string
  readonly device: number
  readonly inode: number
  readonly path: string
}

export type ExclusiveCreatedDirectory = {
  readonly device: number
  readonly inode: number
  readonly path: string
}

function contentHash(data: Buffer): string {
  return createHash("sha256").update(data).digest("hex")
}

function errorCode(error: unknown): string | undefined {
  return error instanceof Error && "code" in error && typeof error.code === "string"
    ? error.code
    : undefined
}

function ensureSafeDirectory(
  boundary: GoWorkflowBoundary,
  projectDir: string,
  targetDirectory: string,
  createdDirectories: ExclusiveCreatedDirectory[],
): void {
  assertGoWorkflowBoundary(boundary)
  const workflowDir = join(projectDir, ".persona", "workflow")
  const relativeDirectory = relative(workflowDir, targetDirectory)
  if (relativeDirectory.startsWith("..") || isAbsolute(relativeDirectory)) {
    throw new GoWorkflowConflictError()
  }
  const workflowStat = lstatSync(workflowDir)
  if (!workflowStat.isDirectory() || workflowStat.isSymbolicLink()) {
    throw new GoWorkflowConflictError()
  }
  let current = workflowDir
  for (const segment of relativeDirectory === "" ? [] : relativeDirectory.split(sep)) {
    current = join(current, segment)
    let created = false
    try {
      mkdirSync(current)
      created = true
    } catch (error) {
      if (!(error instanceof Error) || errorCode(error) !== "EEXIST") {
        throw error
      }
    }
    const stat = lstatSync(current)
    if (!stat.isDirectory() || stat.isSymbolicLink()) {
      throw new GoWorkflowConflictError()
    }
    if (created) {
      createdDirectories.push({ device: stat.dev, inode: stat.ino, path: current })
    }
  }
}

export function createWorkflowFileExclusively(
  boundary: GoWorkflowBoundary,
  projectDir: string,
  targetPath: string,
  data: Buffer,
  createdDirectories: ExclusiveCreatedDirectory[],
): ExclusiveCreatedFile {
  ensureSafeDirectory(boundary, projectDir, dirname(targetPath), createdDirectories)
  const temporaryPath = join(dirname(targetPath), `.${randomUUID()}.persona-go.tmp`)
  let linked = false
  try {
    writeFileSync(temporaryPath, data, { flag: "wx" })
    const temporaryStat = lstatSync(temporaryPath)
    linkSync(temporaryPath, targetPath)
    linked = true
    unlinkSync(temporaryPath)
    return {
      contentHash: contentHash(data),
      device: temporaryStat.dev,
      inode: temporaryStat.ino,
      path: targetPath,
    }
  } catch (error) {
    if (linked) {
      unlinkSync(targetPath)
    }
    if (error instanceof Error && errorCode(error) === "EEXIST") {
      throw new GoWorkflowConflictError()
    }
    throw error
  } finally {
    rmSync(temporaryPath, { force: true })
  }
}

export function createdWorkflowFileMatches(created: ExclusiveCreatedFile): boolean {
  try {
    const stat = lstatSync(created.path)
    return stat.isFile()
      && stat.dev === created.device
      && stat.ino === created.inode
      && contentHash(readFileSync(created.path)) === created.contentHash
  } catch (error) {
    if (!(error instanceof Error)) {
      throw error
    }
    if (errorCode(error) === "ENOENT") {
      return false
    }
    throw error
  }
}

export function rollbackExclusiveWorkflowCreates(
  createdFiles: readonly ExclusiveCreatedFile[],
  createdDirectories: readonly ExclusiveCreatedDirectory[],
): void {
  for (const created of [...createdFiles].reverse()) {
    if (createdWorkflowFileMatches(created)) {
      try {
        unlinkSync(created.path)
      } catch (error) {
        if (!(error instanceof Error)) {
          throw error
        }
        if (errorCode(error) !== "ENOENT") {
          throw error
        }
      }
    }
  }
  for (const created of [...createdDirectories].reverse()) {
    try {
      const stat = lstatSync(created.path)
      if (stat.isDirectory() && !stat.isSymbolicLink() && stat.dev === created.device && stat.ino === created.inode) {
        rmdirSync(created.path)
      }
    } catch (error) {
      if (!(error instanceof Error) || !["ENOENT", "ENOTEMPTY"].includes(errorCode(error) ?? "")) {
        throw error
      }
    }
  }
}
