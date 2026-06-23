import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs"
import { join } from "node:path"

import type { CliRunResult } from "./bearshell.js"
import {
  BACKLOG_PATH,
  HISTORY_DIR,
  TASK_CARD_NAME,
  WORK_DIR,
  formatBacklog,
  formatTaskCard,
  parseBacklog,
  parseStepSections,
  replaceBacklogTicket,
  taskCardPath,
} from "./workflow-ticket-model.js"

type WorkflowTicketOptions = {
  readonly projectDir?: string
}

function resolveProjectDir(options: WorkflowTicketOptions): string {
  return options.projectDir ?? process.cwd()
}

function initializedProjectDir(options: WorkflowTicketOptions): { readonly kind: "ready"; readonly projectDir: string } | CliRunResult {
  const projectDir = resolveProjectDir(options)
  if (!existsSync(join(projectDir, ".persona"))) {
    return {
      status: 1,
      stdout: "",
      stderr: [
        "Persona Harness is not initialized for workflow tickets.",
        "",
        "Run `npx ph init` or `npx ph bootstrap backend` first.",
      ].join("\n") + "\n",
    }
  }
  return { kind: "ready", projectDir }
}

function conflictMessage(path: string): CliRunResult {
  return {
    status: 1,
    stdout: "",
    stderr: [
      "Workflow split refused to overwrite existing workflow state.",
      "",
      `Existing path: ${path}`,
      "",
      "Archive or remove the existing ticket state intentionally before splitting again.",
    ].join("\n") + "\n",
  }
}

export function runWorkflowSplit(sourceFile: string, options: WorkflowTicketOptions): CliRunResult {
  const initialized = initializedProjectDir(options)
  if ("status" in initialized) {
    return initialized
  }

  const projectDir = initialized.projectDir
  const sourcePath = join(projectDir, sourceFile)
  if (!existsSync(sourcePath)) {
    return { status: 1, stdout: "", stderr: `Workflow split source not found: ${sourceFile}\n` }
  }
  const sections = parseStepSections(readFileSync(sourcePath, "utf8"))
  if (sections.length === 0) {
    return {
      status: 1,
      stdout: "",
      stderr: `No Step sections found in ${sourceFile}. Expected headings like "## Step 1. ...".\n`,
    }
  }

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
  for (const section of sections) {
    const ticket = `step-${section.number}`
    const ticketDir = join(projectDir, WORK_DIR, ticket)
    mkdirSync(ticketDir, { recursive: true })
    writeFileSync(join(ticketDir, TASK_CARD_NAME), formatTaskCard(sourceFile, section))
  }
  writeFileSync(backlogAbsolutePath, formatBacklog(sourceFile, sections))

  return {
    status: 0,
    stdout: [
      "Workflow split complete.",
      "",
      `Source: ${sourceFile}`,
      `Backlog: ${BACKLOG_PATH}`,
      `Tickets created: ${sections.length}`,
      "",
      "Next:",
      "- `npx ph workflow next`",
    ].join("\n") + "\n",
    stderr: "",
  }
}

function backlogNotFound(): CliRunResult {
  return {
    status: 1,
    stdout: "",
    stderr: [
      "Workflow backlog not found.",
      "",
      "Run `npx ph workflow split README.md` first.",
    ].join("\n") + "\n",
  }
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
    return {
      status: 0,
      stdout: [
        "Persona Workflow Next Ticket",
        "",
        "Status: complete",
        "No pending tickets remain in `.persona/workflow/backlog.md`.",
      ].join("\n") + "\n",
      stderr: "",
    }
  }

  return {
    status: 0,
    stdout: [
      "Persona Workflow Next Ticket",
      "",
      `Ticket: ${nextTicket.ticket}`,
      `Title: ${nextTicket.title}`,
      `Card: ${nextTicket.path}`,
      "",
      "Next:",
      "- Read the task card.",
      "- Implement only this ticket.",
      `- When done, run \`npx ph workflow archive ${nextTicket.ticket}\`.`,
    ].join("\n") + "\n",
    stderr: "",
  }
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

  return {
    status: 0,
    stdout: [
      `Workflow ticket archived: ${ticketId}`,
      "",
      `From: ${WORK_DIR}/${ticketId}`,
      `To: ${HISTORY_DIR}/${ticketId}`,
      "",
      "Next:",
      "- `npx ph workflow next`",
    ].join("\n") + "\n",
    stderr: "",
  }
}

export function workflowTicketUsage(invocation = "ph"): string {
  return [
    `${invocation} workflow split README.md`,
    `${invocation} workflow next`,
    `${invocation} workflow archive <ticket>`,
  ].join("\n")
}
