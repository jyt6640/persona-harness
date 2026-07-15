import { lstatSync } from "node:fs"

export type RetentionCandidate = {
  readonly category: string
  readonly bytes: number
  readonly reason: "category-cap" | "total-size"
  readonly relativePath: string
}

export const DEFAULT_CATEGORY_CAP = 1_000
export const DEFAULT_TOTAL_BYTES = 50 * 1024 * 1024
export const MAX_DELETIONS = 128
export const MAX_ENTRIES = 512
export const MAX_TOTAL_BYTES = 2 * 1024 * 1024

const PURGEABLE_CATEGORIES = new Set([
  "ab",
  "compaction",
  "entry-steering",
  "logs",
  "phase0",
  "role-boundary",
  "session-injection-skips",
  "token-usage",
])
const PROTECTED_PATH = /(?:^|\/)(?:attestation|authority|ci-reverification|release|verification-attempts|verification-receipts)(?:\/|$)/u
const PROTECTED_NAME = /(?:attestation|authority|receipt|attempt|release)/iu

type RetentionFile = {
  readonly absolutePath: string
  readonly bytes: number
  readonly relativePath: string
}

export function positiveInteger(
  env: Readonly<Record<string, string | undefined>>,
  key: string,
  fallback: number,
): number {
  const value = env[key]
  if (value === undefined) {
    return fallback
  }
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

function protectedEvidence(relativePath: string): boolean {
  const normalized = relativePath.replaceAll("\\", "/")
  return normalized === "summary.md" || PROTECTED_PATH.test(normalized) || PROTECTED_NAME.test(normalized)
}

function candidateCategory(relativePath: string): string {
  return relativePath.split("/")[0] ?? "(root)"
}

function orderByAge(files: readonly RetentionFile[]): readonly RetentionFile[] {
  return [...files].sort((left, right) => {
    const leftTime = lstatSync(left.absolutePath).mtimeMs
    const rightTime = lstatSync(right.absolutePath).mtimeMs
    return leftTime - rightTime || left.relativePath.localeCompare(right.relativePath)
  })
}

export function selectRetentionCandidates(
  files: readonly RetentionFile[],
  categoryCap: number,
  totalBytes: number,
  totalBytesCap: number,
): readonly RetentionCandidate[] {
  const eligible = files.filter((file) => {
    const category = candidateCategory(file.relativePath)
    return PURGEABLE_CATEGORIES.has(category) && !protectedEvidence(file.relativePath)
  })
  const byCategory = new Map<string, readonly RetentionFile[]>()
  for (const file of files) {
    const category = candidateCategory(file.relativePath)
    byCategory.set(category, [...(byCategory.get(category) ?? []), file])
  }
  const selected = new Map<string, RetentionCandidate>()
  for (const [category, categoryFiles] of byCategory.entries()) {
    const excess = Math.max(0, categoryFiles.length - categoryCap)
    const eligibleCategoryFiles = categoryFiles.filter((entry) => eligible.includes(entry))
    for (const file of orderByAge(eligibleCategoryFiles).slice(0, excess)) {
      selected.set(file.relativePath, {
        category,
        bytes: file.bytes,
        reason: "category-cap",
        relativePath: file.relativePath,
      })
    }
  }

  let remainingBytes = totalBytes - Array.from(selected.values()).reduce((sum, file) => sum + file.bytes, 0)
  if (remainingBytes > totalBytesCap) {
    for (const file of orderByAge(eligible)) {
      if (selected.has(file.relativePath)) {
        continue
      }
      selected.set(file.relativePath, {
        category: candidateCategory(file.relativePath),
        bytes: file.bytes,
        reason: "total-size",
        relativePath: file.relativePath,
      })
      remainingBytes -= file.bytes
      if (remainingBytes <= totalBytesCap) {
        break
      }
    }
  }
  return Array.from(selected.values())
    .sort((left, right) => left.relativePath.localeCompare(right.relativePath))
    .slice(0, MAX_DELETIONS)
}
