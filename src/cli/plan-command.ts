import { existsSync } from "node:fs"
import { join, resolve } from "node:path"
import process from "node:process"

import type { CliRunResult } from "./bearshell.js"
import {
  IMPLEMENTATION_REPORT_PATH,
  PlanDraftError,
  PLAN_PATH,
  REVIEW_REPORT_PATH,
  initializeWorkflowPlan,
  type PlanOptions,
} from "./plan.js"
import { runNextCommand, runResumeCommand } from "./plan-next.js"
import {
  PlanStatusError,
  type PlanAcceptanceStatus,
  readWorkflowPlanStatus,
  updateWorkflowPlanStatus,
} from "./plan-status.js"
import { createImplementationPrompt, createPlanOnlyPrompt } from "./plan-prompts.js"
import { workflowRequiredContextLines } from "./workflow-context-guidance.js"
import {
  WorkflowReportStatusError,
  parseWorkflowReportKind,
  updateWorkflowReportStatus,
  type WorkflowReportKind,
} from "./report-status.js"

type ParsedPlanArgs =
  | { readonly kind: "run"; readonly force: boolean }
  | { readonly kind: "auto-accept"; readonly force: boolean }
  | { readonly kind: "status" }
  | { readonly kind: "accept" }
  | { readonly kind: "revise" }
  | { readonly kind: "prompt" }
  | { readonly kind: "implement" }
  | { readonly kind: "next" }
  | { readonly kind: "resume" }
  | { readonly kind: "report-filled"; readonly reportKind: WorkflowReportKind }
  | { readonly kind: "help" }
  | { readonly kind: "invalid"; readonly message: string }

export function planUsage(invocation = "ph"): string {
  return [
    `Usage: ${invocation} plan [--force | --auto-accept | --status | --accept | --revise | --prompt | --implement | --next | --resume | --report-filled <implementation|review>]`,
    "",
    "Creates and manages a blackbear architecture plan before implementation.",
    "",
    "Options:",
    "  --force   Replace existing workflow drafts.",
    "  --auto-accept",
    "            Create workflow drafts and mark the plan accepted for the fastest backend MVP flow.",
    "  --status  Read the plan acceptance status.",
    "  --accept  Mark the plan status as accepted.",
    "  --revise  Mark the plan status as needs-revision.",
    "  --prompt  Print the default OpenCode plan-only prompt.",
    "  --implement",
    "            Check the accepted workflow plan gate and print the implementation prompt.",
    "  --next   Print the next workflow action from plan/report status.",
    "  --resume Print an implementation continuation prompt from workflow report evidence.",
    "  --report-filled <implementation|review>",
    "            Mark a filled workflow report as filled.",
    "",
    "Output:",
    `- ${PLAN_PATH}`,
    `- ${IMPLEMENTATION_REPORT_PATH}`,
    `- ${REVIEW_REPORT_PATH}`,
    "",
    "Scope:",
    "- Java/Spring backend Clean Code planning surface",
    "- Uses README and backend project profile as planning context",
    "- No rule enforcement",
    "- No autonomous implementation",
  ].join("\n")
}

function parsePlanArgs(args: readonly string[]): ParsedPlanArgs {
  if (args.length === 0) {
    return { kind: "run", force: false }
  }

  if (args[0] === "--report-filled") {
    const reportKind = parseWorkflowReportKind(args[1])
    if (args.length !== 2 || reportKind === undefined) {
      return { kind: "invalid", message: "Report kind must be implementation or review." }
    }
    return { kind: "report-filled", reportKind }
  }

  if (args.length > 1) {
    return { kind: "invalid", message: "Plan command accepts one option at a time." }
  }

  const arg = args[0]
  if (arg === "--help" || arg === "-h") {
    return { kind: "help" }
  }
  if (arg === "--force") {
    return { kind: "run", force: true }
  }
  if (arg === "--auto-accept") {
    return { kind: "auto-accept", force: true }
  }
  if (arg === "--status") {
    return { kind: "status" }
  }
  if (arg === "--accept") {
    return { kind: "accept" }
  }
  if (arg === "--revise") {
    return { kind: "revise" }
  }
  if (arg === "--prompt") {
    return { kind: "prompt" }
  }
  if (arg === "--implement") {
    return { kind: "implement" }
  }
  if (arg === "--next") {
    return { kind: "next" }
  }
  if (arg === "--resume") {
    return { kind: "resume" }
  }
  return { kind: "invalid", message: `Unknown option: ${arg}` }
}

function statusOutput(title: string, planPath: string, status: string): string {
  return [`Persona Harness ${title}.`, "", `Plan: ${planPath}`, `Status: ${status}`].join("\n") + "\n"
}

function reportStatusOutput(title: string, relativePath: string, reportPath: string, status: string): string {
  return [
    `Persona Harness ${title}.`,
    "",
    `Workflow report: ${relativePath}`,
    `Path: ${reportPath}`,
    `Status: ${status}`,
  ].join("\n") + "\n"
}

function updateStatus(status: PlanAcceptanceStatus, options: PlanOptions): CliRunResult {
  const result = updateWorkflowPlanStatus(status, options)
  const title = status === "accepted" ? "plan accepted" : "plan marked for revision"
  return { status: 0, stdout: statusOutput(title, result.planPath, result.status), stderr: "" }
}

function projectDirFor(options: PlanOptions): string {
  return resolve(options.projectDir ?? process.cwd())
}

function missingWorkflowArtifacts(options: PlanOptions): readonly string[] {
  const projectDir = projectDirFor(options)
  return [IMPLEMENTATION_REPORT_PATH, REVIEW_REPORT_PATH].filter((relativePath) => !existsSync(join(projectDir, relativePath)))
}

