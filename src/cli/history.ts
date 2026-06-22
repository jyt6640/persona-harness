import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { join, resolve } from "node:path"
import process from "node:process"

import type { CliRunResult } from "./bearshell.js"

type HistoryOptions = {
  readonly projectDir?: string
  readonly now?: Date
}

type ParsedHistoryArgs =
  | { readonly kind: "run"; readonly archiveId?: string }
  | { readonly kind: "help" }
  | { readonly kind: "invalid"; readonly message: string }

type WorkflowArtifact = {
  readonly filename: string
}

type HistoryArchiveResult = {
  readonly archiveDir: string
  readonly archiveId: string
  readonly archivedFiles: readonly string[]
  readonly missingFiles: readonly string[]
}

class WorkflowHistoryError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "WorkflowHistoryError"
  }
}

const WORKFLOW_DIR = ".persona/workflow"
const HISTORY_DIR = ".persona/workflow/history"
const WORKFLOW_ARTIFACTS: readonly WorkflowArtifact[] = [
  { filename: "plan.md" },
  { filename: "implementation-report.md" },
  { filename: "review-report.md" },
]

export function historyUsage(invocation = "ph"): string {
  return [
    `Usage: ${invocation} history [--id <archive-id>]`,
    "",
    "Archives completed workflow artifacts after a run has been used.",
    "",
    "Input:",
    `- ${WORKFLOW_DIR}/plan.md`,
    `- ${WORKFLOW_DIR}/implementation-report.md`,
    `- ${WORKFLOW_DIR}/review-report.md`,
    "",
    "Output:",
    `- ${HISTORY_DIR}/<archive-id>/`,
    "",
    "Scope:",
    "- local workflow history only",
    "- does not delete active workflow files",
    "- not product-quality certification",
  ].join("\n")
}

function parseHistoryArgs(args: readonly string[]): ParsedHistoryArgs {
  let archiveId: string | undefined
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (arg === "--help" || arg === "-h") {
      return { kind: "help" }
    }
    if (arg === "--id") {
      const value = args[index + 1]
      if (value === undefined) {
        return { kind: "invalid", message: "--id requires a value" }
      }
      archiveId = value
      index += 1
      continue
    }
    return { kind: "invalid", message: `Unknown option: ${arg}` }
  }
  return { kind: "run", archiveId }
}

function assertValidArchiveId(archiveId: string): void {
  if (!/^[A-Za-z0-9._-]+$/.test(archiveId)) {
    throw new WorkflowHistoryError("Archive id may contain only letters, numbers, dots, underscores, and hyphens.")
  }
}

function defaultArchiveId(now: Date): string {
  return now.toISOString().replace(/[:.]/g, "-")
}

function artifactPath(projectDir: string, filename: string): string {
  return join(projectDir, WORKFLOW_DIR, filename)
}

function createSummary(result: HistoryArchiveResult): string {
  const evidenceSummaryPath = join(result.archiveDir, "..", "..", "..", "evidence", "summary.md")
  const evidenceSummary = existsSync(evidenceSummaryPath) ? readFileSync(evidenceSummaryPath, "utf8").trim() : "not found"
  return [
    "# Persona Workflow History",
    "",
    `Archive ID: \`${result.archiveId}\``,
    `Archive path: \`${result.archiveDir}\``,
    "",
    "## Archived Files",
    "",
    ...listLines(result.archivedFiles),
    "",
    "## Missing Files",
    "",
    ...listLines(result.missingFiles),
    "",
    "## Evidence Summary",
    "",
    evidenceSummary,
    "",
    "## Limitations",
    "",
    "- This is local workflow history evidence.",
    "- It does not certify generated app product quality.",
    "- It does not enforce rule compliance.",
    "",
  ].join("\n")
}

function listLines(values: readonly string[]): readonly string[] {
  if (values.length === 0) {
    return ["- none"]
  }
  return values.map((value) => `- ${value}`)
}

export function archiveWorkflowHistory(options: HistoryOptions = {}, archiveIdInput?: string): HistoryArchiveResult {
  const projectDir = resolve(options.projectDir ?? process.cwd())
  const archiveId = archiveIdInput ?? defaultArchiveId(options.now ?? new Date())
  assertValidArchiveId(archiveId)

  const archiveDir = join(projectDir, HISTORY_DIR, archiveId)
  if (existsSync(archiveDir)) {
    throw new WorkflowHistoryError(`${HISTORY_DIR}/${archiveId} already exists.`)
  }

  const archivedFiles: string[] = []
  const missingFiles: string[] = []
  for (const artifact of WORKFLOW_ARTIFACTS) {
    const sourcePath = artifactPath(projectDir, artifact.filename)
    if (existsSync(sourcePath)) {
      archivedFiles.push(artifact.filename)
    } else {
      missingFiles.push(artifact.filename)
    }
  }

  if (archivedFiles.length === 0) {
    throw new WorkflowHistoryError(`No workflow artifacts found under ${WORKFLOW_DIR}. Run npx ph plan first.`)
  }

  mkdirSync(archiveDir, { recursive: true })
  for (const filename of archivedFiles) {
    copyFileSync(artifactPath(projectDir, filename), join(archiveDir, filename))
  }

  const result = { archiveDir, archiveId, archivedFiles, missingFiles }
  writeFileSync(join(archiveDir, "summary.md"), createSummary(result))
  return result
}

export function runHistoryCommand(args: readonly string[], options: HistoryOptions = {}, invocationName = "ph"): CliRunResult {
  const parsed = parseHistoryArgs(args)

  if (parsed.kind === "help") {
    return { status: 0, stdout: `${historyUsage(invocationName)}\n`, stderr: "" }
  }

  if (parsed.kind === "invalid") {
    return { status: 1, stdout: "", stderr: `${parsed.message}\n\n${historyUsage(invocationName)}\n` }
  }

  try {
    const result = archiveWorkflowHistory(options, parsed.archiveId)
    return {
      status: 0,
      stdout: [
        "Persona Harness workflow history archived.",
        "",
        `Archive: ${result.archiveDir}`,
        `Archived files: ${result.archivedFiles.length}`,
        `Missing files: ${result.missingFiles.length}`,
      ].join("\n") + "\n",
      stderr: "",
    }
  } catch (error) {
    if (error instanceof WorkflowHistoryError) {
      return { status: 1, stdout: "", stderr: `${error.message}\n` }
    }
    throw error
  }
}
