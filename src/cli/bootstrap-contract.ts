import { PROFILE_PATH } from "./intake-profile.js"
import { IMPLEMENTATION_REPORT_PATH, PLAN_PATH, REVIEW_REPORT_PATH } from "./plan.js"

export type BootstrapOptions = {
  readonly attachStagingOwnership?:
    | { readonly kind: "fresh"; readonly projectRealPath: string }
    | { readonly kind: "repair"; readonly projectRealPath: string }
  readonly env?: Readonly<Record<string, string | undefined>>
  readonly projectDir?: string
  readonly packageRoot?: string
}

export type BackendBootstrapFlags = {
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

export type ParsedBootstrapArgs =
  | ({ readonly kind: "backend" } & BackendBootstrapFlags)
  | { readonly kind: "help" }
  | { readonly kind: "invalid"; readonly message: string }

export const PERSONA_DIR = ".persona"
export const HARNESS_CONFIG_PATH = ".persona/harness.jsonc"
export const CONVENTIONS_DIR_PATH = ".persona/conventions/"
export const RULES_DIR_PATH = ".persona/rules/"
export const OPENCODE_CONFIG_PATH = ".opencode/opencode.json"
export const GITIGNORE_PATH = ".gitignore"
export const POLICY_OVERLAY_PATH = ".persona/policies/overlay.jsonc"
export const ROOT_AGENT_INSTRUCTIONS_PATH = "AGENTS.md"
export const BOOTSTRAP_PERSONA_FILES = [
  ".ph-init-manifest.json",
  "harness.jsonc",
  "project-profile.jsonc",
  "policies/overlay.jsonc",
  "policies/company/backend.md",
  "policies/personal/backend.md",
] as const
export const BOOTSTRAP_WORKFLOW_FILES = [
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

export function strictModeSummaryLines(): readonly string[] {
  return [
    "Strict mode:",
    "- sets enforce.executeVerification: true, so PH runs the project verification command during closure/finish; expect toolchain command cost",
    "- does not enable features.runtimeInjection or enforce.systemConstitution; each remains independently opt-in",
    "- does not enable enforce.writeDeny, enforce.idleContinuation, or enforce.ralphLoop; those stay explicit opt-ins",
    "- still no generated app product-quality certification or closure guarantee",
  ]
}

export function runtimeInjectionPreviewSummaryLines(): readonly string[] {
  return [
    "Runtime injection preview:",
    "- opt-in only via --runtime-injection-preview; default init/bootstrap keeps PH as gate-first CLI/evidence tooling",
    "- enables model-facing PH guidance such as target-file injection, workflow prompt rails, continuation text, and system constitution where supported",
    "- parked after the Stage 9 banner-only H1 measurement; resume only with an approved long-session post-compaction rail-retention measurement",
    "- measured 10-pair OpenCode A/B was worse for runtime injection on the bounded fixture set; keep this as guidance preview, not a token-saving or product-efficacy claim",
    "- closure/check/archive/finish gates remain authoritative whether runtime injection is on or off",
  ]
}

export function multiAgentPreviewSummaryLines(): readonly string[] {
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

export function codeNavPreviewSummaryLines(): readonly string[] {
  return [
    "Code-nav MCP preview:",
    "- opt-in only via --code-nav-preview; default bootstrap does not register the PH code-nav MCP server",
    "- writes OpenCode mcp.persona-harness-code-nav for the packaged PH code-nav MCP server",
    "- exposes bounded lookup tools as persona-harness-code-nav_search_text, persona-harness-code-nav_status, and persona-harness-code-nav_ast_grep_availability",
    "- no codegraph/indexer and no token-saving claim",
  ]
}

export function lspPreviewSummaryLines(): readonly string[] {
  return [
    "LSP MCP preview:",
    "- opt-in only via --lsp-preview; default bootstrap does not register the PH LSP wrapper",
    "- writes OpenCode mcp.persona-harness-lsp for the packaged PH LSP MCP wrapper",
    "- proxies to a real external LSP MCP only when @theupsider/lsp-mcp and a Java LSP binary are available",
    "- otherwise keeps MCP protocol alive with an honest lsp_status unavailable facade",
    "- no auto-install, no code-nav relabeling, and no token-saving or product-quality claim",
  ]
}

export function developerMcpSummaryLines(
  flags: Pick<BackendBootstrapFlags, "codeGraphEnabled" | "developerMcpEnabled">,
): readonly string[] {
  if (!flags.developerMcpEnabled) return []
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

export function parseBootstrapArgs(args: readonly string[]): ParsedBootstrapArgs {
  if (args.length === 0 || args[0] === "--help" || args[0] === "-h" || args[0] === "help") return { kind: "help" }
  if (args[0] !== "backend") return { kind: "invalid", message: `Unknown bootstrap command: ${args[0]}` }

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
    if (arg === "--force") force = true
    else if (arg === "--strict") strict = true
    else if (arg === "--runtime-injection-preview") runtimeInjectionPreview = true
    else if (arg === "--multi-agent-preview") multiAgentPreview = true
    else if (arg === "--code-nav-preview") codeNavPreview = true
    else if (arg === "--lsp-preview") lspPreview = true
    else if (arg === "--codegraph-preview") {
      developerMcpEnabled = true
      codeGraphEnabled = true
      codeGraphPreview = true
    } else if (arg === "--no-codegraph") {
      codeGraphEnabled = false
      codeGraphPreview = false
    } else if (arg === "--no-developer-mcp") {
      developerMcpEnabled = false
      codeGraphPreview = false
    } else return { kind: "invalid", message: `Unknown option: ${arg}` }
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
