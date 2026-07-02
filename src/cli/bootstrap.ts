import { existsSync, writeFileSync } from "node:fs"
import { join, resolve } from "node:path"
import process from "node:process"

import type { CliRunResult } from "./bearshell.js"
import { enableCodeNavMcpPreview } from "./bootstrap-code-nav.js"
import { enableDeveloperMcpBundle } from "./bootstrap-codegraph.js"
import { enableLspMcpPreview } from "./bootstrap-lsp.js"
import { enableMultiAgentPreview } from "./bootstrap-multi-agent.js"
import { enableRuntimeInjectionPreview, enableStrictClosureVerification } from "./bootstrap-strict.js"
import { PROFILE_PATH } from "./intake-profile.js"
import { initializePersonaHarness } from "./init.js"
import { runIntakeCommand } from "./intake.js"
import { IMPLEMENTATION_REPORT_PATH, PLAN_PATH, REVIEW_REPORT_PATH } from "./plan.js"
import { runPlanCommand } from "./plan-command.js"
import { runPolicyCommand } from "./policy.js"
import { loadHarnessConfig } from "../config/harness-config.js"
import { readBackendProjectProfileState } from "../config/project-profile.js"

type BootstrapOptions = {
  readonly env?: Readonly<Record<string, string | undefined>>
  readonly projectDir?: string
  readonly packageRoot?: string
}

type BackendBootstrapFlags = {
  readonly codeGraphEnabled: boolean
  readonly codeGraphPreview: boolean
  readonly codeNavPreview: boolean
  readonly developerMcpEnabled: boolean
  readonly force: boolean
  readonly lspPreview: boolean
  readonly multiAgentPreview: boolean
  readonly runtimeInjectionPreview: boolean
  readonly strict: boolean
}

type ParsedBootstrapArgs =
  | ({ readonly kind: "backend" } & BackendBootstrapFlags)
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

function strictModeSummaryLines(): readonly string[] {
  return [
    "Strict mode:",
    "- sets enforce.executeVerification: true, so PH runs the project verification command during closure/finish; expect toolchain command cost",
    "- sets features.runtimeInjection: true and enforce.systemConstitution: true, so optional PH finish/intent guard prose is injected where supported",
    "- does not enable enforce.writeDeny or enforce.idleContinuation; those stay explicit opt-ins",
    "- still no generated app product-quality certification or closure guarantee",
  ]
}

function runtimeInjectionPreviewSummaryLines(): readonly string[] {
  return [
    "Runtime injection preview:",
    "- opt-in only via --runtime-injection-preview or --strict; default init/bootstrap keeps PH as gate-first CLI/evidence tooling",
    "- enables model-facing PH guidance such as target-file injection, workflow prompt rails, continuation text, and system constitution where supported",
    "- measured 10-pair OpenCode A/B was worse for runtime injection on the bounded fixture set; keep this as guidance preview, not a token-saving or product-efficacy claim",
    "- closure/check/archive/finish gates remain authoritative whether runtime injection is on or off",
  ]
}

function multiAgentPreviewSummaryLines(): readonly string[] {
  return [
    "Multi-agent relay preview:",
    "- opt-in only via --multi-agent-preview; default bootstrap stays single-agent",
    "- writes OpenCode subagent config entries for test-writer, implementer, and reviewer",
    "- does not dispatch native subtasks, auto-fill reports, auto-archive tickets, or weaken finish",
    "- PH closure/workflow state remains the orchestrator/gate; OpenCode subagents are workers",
  ]
}

function codeNavPreviewSummaryLines(): readonly string[] {
  return [
    "Code-nav MCP preview:",
    "- opt-in only via --code-nav-preview; default bootstrap does not register the PH code-nav MCP server",
    "- writes OpenCode mcp.persona-harness-code-nav for the packaged PH code-nav MCP server",
    "- exposes bounded lookup tools as persona-harness-code-nav_search_text, persona-harness-code-nav_status, and persona-harness-code-nav_ast_grep_availability",
    "- no codegraph/indexer and no token-saving claim",
  ]
}

