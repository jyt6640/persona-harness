import { existsSync, mkdirSync, readFileSync, renameSync } from "node:fs"
import { join } from "node:path"

import {
  AtomicWriteConflictError,
  readTextFileSnapshot,
  writeFileAtomic,
  writeFileAtomicIfUnchanged,
  type TextFileSnapshot,
} from "../io/atomic-file.js"
import type { CliRunResult } from "./bearshell.js"
import {
  BACKLOG_PATH,
  DRAFT_REQUIREMENTS_ASSUMPTIONS_PATH,
  DRAFT_REQUIREMENTS_BACKLOG_PATH,
  DRAFT_REQUIREMENTS_QUESTIONS_PATH,
  HISTORY_DIR,
  LATEST_REQUIREMENTS_PATH,
  REQUIREMENTS_ANALYSIS_PATH,
  REQUIREMENTS_DIR,
  TASK_CARD_NAME,
  WORKFLOW_REQUIREMENTS_BACKLOG_SCHEMA_VERSION,
  WORK_DIR,
  type BacklogTicket,
  type RequirementSource,
  formatBacklog,
  formatTaskCard,
  pendingTickets,
  parseBacklogState,
  replaceBacklogTicket,
  taskCardPath,
} from "./workflow-ticket-model.js"
import { analyzeRequirementSections, formatRequirementsAnalysis } from "./workflow-requirements-analysis.js"
import {
  approvalCompleteOutput,
  archiveBlockedOutput,
  archiveBacklogRepairOutput,
  archiveCompleteOutput,
  backlogNotFoundOutput,
  captureCompleteOutput,
  draftCompleteOutput,
  draftRequirementsConflictOutput,
  missingDraftRequirementsOutput,
  missingRequirementSourceOutput,
  malformedBacklogOutput,
  nextTicketOutput,
  noPendingTicketsOutput,
  splitCompleteOutput,
  splitConflictOutput,
  uninitializedTicketOutput,
} from "./workflow-ticket-output.js"
import { readWorkflowClosurePayload, type ClosureBlocker } from "./workflow-closure.js"
import {
  beforeWorkflowStateWrite,
  toWorkflowStateConflict,
  type WorkflowStateWriteOptions,
} from "./workflow-state-conflict.js"

type WorkflowTicketOptions = WorkflowStateWriteOptions & {
  readonly projectDir?: string
  readonly stdin?: string
}

function resolveProjectDir(options: WorkflowTicketOptions): string {
  return options.projectDir ?? process.cwd()
}

function initializedProjectDir(options: WorkflowTicketOptions): { readonly kind: "ready"; readonly projectDir: string } | CliRunResult {
  const projectDir = resolveProjectDir(options)
  if (!existsSync(join(projectDir, ".persona"))) {
    return uninitializedTicketOutput()
  }
  return { kind: "ready", projectDir }
}

function conflictMessage(path: string): CliRunResult {
  return splitConflictOutput(path)
}

function workflowStateConflictResult(error: AtomicWriteConflictError, projectDir: string): CliRunResult {
  const conflict = toWorkflowStateConflict(error, projectDir)
  return { status: 1, stdout: "", stderr: `${conflict.message}\n` }
}

function writeWorkflowStateSnapshot(
  projectDir: string,
  snapshot: TextFileSnapshot,
  nextText: string,
  options: WorkflowTicketOptions,
): CliRunResult | undefined {
  beforeWorkflowStateWrite(options, snapshot.path)
  try {
    writeFileAtomicIfUnchanged(snapshot, nextText)
    return undefined
  } catch (error) {
    if (error instanceof AtomicWriteConflictError) {
      return workflowStateConflictResult(error, projectDir)
    }
    throw error
  }
}

function archiveBlockingBlockers(projectDir: string): readonly ClosureBlocker[] {
  return readWorkflowClosurePayload("next", projectDir, { recordTddGreenEvidence: true }).state.blockers.filter((blocker) =>
    blocker.id !== "pending-ticket" && blocker.id !== "history-backlog-mismatch"
  )
}

function firstMeaningfulLine(markdown: string): string {
  const line = markdown.split(/\r?\n/u).map((candidate) => candidate.trim()).find((candidate) => candidate.length > 0)
  return line ?? "Untitled product idea"
}

