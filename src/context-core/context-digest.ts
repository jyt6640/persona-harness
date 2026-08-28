import { createHash } from "node:crypto"

export class ContextDigestError extends Error {
  readonly code = "context-digest-invalid" as const

  constructor() {
    super("context-digest-invalid")
    this.name = "ContextDigestError"
  }
}

export function canonicalContextJson(value: unknown): string {
  if (value === null || typeof value === "boolean" || typeof value === "string") return JSON.stringify(value)
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new ContextDigestError()
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) return `[${value.map((entry) => canonicalContextJson(entry)).join(",")}]`
  if (isRecord(value)) {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalContextJson(value[key])}`).join(",")}}`
  }
  throw new ContextDigestError()
}

export function canonicalContextDigest(value: unknown): string {
  return createHash("sha256").update(canonicalContextJson(value)).digest("hex")
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
