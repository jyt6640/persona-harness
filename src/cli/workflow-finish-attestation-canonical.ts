import { createHash } from "node:crypto"

export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortCanonical(value))
}

export function sha256Digest(value: string | Buffer): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`
}

function sortCanonical(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortCanonical)
  }
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, sortCanonical(item)]),
    )
  }
  return value
}
