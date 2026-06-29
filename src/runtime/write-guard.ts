import { readFileSync } from "node:fs"
import { relative, resolve } from "node:path"

import { observeControllerRepositoryDependency } from "../observer/controller-repository-observer.js"
import type { ControllerRepositoryEvidence } from "../observer/controller-repository-observer.js"
import { isJavaTargetFile } from "./file-role.js"

type WriteGuardInput = {
  readonly projectDir: string
  readonly targetFile: string
  readonly tool: string
}

export function createWriteGuardWarning(input: WriteGuardInput): string | undefined {
  if (!isWriteOrEditTool(input.tool) || !isJavaTargetFile(input.targetFile) || !input.targetFile.endsWith("Controller.java")) {
    return undefined
  }

  const absoluteTargetPath = resolve(input.projectDir, input.targetFile)
  const source = readFileSync(absoluteTargetPath, "utf8")
  const observation = observeControllerRepositoryDependency({ filePath: absoluteTargetPath, source })
  if (observation.finding !== "WARN" || !hasSpecificDependencyEvidence(observation.evidence)) {
    return undefined
  }

  const evidenceText = [...observation.evidence.constructorParameters, ...observation.evidence.fields, ...observation.evidence.imports].join("; ")
  return [
    "[Persona Harness Write Guard]",
    "",
    "Mode: non-blocking warning. The current OpenCode plugin hook can mutate tool args/output but does not expose a controlled write deny/rewrite result.",
    "Rule: controller.repository-dependency",
    `File: ${relative(input.projectDir, absoluteTargetPath)}`,
    `Finding: Controller directly depends on Repository (${evidenceText}).`,
    "Fix path: route the Controller through a Service layer instead of depending on Repository directly.",
    "After fix: re-run `npx ph workflow check`; finish/archive may block if this convention remains at level `block`.",
  ].join("\n")
}

function hasSpecificDependencyEvidence(evidence: ControllerRepositoryEvidence): boolean {
  return evidence.constructorParameters.length > 0 || evidence.fields.length > 0 || evidence.imports.length > 0
}

function isWriteOrEditTool(tool: string): boolean {
  const normalizedTool = tool.toLowerCase()
  return normalizedTool === "write"
    || normalizedTool === "edit"
    || normalizedTool === "patch"
    || normalizedTool === "multiedit"
    || normalizedTool === "multi_edit"
    || normalizedTool.includes("write")
    || normalizedTool.includes("edit")
}
