import { lstatSync } from "node:fs"
import { join } from "node:path"

import { GoWorkflowConflictError } from "./go-conflict.js"

type DirectoryIdentity = {
  readonly device: number
  readonly inode: number
  readonly path: string
}

export type GoWorkflowBoundary = {
  readonly persona: DirectoryIdentity
  readonly workflow: DirectoryIdentity
}

function directoryIdentity(path: string): DirectoryIdentity {
  const stat = lstatSync(path)
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    throw new GoWorkflowConflictError()
  }
  return { device: stat.dev, inode: stat.ino, path }
}

export function captureGoWorkflowBoundary(projectDir: string): GoWorkflowBoundary {
  return {
    persona: directoryIdentity(join(projectDir, ".persona")),
    workflow: directoryIdentity(join(projectDir, ".persona", "workflow")),
  }
}

export function assertGoWorkflowBoundary(boundary: GoWorkflowBoundary): void {
  for (const expected of [boundary.persona, boundary.workflow]) {
    const actual = directoryIdentity(expected.path)
    if (actual.device !== expected.device || actual.inode !== expected.inode) {
      throw new GoWorkflowConflictError()
    }
  }
}
