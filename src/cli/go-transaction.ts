import {
  cpSync,
  existsSync,
  lstatSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join, relative } from "node:path"

import {
  assertGoWorkflowBoundary,
  captureGoWorkflowBoundary,
  type GoWorkflowBoundary,
} from "./go-boundary.js"
import { GoWorkflowConflictError } from "./go-conflict.js"
import {
  createWorkflowFileExclusively,
  createdWorkflowFileMatches,
  type ExclusiveCreatedDirectory,
  type ExclusiveCreatedFile,
  rollbackExclusiveWorkflowCreates,
} from "./go-exclusive-commit.js"
import { workflowTreeSnapshot } from "./go-workflow-tree.js"
import {
  BACKLOG_PATH,
  HISTORY_DIR,
  REQUIREMENTS_ANALYSIS_PATH,
  REQUIREMENTS_DIR,
  WORK_DIR,
} from "./workflow-ticket-model.js"

export type GoWorkflowTransaction = {
  readonly boundary: GoWorkflowBoundary
  readonly initialFiles: ReadonlySet<string>
  readonly originalFingerprint: string
  readonly projectDir: string
  readonly stagingProjectDir: string
  readonly stagingRoot: string
}

type GoWorkflowTransactionOptions = {
  readonly onAfterCopy?: () => void
  readonly onAfterCreateFile?: (relativePath: string) => void
}

export const GO_OWNED_PATHS = [
  REQUIREMENTS_DIR,
  REQUIREMENTS_ANALYSIS_PATH,
  WORK_DIR,
  HISTORY_DIR,
  BACKLOG_PATH,
  ".persona/workflow/rail-body-cache.json",
] as const

function stagedFiles(transaction: GoWorkflowTransaction): readonly string[] {
  const files: string[] = []
  const visit = (relativePath: string): void => {
    const path = join(transaction.stagingProjectDir, relativePath)
    if (!existsSync(path)) {
      return
    }
    const stat = lstatSync(path)
    if (stat.isSymbolicLink()) {
      throw new GoWorkflowConflictError()
    }
    if (stat.isFile()) {
      files.push(relativePath)
      return
    }
    for (const entry of readdirSync(path).sort()) {
      visit(join(relativePath, entry))
    }
  }
  for (const relativePath of GO_OWNED_PATHS) {
    visit(relativePath)
  }
  return files
}

export function beginGoWorkflowTransaction(
  projectDir: string,
  options: GoWorkflowTransactionOptions = {},
): GoWorkflowTransaction {
  const stagingRoot = mkdtempSync(join(tmpdir(), "persona-go-transaction-"))
  try {
    const boundary = captureGoWorkflowBoundary(projectDir)
    const initial = workflowTreeSnapshot(projectDir)
    const stagingProjectDir = join(stagingRoot, "project")
    cpSync(join(projectDir, ".persona"), join(stagingProjectDir, ".persona"), { recursive: true })
    for (const relativePath of ["AGENTS.md", "README.md"]) {
      const source = join(projectDir, relativePath)
      if (existsSync(source)) {
        cpSync(source, join(stagingProjectDir, relativePath))
      }
    }
    options.onAfterCopy?.()
    assertGoWorkflowBoundary(boundary)
    if (
      workflowTreeSnapshot(projectDir).fingerprint !== initial.fingerprint
      || workflowTreeSnapshot(stagingProjectDir).fingerprint !== initial.fingerprint
    ) {
      throw new GoWorkflowConflictError()
    }
    return {
      boundary,
      initialFiles: initial.files,
      originalFingerprint: initial.fingerprint,
      projectDir,
      stagingProjectDir,
      stagingRoot,
    }
  } catch (error) {
    rmSync(stagingRoot, { force: true, recursive: true })
    throw error
  }
}

export function commitGoWorkflowTransaction(
  transaction: GoWorkflowTransaction,
  options: GoWorkflowTransactionOptions = {},
): void {
  assertGoWorkflowBoundary(transaction.boundary)
  if (workflowTreeSnapshot(transaction.projectDir).fingerprint !== transaction.originalFingerprint) {
    throw new GoWorkflowConflictError()
  }
  const createdFiles: ExclusiveCreatedFile[] = []
  const createdDirectories: ExclusiveCreatedDirectory[] = []
  try {
    for (const relativePath of stagedFiles(transaction)) {
      if (transaction.initialFiles.has(relativePath)) {
        continue
      }
      const data = readFileSync(join(transaction.stagingProjectDir, relativePath))
      createdFiles.push(
        createWorkflowFileExclusively(
          transaction.boundary,
          transaction.projectDir,
          join(transaction.projectDir, relativePath),
          data,
          createdDirectories,
        ),
      )
      options.onAfterCreateFile?.(relativePath)
    }
    assertGoWorkflowBoundary(transaction.boundary)
    const createdPaths = new Set(createdFiles.map((created) => relative(transaction.projectDir, created.path)))
    if (
      createdFiles.some((created) => !createdWorkflowFileMatches(created))
      || workflowTreeSnapshot(transaction.projectDir, createdPaths).fingerprint !== transaction.originalFingerprint
    ) {
      throw new GoWorkflowConflictError()
    }
  } catch (error) {
    rollbackExclusiveWorkflowCreates(createdFiles, createdDirectories)
    throw error
  }
}

export function closeGoWorkflowTransaction(transaction: GoWorkflowTransaction): void {
  rmSync(transaction.stagingRoot, { force: true, recursive: true })
}
