import { redactEvidenceText } from "./evidence-redaction.js"

export type RuntimeWarningKind = "evidence-write" | "hook-boundary" | "observer-report-only"

export type RuntimeWarning = {
  kind: RuntimeWarningKind
  scope: string
  detail?: string
  error: Error
}

function formatQuotedField(name: string, value: string): string {
  return `${name}=${JSON.stringify(value)}`
}

function safeWarningText(value: string): string {
  return redactEvidenceText(value).text
}

export function formatRuntimeWarning(warning: RuntimeWarning): string {
  const base = `[Persona Harness Runtime Warning] kind=${warning.kind} scope=${warning.scope}`
  const detail = warning.detail === undefined ? "" : ` ${formatQuotedField("detail", safeWarningText(warning.detail))}`
  const error = `${warning.error.name}: ${safeWarningText(warning.error.message)}`
  return `${base}${detail} ${formatQuotedField("error", error)}`
}

export function warnRuntimeFailure(
  kind: RuntimeWarningKind,
  scope: string,
  detail: string | undefined,
  error: Error,
): void {
  console.warn(formatRuntimeWarning({ kind, scope, detail, error }))
}
