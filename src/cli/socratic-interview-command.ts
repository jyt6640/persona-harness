import process from "node:process"

import type { CliRunResult } from "./bearshell.js"
import {
  openSocraticInterviewProjectStore,
  SocraticInterviewProjectStateError,
  SocraticInterviewProjectStateStaleError,
  type SocraticInterviewProjectStore,
  type SocraticInterviewStoredRecord,
} from "./socratic-interview-project-store.js"
import {
  parseSocraticInterviewAdvanceInput,
  parseSocraticInterviewApprovalInput,
  parseSocraticInterviewCancelInput,
  socraticInterviewInputFailureCode,
} from "./socratic-interview-input.js"
import {
  advanceSocraticInterview,
  createSocraticInterview,
  createSocraticInterviewDecisionRecord,
  replaySocraticInterviewDecisionRecord,
  type SocraticInterviewMode,
  type SocraticInterviewState,
} from "../interview/socratic-interview-core.js"

export { MAX_SOCRATIC_INTERVIEW_INPUT_BYTES } from "./socratic-interview-input.js"

export type SocraticInterviewCommandOptions = {
  readonly projectDir?: string
  readonly stdin?: string
}

export function socraticInterviewUsage(invocationName = "ph"): string {
  return [
    `Usage: ${invocationName} interview <start|advance|approve|cancel|status> --json`,
    "",
    "Commands:",
    "  start --json [--new] [--mode <new-product|brownfield-change-discovery>]  Start or replay a portable interview.",
    "  advance --json --stdin    Advance one active interview state from JSON stdin.",
    "  approve --json --stdin    Persist only explicitly approved decision data from JSON stdin.",
    "  cancel --json --stdin     End one active interview state without writing project data.",
    "  status --json             Inspect the approved decision record without exposing its contents.",
  ].join("\n")
}

export function runSocraticInterviewCommand(
  args: readonly string[],
  options: SocraticInterviewCommandOptions = {},
  invocationName = "ph",
): CliRunResult {
  const command = args[0]
  if (command === undefined || command === "help" || command === "--help" || command === "-h") {
    return success(`${socraticInterviewUsage(invocationName)}\n`)
  }
  if (command === "start") return runStart(args.slice(1), options)
  if (command === "advance") return runAdvance(args.slice(1), options)
  if (command === "approve") return runApprove(args.slice(1), options)
  if (command === "cancel") return runCancel(args.slice(1), options)
  if (command === "status") return runStatus(args.slice(1), options)
  return failure("socratic-interview-command-invalid")
}

function runStart(args: readonly string[], options: SocraticInterviewCommandOptions): CliRunResult {
  const parsed = parseStartArgs(args)
  if (parsed === undefined) return failure("socratic-interview-command-invalid")
  return withStore(options.projectDir, (store) => {
    const stored = store.readRecord()
    if (!isUsableStoredRecord(stored)) return storedFailure(stored)
    if (stored.kind === "valid" && !parsed.startNew) {
      const replay = replaySocraticInterviewDecisionRecord(stored.value)
      if (replay.kind !== "approved") return failure(replay.code)
      return successJson({
        decisionCount: replay.decisions.length,
        kind: "approved-decision-replay",
        progress: 100,
        recordRevision: stored.revision,
      })
    }
    const started = createSocraticInterview({
      mode: parsed.mode,
      projectBinding: store.projectBinding,
      recordRevision: stored.revision,
    })
    return started.kind === "blocked" ? failure(started.code) : successJson(started)
  })
}

function runAdvance(args: readonly string[], options: SocraticInterviewCommandOptions): CliRunResult {
  if (!hasExactArgs(args, ["--json", "--stdin"])) return failure("socratic-interview-command-invalid")
  const input = parseSocraticInterviewAdvanceInput(options.stdin)
  if (input.kind !== "valid") return failure(socraticInterviewInputFailureCode(input))
  return withCurrentState(options.projectDir, input.value.state, (store) => {
    const result = advanceSocraticInterview(input.value.state, input.value.response)
    if (result.kind === "blocked") return failure(result.code)
    if (result.kind === "approved") return failure("socratic-interview-approval-command-required")
    return successJson(result)
  })
}

function runApprove(args: readonly string[], options: SocraticInterviewCommandOptions): CliRunResult {
  if (!hasExactArgs(args, ["--json", "--stdin"])) return failure("socratic-interview-command-invalid")
  const input = parseSocraticInterviewApprovalInput(options.stdin)
  if (input.kind !== "valid") return failure(socraticInterviewInputFailureCode(input))
  return withCurrentState(options.projectDir, input.value.state, (store, stored) => {
    const result = advanceSocraticInterview(input.value.state, input.value.confirmation)
    if (result.kind === "blocked") return failure(result.code)
    if (result.kind !== "approved") return successJson(result)
    const record = createSocraticInterviewDecisionRecord(result.decisions, stored.revision + 1)
    if (record === undefined) return failure("socratic-interview-state-malformed")
    store.writeRecordIfUnchanged(record, stored)
    return successJson({ kind: "approved", progress: 100, recordRevision: record.revision })
  })
}

