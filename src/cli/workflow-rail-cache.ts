import { createHash } from "node:crypto"
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"

import { writeFileAtomic } from "../io/atomic-file.js"

export type WorkflowRailCacheSurface = "workflow-check" | "workflow-continue" | "workflow-implement"

type WorkflowRailCacheEntry = {
  readonly bodyHash: string
  readonly updatedAt: string
}

type WorkflowRailCacheMarker = {
  readonly entries: Readonly<Record<string, WorkflowRailCacheEntry>>
  readonly printedAt?: string
  readonly schemaVersion: "workflow-rail-body-cache.1"
}

export type CachedWorkflowRailOutput = {
  readonly full: boolean
  readonly fullLines?: readonly string[]
  readonly projectDir: string
  readonly railBodyLines: readonly string[]
  readonly surface: WorkflowRailCacheSurface
  readonly uniqueLines: readonly string[]
}

export const RAIL_UNCHANGED_LINE = "rail unchanged (full text: `ph workflow implement --full`)"

const MARKER_PATH = ".persona/workflow/rail-body-cache.json"
const SCHEMA_VERSION = "workflow-rail-body-cache.1"

function markerPath(projectDir: string): string {
  return join(projectDir, MARKER_PATH)
}

function bodyText(lines: readonly string[]): string {
  return `${lines.join("\n")}\n`
}

function bodyHash(lines: readonly string[]): string {
  return createHash("sha256").update(bodyText(lines)).digest("hex")
}

function isCacheEntry(value: unknown): value is WorkflowRailCacheEntry {
  return (
    typeof value === "object"
    && value !== null
    && "bodyHash" in value
    && typeof value.bodyHash === "string"
    && "updatedAt" in value
    && typeof value.updatedAt === "string"
  )
}

function isCacheMarker(value: unknown): value is WorkflowRailCacheMarker {
  if (typeof value !== "object" || value === null || !("schemaVersion" in value) || value.schemaVersion !== SCHEMA_VERSION) {
    return false
  }
  if (!("entries" in value) || typeof value.entries !== "object" || value.entries === null) {
    return false
  }
  if ("printedAt" in value && typeof value.printedAt !== "string") {
    return false
  }
  return Object.values(value.entries).every(isCacheEntry)
}

function readMarker(projectDir: string): WorkflowRailCacheMarker {
  const path = markerPath(projectDir)
  if (!existsSync(path)) {
    return { entries: {}, schemaVersion: SCHEMA_VERSION }
  }
  try {
    const parsed: unknown = JSON.parse(readFileSync(path, "utf8"))
    return isCacheMarker(parsed) ? parsed : { entries: {}, schemaVersion: SCHEMA_VERSION }
  } catch (error) {
    if (!(error instanceof Error)) {
      throw error
    }
    return { entries: {}, schemaVersion: SCHEMA_VERSION }
  }
}

function writeMarker(projectDir: string, marker: WorkflowRailCacheMarker): void {
  writeFileAtomic(markerPath(projectDir), `${JSON.stringify(marker, null, 2)}\n`)
}

function withTrailingNewline(lines: readonly string[]): string {
  return `${lines.join("\n")}\n`
}

export function cachedWorkflowRailOutput(input: CachedWorkflowRailOutput): string {
  const hash = bodyHash(input.railBodyLines)
  const marker = readMarker(input.projectDir)
  const cached = marker.entries[input.surface]
  const workspaceHasPrintedRail = marker.printedAt !== undefined || Object.keys(marker.entries).length > 0
  if (!input.full && (cached?.bodyHash === hash || (cached === undefined && workspaceHasPrintedRail))) {
    if (cached === undefined) {
      writeMarker(input.projectDir, {
        entries: {
          ...marker.entries,
          [input.surface]: { bodyHash: hash, updatedAt: new Date().toISOString() },
        },
        printedAt: marker.printedAt,
        schemaVersion: SCHEMA_VERSION,
      })
    }
    return withTrailingNewline([...input.uniqueLines, RAIL_UNCHANGED_LINE])
  }

  const updatedAt = new Date().toISOString()
  writeMarker(input.projectDir, {
    entries: {
      ...marker.entries,
      [input.surface]: { bodyHash: hash, updatedAt },
    },
    printedAt: marker.printedAt ?? updatedAt,
    schemaVersion: SCHEMA_VERSION,
  })
  return withTrailingNewline(input.fullLines ?? [...input.uniqueLines, ...input.railBodyLines])
}
