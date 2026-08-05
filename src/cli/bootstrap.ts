import { existsSync } from "node:fs"
import { join, resolve } from "node:path"
import process from "node:process"

import {
  BootstrapWriteBoundaryError,
  reserveBootstrapWriteBoundary,
  type BootstrapWriteBoundary,
} from "../io/bootstrap-write-boundary.js"
import {
  WORKFLOW_LIFECYCLE_STATE_UNSUPPORTED_REASON,
  workflowLifecycleStateSupported,
} from "../io/workflow-lifecycle-state.js"
import { rulePackContentHash } from "../rules/rule-delivery.js"
import { emptyRalphLoopState, readRalphLoopStateSnapshot, writeRalphLoopState } from "../runtime/ralph-loop-state.js"
import type { CliRunResult } from "./bearshell.js"
import { enableCodeNavMcpPreview } from "./bootstrap-code-nav.js"
import { enableDeveloperMcpBundle } from "./bootstrap-codegraph.js"
import { enableLspMcpPreview } from "./bootstrap-lsp.js"
import { enableMultiAgentPreview } from "./bootstrap-multi-agent.js"
import { enableRuntimeInjectionPreview, enableStrictClosureVerification } from "./bootstrap-strict.js"
import { PROFILE_PATH } from "./intake-profile.js"
import { initializeFreshBootstrapPersonaHarness } from "./init.js"
import { runIntakeCommand } from "./intake.js"
import {
  IMPLEMENTATION_REPORT_PATH,
  PLAN_PATH,
  restoreMissingWorkflowTemplates,
  REVIEW_REPORT_PATH,
} from "./plan.js"
import { runPlanCommand } from "./plan-command.js"
import { runPolicyCommand } from "./policy.js"
import {
  readWorkflowLoopStateSnapshot,
  WORKFLOW_LOOP_STATE_SCHEMA_VERSION,
  writeWorkflowLoopState,
} from "./workflow-loop-state.js"
import { loadHarnessConfig } from "../config/harness-config.js"
import { readBackendProjectProfileState } from "../config/project-profile.js"
import { backendAgentInstructions } from "./agents-contract.js"

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
const ROLE_CHECKLIST_RELAY_SECTION_TITLE = "## Persona Harness Role Checklist Relay Preview"
const LEGACY_MULTI_AGENT_RELAY_SECTION_TITLE = "## Persona Harness Multi-Agent Relay Preview"
const BOOTSTRAP_PERSONA_FILES = [
  "harness.jsonc",
  "project-profile.jsonc",
  "policies/overlay.jsonc",
  "policies/company/backend.md",
  "policies/personal/backend.md",
] as const
const BOOTSTRAP_WORKFLOW_FILES = [
  "plan.md",
  "implementation-report.md",
  "review-report.md",
  "roles.md",
  "workflow-loop-state.json",
  "ralph-loop-state.json",
] as const

export const BOOTSTRAP_TRANSACTION_OUTPUT_MANIFEST = [
  ".gitignore",
  ".opencode/opencode.json",
  "AGENTS.md",
  ".persona/.ph-init-manifest.json",
  ".persona/harness.jsonc",
  ".persona/conventions/**",
  ".persona/rules/**",
  ".persona/project-profile.jsonc",
  ".persona/policies/overlay.jsonc",
  ".persona/policies/company/backend.md",
  ".persona/policies/personal/backend.md",
  ".persona/workflow/plan.md",
  ".persona/workflow/implementation-report.md",
  ".persona/workflow/review-report.md",
  ".persona/workflow/roles.md",
  ".persona/workflow/workflow-loop-state.json",
  ".persona/workflow/ralph-loop-state.json",
  "temporary: .<leaf>.<uuid>.tmp",
  "temporary: Persona staging directory",
] as const

function strictModeSummaryLines(): readonly string[] {
  return [
    "Strict mode:",
    "- sets enforce.executeVerification: true, so PH runs the project verification command during closure/finish; expect toolchain command cost",
    "- does not enable features.runtimeInjection or enforce.systemConstitution; each remains independently opt-in",
    "- does not enable enforce.writeDeny, enforce.idleContinuation, or enforce.ralphLoop; those stay explicit opt-ins",
    "- still no generated app product-quality certification or closure guarantee",
  ]
}

