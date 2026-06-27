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

export function formatRuntimeWarning(warning: RuntimeWarning): string {
  const base = `[Persona Harness Runtime Warning] kind=${warning.kind} scope=${warning.scope}`
  const detail = warning.detail === undefined ? "" : ` ${formatQuotedField("detail", warning.detail)}`
  return `${base}${detail} ${formatQuotedField("error", `${warning.error.name}: ${warning.error.message}`)}`
}

export function warnRuntimeFailure(
  kind: RuntimeWarningKind,
  scope: string,
  detail: string | undefined,
  error: Error,
): void {
  console.warn(formatRuntimeWarning({ kind, scope, detail, error }))
}
