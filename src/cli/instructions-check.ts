import { existsSync } from "node:fs"
import { join } from "node:path"

import { isRecord } from "../config/jsonc.js"
import {
  INSTRUCTION_INFERENCE_LIMITATIONS,
  INSTRUCTIONS_OUTPUT_DIR,
  lineFor,
  listFiles,
  readText,
  sourceRef,
  type SourceRef,
} from "./instructions-model.js"

type AdoptedRule = {
  readonly id: string
  readonly mode: string
}

type InstructionCheckFinding = {
  readonly id: string
  readonly ruleId: string
  readonly severity: "drift"
  readonly sourceRefs: readonly SourceRef[]
  readonly suggestedFix: string
  readonly summary: string
}

type InstructionCheckReport = {
  readonly adoptedPath: string
  readonly adoptedRules: number
  readonly findings: readonly InstructionCheckFinding[]
  readonly limitations: readonly string[]
  readonly projectDir: string
  readonly schemaVersion: "instructions-check.1"
  readonly skippedRules: readonly string[]
}

const CHECK_LIMITATIONS = [
  "Only adopted rules are checked; inferred-only candidates are ignored.",
  ...INSTRUCTION_INFERENCE_LIMITATIONS,
] as const

export function readInstructionCheckReport(projectDir: string): InstructionCheckReport {
  const adoptedPath = join(projectDir, INSTRUCTIONS_OUTPUT_DIR, "adopted.json")
  const adoptedRules = readAdoptedRules(adoptedPath)
  const supported = new Set(["architecture.controller-service-repository"])
  return {
    adoptedPath,
    adoptedRules: adoptedRules.length,
    findings: adoptedRules.flatMap((adoptedRule) => findingsForRule(projectDir, adoptedRule)),
    limitations: CHECK_LIMITATIONS,
    projectDir,
    schemaVersion: "instructions-check.1",
    skippedRules: adoptedRules.filter((rule) => !supported.has(rule.id)).map((rule) => rule.id),
  }
}

export function formatInstructionCheckReport(report: InstructionCheckReport): string {
  return [
    "# Persona Instruction Check",
    "",
    `Adopted rules checked: ${report.adoptedRules}`,
    `Findings: ${report.findings.length}`,
    `Skipped unsupported rules: ${report.skippedRules.length}`,
    "",
    ...findingLines(report.findings),
    "",
    "Boundary: only adopted rules are checked; inferred-only candidates do not block finish.",
  ].join("\n")
}

function findingsForRule(projectDir: string, rule: AdoptedRule): readonly InstructionCheckFinding[] {
  if (rule.id !== "architecture.controller-service-repository") {
    return []
  }
  return controllerRepositoryFindings(projectDir, rule.id)
}

function controllerRepositoryFindings(projectDir: string, ruleId: string): readonly InstructionCheckFinding[] {
  const controllers = listFiles(join(projectDir, "src", "main", "java"), "Controller.java")
  return controllers.flatMap((controllerPath) => {
    const text = readText(controllerPath)
    if (!/Repository\b/u.test(text)) {
      return []
    }
    return [
      {
        id: "drift.controller-repository-direct-dependency",
        ruleId,
        severity: "drift",
        sourceRefs: [sourceRef(projectDir, controllerPath, lineFor(text, /Repository\b/u), "Controller mentions Repository directly")],
        suggestedFix: "Route controller behavior through an application/service layer before repository access.",
        summary: "Adopted Controller/Service/Repository boundary drift: controller references repository directly.",
      },
    ]
  })
}

function readAdoptedRules(adoptedPath: string): readonly AdoptedRule[] {
  if (!existsSync(adoptedPath)) {
    return []
  }
  const parsed: unknown = JSON.parse(readText(adoptedPath))
  if (!isRecord(parsed) || !Array.isArray(parsed.rules)) {
    return []
  }
  return parsed.rules.flatMap((entry) => {
    if (!isRecord(entry) || typeof entry.id !== "string") {
      return []
    }
    return [{ id: entry.id, mode: typeof entry.mode === "string" ? entry.mode : "advisory" }]
  })
}

function findingLines(findings: readonly InstructionCheckFinding[]): readonly string[] {
  if (findings.length === 0) {
    return ["- none"]
  }
  return findings.map((finding) => `- ${finding.id}: ${finding.summary}`)
}
