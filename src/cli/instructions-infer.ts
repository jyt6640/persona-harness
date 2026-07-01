import { join } from "node:path"

import type { CliRunResult } from "./bearshell.js"
import { formatInstructionAdoptResult, parseMinConfidence, runInstructionAdopt, stripAdoptArgs } from "./instructions-adopt.js"
import { formatInstructionCheckReport, readInstructionCheckReport } from "./instructions-check.js"
import { inferBackendInstructions } from "./instructions-engine.js"
import { INSTRUCTIONS_OUTPUT_DIR, type InstructionInferenceResult } from "./instructions-model.js"

export function instructionsUsage(invocationName: string): string {
  return [
    `Usage: ${invocationName} instructions <command> [--json]`,
    "",
    "Commands:",
    "  instructions infer backend [--json]  Infer backend instruction candidates with provenance.",
    "  instructions adopt [--json]          Copy inferred candidates into adopted policy for review.",
    "  instructions check [--json]          Check adopted instruction rules only.",
    "",
    "Boundaries:",
    "  Inference writes .persona/instructions/inferred.json and conflicts.json.",
    "  Inferred rules are not blockers until a future explicit adoption step.",
  ].join("\n")
}

export function runInstructionsCommand(
  args: readonly string[],
  options: { readonly projectDir?: string },
  invocationName: string,
): CliRunResult {
  if (args.length === 0 || args[0] === "--help" || args[0] === "-h" || args[0] === "help") {
    return { status: 0, stdout: `${instructionsUsage(invocationName)}\n`, stderr: "" }
  }
  const json = args.includes("--json")
  const positional = stripAdoptArgs(args).filter((arg) => arg !== "--json")
  if (positional.length === 2 && positional[0] === "infer" && positional[1] === "backend") {
    return runInstructionsInfer(options.projectDir ?? process.cwd(), json)
  }
  if (positional.length === 1 && positional[0] === "adopt") {
    return runInstructionsAdopt(options.projectDir ?? process.cwd(), json, parseMinConfidence(args))
  }
  if (positional.length === 1 && positional[0] === "check") {
    return runInstructionsCheck(options.projectDir ?? process.cwd(), json)
  }
  {
    return { status: 1, stdout: "", stderr: `Unknown instructions command.\n\n${instructionsUsage(invocationName)}\n` }
  }
}

function runInstructionsInfer(projectDir: string, json: boolean): CliRunResult {
  const result = inferBackendInstructions(projectDir)
  if (json) {
    return { status: 0, stdout: `${JSON.stringify(result.inferred, null, 2)}\n`, stderr: "" }
  }
  return { status: 0, stdout: formatInstructionInference(result), stderr: "" }
}

function runInstructionsCheck(projectDir: string, json: boolean): CliRunResult {
  const report = readInstructionCheckReport(projectDir)
  if (json) {
    return { status: 0, stdout: `${JSON.stringify(report, null, 2)}\n`, stderr: "" }
  }
  return { status: 0, stdout: formatInstructionCheckReport(report), stderr: "" }
}

function runInstructionsAdopt(projectDir: string, json: boolean, minConfidence: "high" | "low" | "medium"): CliRunResult {
  const result = runInstructionAdopt(projectDir, minConfidence)
  if (json) {
    return { status: 0, stdout: `${JSON.stringify(result, null, 2)}\n`, stderr: "" }
  }
  return { status: 0, stdout: formatInstructionAdoptResult(result), stderr: "" }
}

function formatInstructionInference(result: InstructionInferenceResult): string {
  return [
    "# Persona Instruction Inference",
    "",
    `Rules inferred: ${result.inferred.rules.length}`,
    `Conflicts reported: ${result.conflicts.conflicts.length}`,
    `Inferred rules: \`${join(result.inferred.projectDir, INSTRUCTIONS_OUTPUT_DIR, "inferred.json")}\``,
    `Conflicts: \`${join(result.inferred.projectDir, INSTRUCTIONS_OUTPUT_DIR, "conflicts.json")}\``,
    "",
    "Suggested next step: review inferred.json before any future adoption/check step.",
    "Boundary: inferred rules are not closure blockers and are not company compliance or app-quality guarantees.",
  ].join("\n")
}
