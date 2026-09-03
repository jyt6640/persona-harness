import {
  isBoundedSocraticInterviewText,
  parseSocraticInterviewState,
  type SocraticInterviewState,
} from "../interview/socratic-interview-core.js"

export const MAX_SOCRATIC_INTERVIEW_INPUT_BYTES = 16_384

export type ParsedAdvanceInput = { readonly response: string; readonly state: SocraticInterviewState }
export type ParsedApprovalInput = { readonly confirmation: string; readonly state: SocraticInterviewState }
export type ParsedInterviewInput<T> =
  | { readonly kind: "valid"; readonly value: T }
  | { readonly kind: "input-invalid" }
  | { readonly kind: "state-malformed" }
  | { readonly kind: "state-version-mismatch" }

export function parseSocraticInterviewAdvanceInput(stdin: string | undefined): ParsedInterviewInput<ParsedAdvanceInput> {
  const input = parseJsonObject(stdin, ["response", "state"])
  if (input === undefined || !isBoundedSocraticInterviewText(input.response)) return { kind: "input-invalid" }
  const response = input.response
  return parsedState(input.state, (state) => ({ response, state }))
}

export function parseSocraticInterviewApprovalInput(stdin: string | undefined): ParsedInterviewInput<ParsedApprovalInput> {
  const input = parseJsonObject(stdin, ["confirmation", "state"])
  if (input === undefined || !isBoundedSocraticInterviewText(input.confirmation)) return { kind: "input-invalid" }
  const confirmation = input.confirmation
  return parsedState(input.state, (state) => ({ confirmation, state }))
}

export function parseSocraticInterviewCancelInput(stdin: string | undefined): ParsedInterviewInput<SocraticInterviewState> {
  const input = parseJsonObject(stdin, ["state"])
  return input === undefined ? { kind: "input-invalid" } : parsedState(input.state, (state) => state)
}

export function socraticInterviewInputFailureCode(input: Exclude<ParsedInterviewInput<unknown>, { readonly kind: "valid" }>): string {
  return input.kind === "input-invalid" ? "socratic-interview-input-invalid" : `socratic-interview-${input.kind}`
}

function parsedState<T>(value: unknown, map: (state: SocraticInterviewState) => T): ParsedInterviewInput<T> {
  const parsed = parseSocraticInterviewState(value)
  if (parsed.kind === "version-mismatch") return { kind: "state-version-mismatch" }
  if (parsed.kind === "malformed") return { kind: "state-malformed" }
  return { kind: "valid", value: map(parsed.value) }
}

function parseJsonObject(stdin: string | undefined, expectedKeys: readonly string[]): Readonly<Record<string, unknown>> | undefined {
  if (stdin === undefined || stdin.trim() === "" || Buffer.byteLength(stdin, "utf8") > MAX_SOCRATIC_INTERVIEW_INPUT_BYTES) return undefined
  try {
    const parsed = JSON.parse(stdin) as unknown
    return isRecord(parsed) && hasExactKeys(Object.keys(parsed), expectedKeys) ? parsed : undefined
  } catch {
    return undefined
  }
}

function hasExactKeys(args: readonly string[], expected: readonly string[]): boolean {
  const actual = [...args].sort()
  const normalizedExpected = [...expected].sort()
  return actual.length === normalizedExpected.length && actual.every((arg, index) => arg === normalizedExpected[index])
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}