function runCancel(args: readonly string[], options: SocraticInterviewCommandOptions): CliRunResult {
  if (!hasExactArgs(args, ["--json", "--stdin"])) return failure("socratic-interview-command-invalid")
  const input = parseSocraticInterviewCancelInput(options.stdin)
  if (input.kind !== "valid") return failure(socraticInterviewInputFailureCode(input))
  return withCurrentState(options.projectDir, input.value, () => {
    const result = advanceSocraticInterview(input.value, "cancel")
    return result.kind === "stopped" ? successJson(result) : failure("socratic-interview-state-malformed")
  })
}

function runStatus(args: readonly string[], options: SocraticInterviewCommandOptions): CliRunResult {
  if (!hasExactArgs(args, ["--json"])) return failure("socratic-interview-command-invalid")
  return withStore(options.projectDir, (store) => {
    const stored = store.readRecord()
    if (!isUsableStoredRecord(stored)) return storedFailure(stored)
    return successJson(stored.kind === "absent"
      ? { kind: "status", record: "missing", recordRevision: 0 }
      : { kind: "status", record: "approved", recordRevision: stored.revision })
  })
}

function withCurrentState(
  projectDir: string | undefined,
  state: SocraticInterviewState,
  operation: (store: SocraticInterviewProjectStore, stored: Extract<SocraticInterviewStoredRecord, { readonly kind: "absent" | "valid" }>) => CliRunResult,
): CliRunResult {
  return withStore(projectDir, (store) => {
    if (state.projectBinding !== store.projectBinding) return failure("socratic-interview-state-foreign")
    const stored = store.readRecord()
    if (!isUsableStoredRecord(stored)) return storedFailure(stored)
    if (state.recordRevision !== stored.revision) return failure("socratic-interview-state-stale")
    return operation(store, stored)
  })
}

function withStore(projectDir: string | undefined, operation: (store: SocraticInterviewProjectStore) => CliRunResult): CliRunResult {
  let store: SocraticInterviewProjectStore | undefined
  try {
    store = openSocraticInterviewProjectStore(projectDir ?? process.cwd())
    return operation(store)
  } catch (error) {
    if (error instanceof SocraticInterviewProjectStateStaleError) return failure("socratic-interview-state-stale")
    if (error instanceof SocraticInterviewProjectStateError) return failure("socratic-interview-state-unsafe")
    return failure("socratic-interview-state-unsafe")
  } finally {
    store?.close()
  }
}

function isUsableStoredRecord(stored: SocraticInterviewStoredRecord): stored is Extract<SocraticInterviewStoredRecord, { readonly kind: "absent" | "valid" }> {
  return stored.kind === "absent" || stored.kind === "valid"
}

function storedFailure(stored: Exclude<SocraticInterviewStoredRecord, { readonly kind: "absent" | "valid" }>): CliRunResult {
  return stored.kind === "version-mismatch"
    ? failure("socratic-interview-record-version-mismatch")
    : failure("socratic-interview-record-malformed")
}

function parseStartArgs(args: readonly string[]): { readonly mode: SocraticInterviewMode; readonly startNew: boolean } | undefined {
  let mode: SocraticInterviewMode = "new-product"
  let modeSeen = false
  let json = false
  let startNew = false
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index]
    if (argument === "--json" && !json) {
      json = true
      continue
    }
    if (argument === "--new" && !startNew) {
      startNew = true
      continue
    }
    if (argument === "--mode" && !modeSeen) {
      const candidate = args[index + 1]
      if (candidate !== "new-product" && candidate !== "brownfield-change-discovery") return undefined
      mode = candidate
      modeSeen = true
      index += 1
      continue
    }
    return undefined
  }
  return json ? { mode, startNew } : undefined
}

function hasExactArgs(args: readonly string[], expected: readonly string[]): boolean {
  const actual = [...args].sort()
  const normalizedExpected = [...expected].sort()
  return actual.length === normalizedExpected.length && actual.every((arg, index) => arg === normalizedExpected[index])
}

function successJson(value: unknown): CliRunResult {
  return success(`${JSON.stringify(value)}\n`)
}

function success(stdout: string): CliRunResult {
  return { status: 0, stdout, stderr: "" }
}

function failure(code: string): CliRunResult {
  return { status: 1, stdout: "", stderr: `${code}\n` }
}
