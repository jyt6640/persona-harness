import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs"
import { join } from "node:path"

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
  WORK_DIR,
  type RequirementSource,
  formatBacklog,
  formatTaskCard,
  pendingTickets,
  parseBacklog,
  replaceBacklogTicket,
  taskCardPath,
} from "./workflow-ticket-model.js"
import { analyzeRequirementSections, formatRequirementsAnalysis } from "./workflow-requirements-analysis.js"
import {
  approvalCompleteOutput,
  archiveCompleteOutput,
  backlogNotFoundOutput,
  captureCompleteOutput,
  draftCompleteOutput,
  draftRequirementsConflictOutput,
  missingDraftRequirementsOutput,
  missingRequirementSourceOutput,
  nextTicketOutput,
  noPendingTicketsOutput,
  splitCompleteOutput,
  splitConflictOutput,
  uninitializedTicketOutput,
} from "./workflow-ticket-output.js"

type WorkflowTicketOptions = {
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
  writeFileSync(join(projectDir, LATEST_REQUIREMENTS_PATH), input.endsWith("\n") ? input : `${input}\n`)
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
  writeFileSync(join(projectDir, LATEST_REQUIREMENTS_PATH), input.endsWith("\n") ? input : `${input}\n`)
  writeFileSync(join(projectDir, DRAFT_REQUIREMENTS_BACKLOG_PATH), formatDraftRequirementsBacklog(input))
  writeFileSync(join(projectDir, DRAFT_REQUIREMENTS_QUESTIONS_PATH), formatDraftQuestions(input))
  writeFileSync(join(projectDir, DRAFT_REQUIREMENTS_ASSUMPTIONS_PATH), formatDraftAssumptions(input))
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
      writeFileSync(absolutePath, replaceDraftStatus(readFileSync(absolutePath, "utf8")))
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
  writeFileSync(join(projectDir, REQUIREMENTS_ANALYSIS_PATH), formatRequirementsAnalysis(source, analysis, sourceMarkdown))
  for (const section of sections) {
    const ticket = section.kind === "step" ? `step-${section.number}` : `req-${section.number}`
    const ticketDir = join(projectDir, WORK_DIR, ticket)
    mkdirSync(ticketDir, { recursive: true })
    writeFileSync(join(ticketDir, TASK_CARD_NAME), formatTaskCard(source, section))
  }
  writeFileSync(backlogAbsolutePath, formatBacklog(source, sections))

  return splitCompleteOutput(source, sections.length)
}

function backlogNotFound(): CliRunResult {
  return backlogNotFoundOutput()
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
  const tickets = parseBacklog(readFileSync(backlogAbsolutePath, "utf8"))
  const nextTicket = tickets.find((ticket) => ticket.status === "pending" || ticket.status === "active")
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
  return pendingTickets(readFileSync(backlogAbsolutePath, "utf8")).map((ticket) => ticket.ticket)
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
  if (!existsSync(workDir)) {
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

  mkdirSync(join(projectDir, HISTORY_DIR), { recursive: true })
  renameSync(workDir, historyDir)
  const backlog = readFileSync(backlogAbsolutePath, "utf8")
  writeFileSync(backlogAbsolutePath, replaceBacklogTicket(backlog, ticketId))

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
