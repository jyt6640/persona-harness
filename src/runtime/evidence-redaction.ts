import { createHash } from "node:crypto"
import { isAbsolute, relative, resolve } from "node:path"

type RedactionRule = {
  readonly pattern: RegExp
  readonly replacement: string
}

export type RedactedEvidenceText = {
  readonly redactionCount: number
  readonly text: string
}

export type EvidenceTextSummary = {
  readonly byteCount: number
  readonly charCount: number
  readonly preview?: string
  readonly redactionCount: number
  readonly sha256: string
  readonly truncated: boolean
}

export type EvidenceSanitizationOptions = {
  readonly projectDir?: string
}

export type EvidenceTextSummaryOptions = EvidenceSanitizationOptions & {
  readonly includePreview: boolean
  readonly maxPreviewChars: number
}

const REDACTION_RULES: readonly RedactionRule[] = [
  {
    pattern: /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z0-9 ]*PRIVATE KEY-----/gu,
    replacement: "[REDACTED PEM BLOCK]",
  },
  {
    pattern: /\b((?:jdbc:[a-z][a-z0-9+.-]*|[a-z][a-z0-9+.-]*):\/\/)[^/\s:@]+:[^@\s/]+@/giu,
    replacement: "$1[REDACTED]:[REDACTED]@",
  },
  {
    pattern: /\b(Bearer)\s+[A-Za-z0-9._~+/=-]+/giu,
    replacement: "$1 [REDACTED]",
  },
  {
    pattern: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/gu,
    replacement: "[REDACTED]",
  },
  {
    pattern: /\b(?:sk-(?:proj-)?[A-Za-z0-9_-]{16,}|gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/gu,
    replacement: "[REDACTED]",
  },
  {
    pattern: /(\b[A-Z0-9_]*(?:API_KEY|ACCESS_KEY|SECRET(?:_ACCESS_KEY)?|TOKEN|PASSWORD|PASSWD|PWD)\b\s*[:=]\s*)(?:"[^"\r\n]*"|'[^'\r\n]*'|[^\s,;&]+)/giu,
    replacement: "$1[REDACTED]",
  },
  {
    pattern: /(["'](?:api[_-]?key|x-api-key|access[_-]?token|auth[_-]?token|token|secret|password|passwd|pwd)["']\s*:\s*)(["'])[^"'\r\n]*\2/giu,
    replacement: "$1$2[REDACTED]$2",
  },
  {
    pattern: /(\b(?:api[_-]?key|x-api-key|access[_-]?token|auth[_-]?token|token|secret|password|passwd|pwd|jdbc\.password|spring\.datasource\.password)\b\s*[:=]\s*)(?:"[^"\r\n]*"|'[^'\r\n]*'|[^\s,;&]+)/giu,
    replacement: "$1[REDACTED]",
  },
  {
    pattern: /((?:^|\s)--?(?:api[_-]?key|token|secret|password|passwd|pwd)(?:=|\s+))(?:"[^"\r\n]*"|'[^'\r\n]*'|[^\s,;&]+)/gimu,
    replacement: "$1[REDACTED]",
  },
  {
    pattern: /([?&;](?:user(?:name)?|password|passwd|pwd|token|api[_-]?key)=)[^&#;\s]+/giu,
    replacement: "$1[REDACTED]",
  },
] as const

export function redactEvidenceText(
  source: string,
  options: EvidenceSanitizationOptions = {},
): RedactedEvidenceText {
  let text = source
  let redactionCount = 0
  for (const rule of REDACTION_RULES) {
    redactionCount += text.match(rule.pattern)?.length ?? 0
    text = text.replace(rule.pattern, rule.replacement)
  }
  const paths = redactAbsolutePaths(text, options.projectDir)
  text = paths.text
  redactionCount += paths.redactionCount
  return { redactionCount, text }
}

export function summarizeEvidenceText(
  source: string,
  options: EvidenceTextSummaryOptions,
): EvidenceTextSummary {
  const redacted = redactEvidenceText(source, options)
  const truncated = redacted.text.length > options.maxPreviewChars
  const preview = options.includePreview
    ? boundPreview(redacted.text, options.maxPreviewChars)
    : undefined
  return {
    byteCount: Buffer.byteLength(source),
    charCount: source.length,
    ...(preview === undefined ? {} : { preview }),
    redactionCount: redacted.redactionCount,
    sha256: `sha256:${createHash("sha256").update(source).digest("hex")}`,
    truncated,
  }
}

export function sanitizeEvidenceValue(
  value: unknown,
  maxStringChars = 4_096,
  options: EvidenceSanitizationOptions = {},
): unknown {
  if (typeof value === "string") {
    return boundPreview(redactEvidenceText(value, options).text, maxStringChars)
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeEvidenceValue(item, maxStringChars, options))
  }
  if (typeof value !== "object" || value === null) {
    return value
  }
  return Object.fromEntries(
    Object.entries(value).map(([key, nested]) => [key, sanitizeEvidenceValue(nested, maxStringChars, options)]),
  )
}

type RedactedPathText = {
  readonly redactionCount: number
  readonly text: string
}

const POSIX_ABSOLUTE_PATH = /(?<![A-Za-z0-9:_/-])\/(?:[^\s"'`<>|;&/]+\/)+[^\s"'`<>|;&]*/gu
const WINDOWS_ABSOLUTE_PATH = /\b[A-Za-z]:[\\/](?:[^\s"'`<>|;&]+[\\/]?)+/gu
const UNC_ABSOLUTE_PATH = /(?<![A-Za-z0-9])\\\\(?:[^\s"'`<>|;&]+[\\/]?)+/gu

function redactAbsolutePaths(source: string, projectDir: string | undefined): RedactedPathText {
  let redactionCount = 0
  let text = source
  for (const pattern of [POSIX_ABSOLUTE_PATH, WINDOWS_ABSOLUTE_PATH, UNC_ABSOLUTE_PATH]) {
    text = text.replace(pattern, (candidate) => {
      redactionCount += 1
      return safePathReference(candidate, projectDir)
    })
  }
  return { redactionCount, text }
}

function safePathReference(candidate: string, projectDir: string | undefined): string {
  const trimmed = candidate.replace(/[),.;:\]}]+$/u, "")
  const suffix = candidate.slice(trimmed.length)
  if (projectDir !== undefined && isAbsolute(trimmed)) {
    const relativePath = relative(resolve(projectDir), resolve(trimmed))
    if (relativePath === "" || (!relativePath.startsWith("..") && !isAbsolute(relativePath))) {
      return `${relativePath || "."}${suffix}`
    }
  }
  return "[REDACTED_PATH]"
}

function boundPreview(text: string, maxChars: number): string {
  if (text.length <= maxChars) {
    return text
  }
  const marker = `\n[evidence preview truncated; original redacted chars: ${text.length}]\n`
  const contentChars = Math.max(0, maxChars - marker.length)
  const headChars = Math.floor(contentChars * 0.6)
  const tailChars = contentChars - headChars
  return `${text.slice(0, headChars).trimEnd()}${marker}${text.slice(text.length - tailChars).trimStart()}`
}