function formatDraftRequirementsBacklog(input: string): string {
  const idea = firstMeaningfulLine(input)
  return [
    "# Requirements Draft Backlog",
    "",
    "Status: draft",
    `schemaVersion: ${WORKFLOW_REQUIREMENTS_BACKLOG_SCHEMA_VERSION}`,
    "Source kind: prompt",
    `Source path: ${LATEST_REQUIREMENTS_PATH}`,
    `Original idea: ${idea}`,
    "",
    "## Step 1. Product scope and core use cases",
    "",
    `- Clarify the MVP scope for: ${idea}`,
    "- Identify primary users and the main user goals.",
    "- List core create/read/update/delete or workflow use cases.",
    "",
    "## Step 2. Domain model and API contract",
    "",
    "- Draft domain concepts, aggregate boundaries, and ownership rules.",
    "- Draft REST API endpoints, request DTOs, response DTOs, and status codes.",
    "- Keep external contracts separate from domain objects.",
    "",
    "## Step 3. Persistence and validation rules",
    "",
    "- Decide storage technology from the project profile before implementation.",
    "- Draft validation, error response, and edge-case behavior.",
    "- Keep Repository ports in domain and adapters in infrastructure.",
    "",
    "## Step 4. Verification and delivery slices",
    "",
    "- Define build/test/smoke checks for each slice.",
    "- Split implementation into reviewable tickets after user approval.",
    "- Do not claim all requirements are complete while pending tickets remain.",
    "",
    "## Review Gate",
    "",
    "- This is a requirements draft, not implementation output.",
    "- Ask the user to review before running implementation tickets.",
    "- Continue only after the user says `진행하자` or explicitly approves the draft.",
  ].join("\n") + "\n"
}

function formatDraftQuestions(input: string): string {
  const idea = firstMeaningfulLine(input)
  return [
    "# Requirements Questions",
    "",
    "Status: draft",
    `Original idea: ${idea}`,
    "",
    "- Who are the primary users or roles?",
    "- What is the smallest useful MVP scope?",
    "- Which backend storage choice should be used for this project?",
    "- Which operations need failure cases and explicit error responses?",
    "- Which requirements must be deferred instead of implemented now?",
  ].join("\n") + "\n"
}

function formatDraftAssumptions(input: string): string {
  const idea = firstMeaningfulLine(input)
  return [
    "# Requirements Assumptions",
    "",
    "Status: draft",
    `Original idea: ${idea}`,
    "",
    "- Java/Spring backend Clean Code guidance applies when the project profile targets backend work.",
    "- Gradle is preferred for Java/Spring projects unless the user explicitly says otherwise.",
    "- Implementation waits until the user reviews and approves the requirements draft.",
    "- Existing project style wins when adding to an existing codebase.",
  ].join("\n") + "\n"
}

