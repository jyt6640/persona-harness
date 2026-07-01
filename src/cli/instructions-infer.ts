import { join } from "node:path"

import type { CliRunResult } from "./bearshell.js"
import { inferBackendInstructions } from "./instructions-engine.js"
import { INSTRUCTIONS_OUTPUT_DIR, type InstructionInferenceResult } from "./instructions-model.js"

export function instructionsUsage(invocationName: string): string {
  return [
    `Usage: ${invocationName} instructions infer backend [--json]`,
    "",
    "Commands:",
    "  instructions infer backend [--json]  Infer backend instruction candidates with provenance.",
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
  const positional = args.filter((arg) => arg !== "--json")
  if (positional.length !== 2 || positional[0] !== "infer" || positional[1] !== "backend") {
    return { status: 1, stdout: "", stderr: `Unknown instructions command.\n\n${instructionsUsage(invocationName)}\n` }
  }
  const projectDir = options.projectDir ?? process.cwd()
  const result = inferBackendInstructions(projectDir)
  if (json) {
    return { status: 0, stdout: `${JSON.stringify(result.inferred, null, 2)}\n`, stderr: "" }
  }
  return { status: 0, stdout: formatInstructionInference(result), stderr: "" }
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
