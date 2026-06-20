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

type ParsedPlanArgs =
  | { readonly kind: "run"; readonly force: boolean }
  | { readonly kind: "status" }
  | { readonly kind: "accept" }
  | { readonly kind: "revise" }
  | { readonly kind: "help" }
  | { readonly kind: "invalid"; readonly message: string }

export function planUsage(invocation = "ph"): string {
  return [
    `Usage: ${invocation} plan [--force | --status | --accept | --revise]`,
    "",
    "Creates and manages a blackbear architecture plan before implementation.",
    "",
    "Options:",
    "  --force   Replace existing workflow drafts.",
    "  --status  Read the plan acceptance status.",
    "  --accept  Mark the plan status as accepted.",
    "  --revise  Mark the plan status as needs-revision.",
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
  return { kind: "invalid", message: `Unknown option: ${arg}` }
}

function statusOutput(title: string, planPath: string, status: string): string {
  return [`Persona Harness ${title}.`, "", `Plan: ${planPath}`, `Status: ${status}`].join("\n") + "\n"
}

function updateStatus(status: PlanAcceptanceStatus, options: PlanOptions): CliRunResult {
  const result = updateWorkflowPlanStatus(status, options)
  const title = status === "accepted" ? "plan accepted" : "plan marked for revision"
  return { status: 0, stdout: statusOutput(title, result.planPath, result.status), stderr: "" }
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
        "- Run `ph plan --accept` before implementation, or `ph plan --revise` if the plan needs changes.",
        `- Fill ${IMPLEMENTATION_REPORT_PATH} after implementation.`,
        `- Fill ${REVIEW_REPORT_PATH} after review/manual QA.`,
      ].join("\n") + "\n",
      stderr: "",
    }
  } catch (error) {
    if (error instanceof PlanDraftError || error instanceof PlanStatusError) {
      return { status: 1, stdout: "", stderr: `${error.message}\n` }
    }
    throw error
  }
}
