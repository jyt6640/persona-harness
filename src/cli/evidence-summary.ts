import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs"
import { basename, dirname, join, resolve } from "node:path"
import process from "node:process"

import { isRecord } from "../config/jsonc.js"
import type { CliRunResult } from "./bearshell.js"

type EvidenceOptions = {
  readonly projectDir?: string
}

type EvidenceRecord = {
  readonly targetFile: string
  readonly fileRole: string
  readonly selectedRules: readonly string[]
  readonly selectedSharedSkills: readonly string[]
}

type EvidenceSummary = {
  readonly records: readonly EvidenceRecord[]
  readonly unreadableFiles: readonly string[]
}

const SUMMARY_PATH = ".persona/evidence/summary.md"

function stringArray(value: unknown): readonly string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : []
}

function skillNames(value: unknown): readonly string[] {
  if (!Array.isArray(value)) {
    return []
  }
  return value.flatMap((entry) => (isRecord(entry) && typeof entry.name === "string" ? [entry.name] : []))
}

function listJsonFiles(dirPath: string): readonly string[] {
  if (!existsSync(dirPath)) {
    return []
  }
  const files: string[] = []
  for (const entry of readdirSync(dirPath)) {
    const entryPath = join(dirPath, entry)
    const stat = statSync(entryPath)
    if (stat.isDirectory()) {
      files.push(...listJsonFiles(entryPath))
    } else if (stat.isFile() && entryPath.endsWith(".json")) {
      files.push(entryPath)
    }
  }
  return files
}

function increment(counts: Map<string, number>, key: string): void {
  counts.set(key, (counts.get(key) ?? 0) + 1)
}

function countLines(counts: Map<string, number>): readonly string[] {
  if (counts.size === 0) {
    return ["- none"]
  }
  return Array.from(counts.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, count]) => `- ${key}: ${count}`)
}

function parseEvidenceFile(filePath: string): EvidenceRecord | undefined {
  const parsed: unknown = JSON.parse(readFileSync(filePath, "utf8"))
  if (!isRecord(parsed)) {
    return undefined
  }
  return {
    targetFile: typeof parsed.targetFile === "string" ? parsed.targetFile : "unknown",
    fileRole: typeof parsed.fileRole === "string" ? parsed.fileRole : "unknown",
    selectedRules: stringArray(parsed.selectedRules),
    selectedSharedSkills: skillNames(parsed.selectedSharedSkills),
  }
}

function readEvidenceSummary(projectDir: string): EvidenceSummary {
  const evidenceDir = join(projectDir, ".persona", "evidence")
  const records: EvidenceRecord[] = []
  const unreadableFiles: string[] = []
  for (const filePath of listJsonFiles(evidenceDir)) {
    try {
      const record = parseEvidenceFile(filePath)
      if (record === undefined) {
        unreadableFiles.push(filePath)
      } else {
        records.push(record)
      }
    } catch {
      unreadableFiles.push(filePath)
    }
  }
  return { records, unreadableFiles }
}

function formatEvidenceSummary(projectDir: string, summary: EvidenceSummary): string {
  const roleCounts = new Map<string, number>()
  const ruleCounts = new Map<string, number>()
  const skillCounts = new Map<string, number>()
  for (const record of summary.records) {
    increment(roleCounts, record.fileRole)
    for (const rule of record.selectedRules) {
      increment(ruleCounts, rule)
    }
    for (const skill of record.selectedSharedSkills) {
      increment(skillCounts, skill)
    }
  }
  return [
    "# Persona Evidence Summary",
    "",
    `Project: \`${projectDir}\``,
    `Total evidence files: ${summary.records.length}`,
    `Unreadable evidence files: ${summary.unreadableFiles.length}`,
    "",
    "## Role Counts",
    "",
    ...countLines(roleCounts),
    "",
    "## Rule Counts",
    "",
    ...countLines(ruleCounts),
    "",
    "## Skill Counts",
    "",
    ...countLines(skillCounts),
    "",
    "## Targets",
    "",
    ...(summary.records.length === 0
      ? ["- none"]
      : summary.records.map((record) => `- ${basename(record.targetFile)} (${record.fileRole})`)),
    "",
    "## Unreadable Files",
    "",
    ...(summary.unreadableFiles.length === 0 ? ["- none"] : summary.unreadableFiles.map((filePath) => `- ${basename(filePath)}`)),
    "",
    "## Limitations",
    "",
    "- Summary-only evidence view.",
    "- Not generated app product-quality certification.",
    "",
  ].join("\n")
}

export function writeEvidenceSummary(options: EvidenceOptions = {}): string {
  const projectDir = resolve(options.projectDir ?? process.cwd())
  const outputPath = join(projectDir, SUMMARY_PATH)
  mkdirSync(dirname(outputPath), { recursive: true })
  writeFileSync(outputPath, formatEvidenceSummary(projectDir, readEvidenceSummary(projectDir)))
  return outputPath
}

export function runEvidenceCommand(args: readonly string[], options: EvidenceOptions = {}, invocationName = "ph"): CliRunResult {
  if (args.length !== 1 || args[0] !== "summary") {
    return { status: 1, stdout: "", stderr: `Usage: ${invocationName} evidence summary\n` }
  }
  const outputPath = writeEvidenceSummary(options)
  return { status: 0, stdout: `Evidence summary written: ${outputPath}\n`, stderr: "" }
}