function lspPreviewSummaryLines(): readonly string[] {
  return [
    "LSP MCP preview:",
    "- opt-in only via --lsp-preview; default bootstrap does not register the PH LSP wrapper",
    "- writes OpenCode mcp.persona-harness-lsp for the packaged PH LSP MCP wrapper",
    "- proxies to a real external LSP MCP only when @theupsider/lsp-mcp and a Java LSP binary are available",
    "- otherwise keeps MCP protocol alive with an honest lsp_status unavailable facade",
    "- no auto-install, no code-nav relabeling, and no token-saving or product-quality claim",
  ]
}

function developerMcpSummaryLines(flags: Pick<BackendBootstrapFlags, "codeGraphEnabled" | "developerMcpEnabled">): readonly string[] {
  if (!flags.developerMcpEnabled) {
    return []
  }
  const codeGraphLine = flags.codeGraphEnabled
    ? "- codegraph is opt-in via --codegraph-preview and registered through the PH wrapper; if CodeGraph is unavailable, the wrapper keeps MCP protocol alive with an honest status-only MCP facade"
    : "- codegraph is not registered by default; use --codegraph-preview only when you explicitly want the PH CodeGraph wrapper"
  return [
    "Developer MCP bundle:",
    "- remote grep_app and context7 are registered by default for backend bootstrap; disable all bundle entries with --no-developer-mcp",
    "- registers remote grep_app and context7 MCP entries using OpenCode remote URL config",
    codeGraphLine,
    "- PH does not run codegraph init; create .codegraph intentionally when you want an index",
    "- git_bash and lsp are not registered: PH has no packaged OpenCode-compatible MCP surface for them in this release",
    "- external developer tooling only; no PH-owned codegraph, OMO replacement, or token-saving claim",
  ]
}

