import { existsSync } from "node:fs"
import { join, resolve } from "node:path"
import process from "node:process"

import type { CliRunResult } from "./bearshell.js"
import { PROFILE_PATH } from "./intake-profile.js"
import { initializePersonaHarness } from "./init.js"
import { runIntakeCommand } from "./intake.js"
import { IMPLEMENTATION_REPORT_PATH, PLAN_PATH, REVIEW_REPORT_PATH } from "./plan.js"
import { runPlanCommand } from "./plan-command.js"
import { runPolicyCommand } from "./policy.js"
import { readBackendProjectProfileState } from "../phase0/project-profile.js"

type BootstrapOptions = {
  readonly projectDir?: string
  readonly packageRoot?: string
}

type ParsedBootstrapArgs =
  | { readonly kind: "backend"; readonly force: boolean }
  | { readonly kind: "help" }
  | { readonly kind: "invalid"; readonly message: string }

const PERSONA_DIR = ".persona"
const POLICY_OVERLAY_PATH = ".persona/policies/overlay.jsonc"

export function bootstrapUsage(invocation = "ph"): string {
  return [
    `Usage: ${invocation} bootstrap backend [--force]`,
    "",
    "Prepares the backend Persona Harness workflow for AI implementation.",
    "",
    "What it fills when missing:",
    `- ${PERSONA_DIR}/ harness files`,
    `- ${PROFILE_PATH}`,
    `- ${POLICY_OVERLAY_PATH}`,
    `- ${PLAN_PATH}`,
    `- ${IMPLEMENTATION_REPORT_PATH}`,
    `- ${REVIEW_REPORT_PATH}`,
    "",
    "Scope:",
    "- Java/Spring backend workflow convenience",
    "- no generated app product-quality certification",
    "- no frontend/infra workflow",
  ].join("\n")
}

function parseBootstrapArgs(args: readonly string[]): ParsedBootstrapArgs {
  if (args.length === 0 || args[0] === "--help" || args[0] === "-h" || args[0] === "help") {
    return { kind: "help" }
  }
  if (args[0] !== "backend") {
    return { kind: "invalid", message: `Unknown bootstrap command: ${args[0]}` }
  }

  let force = false
  for (const arg of args.slice(1)) {
    if (arg === "--force") {
      force = true
      continue
    }
    return { kind: "invalid", message: `Unknown option: ${arg}` }
  }

  return { kind: "backend", force }
}

function projectDirFor(options: BootstrapOptions): string {
  return resolve(options.projectDir ?? process.cwd())
}

function failStep(step: string, result: CliRunResult): CliRunResult {
  return {
    status: 1,
    stdout: "",
    stderr: [
      `Persona Harness backend bootstrap failed during ${step}.`,
      "",
      result.stderr.trim().length > 0 ? result.stderr.trim() : result.stdout.trim(),
      "",
    ].join("\n"),
  }
}

function runAndRecord(
  actions: string[],
  step: string,
  result: CliRunResult,
  successMessage: string,
): CliRunResult | undefined {
  if (result.status !== 0) {
    return failStep(step, result)
  }
  actions.push(successMessage)
  return undefined
}

function runBackendBootstrap(options: BootstrapOptions, force: boolean): CliRunResult {
  const projectDir = projectDirFor(options)
  const actions: string[] = []
  const skipped: string[] = []

  if (!existsSync(join(projectDir, PERSONA_DIR))) {
    initializePersonaHarness({ projectDir, packageRoot: options.packageRoot })
    actions.push("initialized .persona and OpenCode plugin config")
  } else {
    skipped.push(".persona already exists")
  }

  const profileState = readBackendProjectProfileState(projectDir)
  if (force || profileState.status !== "ready") {
    const result = runIntakeCommand(["--default", "backend", "--force"], { projectDir }, "ph")
    const failure = runAndRecord(actions, "profile", result, "created default backend profile")
    if (failure !== undefined) {
      return failure
    }
  } else {
    skipped.push(`${PROFILE_PATH} already ready`)
  }

  if (force || !existsSync(join(projectDir, POLICY_OVERLAY_PATH))) {
    const policyArgs = force ? ["init", "--force"] : ["init"]
    const result = runPolicyCommand(policyArgs, { projectDir }, "ph")
    const failure = runAndRecord(actions, "policy", result, "created backend policy overlay")
    if (failure !== undefined) {
      return failure
    }
  } else {
    skipped.push(`${POLICY_OVERLAY_PATH} already exists`)
  }

  if (force || !existsSync(join(projectDir, PLAN_PATH))) {
    const result = runPlanCommand(["--auto-accept"], { projectDir }, "ph")
    const failure = runAndRecord(actions, "plan", result, "created and accepted backend workflow plan")
    if (failure !== undefined) {
      return failure
    }
  } else {
    skipped.push(`${PLAN_PATH} already exists`)
  }

  return {
    status: 0,
    stdout: [
      "Persona Harness backend bootstrap complete.",
      "",
      "Actions:",
      ...(actions.length > 0 ? actions.map((action) => `- ${action}`) : ["- no changes needed"]),
      "",
      "Skipped:",
      ...(skipped.length > 0 ? skipped.map((item) => `- ${item}`) : ["- none"]),
      "",
      "Ready workflow files:",
      `- ${PROFILE_PATH}`,
      `- ${POLICY_OVERLAY_PATH}`,
      `- ${PLAN_PATH}`,
      `- ${IMPLEMENTATION_REPORT_PATH}`,
      `- ${REVIEW_REPORT_PATH}`,
      "",
      "Next:",
      "- Ask the AI agent to run `npx ph workflow implement` before implementation.",
      "- Short TUI requests like `README.md 보고 구현해줘` should use the workflow rail, not ad hoc commands.",
      "",
      "Scope:",
      "- workflow convenience only",
      "- no generated app product-quality certification",
    ].join("\n") + "\n",
    stderr: "",
  }
}

export function runBootstrapCommand(
  args: readonly string[],
  options: BootstrapOptions = {},
  invocationName = "ph",
): CliRunResult {
  const parsed = parseBootstrapArgs(args)
  if (parsed.kind === "help") {
    return { status: 0, stdout: `${bootstrapUsage(invocationName)}\n`, stderr: "" }
  }
  if (parsed.kind === "invalid") {
    return { status: 1, stdout: "", stderr: `${parsed.message}\n\n${bootstrapUsage(invocationName)}\n` }
  }
  return runBackendBootstrap(options, parsed.force)
}
