export type ContextPreviewFormat = "json" | "text"

export type ContextPreviewRequest = {
  readonly format: ContextPreviewFormat
  readonly projectKey?: string
  readonly targetPath: string
  readonly taskKey?: string
  readonly topics: readonly string[]
}

export type ContextPreviewRequestResult =
  | { readonly status: "ready"; readonly request: ContextPreviewRequest }
  | {
      readonly status: "blocked"
      readonly code: "context-preview-arguments-invalid" | "context-target-invalid" | "context-target-required"
    }

export function parseContextPreviewRequest(args: readonly string[]): ContextPreviewRequestResult {
  if (args.length === 0) return { code: "context-target-required", status: "blocked" }
  const targetPath = parseTargetPath(args[0])
  if (targetPath === undefined) return { code: "context-target-invalid", status: "blocked" }

  let format: ContextPreviewFormat = "text"
  let projectKey: string | undefined
  let taskKey: string | undefined
  const topics = new Set<string>()

  for (let index = 1; index < args.length; index += 1) {
    const option = args[index]
    if (option === "--json") {
      if (format === "json") return invalidArguments()
      format = "json"
      continue
    }
    if (option === "--project") {
      const value = optionValue(args, index)
      if (value === undefined || projectKey !== undefined) return invalidArguments()
      projectKey = value
      index += 1
      continue
    }
    if (option === "--task") {
      const value = optionValue(args, index)
      if (value === undefined || taskKey !== undefined) return invalidArguments()
      taskKey = value
      index += 1
      continue
    }
    if (option === "--topic") {
      const value = optionValue(args, index)
      if (value === undefined) return invalidArguments()
      topics.add(value)
      index += 1
      continue
    }
    return invalidArguments()
  }

  return {
    request: { format, projectKey, targetPath, taskKey, topics: [...topics].sort() },
    status: "ready",
  }
}

function invalidArguments(): ContextPreviewRequestResult {
  return { code: "context-preview-arguments-invalid", status: "blocked" }
}

function optionValue(args: readonly string[], optionIndex: number): string | undefined {
  const value = args[optionIndex + 1]
  return value !== undefined && !value.startsWith("--") && isSafeIdentifier(value) ? value : undefined
}

function parseTargetPath(value: string | undefined): string | undefined {
  if (value === undefined || value.length === 0 || value.length > 240 || /[\u0000-\u001f\u007f]/u.test(value)) return undefined
  const normalized = value.replaceAll("\\\\", "/")
  if (normalized.startsWith("/") || /^(?:[A-Za-z]:\/|https?:\/\/)/u.test(normalized)) return undefined
  const segments = normalized.split("/")
  if (segments.some((segment) => segment.length === 0 || segment === "." || segment === "..")) return undefined
  return normalized
}

function isSafeIdentifier(value: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/u.test(value)
}