export function bootstrapUsage(invocation = "ph"): string {
  return [
    `Usage: ${invocation} bootstrap backend [--force] [--strict] [--runtime-injection-preview] [--multi-agent-preview] [--code-nav-preview] [--lsp-preview] [--codegraph-preview] [--no-codegraph] [--no-developer-mcp]`,
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
    "- no generated app product-quality certification",
    "- no frontend/infra workflow",
    "",
    ...strictModeSummaryLines(),
    "",
    ...runtimeInjectionPreviewSummaryLines(),
    "",
    ...multiAgentPreviewSummaryLines(),
    "",
    ...codeNavPreviewSummaryLines(),
    "",
    ...lspPreviewSummaryLines(),
    "",
    ...developerMcpSummaryLines({ codeGraphEnabled: false, developerMcpEnabled: true }),
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
  let multiAgentPreview = false
  let codeNavPreview = false
  let codeGraphEnabled = false
  let codeGraphPreview = false
  let developerMcpEnabled = true
  let lspPreview = false
  let runtimeInjectionPreview = false
  for (const arg of args.slice(1)) {
    if (arg === "--force") {
      force = true
      continue
    }
    if (arg === "--strict") {
      strict = true
      continue
    }
    if (arg === "--runtime-injection-preview") {
      runtimeInjectionPreview = true
      continue
    }
    if (arg === "--multi-agent-preview") {
      multiAgentPreview = true
      continue
    }
    if (arg === "--code-nav-preview") {
      codeNavPreview = true
      continue
    }
    if (arg === "--lsp-preview") {
      lspPreview = true
      continue
    }
    if (arg === "--codegraph-preview") {
      developerMcpEnabled = true
      codeGraphEnabled = true
      codeGraphPreview = true
      continue
    }
    if (arg === "--no-codegraph") {
      codeGraphEnabled = false
      codeGraphPreview = false
      continue
    }
    if (arg === "--no-developer-mcp") {
      developerMcpEnabled = false
      codeGraphPreview = false
      continue
    }
    return { kind: "invalid", message: `Unknown option: ${arg}` }
  }

  return {
    kind: "backend",
    codeGraphEnabled,
    codeGraphPreview,
    codeNavPreview,
    developerMcpEnabled,
    force,
    lspPreview,
    multiAgentPreview,
    runtimeInjectionPreview,
    strict,
  }
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

function runBackendBootstrap(
  options: BootstrapOptions,
  flags: BackendBootstrapFlags,
): CliRunResult {
  const projectDir = projectDirFor(options)
  const actions: string[] = []
  const skipped: string[] = []

  if (!existsSync(join(projectDir, PERSONA_DIR))) {
    initializePersonaHarness({ projectDir, packageRoot: options.packageRoot })
    actions.push("initialized .persona and OpenCode plugin config")
  } else {
    skipped.push(".persona already exists")
  }

  if (flags.strict) {
    const strictFailure = enableStrictClosureVerification(projectDir)
    if (strictFailure !== undefined) {
      return strictFailure
    }
    actions.push("enabled strict closure verification")
  }

  if (flags.runtimeInjectionPreview && !flags.strict) {
    const injectionFailure = enableRuntimeInjectionPreview(projectDir)
    if (injectionFailure !== undefined) {
      return injectionFailure
    }
    actions.push("enabled runtime injection preview")
  }

  if (flags.multiAgentPreview) {
    const previewFailure = enableMultiAgentPreview(projectDir, loadHarnessConfig(projectDir).multiAgent)
    if (previewFailure !== undefined) {
      return previewFailure
    }
    actions.push("enabled multi-agent relay preview for test-writer, implementer, and reviewer")
  }

  if (flags.codeNavPreview) {
    const codeNavFailure = enableCodeNavMcpPreview(projectDir, options.packageRoot)
    if (codeNavFailure !== undefined) {
      return codeNavFailure
    }
    actions.push("enabled code-nav MCP preview")
  }

  if (flags.lspPreview) {
    const lspFailure = enableLspMcpPreview(projectDir, options.packageRoot)
    if (lspFailure !== undefined) {
      return lspFailure
    }
    actions.push("enabled LSP MCP preview")
  }

  if (flags.developerMcpEnabled) {
    const developerMcpResult = enableDeveloperMcpBundle(projectDir, {
      codeGraphEnabled: flags.codeGraphEnabled,
      packageRoot: options.packageRoot,
    })
    if (developerMcpResult.kind === "failure") {
      return developerMcpResult.result
    }
    actions.push(flags.codeGraphEnabled
      ? "registered developer MCP bundle for OpenCode"
      : "registered developer MCP bundle for OpenCode without CodeGraph")
  } else {
    skipped.push("developer MCP bundle disabled by --no-developer-mcp")
  }

  const profileState = readBackendProjectProfileState(projectDir)
  if (flags.force || profileState.status !== "ready") {
    const result = runIntakeCommand(["--default", "backend", "--force"], { projectDir }, "ph")
    const failure = runAndRecord(actions, "profile", result, "created default backend profile")
    if (failure !== undefined) {
      return failure
    }
  } else {
    skipped.push(`${PROFILE_PATH} already ready`)
  }

  if (flags.force || !existsSync(join(projectDir, POLICY_OVERLAY_PATH))) {
    const policyArgs = flags.force ? ["init", "--force"] : ["init"]
    const result = runPolicyCommand(policyArgs, { projectDir }, "ph")
    const failure = runAndRecord(actions, "policy", result, "created backend policy overlay")
    if (failure !== undefined) {
      return failure
    }
  } else {
    skipped.push(`${POLICY_OVERLAY_PATH} already exists`)
  }

  if (flags.force || !existsSync(join(projectDir, PLAN_PATH))) {
    const result = runPlanCommand(["--auto-accept"], { projectDir }, "ph")
    const failure = runAndRecord(actions, "plan", result, "created and accepted backend workflow plan")
    if (failure !== undefined) {
      return failure
    }
  } else {
    skipped.push(`${PLAN_PATH} already exists`)
  }

  const agentInstructionAction = writeBackendAgentInstructions(projectDir, skipped, flags.force)
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
      ...(flags.strict ? [...strictModeSummaryLines(), ""] : []),
      ...(flags.runtimeInjectionPreview && !flags.strict ? [...runtimeInjectionPreviewSummaryLines(), ""] : []),
      ...(flags.multiAgentPreview ? [...multiAgentPreviewSummaryLines(), ""] : []),
      ...(flags.codeNavPreview ? [...codeNavPreviewSummaryLines(), ""] : []),
      ...(flags.lspPreview ? [...lspPreviewSummaryLines(), ""] : []),
      ...(flags.developerMcpEnabled ? [...developerMcpSummaryLines(flags), ""] : []),
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
  return runBackendBootstrap(options, parsed)
}
