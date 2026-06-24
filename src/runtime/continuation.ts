import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"

import { writeContinuationEvidence } from "./evidence.js"

type ContinuationSummary = {
  readonly finding: "INFO" | "WARN"
  readonly reason: string
  readonly nextAction: string
  readonly pendingTicket?: string
  readonly pendingTicketPath?: string
  readonly remainingReadRange?: string
  readonly remainingScope?: string
  readonly nextPromptHint?: string
}

const IMPLEMENTATION_REPORT_PATH = ".persona/workflow/implementation-report.md"
const BACKLOG_PATH = ".persona/workflow/backlog.md"
const WORKFLOW_OPT_IN_PATH = ".persona"

const COMPLETION_CLAIM_PATTERN = /(완료|끝났|끝냈|구현했습니다|구현 완료|마무리|done|complete|completed|implemented|finished)/iu
const EMPTY_VALUE_PATTERN = /^(?:없음|없다|none|n\/a|na|-|완료|complete|completed|all done)$/iu

function readIfExists(projectDir: string, relativePath: string): string | undefined {
  const path = join(projectDir, relativePath)
  return existsSync(path) ? readFileSync(path, "utf8") : undefined
}

function valueForLabel(text: string, label: string): string | undefined {
  const prefix = `- ${label}:`
  for (const line of text.split(/\r?\n/)) {
    if (line.startsWith(prefix)) {
      const value = line.slice(prefix.length).trim()
      return value.length > 0 ? value : undefined
    }
  }
  return undefined
}

function filledValue(text: string, label: string): string | undefined {
  const value = valueForLabel(text, label)
  if (value === undefined || EMPTY_VALUE_PATTERN.test(value)) {
    return undefined
  }
  return value
}

function firstPendingTicket(backlogText: string): Pick<ContinuationSummary, "pendingTicket" | "pendingTicketPath"> {
  for (const line of backlogText.split(/\r?\n/)) {
    const cells = line.split("|").map((cell) => cell.trim()).filter((cell) => cell.length > 0)
    if (cells.length < 5 || cells[3] !== "pending") {
      continue
    }
    return {
      pendingTicket: cells[2],
      pendingTicketPath: cells[4],
    }
  }
  return {}
}

function summarizeContinuation(projectDir: string, outputText: string): ContinuationSummary | undefined {
  if (!existsSync(join(projectDir, WORKFLOW_OPT_IN_PATH))) {
    return undefined
  }

  const implementationReport = readIfExists(projectDir, IMPLEMENTATION_REPORT_PATH)
  const backlog = readIfExists(projectDir, BACKLOG_PATH)
  const pending = backlog === undefined ? {} : firstPendingTicket(backlog)
  const remainingReadRange = implementationReport === undefined
    ? undefined
    : filledValue(implementationReport, "남은 README/plan 범위")
  const remainingScope = implementationReport === undefined
    ? undefined
    : filledValue(implementationReport, "남은 구현 범위")
  const incompleteRequirements = implementationReport === undefined
    ? undefined
    : filledValue(implementationReport, "미완료 요구사항")
  const nextPromptHint = implementationReport === undefined
    ? undefined
    : filledValue(implementationReport, "다음 프롬프트 힌트")

  const hasRemainingReportScope =
    remainingReadRange !== undefined ||
    remainingScope !== undefined ||
    incompleteRequirements !== undefined ||
    nextPromptHint !== undefined
  const hasPendingTicket = pending.pendingTicket !== undefined
  if (!hasRemainingReportScope && !(hasPendingTicket && COMPLETION_CLAIM_PATTERN.test(outputText))) {
    return undefined
  }

  return {
    finding: hasPendingTicket || hasRemainingReportScope ? "WARN" : "INFO",
    reason: hasRemainingReportScope
      ? "Implementation report records remaining scope."
      : "Assistant output looks complete while workflow backlog still has pending tickets.",
    nextAction: "Run `npx ph workflow continue` or `npx ph workflow next`, then implement only the next pending ticket.",
    ...pending,
    remainingReadRange,
    remainingScope: remainingScope ?? incompleteRequirements,
    nextPromptHint,
  }
}

function continuationBlock(summary: ContinuationSummary): string {
  return [
    "[Persona Harness Continuation]",
    "",
    `Finding: ${summary.finding}`,
    `Reason: ${summary.reason}`,
    summary.pendingTicket === undefined ? undefined : `Next pending ticket: ${summary.pendingTicket}`,
    summary.pendingTicketPath === undefined ? undefined : `Task card: ${summary.pendingTicketPath}`,
    summary.remainingReadRange === undefined ? undefined : `Remaining README/plan range: ${summary.remainingReadRange}`,
    summary.remainingScope === undefined ? undefined : `Remaining scope: ${summary.remainingScope}`,
    summary.nextPromptHint === undefined ? undefined : `Next prompt hint: ${summary.nextPromptHint}`,
    "",
    `Next action: ${summary.nextAction}`,
    "",
    "This is report-only continuation guidance, not a build/test gate.",
  ].filter((line): line is string => line !== undefined).join("\n")
}

export class ContinuationTracker {
  private readonly reportedSessions = new Set<string>()

  completeText(projectDir: string, sessionID: string, outputText: string): string | undefined {
    if (this.reportedSessions.has(sessionID)) {
      return undefined
    }

    const summary = summarizeContinuation(projectDir, outputText)
    if (summary === undefined) {
      return undefined
    }

    this.reportedSessions.add(sessionID)
    writeContinuationEvidence(projectDir, {
      hook: "experimental.text.complete",
      sessionID,
      finding: summary.finding,
      reason: summary.reason,
      nextAction: summary.nextAction,
      pendingTicket: summary.pendingTicket,
      pendingTicketPath: summary.pendingTicketPath,
      remainingReadRange: summary.remainingReadRange,
      remainingScope: summary.remainingScope,
      nextPromptHint: summary.nextPromptHint,
    })
    return continuationBlock(summary)
  }
}
