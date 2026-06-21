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
import {
  PlanStatusError,
  type PlanAcceptanceStatus,
  readWorkflowPlanStatus,
  updateWorkflowPlanStatus,
} from "./plan-status.js"
import {
  WorkflowReportStatusError,
  parseWorkflowReportKind,
  updateWorkflowReportStatus,
  type WorkflowReportKind,
} from "./report-status.js"

type ParsedPlanArgs =
  | { readonly kind: "run"; readonly force: boolean }
  | { readonly kind: "status" }
  | { readonly kind: "accept" }
  | { readonly kind: "revise" }
  | { readonly kind: "prompt" }
  | { readonly kind: "implement" }
  | { readonly kind: "report-filled"; readonly reportKind: WorkflowReportKind }
  | { readonly kind: "help" }
  | { readonly kind: "invalid"; readonly message: string }

export function planUsage(invocation = "ph"): string {
  return [
    `Usage: ${invocation} plan [--force | --status | --accept | --revise | --prompt | --implement | --report-filled <implementation|review>]`,
    "",
    "Creates and manages a blackbear architecture plan before implementation.",
    "",
    "Options:",
    "  --force   Replace existing workflow drafts.",
    "  --status  Read the plan acceptance status.",
    "  --accept  Mark the plan status as accepted.",
    "  --revise  Mark the plan status as needs-revision.",
    "  --prompt  Print the default OpenCode plan-only prompt.",
    "  --implement",
    "            Check the accepted workflow plan gate and print the implementation prompt.",
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
  return { kind: "invalid", message: `Unknown option: ${arg}` }
}

export function createPlanOnlyPrompt(): string {
  return [
    "README.md, .persona/project-profile.jsonc, .persona/policies, .persona/workflow/plan.md를 읽고 구현하지 말고 architecture/technology plan만 완성해줘.",
    "",
    "계획에는 요구사항 요약, Java/Spring Gradle 기술 선택, package/layer 구조, storage/persistence 선택, repository boundary, DTO boundary, domain behavior 기준을 포함해줘.",
    "",
    "계획이 불확실하면 구현하지 말고 질문이나 가정을 .persona/workflow/plan.md에 명확히 남겨줘.",
    "",
    "만약 사용자가 '플랜 보고 구현해줘', '계획대로 해줘', '이제 구현해줘'처럼 짧은 구현 지시를 하면 바로 구현하지 말고 `npx ph plan --implement`를 먼저 실행해줘.",
    "",
    "명령 실행이 필요하면 `npx ph bearshell`을 우선 사용하고, Persona Harness CLI는 글로벌 `ph`가 아니라 `npx ph`로 실행해줘.",
  ].join("\n")
}

export function createImplementationPrompt(): string {
  return [
    "README.md, .persona/project-profile.jsonc, .persona/policies, .persona/workflow/plan.md를 먼저 읽고 accepted plan 기준으로 구현해줘.",
    "",
    "구현 중에는 Java/Spring Gradle backend Clean Code 범위를 유지하고, plan에 없는 frontend/infra/desktop 범위로 확장하지 마.",
    "",
    "구현 후 .persona/workflow/implementation-report.md를 채우고 `npx ph plan --report-filled implementation`을 실행해줘.",
    "",
    "리뷰와 manual QA가 끝나면 .persona/workflow/review-report.md를 채우고 `npx ph plan --report-filled review`를 실행해줘.",
    "",
    "명령 실행이 필요하면 `npx ph bearshell`을 우선 사용하고, Persona Harness CLI는 글로벌 `ph`가 아니라 `npx ph`로 실행해줘.",
  ].join("\n")
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

function implementationGateOutput(planPath: string, status: string): string {
  return [
    "Persona Harness implementation gate passed.",
    "",
    `Plan: ${planPath}`,
    `Status: ${status}`,
    "",
    "Required context:",
    "- README.md",
    "- .persona/project-profile.jsonc",
    "- .persona/policies",
    `- ${PLAN_PATH}`,
    "",
    "Required workflow reports:",
    `- ${IMPLEMENTATION_REPORT_PATH}`,
    `- ${REVIEW_REPORT_PATH}`,
    "",
    "Implementation prompt:",
    createImplementationPrompt(),
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

  return { status: 0, stdout: implementationGateOutput(result.planPath, result.status), stderr: "" }
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