function replaceDraftStatus(markdown: string): string {
  if (/^Status:\s*draft\s*$/imu.test(markdown)) {
    return markdown.replace(/^Status:\s*draft\s*$/imu, "Status: accepted")
  }
  if (/^Status:\s*accepted\s*$/imu.test(markdown)) {
    return markdown
  }
  return markdown.replace(/^# .+$/u, (heading) => `${heading}\n\nStatus: accepted`)
}

function resolveRequirementSource(projectDir: string, sourceFile: string | undefined): RequirementSource | CliRunResult {
  if (sourceFile !== undefined) {
    if (!existsSync(join(projectDir, sourceFile))) {
      return { status: 1, stdout: "", stderr: `Workflow split source not found: ${sourceFile}\n` }
    }
    return { kind: "file", path: sourceFile, label: sourceFile }
  }
  if (!existsSync(join(projectDir, LATEST_REQUIREMENTS_PATH))) {
    return missingRequirementSourceOutput()
  }
  return { kind: "prompt", path: LATEST_REQUIREMENTS_PATH, label: LATEST_REQUIREMENTS_PATH }
}

export function runWorkflowCapture(options: WorkflowTicketOptions): CliRunResult {
  const initialized = initializedProjectDir(options)
  if ("status" in initialized) {
    return initialized
  }
  const input = options.stdin ?? ""
  if (input.trim().length === 0) {
    return {
      status: 1,
      stdout: "",
      stderr: "Workflow capture requires requirements text on stdin.\n",
    }
  }

  const projectDir = initialized.projectDir
  mkdirSync(join(projectDir, REQUIREMENTS_DIR), { recursive: true })
  writeFileAtomic(join(projectDir, LATEST_REQUIREMENTS_PATH), input.endsWith("\n") ? input : `${input}\n`)
  return captureCompleteOutput()
}

export function runWorkflowDraft(options: WorkflowTicketOptions): CliRunResult {
  const initialized = initializedProjectDir(options)
  if ("status" in initialized) {
    return initialized
  }
  const input = options.stdin ?? ""
  if (input.trim().length === 0) {
    return {
      status: 1,
      stdout: "",
      stderr: "Workflow draft requires product idea text on stdin.\n",
    }
  }

  const projectDir = initialized.projectDir
  const draftPaths = [
    DRAFT_REQUIREMENTS_BACKLOG_PATH,
    DRAFT_REQUIREMENTS_QUESTIONS_PATH,
    DRAFT_REQUIREMENTS_ASSUMPTIONS_PATH,
  ] as const
  const existingDraftPath = draftPaths.find((path) => existsSync(join(projectDir, path)))
  if (existingDraftPath !== undefined) {
    return draftRequirementsConflictOutput(existingDraftPath)
  }

  mkdirSync(join(projectDir, REQUIREMENTS_DIR), { recursive: true })
  writeFileAtomic(join(projectDir, LATEST_REQUIREMENTS_PATH), input.endsWith("\n") ? input : `${input}\n`)
  writeFileAtomic(join(projectDir, DRAFT_REQUIREMENTS_BACKLOG_PATH), formatDraftRequirementsBacklog(input))
  writeFileAtomic(join(projectDir, DRAFT_REQUIREMENTS_QUESTIONS_PATH), formatDraftQuestions(input))
  writeFileAtomic(join(projectDir, DRAFT_REQUIREMENTS_ASSUMPTIONS_PATH), formatDraftAssumptions(input))
  return draftCompleteOutput()
}

export function runWorkflowApproveRequirements(options: WorkflowTicketOptions): CliRunResult {
  const initialized = initializedProjectDir(options)
  if ("status" in initialized) {
    return initialized
  }

  const projectDir = initialized.projectDir
  const backlogPath = join(projectDir, DRAFT_REQUIREMENTS_BACKLOG_PATH)
  if (!existsSync(backlogPath)) {
    return missingDraftRequirementsOutput()
  }

  const draftPaths = [
    DRAFT_REQUIREMENTS_BACKLOG_PATH,
    DRAFT_REQUIREMENTS_QUESTIONS_PATH,
    DRAFT_REQUIREMENTS_ASSUMPTIONS_PATH,
  ] as const
  for (const path of draftPaths) {
    const absolutePath = join(projectDir, path)
    if (existsSync(absolutePath)) {
      const snapshot = readTextFileSnapshot(absolutePath)
      const conflict = writeWorkflowStateSnapshot(projectDir, snapshot, replaceDraftStatus(snapshot.text), options)
      if (conflict !== undefined) {
        return conflict
      }
    }
  }
  return approvalCompleteOutput()
}

export function runWorkflowSplit(sourceFile: string | undefined, options: WorkflowTicketOptions): CliRunResult {
  const initialized = initializedProjectDir(options)
  if ("status" in initialized) {
    return initialized
  }

  const projectDir = initialized.projectDir
  const source = resolveRequirementSource(projectDir, sourceFile)
  if ("status" in source) {
    return source
  }
  const sourceMarkdown = readFileSync(join(projectDir, source.path), "utf8")
  const analysis = analyzeRequirementSections(sourceMarkdown)
  const sections = analysis.sections

  const backlogAbsolutePath = join(projectDir, BACKLOG_PATH)
  if (existsSync(backlogAbsolutePath)) {
    return conflictMessage(BACKLOG_PATH)
  }

  for (const section of sections) {
    const ticket = `step-${section.number}`
    if (existsSync(join(projectDir, WORK_DIR, ticket))) {
      return conflictMessage(`${WORK_DIR}/${ticket}`)
    }
    if (existsSync(join(projectDir, HISTORY_DIR, ticket))) {
      return conflictMessage(`${HISTORY_DIR}/${ticket}`)
    }
  }

  mkdirSync(join(projectDir, WORK_DIR), { recursive: true })
  mkdirSync(join(projectDir, HISTORY_DIR), { recursive: true })
  mkdirSync(join(projectDir, ".persona", "workflow"), { recursive: true })
  writeFileAtomic(join(projectDir, REQUIREMENTS_ANALYSIS_PATH), formatRequirementsAnalysis(source, analysis, sourceMarkdown))
  for (const section of sections) {
    const ticket = section.kind === "step" ? `step-${section.number}` : `req-${section.number}`
    const ticketDir = join(projectDir, WORK_DIR, ticket)
    mkdirSync(ticketDir, { recursive: true })
    writeFileAtomic(join(ticketDir, TASK_CARD_NAME), formatTaskCard(source, section))
  }
  writeFileAtomic(backlogAbsolutePath, formatBacklog(source, sections))

  return splitCompleteOutput(source, sections.length)
}

function backlogNotFound(): CliRunResult {
  return backlogNotFoundOutput()
}

function readBacklogState(backlogAbsolutePath: string): { readonly kind: "ok"; readonly tickets: readonly BacklogTicket[] } | CliRunResult {
  const state = parseBacklogState(readFileSync(backlogAbsolutePath, "utf8"))
  if (state.kind === "malformed") {
    return malformedBacklogOutput(BACKLOG_PATH, state.reason)
  }
  return state
}

export function runWorkflowNext(options: WorkflowTicketOptions): CliRunResult {
  const initialized = initializedProjectDir(options)
  if ("status" in initialized) {
    return initialized
  }

  const backlogAbsolutePath = join(initialized.projectDir, BACKLOG_PATH)
  if (!existsSync(backlogAbsolutePath)) {
    return backlogNotFound()
  }
  const backlog = readBacklogState(backlogAbsolutePath)
  if ("status" in backlog) {
    return backlog
  }
  const nextTicket = backlog.tickets.find((ticket) => ticket.status === "pending" || ticket.status === "active")
  if (nextTicket === undefined) {
    return noPendingTicketsOutput()
  }

  return nextTicketOutput(nextTicket.ticket, nextTicket.title, nextTicket.path)
}

export function pendingWorkflowTicketIds(projectDir: string): readonly string[] {
  const backlogAbsolutePath = join(projectDir, BACKLOG_PATH)
  if (!existsSync(backlogAbsolutePath)) {
    return []
  }
  const state = parseBacklogState(readFileSync(backlogAbsolutePath, "utf8"))
  if (state.kind === "malformed") {
    return ["malformed-backlog"]
  }
  return state.tickets.filter((ticket) => ticket.status === "pending" || ticket.status === "active").map((ticket) => ticket.ticket)
}

export function runWorkflowArchive(ticketId: string, options: WorkflowTicketOptions): CliRunResult {
  const initialized = initializedProjectDir(options)
  if ("status" in initialized) {
    return initialized
  }

  const projectDir = initialized.projectDir
  const workDir = join(projectDir, WORK_DIR, ticketId)
  const historyDir = join(projectDir, HISTORY_DIR, ticketId)
  const backlogAbsolutePath = join(projectDir, BACKLOG_PATH)

  if (!existsSync(backlogAbsolutePath)) {
    return backlogNotFound()
  }
  const backlogState = readBacklogState(backlogAbsolutePath)
  if ("status" in backlogState) {
    return backlogState
  }
  if (!existsSync(workDir)) {
    const backlogSnapshot = readTextFileSnapshot(backlogAbsolutePath)
    const pendingTicket = pendingTickets(backlogSnapshot.text).find((ticket) => ticket.ticket === ticketId)
    if (pendingTicket !== undefined && existsSync(join(historyDir, TASK_CARD_NAME))) {
      const conflict = writeWorkflowStateSnapshot(
        projectDir,
        backlogSnapshot,
        replaceBacklogTicket(backlogSnapshot.text, ticketId),
        options,
      )
      if (conflict !== undefined) {
        return conflict
      }
      return archiveBacklogRepairOutput(ticketId, `${HISTORY_DIR}/${ticketId}`)
    }
    return { status: 1, stdout: "", stderr: `Workflow work ticket not found: ${WORK_DIR}/${ticketId}\n` }
  }
  if (!existsSync(join(workDir, TASK_CARD_NAME))) {
    return { status: 1, stdout: "", stderr: `Workflow task card not found: ${taskCardPath(ticketId)}\n` }
  }
  if (existsSync(historyDir)) {
    return {
      status: 1,
      stdout: "",
      stderr: [
        `History already exists: ${HISTORY_DIR}/${ticketId}`,
        "Refusing to overwrite completed workflow history.",
      ].join("\n") + "\n",
    }
  }
  const blockers = archiveBlockingBlockers(projectDir)
  if (blockers.length > 0) {
    return archiveBlockedOutput(ticketId, blockers)
  }

  mkdirSync(join(projectDir, HISTORY_DIR), { recursive: true })
  const backlogSnapshot = readTextFileSnapshot(backlogAbsolutePath)
  renameSync(workDir, historyDir)
  const conflict = writeWorkflowStateSnapshot(
    projectDir,
    backlogSnapshot,
    replaceBacklogTicket(backlogSnapshot.text, ticketId),
    options,
  )
  if (conflict !== undefined) {
    return conflict
  }

  return archiveCompleteOutput(ticketId, `${WORK_DIR}/${ticketId}`, `${HISTORY_DIR}/${ticketId}`)
}

export function workflowTicketUsage(invocation = "ph"): string {
  return [
    `${invocation} workflow draft --stdin`,
    `${invocation} workflow approve requirements`,
    `${invocation} workflow capture --stdin`,
    `${invocation} workflow split`,
    `${invocation} workflow split README.md`,
    `${invocation} workflow next`,
    `${invocation} workflow archive <ticket>`,
  ].join("\n")
}