function runtimeInjectionPreviewSummaryLines(): readonly string[] {
  return [
    "Runtime injection preview:",
    "- opt-in only via --runtime-injection-preview; default init/bootstrap keeps PH as gate-first CLI/evidence tooling",
    "- enables model-facing PH guidance such as target-file injection, workflow prompt rails, continuation text, and system constitution where supported",
    "- parked after the Stage 9 banner-only H1 measurement; resume only with an approved long-session post-compaction rail-retention measurement",
    "- measured 10-pair OpenCode A/B was worse for runtime injection on the bounded fixture set; keep this as guidance preview, not a token-saving or product-efficacy claim",
    "- closure/check/archive/finish gates remain authoritative whether runtime injection is on or off",
  ]
}

function multiAgentPreviewSummaryLines(): readonly string[] {
  return [
    "Role Checklist Relay preview:",
    "- opt-in only via --multi-agent-preview; the flag/config name is kept as a compatibility alias",
    "- default bootstrap stays single-session and does not add relay guidance",
    "- writes role checklist guidance for test-writer, implementer, and reviewer",
    "- writes OpenCode subagent config entries as optional host capability when OpenCode chooses to use them",
    "- does not guarantee or enforce host subagent invocation, auto-fill reports, auto-archive tickets, or weaken finish",
    "- if host subagent invocation is unavailable, the main session completes the current role checklist and records the limitation",
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

function multiAgentRelayProcedureGuidance(): readonly string[] {
  return [
    ROLE_CHECKLIST_RELAY_SECTION_TITLE,
    "",
    "This section is present only when `ph bootstrap backend --multi-agent-preview` is used.",
    "`--multi-agent-preview` is the compatibility flag/config name for the Role Checklist Relay preview.",
    "Relay is a main-session role checklist rail through role lenses: `test-writer`, `implementer`, and `reviewer`.",
    "Hosts may expose subagent/task invocation, but Persona Harness does not guarantee or enforce host subagent invocation.",
    "",
    "At the start of each active ticket:",
    "- Run `npx ph workflow relay next --json` to identify the current role and required role artifact.",
    "- If the host exposes subagent/task invocation, use the matching OpenCode subagent: `test-writer`, `implementer`, or `reviewer`.",
    "- If subagent invocation is unavailable or not taken, complete the current role checklist in the main session.",
    "- In every role artifact, record whether subagent invocation was used or unavailable.",
    "- After the role artifact is complete, run `npx ph workflow closure next --json` to connect the next gate step.",
    "",
  ]
}

function bootstrapAgentInstructions(includeMultiAgentRelayGuidance = false): string {
  const lines = backendAgentInstructions().trimEnd().split("\n")
  lines.push("")
  if (includeMultiAgentRelayGuidance) {
    lines.push(...multiAgentRelayProcedureGuidance())
  }
  return lines.join("\n")
}

function writeBackendAgentInstructions(
  bootstrapWriteBoundary: BootstrapWriteBoundary,
  skipped: string[],
  force: boolean,
  includeMultiAgentRelayGuidance: boolean,
): string | undefined {
  const currentBytes = bootstrapWriteBoundary.readProjectFile(ROOT_AGENT_INSTRUCTIONS_PATH)
  if (currentBytes !== undefined && !force) {
    if (includeMultiAgentRelayGuidance) {
      const current = currentBytes.toString("utf8")
      if (
        current.includes(ROLE_CHECKLIST_RELAY_SECTION_TITLE) ||
        current.includes(LEGACY_MULTI_AGENT_RELAY_SECTION_TITLE)
      ) {
        skipped.push(`${ROOT_AGENT_INSTRUCTIONS_PATH} role checklist relay guidance already exists`)
        return undefined
      }
      bootstrapWriteBoundary.writeProjectFileAtomically(
        ROOT_AGENT_INSTRUCTIONS_PATH,
        `${current.trimEnd()}\n\n${multiAgentRelayProcedureGuidance().join("\n")}`,
      )
      return `updated ${ROOT_AGENT_INSTRUCTIONS_PATH} with role checklist relay procedure guidance`
    }
    skipped.push(`${ROOT_AGENT_INSTRUCTIONS_PATH} already exists`)
    return undefined
  }
  bootstrapWriteBoundary.writeProjectFileAtomically(
    ROOT_AGENT_INSTRUCTIONS_PATH,
    bootstrapAgentInstructions(includeMultiAgentRelayGuidance),
  )
  return `created ${ROOT_AGENT_INSTRUCTIONS_PATH} AI bootstrap instructions`
}

function initializeWorkflowLifecycleStates(projectDir: string, actions: string[]): CliRunResult | undefined {
  const workflowSnapshot = readWorkflowLoopStateSnapshot(projectDir)
  const ralphSnapshot = readRalphLoopStateSnapshot(projectDir)
  const now = new Date().toISOString()

  if (workflowSnapshot.integrity === "unsafe" || ralphSnapshot.integrity === "unsafe") {
    return lifecycleInitializationFailure()
  }

  try {
    if (workflowSnapshot.integrity === "absent") {
      writeWorkflowLoopState(
        projectDir,
        {
          finalDecision: "not-run",
          iterations: [],
          rulePackHash: rulePackContentHash(projectDir),
          schemaVersion: WORKFLOW_LOOP_STATE_SCHEMA_VERSION,
          startedAt: now,
        },
        workflowSnapshot.token,
      )
      actions.push("initialized empty workflow-loop state")
    }
    if (ralphSnapshot.integrity === "absent") {
      if (!writeRalphLoopState(projectDir, emptyRalphLoopState(now), ralphSnapshot.token)) {
        return lifecycleInitializationFailure()
      }
      actions.push("initialized empty ralph-loop state")
    }
  } catch {
    return lifecycleInitializationFailure()
  }

  return undefined
}

function lifecycleInitializationFailure(): CliRunResult {
  // Naming the platform cause matters: on Windows there is no existing state to
  // review, and telling the user to review one sends them looking for a file
  // that was never written.
  const reason = workflowLifecycleStateSupported()
    ? "Review the existing workflow state before retrying."
    : `${WORKFLOW_LIFECYCLE_STATE_UNSUPPORTED_REASON} Platform: ${process.platform}.`
  return {
    status: 1,
    stdout: "",
    stderr: `Persona Harness backend bootstrap failed during workflow lifecycle initialization. ${reason}\n`,
  }
}

function bootstrapWriteBoundaryFailure(): CliRunResult {
  return {
    status: 1,
    stdout: "",
    stderr: "Persona Harness backend bootstrap failed during bootstrap workspace intake. Review the existing bootstrap workspace before retrying.\n",
  }
}

function reserveBootstrapWriteBoundaryFor(projectDir: string): BootstrapWriteBoundary | undefined {
  try {
    const boundary = reserveBootstrapWriteBoundary(projectDir)
    for (const path of BOOTSTRAP_PERSONA_FILES) boundary.assertSafePersonaFile(path)
    for (const name of BOOTSTRAP_WORKFLOW_FILES) boundary.assertSafeWorkflowFile(name)
    return boundary
  } catch {
    return undefined
  }
}

function runBackendBootstrap(
  options: BootstrapOptions,
  flags: BackendBootstrapFlags,
): CliRunResult {
  const projectDir = projectDirFor(options)
  const actions: string[] = []
  const skipped: string[] = []
  let bootstrapWriteBoundary: BootstrapWriteBoundary | undefined
  try {
    if (!existsSync(join(projectDir, PERSONA_DIR))) {
      const initialized = initializeFreshBootstrapPersonaHarness({ projectDir, packageRoot: options.packageRoot })
      bootstrapWriteBoundary = initialized.boundary
      actions.push("initialized .persona and OpenCode plugin config")
    } else {
      skipped.push(".persona already exists")
      bootstrapWriteBoundary = reserveBootstrapWriteBoundaryFor(projectDir)
    }
  } catch {
    return bootstrapWriteBoundaryFailure()
  }
  if (bootstrapWriteBoundary === undefined) return bootstrapWriteBoundaryFailure()

  const activeBoundary = bootstrapWriteBoundary
  try {
    return activeBoundary.withCapturedProject(() => {
      const capturedProjectDir = "."

    if (flags.strict) {
      const strictFailure = enableStrictClosureVerification(capturedProjectDir, activeBoundary)
    if (strictFailure !== undefined) {
      return strictFailure
    }
    actions.push("enabled strict closure verification")
  }

    if (flags.runtimeInjectionPreview) {
      const injectionFailure = enableRuntimeInjectionPreview(capturedProjectDir, activeBoundary)
    if (injectionFailure !== undefined) {
      return injectionFailure
    }
    actions.push("enabled runtime injection preview")
  }

    if (flags.multiAgentPreview) {
    const previewFailure = enableMultiAgentPreview(
      capturedProjectDir,
      loadHarnessConfig(capturedProjectDir, activeBoundary).multiAgent,
      activeBoundary,
    )
    if (previewFailure !== undefined) {
      return previewFailure
    }
    actions.push("enabled Role Checklist Relay preview for test-writer, implementer, and reviewer")
  }

    if (flags.codeNavPreview) {
    const codeNavFailure = enableCodeNavMcpPreview(capturedProjectDir, options.packageRoot, activeBoundary)
    if (codeNavFailure !== undefined) {
      return codeNavFailure
    }
    actions.push("enabled code-nav MCP preview")
  }

    if (flags.lspPreview) {
    const lspFailure = enableLspMcpPreview(capturedProjectDir, options.packageRoot, activeBoundary)
    if (lspFailure !== undefined) {
      return lspFailure
    }
    actions.push("enabled LSP MCP preview")
  }

    if (flags.developerMcpEnabled) {
    const developerMcpResult = enableDeveloperMcpBundle(capturedProjectDir, {
      bootstrapWriteBoundary: activeBoundary,
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

    const profileState = readBackendProjectProfileState(capturedProjectDir, activeBoundary)
    if (flags.force || profileState.status !== "ready") {
      const result = runIntakeCommand(["--default", "backend", "--force"], { bootstrapWriteBoundary: activeBoundary, projectDir: capturedProjectDir }, "ph")
    const failure = runAndRecord(actions, "profile", result, "created default backend profile")
    if (failure !== undefined) {
      return failure
    }
  } else {
    skipped.push(`${PROFILE_PATH} already ready`)
  }

    if (flags.force || !activeBoundary.projectFileExists(POLICY_OVERLAY_PATH)) {
      const policyArgs = flags.force ? ["init", "--force"] : ["init"]
      const result = runPolicyCommand(policyArgs, { bootstrapWriteBoundary: activeBoundary, projectDir: capturedProjectDir }, "ph")
    const failure = runAndRecord(actions, "policy", result, "created backend policy overlay")
    if (failure !== undefined) {
      return failure
    }
  } else {
    skipped.push(`${POLICY_OVERLAY_PATH} already exists`)
  }

    if (flags.force || !activeBoundary.projectFileExists(PLAN_PATH)) {
      const result = runPlanCommand(["--auto-accept"], { bootstrapWriteBoundary: activeBoundary, projectDir: capturedProjectDir }, "ph")
    const failure = runAndRecord(actions, "plan", result, "created and accepted backend workflow plan")
    if (failure !== undefined) {
      return failure
    }
  } else {
    skipped.push(`${PLAN_PATH} already exists`)
    // Report templates are only written while drafting a plan, so a project
    // whose plan survives but whose templates were deleted had no way back.
    const restored = restoreMissingWorkflowTemplates({
      bootstrapWriteBoundary: activeBoundary,
      projectDir: capturedProjectDir,
    })
    for (const path of restored) {
      actions.push(`restored missing workflow template ${path}`)
    }
  }

    activeBoundary.assert()
    const lifecycleFailure = initializeWorkflowLifecycleStates(capturedProjectDir, actions)
    if (lifecycleFailure !== undefined) {
      return lifecycleFailure
    }
    activeBoundary.assert()

    const agentInstructionAction = writeBackendAgentInstructions(activeBoundary, skipped, flags.force, flags.multiAgentPreview)
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
      ...(flags.runtimeInjectionPreview ? [...runtimeInjectionPreviewSummaryLines(), ""] : []),
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
      "- .persona/workflow/workflow-loop-state.json",
      "- .persona/workflow/ralph-loop-state.json",
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
    })
  } catch (error) {
    if (error instanceof BootstrapWriteBoundaryError) return bootstrapWriteBoundaryFailure()
    throw error
  } finally {
    activeBoundary.close()
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