function implementationGateOutput(planPath: string, status: string, projectDir?: string): string {
  return [
    "Persona Harness implementation gate passed.",
    "",
    `Plan: ${planPath}`,
    `Status: ${status}`,
    "",
    "Required context:",
    ...workflowRequiredContextLines(projectDir),
    "- Use PH-owned surfaces first for structure checks: accepted plan, workflow check/closure, ast-grep conventions, and relay handoff",
    "- Optional external codegraph/code-nav tools may be used only if actually available; do not present them as PH-owned or token-saving",
    "",
    "Required workflow reports:",
    `- ${IMPLEMENTATION_REPORT_PATH}`,
    `- ${REVIEW_REPORT_PATH}`,
    "",
    "Required workflow commands:",
    "- Before implementation, run `npx ph workflow implement` for the single AI-facing implementation rail.",
    "- Run shell verification through `npx ph bearshell` when possible.",
    "- After implementation, fill the implementation report and run `npx ph plan --report-filled implementation`.",
    "- Before final answer, fill the review report after manual QA, run `npx ph plan --report-filled review`, then run `npx ph workflow finish implement`.",
    "",
    "Implementation prompt:",
    createImplementationPrompt(projectDir),
  ].join("\n") + "\n"
}

function runImplementationGate(options: PlanOptions): CliRunResult {
  const result = readWorkflowPlanStatus(options)
  if (result.status !== "accepted") {
    throw new PlanStatusError(
      [
        "Workflow plan is not accepted.",
        `Current status: ${result.status}`,
        "Run npx ph plan --accept after review, or npx ph plan --revise if the plan needs changes.",
        "For a short TUI request like '그냥 플랜보고 구현해줘', run npx ph workflow implement after acceptance.",
      ].join("\n"),
    )
  }

  const missingArtifacts = missingWorkflowArtifacts(options)
  if (missingArtifacts.length > 0) {
    throw new PlanStatusError(
      [
        `Missing workflow artifacts: ${missingArtifacts.join(", ")}`,
        "Run npx ph plan first to create the required workflow templates.",
      ].join("\n"),
    )
  }

  return { status: 0, stdout: implementationGateOutput(result.planPath, result.status, projectDirFor(options)), stderr: "" }
}

export function runPlanCommand(args: readonly string[], options: PlanOptions = {}, invocationName = "ph"): CliRunResult {
  const parsed = parsePlanArgs(args)

  if (parsed.kind === "help") {
    return { status: 0, stdout: `${planUsage(invocationName)}\n`, stderr: "" }
  }

  if (parsed.kind === "invalid") {
    return { status: 1, stdout: "", stderr: `${parsed.message}\n\n${planUsage(invocationName)}\n` }
  }

  try {
    if (parsed.kind === "status") {
      const result = readWorkflowPlanStatus(options)
      return { status: 0, stdout: statusOutput("plan status", result.planPath, result.status), stderr: "" }
    }
    if (parsed.kind === "accept") {
      return updateStatus("accepted", options)
    }
    if (parsed.kind === "revise") {
      return updateStatus("needs-revision", options)
    }
    if (parsed.kind === "report-filled") {
      const result = updateWorkflowReportStatus(parsed.reportKind, "filled", options)
      return {
        status: 0,
        stdout: reportStatusOutput("workflow report filled", result.relativePath, result.reportPath, result.status),
        stderr: "",
      }
    }
    if (parsed.kind === "prompt") {
      return { status: 0, stdout: `${createPlanOnlyPrompt()}\n`, stderr: "" }
    }
    if (parsed.kind === "implement") {
      return runImplementationGate(options)
    }
    if (parsed.kind === "next") {
      return runNextCommand(options)
    }
    if (parsed.kind === "resume") {
      return runResumeCommand(options)
    }
    if (parsed.kind === "auto-accept") {
      const planPath = initializeWorkflowPlan(options, parsed.force)
      const accepted = updateWorkflowPlanStatus("accepted", options)
      return {
        status: 0,
        stdout: [
          "Persona Harness blackbear plan draft created and accepted.",
          "",
          `Plan: ${planPath}`,
          `Status: ${accepted.status}`,
          "",
          "Next:",
          "- Run `npx ph workflow implement` before implementation.",
          `- Fill ${IMPLEMENTATION_REPORT_PATH} after implementation, then run \`npx ph plan --report-filled implementation\`.`,
          `- Fill ${REVIEW_REPORT_PATH} after review/manual QA, then run \`npx ph plan --report-filled review\`.`,
        ].join("\n") + "\n",
        stderr: "",
      }
    }

    const planPath = initializeWorkflowPlan(options, parsed.force)
    return {
      status: 0,
      stdout: [
        "Persona Harness blackbear plan draft created.",
        "",
        `Plan: ${planPath}`,
        "",
        "Next:",
        `- Review and complete ${PLAN_PATH} before implementation.`,
        "- Run `npx ph plan --accept` before implementation, or `npx ph plan --revise` if the plan needs changes.",
        `- Fill ${IMPLEMENTATION_REPORT_PATH} after implementation, then run \`npx ph plan --report-filled implementation\`.`,
        `- Fill ${REVIEW_REPORT_PATH} after review/manual QA, then run \`npx ph plan --report-filled review\`.`,
      ].join("\n") + "\n",
      stderr: "",
    }
  } catch (error) {
    if (error instanceof PlanDraftError || error instanceof PlanStatusError || error instanceof WorkflowReportStatusError) {
      return { status: 1, stdout: "", stderr: `${error.message}\n` }
    }
    throw error
  }
}
