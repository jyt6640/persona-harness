type FinishStatus = "blocked" | "fail" | "pass" | "unknown"
type SurfaceDefaultState = "default" | "off" | "opt-in" | "unknown"

type ClosureRunMetrics = {
  readonly closureBlockerDelta: number | null
  readonly closureBlockersAfter: number | null
  readonly closureBlockersBefore: number | null
  readonly continuationApplied: boolean | null
  readonly earlyCompletionBlocked: boolean | null
  readonly finishStatusAfter: FinishStatus | null
  readonly finishStatusBefore: FinishStatus | null
  readonly retryCapHit: boolean | null
  readonly runawayRetries: number | null
}

type TokenAggregate = {
  readonly cacheRead: number | null
  readonly cacheWrite: number | null
  readonly input: number | null
  readonly output: number | null
  readonly reasoning: number | null
  readonly total: number | null
}

export type EvidenceAbRunOptions = {
  readonly env?: Readonly<Record<string, string | undefined>>
  readonly projectDir?: string
}

export type AbRunConfig = {
  readonly blockedInvalidCompletion: boolean | null
  readonly closure: ClosureRunMetrics
  readonly command: readonly string[]
  readonly condition: string
  readonly conditionLabel: string | null
  readonly elapsedMs: number | null
  readonly finishStatus: FinishStatus | null
  readonly mcpCalls: number | null
  readonly outcome: string | null
  readonly providerTokens: TokenAggregate | null
  readonly readChars: number | null
  readonly runId: string | null
  readonly scenario: string
  readonly scenarioLabel: string | null
  readonly source: string | null
  readonly surface: {
    readonly defaultState: SurfaceDefaultState
    readonly id: string | null
    readonly label: string | null
  }
  readonly toolCalls: number | null
}

export type AbRunRecord = {
  readonly closureBlockerDelta: number | null
  readonly closureBlockersAfter: number | null
  readonly closureBlockersBefore: number | null
  readonly command: readonly string[]
  readonly continuationApplied: boolean | null
  readonly earlyCompletionBlocked: boolean | null
  readonly elapsedMs: number | null
  readonly exitStatus: number | null
  readonly finishStatus: FinishStatus
  readonly finishStatusAfter: FinishStatus | null
  readonly finishStatusBefore: FinishStatus | null
  readonly id: string
  readonly mcpCalls: number | null
  readonly outcome: string
  readonly providerTokens: TokenAggregate | null
  readonly readChars: number | null
  readonly retryCapHit: boolean | null
  readonly runawayRetries: number | null
  readonly signal: string | null
  readonly stderrChars: number
  readonly stdoutChars: number
  readonly toolCalls: number | null
}

export const EVIDENCE_AB_RUN_USAGE =
  [
    "Usage: ph evidence ab-run --scenario <id> --condition <id> [metadata...] -- <command> [args...]",
    "",
    "Optional closure metrics:",
    "  --closure-blockers-before <n> --closure-blockers-after <n>",
    "  --closure-blocker-delta <n>",
    "  --finish-status-before <pass|fail|blocked|unknown>",
    "  --finish-status-after <pass|fail|blocked|unknown>",
    "  --early-completion-blocked <true|false>",
    "  --continuation-applied <true|false>",
    "  --retry-cap-hit <true|false> --runaway-retries <n>",
    "",
  ].join("\n")

export function safeEvidenceSlug(value: string): string {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
  return slug === "" ? "unknown" : slug.slice(0, 80)
}

