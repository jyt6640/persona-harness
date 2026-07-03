import { isAbsolute, relative, resolve } from "node:path"

import type { MultiAgentRole } from "../config/harness-config.js"
import { roleArtifactPath } from "../cli/workflow-relay-artifacts.js"

export const HEURISTIC_LIMITATION =
  "heuristic time-window attribution; the write may originate from the main session or an unrelated subagent"

export const ROLE_BOUNDARY_LIMITATIONS = [
  HEURISTIC_LIMITATION,
  "report-only observation; no writes are blocked, no workflow state is mutated, and no closure blocker is created",
] as const

export function isWriteOrEditTool(tool: string): boolean {
  const normalizedTool = tool.toLowerCase()
  return (
    normalizedTool === "write" ||
    normalizedTool === "edit" ||
    normalizedTool === "patch" ||
    normalizedTool === "multiedit" ||
    normalizedTool === "multi_edit" ||
    normalizedTool.includes("write") ||
    normalizedTool.includes("edit")
  )
}

export function normalizeObservedPath(projectDir: string, targetFile: string): string {
  const absolutePath = resolve(projectDir, targetFile)
  const relativePath = relative(projectDir, absolutePath).replace(/\\/g, "/")
  if (relativePath.length === 0) {
    return "."
  }
  if (relativePath === ".." || relativePath.startsWith("../") || isAbsolute(relativePath)) {
    return targetFile.replace(/\\/g, "/")
  }
  return relativePath
}

function isTestPath(path: string): boolean {
  const normalized = path.toLowerCase()
  const fileName = normalized.split("/").at(-1) ?? normalized
  return (
    normalized.startsWith("src/test/") ||
    normalized.startsWith("test/") ||
    normalized.startsWith("tests/") ||
    fileName.endsWith("test.java") ||
    fileName.endsWith("tests.java") ||
    fileName.endsWith("spec.java")
  )
}

function isProductionSourcePath(path: string): boolean {
  const normalized = path.toLowerCase()
  return normalized.startsWith("src/main/") || normalized.startsWith("src/")
}

export function roleBoundaryPathPolicy(
  role: MultiAgentRole,
  ticketId: string,
  path: string,
): { readonly allowed: boolean; readonly reason: string } {
  const artifactPath = roleArtifactPath(ticketId, role)
  if (role === "test-writer") {
    return {
      allowed: isTestPath(path) || path === artifactPath,
      reason: "test-writer may write test paths and its own relay artifact path",
    }
  }
  if (role === "implementer") {
    return {
      allowed:
        isProductionSourcePath(path) ||
        path === artifactPath ||
        path === ".persona/workflow/implementation-report.md",
      reason: "implementer may write production/source paths, implementation report, and its own relay artifact path",
    }
  }
  return {
    allowed: path === artifactPath || path === ".persona/workflow/review-report.md",
    reason: "reviewer may write review report and its own relay artifact path; production source writes are suspicious",
  }
}
