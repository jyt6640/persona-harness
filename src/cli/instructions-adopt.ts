import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"

import { isRecord } from "../config/jsonc.js"
import { INSTRUCTION_INFERENCE_LIMITATIONS, INSTRUCTIONS_OUTPUT_DIR, type Confidence, type InferredRule, type SourceRef } from "./instructions-model.js"

type AdoptedInstructionRule = {
  readonly confidence: Confidence
  readonly id: string
  readonly mode: "advisory" | "candidate-blocker"
  readonly sourceRefs: readonly SourceRef[]
  readonly summary: string
}

type AdoptedInstructionReport = {
  readonly generatedAt: string
  readonly limitations: readonly string[]
  readonly rules: readonly AdoptedInstructionRule[]
  readonly schemaVersion: "instructions-adopted.1"
}

type InstructionAdoptResult = {
  readonly adoptedPath: string
  readonly rulesAdopted: number
  readonly schemaVersion: "instructions-adopt-result.1"
  readonly skippedRules: readonly string[]
}

const CONFIDENCE_RANK: Readonly<Record<Confidence, number>> = {
  high: 3,
  low: 1,
  medium: 2,
}

export function runInstructionAdopt(projectDir: string, minConfidence: Confidence): InstructionAdoptResult {
  const instructionsDir = join(projectDir, INSTRUCTIONS_OUTPUT_DIR)
  const inferredPath = join(instructionsDir, "inferred.json")
  const adoptedPath = join(instructionsDir, "adopted.json")
  const inferredRules = readInferredRules(inferredPath)
  const adoptedRules = inferredRules.filter((rule) => canAdopt(rule, minConfidence)).map(adoptedRule)
  const adopted = {
    generatedAt: new Date().toISOString(),
    limitations: [
      "Adoption copies reviewed inferred candidates only; it does not create closure blockers.",
      ...INSTRUCTION_INFERENCE_LIMITATIONS,
    ],
    rules: adoptedRules,
    schemaVersion: "instructions-adopted.1",
  } satisfies AdoptedInstructionReport
  mkdirSync(instructionsDir, { recursive: true })
  writeFileSync(adoptedPath, `${JSON.stringify(adopted, null, 2)}\n`)
  return {
    adoptedPath,
    rulesAdopted: adoptedRules.length,
    schemaVersion: "instructions-adopt-result.1",
    skippedRules: inferredRules.filter((rule) => !canAdopt(rule, minConfidence)).map((rule) => rule.id),
  }
}

export function formatInstructionAdoptResult(result: InstructionAdoptResult): string {
  return [
    "# Persona Instruction Adoption Preview",
    "",
    `Rules adopted: ${result.rulesAdopted}`,
    `Skipped rules: ${result.skippedRules.length}`,
    `Adopted policy: \`${result.adoptedPath}\``,
    "",
    "Boundary: adopted rules are checked only by `ph instructions check`; adoption does not add closure blockers.",
  ].join("\n")
}

export function parseMinConfidence(args: readonly string[]): Confidence {
  const index = args.indexOf("--min-confidence")
  if (index === -1) {
    return "high"
  }
  const value = args[index + 1]
  if (value === "high" || value === "medium" || value === "low") {
    return value
  }
  return "high"
}

export function stripAdoptArgs(args: readonly string[]): readonly string[] {
  const output: string[] = []
  let skipNext = false
  for (const arg of args) {
    if (skipNext) {
      skipNext = false
      continue
    }
    if (arg === "--min-confidence") {
      skipNext = true
      continue
    }
    output.push(arg)
  }
  return output
}

function canAdopt(rule: InferredRule, minConfidence: Confidence): boolean {
  return rule.suggestedMode !== "conflict" && CONFIDENCE_RANK[rule.confidence] >= CONFIDENCE_RANK[minConfidence]
}

function adoptedRule(rule: InferredRule): AdoptedInstructionRule {
  return {
    confidence: rule.confidence,
    id: rule.id,
    mode: rule.suggestedMode === "candidate-blocker" ? "candidate-blocker" : "advisory",
    sourceRefs: rule.sourceRefs,
    summary: rule.summary,
  }
}

function readInferredRules(inferredPath: string): readonly InferredRule[] {
  if (!existsSync(inferredPath)) {
    return []
  }
  const parsed: unknown = JSON.parse(readFileSync(inferredPath, "utf8"))
  if (!isRecord(parsed) || !Array.isArray(parsed.rules)) {
    return []
  }
  return parsed.rules.flatMap(parseInferredRule)
}

function parseInferredRule(value: unknown): readonly InferredRule[] {
  if (!isRecord(value) || typeof value.id !== "string" || !isConfidence(value.confidence) || typeof value.summary !== "string") {
    return []
  }
  if (value.suggestedMode !== "advisory" && value.suggestedMode !== "candidate-blocker" && value.suggestedMode !== "conflict") {
    return []
  }
  return [
    {
      confidence: value.confidence,
      id: value.id,
      kind: value.kind === "build" ? "build" : "architecture",
      sourceKind: value.sourceKind === "docs" || value.sourceKind === "project-profile" ? value.sourceKind : "code",
      sourceRefs: parseSourceRefs(value.sourceRefs),
      suggestedMode: value.suggestedMode,
      summary: value.summary,
    },
  ]
}

function parseSourceRefs(value: unknown): readonly SourceRef[] {
  if (!Array.isArray(value)) {
    return []
  }
  return value.flatMap((entry) => {
    if (!isRecord(entry) || typeof entry.filePath !== "string" || typeof entry.evidence !== "string" || typeof entry.line !== "number") {
      return []
    }
    return [{ evidence: entry.evidence, filePath: entry.filePath, line: entry.line }]
  })
}

function isConfidence(value: unknown): value is Confidence {
  return value === "high" || value === "medium" || value === "low"
}
