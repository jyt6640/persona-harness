import { isAbsolute, resolve } from "node:path"
import { captureNoFollowDirectory } from "../io/no-follow-file.js"
import { selectContextForTargets, type TargetContextOptions, type TargetContextSelection } from "./context-target-selection.js"
import { extractContextTargets } from "./context-tool-targets.js"
import { selectPortableSessionGuidance } from "./portable-context-session.js"
import { canonicalContextDigest } from "../context-core/context-digest.js"
import { readContextScopeBinding } from "../cli/context-checkout-binding.js"
import { isContextPersonalizationEnabled, loadHarnessConfigResult } from "../config/harness-config.js"

type SelectedContext = Extract<TargetContextSelection, { readonly status: "selected" }>

export type PortableContextHookResult =
  | { readonly status: "blocked"; readonly reason: string }
  | { readonly status: "skipped"; readonly reason: string }
  | {
      readonly status: "offered"
      readonly selection: SelectedContext
      readonly kind: "rules" | "guidance"
      readonly output: { readonly hookSpecificOutput: { readonly hookEventName: "PreToolUse" | "SessionStart"; readonly additionalContext: string } }
    }

export function runPortableContextHook(
  input: unknown,
  projectDir: string,
  options: TargetContextOptions & { readonly setupScript?: string; readonly host?: "codex" | "claude" } = {},
): PortableContextHookResult {
  if (!isRecord(input) || !safeText(input.session_id, 256) || !safeText(input.hook_event_name, 80)) {
    return { status: "blocked", reason: "hook-input-invalid" }
  }
  if (input.hook_event_name !== "PreToolUse" && input.hook_event_name !== "SessionStart") return { status: "skipped", reason: "event-unsupported" }
  if (!safeText(input.cwd, 4_096) || !isAbsolute(input.cwd) || resolve(input.cwd) !== resolve(projectDir)
    || captureNoFollowDirectory(resolve(projectDir)).kind !== "ready") {
    return { status: "blocked", reason: "hook-project-invalid" }
  }
  if (input.hook_event_name === "SessionStart") {
    const taskSession = options.host === undefined ? undefined : canonicalContextDigest({ host: options.host, sessionId: input.session_id })
    const selection = selectPortableSessionGuidance(projectDir, options.setupScript, taskSession)
    return selection.status === "selected" ? {
      status: "offered", kind: "guidance", selection,
      output: { hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: selection.block } },
    } : selection
  }
  if (!safeText(input.tool_name, 256)) return { status: "blocked", reason: "hook-input-invalid" }
  const targets = extractContextTargets(input.tool_name, input.tool_input)
  if (targets.kind === "unsupported") return { status: "skipped", reason: "tool-unsupported" }
  if (targets.kind === "blocked") return { status: "blocked", reason: targets.reason }
  try {
    let taskKey = options.taskKey
    if (options.host !== undefined && isContextPersonalizationEnabled(loadHarnessConfigResult(projectDir))) {
      const taskSession = canonicalContextDigest({ host: options.host, sessionId: input.session_id })
      const binding = readContextScopeBinding(projectDir, { ...options.personalization, taskSession })
      if (binding.status === "bound") taskKey = binding.scopeKey
    }
    const selection = selectContextForTargets(projectDir, targets.paths, { ...options, taskKey })
    if (selection.status !== "selected") return selection
    return {
      status: "offered", kind: "rules", selection,
      output: { hookSpecificOutput: { hookEventName: "PreToolUse", additionalContext: selection.block } },
    }
  } catch {
    return { status: "blocked", reason: "context-read-unavailable" }
  }
}

function safeText(value: unknown, maxLength: number): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= maxLength && !/[\u0000-\u001f\u007f]/u.test(value)
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}
