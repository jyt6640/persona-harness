import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative } from "node:path"

export type CandidateKind = "architecture" | "build" | "docs" | "naming" | "testing" | "workflow"
export type Confidence = "high" | "low" | "medium"
export type SourceKind = "code" | "docs" | "project-profile"
export type SuggestedMode = "advisory" | "candidate-blocker" | "conflict"

export type SourceRef = {
  readonly evidence: string
  readonly filePath: string
  readonly line: number
}

export type InferredRule = {
  readonly confidence: Confidence
  readonly id: string
  readonly kind: CandidateKind
  readonly sourceKind: SourceKind
  readonly sourceRefs: readonly SourceRef[]
  readonly suggestedMode: SuggestedMode
  readonly summary: string
}

export type InstructionConflict = {
  readonly id: string
  readonly sourceRefs: readonly SourceRef[]
  readonly summary: string
}

export type InstructionInferenceReport = {
  readonly conflictsPath: string
  readonly generatedAt: string
  readonly limitations: readonly string[]
  readonly projectDir: string
  readonly rules: readonly InferredRule[]
  readonly schemaVersion: "instructions-inferred.1"
}

export type InstructionConflictReport = {
  readonly conflicts: readonly InstructionConflict[]
  readonly limitations: readonly string[]
  readonly schemaVersion: "instructions-conflicts.1"
}

export type InstructionInferenceResult = {
  readonly conflicts: InstructionConflictReport
  readonly inferred: InstructionInferenceReport
}

export type ProfileObservation = {
  readonly architectureStyle: string | null
  readonly buildTool: string | null
  readonly packageStyle: string | null
  readonly sourceRef: SourceRef | null
}

export const INSTRUCTIONS_OUTPUT_DIR = ".persona/instructions"
export const INSTRUCTION_INFERENCE_LIMITATIONS = [
  "Read-only preview: inferred rules are observations, not adopted policy.",
  "No closure blocker or config mutation is performed.",
  "This is not a company instruction compliance, app-quality, or broad linter claim.",
] as const

export function inferredRule(
  id: string,
  kind: CandidateKind,
  confidence: Confidence,
  sourceKind: SourceKind,
  suggestedMode: SuggestedMode,
  summary: string,
  sourceRefs: readonly SourceRef[],
): InferredRule {
  return { confidence, id, kind, sourceKind, sourceRefs, suggestedMode, summary }
}

export function sourceRef(projectDir: string, filePath: string, line: number, evidence: string): SourceRef {
  return { evidence, filePath: relative(projectDir, filePath), line }
}

export function firstExisting(projectDir: string, paths: readonly string[]): string | null {
  for (const candidate of paths) {
    const fullPath = join(projectDir, candidate)
    if (existsSync(fullPath)) {
      return fullPath
    }
  }
  return null
}

export function listFiles(rootDir: string, suffix: string): readonly string[] {
  if (!existsSync(rootDir)) {
    return []
  }
  const files: string[] = []
  for (const entry of readdirSync(rootDir)) {
    const entryPath = join(rootDir, entry)
    const stat = statSync(entryPath)
    if (stat.isDirectory()) {
      files.push(...listFiles(entryPath, suffix))
    } else if (stat.isFile() && entryPath.endsWith(suffix)) {
      files.push(entryPath)
    }
  }
  return files.sort()
}

export function readText(path: string): string {
  return readFileSync(path, "utf8")
}

export function lineFor(text: string, pattern: RegExp): number {
  const lines = text.split(/\r?\n/u)
  const index = lines.findIndex((line) => pattern.test(line))
  return index === -1 ? 1 : index + 1
}
