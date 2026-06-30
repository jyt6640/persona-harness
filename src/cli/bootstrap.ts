import { existsSync, writeFileSync } from "node:fs"
import { join, resolve } from "node:path"
import process from "node:process"

import type { CliRunResult } from "./bearshell.js"
import { enableStrictClosureVerification } from "./bootstrap-strict.js"
import { PROFILE_PATH } from "./intake-profile.js"
import { initializePersonaHarness } from "./init.js"
import { runIntakeCommand } from "./intake.js"
import { IMPLEMENTATION_REPORT_PATH, PLAN_PATH, REVIEW_REPORT_PATH } from "./plan.js"
import { runPlanCommand } from "./plan-command.js"
import { runPolicyCommand } from "./policy.js"
import { readBackendProjectProfileState } from "../config/project-profile.js"

type BootstrapOptions = {
  readonly projectDir?: string
  readonly packageRoot?: string
}

type ParsedBootstrapArgs =
  | { readonly force: boolean; readonly kind: "backend"; readonly strict: boolean }
  | { readonly kind: "help" }
  | { readonly kind: "invalid"; readonly message: string }

const PERSONA_DIR = ".persona"
const HARNESS_CONFIG_PATH = ".persona/harness.jsonc"
const CONVENTIONS_DIR_PATH = ".persona/conventions/"
const RULES_DIR_PATH = ".persona/rules/"
const OPENCODE_CONFIG_PATH = ".opencode/opencode.json"
const GITIGNORE_PATH = ".gitignore"
const POLICY_OVERLAY_PATH = ".persona/policies/overlay.jsonc"
const ROOT_AGENT_INSTRUCTIONS_PATH = "AGENTS.md"

export function bootstrapUsage(invocation = "ph"): string {
  return [
    `Usage: ${invocation} bootstrap backend [--force] [--strict]`,
    "",
    "Prepares the backend Persona Harness workflow for AI implementation.",
    "",
    "What it fills when missing:",
    `- ${HARNESS_CONFIG_PATH}`,
    `- ${CONVENTIONS_DIR_PATH}`,
    `- ${RULES_DIR_PATH}`,
    `- ${OPENCODE_CONFIG_PATH}`,
    `- ${GITIGNORE_PATH}`,
    `- ${ROOT_AGENT_INSTRUCTIONS_PATH}`,
    `- ${PROFILE_PATH}`,
    `- ${POLICY_OVERLAY_PATH}`,
    `- ${PLAN_PATH}`,
    `- ${IMPLEMENTATION_REPORT_PATH}`,
    `- ${REVIEW_REPORT_PATH}`,
    "",
    "Scope:",
    "- Java/Spring backend workflow convenience",
    "- --strict enables PH-run direct verification during closure/finish; expect toolchain command cost",
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
  let strict = false
  for (const arg of args.slice(1)) {
    if (arg === "--force") {
      force = true
      continue
    }
    if (arg === "--strict") {
      strict = true
      continue
    }
    return { kind: "invalid", message: `Unknown option: ${arg}` }
  }

  return { kind: "backend", force, strict }
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

function backendAgentInstructions(): string {
  return [
    "# Persona Harness Agent Instructions",
    "",
    "This project is initialized with Persona Harness for Java/Spring backend work.",
    "",
    "Before implementation:",
    "- Run `npx ph workflow implement` and follow the single AI-facing rail.",
    "- Read `.persona/project-profile.jsonc` directly. Do not rely on Glob results for hidden `.persona` paths.",
    "- Use the project profile as the source of truth for language, framework, build tool, storage, persistence, migration, package style, and architecture style.",
    "- If README.md does not mention a technology stack, keep the stack from `.persona/project-profile.jsonc`.",
    "",
    "Do not infer a Node/CommonJS project from package.json.",
    "- package.json may exist only because Persona Harness is installed through npm.",
    "- node_modules is dependency/vendor material, not product implementation context.",
    "",
    "Do not read these as implementation context:",
    "- node_modules",
    "- .opencode/node_modules",
    "- .persona/rules",
    "- .persona/evidence",
    "",
    "After implementation:",
    "- Fill `.persona/workflow/implementation-report.md`.",
    "- Fill `.persona/workflow/review-report.md`.",
    "- Run `npx ph workflow finish implement` before claiming completion.",
    "",
  ].join("\n")
}

function writeBackendAgentInstructions(projectDir: string, skipped: string[], force: boolean): string | undefined {
  const targetPath = join(projectDir, ROOT_AGENT_INSTRUCTIONS_PATH)
  if (existsSync(targetPath) && !force) {
    skipped.push(`${ROOT_AGENT_INSTRUCTIONS_PATH} already exists`)
    return undefined
  }
  writeFileSync(targetPath, backendAgentInstructions(), "utf8")
  return `created ${ROOT_AGENT_INSTRUCTIONS_PATH} AI bootstrap instructions`
}

function runBackendBootstrap(options: BootstrapOptions, force: boolean, strict: boolean): CliRunResult {
  const projectDir = projectDirFor(options)
  const actions: string[] = []
  const skipped: string[] = []

  if (!existsSync(join(projectDir, PERSONA_DIR))) {
    initializePersonaHarness({ projectDir, packageRoot: options.packageRoot })
    actions.push("initialized .persona and OpenCode plugin config")
  } else {
    skipped.push(".persona already exists")
  }

  if (strict) {
    const strictFailure = enableStrictClosureVerification(projectDir)
    if (strictFailure !== undefined) {
      return strictFailure
    }
    actions.push("enabled strict closure verification; PH runs the project verification command during closure/finish, so expect toolchain command cost")
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

  const agentInstructionAction = writeBackendAgentInstructions(projectDir, skipped, force)
  if (agentInstructionAction !== undefined) {
    actions.push(agentInstructionAction)
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
      "Ready backend bootstrap files:",
      `- ${HARNESS_CONFIG_PATH}`,
      `- ${CONVENTIONS_DIR_PATH}`,
      `- ${RULES_DIR_PATH}`,
      `- ${OPENCODE_CONFIG_PATH}`,
      `- ${GITIGNORE_PATH}`,
      `- ${ROOT_AGENT_INSTRUCTIONS_PATH}`,
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
  return runBackendBootstrap(options, parsed.force, parsed.strict)
}