function numberValue(value: string | undefined): number | null {
  if (value === undefined) {
    return null
  }
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function booleanValue(value: string | undefined): boolean | null {
  if (value === "true") {
    return true
  }
  if (value === "false") {
    return false
  }
  return null
}

function finishStatus(value: string | undefined): FinishStatus | null {
  if (value === "blocked" || value === "fail" || value === "pass" || value === "unknown") {
    return value
  }
  return null
}

function surfaceDefaultState(value: string | undefined): SurfaceDefaultState {
  return value === "default" || value === "off" || value === "opt-in" ? value : "unknown"
}

function nextValue(args: readonly string[], index: number): string | undefined {
  return index + 1 < args.length ? args[index + 1] : undefined
}

function hasTokenEvidence(tokens: TokenAggregate): boolean {
  return Object.values(tokens).some((value) => value !== null)
}

export function parseAbRunConfig(args: readonly string[]): AbRunConfig | undefined {
  const commandSeparator = args.indexOf("--")
  if (commandSeparator < 0 || commandSeparator === args.length - 1) {
    return undefined
  }
  const command = args.slice(commandSeparator + 1)
  const flags = args.slice(0, commandSeparator)
  let blockedInvalidCompletion: boolean | null = null
  let closureBlockerDelta: number | null = null
  let closureBlockersAfter: number | null = null
  let closureBlockersBefore: number | null = null
  let condition: string | null = null
  let conditionLabel: string | null = null
  let continuationApplied: boolean | null = null
  let elapsedMs: number | null = null
  let earlyCompletionBlocked: boolean | null = null
  let configuredFinishStatus: FinishStatus | null = null
  let finishStatusAfter: FinishStatus | null = null
  let finishStatusBefore: FinishStatus | null = null
  let mcpCalls: number | null = null
  let outcome: string | null = null
  let providerCacheRead: number | null = null
  let providerCacheWrite: number | null = null
  let providerTokenInput: number | null = null
  let providerTokenOutput: number | null = null
  let providerTokenReasoning: number | null = null
  let providerTokenTotal: number | null = null
  let readChars: number | null = null
  let retryCapHit: boolean | null = null
  let runId: string | null = null
  let runawayRetries: number | null = null
  let scenario: string | null = null
  let scenarioLabel: string | null = null
  let source: string | null = null
  let surfaceDefault: SurfaceDefaultState = "unknown"
  let surfaceId: string | null = null
  let surfaceLabel: string | null = null
  let toolCalls: number | null = null

  for (let index = 0; index < flags.length; index += 2) {
    const flag = flags[index]
    const value = nextValue(flags, index)
    if (flag === undefined || value === undefined) {
      return undefined
    }
    switch (flag) {
      case "--blocked-invalid-completion":
        blockedInvalidCompletion = booleanValue(value)
        break
      case "--closure-blocker-delta":
        closureBlockerDelta = numberValue(value)
        break
      case "--closure-blockers-after":
        closureBlockersAfter = numberValue(value)
        break
      case "--closure-blockers-before":
        closureBlockersBefore = numberValue(value)
        break
      case "--condition":
        condition = value
        break
      case "--condition-label":
        conditionLabel = value
        break
      case "--continuation-applied":
        continuationApplied = booleanValue(value)
        break
      case "--elapsed-ms":
        elapsedMs = numberValue(value)
        break
      case "--early-completion-blocked":
        earlyCompletionBlocked = booleanValue(value)
        break
      case "--finish-status":
        configuredFinishStatus = finishStatus(value)
        break
      case "--finish-status-after":
        finishStatusAfter = finishStatus(value)
        break
      case "--finish-status-before":
        finishStatusBefore = finishStatus(value)
        break
      case "--mcp-calls":
        mcpCalls = numberValue(value)
        break
      case "--outcome":
        outcome = value
        break
      case "--provider-cache-read":
        providerCacheRead = numberValue(value)
        break
      case "--provider-cache-write":
        providerCacheWrite = numberValue(value)
        break
      case "--provider-token-input":
        providerTokenInput = numberValue(value)
        break
      case "--provider-token-output":
        providerTokenOutput = numberValue(value)
        break
      case "--provider-token-reasoning":
        providerTokenReasoning = numberValue(value)
        break
      case "--provider-token-total":
        providerTokenTotal = numberValue(value)
        break
      case "--read-chars":
        readChars = numberValue(value)
        break
      case "--retry-cap-hit":
        retryCapHit = booleanValue(value)
        break
      case "--run-id":
        runId = value
        break
      case "--runaway-retries":
        runawayRetries = numberValue(value)
        break
      case "--scenario":
        scenario = value
        break
      case "--scenario-label":
        scenarioLabel = value
        break
      case "--source":
        source = value
        break
      case "--surface":
        surfaceId = value
        break
      case "--surface-default":
        surfaceDefault = surfaceDefaultState(value)
        break
      case "--surface-label":
        surfaceLabel = value
        break
      case "--tool-calls":
        toolCalls = numberValue(value)
        break
      default:
        return undefined
    }
  }
  if (scenario === null || condition === null) {
    return undefined
  }
  const tokens: TokenAggregate = {
    cacheRead: providerCacheRead,
    cacheWrite: providerCacheWrite,
    input: providerTokenInput,
    output: providerTokenOutput,
    reasoning: providerTokenReasoning,
    total: providerTokenTotal,
  }
  return {
    blockedInvalidCompletion,
    closure: {
      closureBlockerDelta:
        closureBlockerDelta
        ?? (closureBlockersBefore !== null && closureBlockersAfter !== null
          ? closureBlockersBefore - closureBlockersAfter
          : null),
      closureBlockersAfter,
      closureBlockersBefore,
      continuationApplied,
      earlyCompletionBlocked,
      finishStatusAfter,
      finishStatusBefore,
      retryCapHit,
      runawayRetries,
    },
    command,
    condition,
    conditionLabel,
    elapsedMs,
    finishStatus: configuredFinishStatus,
    mcpCalls,
    outcome,
    providerTokens: hasTokenEvidence(tokens) ? tokens : null,
    readChars,
    runId,
    scenario,
    scenarioLabel,
    source,
    surface: { defaultState: surfaceDefault, id: surfaceId, label: surfaceLabel },
    toolCalls,
  }
}
