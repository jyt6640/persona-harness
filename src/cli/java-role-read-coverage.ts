import { lstatSync, readdirSync, readFileSync } from "node:fs"
import { join, relative } from "node:path"

import { loadHarnessConfigResult, resolveConfiguredPathResult } from "../config/harness-config.js"
import { walkBoundedFiles } from "../io/bounded-path-walker.js"
import { redactEvidenceText } from "../runtime/evidence-redaction.js"
export type JavaRoleReadCoverageFinding = "PASS" | "WARN"

export type JavaRoleReadCoverageSummary = {
  readonly javaRoleReadCoverage: string
  readonly javaRoleReadCoverageBlocking: boolean
  readonly javaRoleReadCoverageFinding: JavaRoleReadCoverageFinding
}

type JavaGeneratedRole =
  | "controller/presentation"
  | "service/application"
  | "repository/domain port"
  | "infrastructure adapter"
  | "domain model"
  | "request DTO"
  | "response DTO"
  | "exception"

type JavaRoleFile = {
  readonly path: string
  readonly role: JavaGeneratedRole
}

const JAVA_MAIN_DIR = join("src", "main", "java")
const JAVA_ROLE_MAX_DEPTH = 64
const JAVA_ROLE_MAX_ENTRIES = 10_000
const ACTIONABLE_INJECTION_PATTERN = /"injectedInto"\s*:\s*"(?:tool-output|model-input)"/
const ANY_INJECTION_PATTERN = /"injectedInto"\s*:/

function normalizePath(value: string): string {
  return value.replace(/\\\\/g, "/").replace(/\\/g, "/")
}

function fileNameFor(filePath: string): string {
  const normalized = normalizePath(filePath)
  return normalized.split("/").at(-1) ?? normalized
}

function javaRoleFor(relativePath: string): JavaGeneratedRole | undefined {
  const normalized = normalizePath(relativePath)
  const lowerPath = normalized.toLowerCase()
  const fileName = fileNameFor(normalized)

  if (lowerPath.includes("/dto/request/") || fileName.endsWith("Request.java")) return "request DTO"
  if (lowerPath.includes("/dto/response/") || fileName.endsWith("Response.java")) return "response DTO"
  if (fileName.endsWith("Exception.java") || lowerPath.includes("/exception/")) return "exception"
  if (lowerPath.includes("/infrastructure/") || lowerPath.includes("/adapter/")) return "infrastructure adapter"
  if (fileName.endsWith("Controller.java") || lowerPath.includes("/presentation/") || lowerPath.includes("/web/")) {
    return "controller/presentation"
  }
  if (fileName.endsWith("Service.java") || lowerPath.includes("/application/")) return "service/application"
  if (fileName.endsWith("Repository.java") || lowerPath.includes("/repository/")) return "repository/domain port"
  if (fileName.endsWith("Entity.java") || lowerPath.includes("/domain/")) return "domain model"

  return undefined
}

function collectJavaRoleFiles(projectDir: string): { readonly files: readonly JavaRoleFile[]; readonly safe: boolean } {
  const rootDir = join(projectDir, JAVA_MAIN_DIR)
  const files: JavaRoleFile[] = []
  let entryCount = 0
  let safe = true

  function visit(dirPath: string, depth: number): void {
    if (!safe) {
      return
    }
    if (depth > JAVA_ROLE_MAX_DEPTH) {
      safe = false
      return
    }
    let entries: readonly string[]
    try {
      entries = readdirSync(dirPath).sort()
    } catch {
      safe = false
      return
    }
    for (const entry of entries) {
      entryCount += 1
      if (entryCount > JAVA_ROLE_MAX_ENTRIES) {
        safe = false
        return
      }
      const entryPath = join(dirPath, entry)
      let stat: ReturnType<typeof lstatSync>
      try {
        stat = lstatSync(entryPath)
      } catch {
        safe = false
        return
      }
      if (stat.isSymbolicLink()) {
        safe = false
        return
      }
      if (stat.isDirectory()) {
        visit(entryPath, depth + 1)
        continue
      }
      if (!stat.isFile() || !entryPath.endsWith(".java")) {
        continue
      }
      const relativePath = safeJavaRelativePath(normalizePath(relative(projectDir, entryPath)))
      const role = javaRoleFor(relativePath)
      if (role !== undefined) {
        files.push({ path: relativePath, role })
      }
    }
  }

  try {
    const root = lstatSync(rootDir)
    if (root.isSymbolicLink() || !root.isDirectory()) {
      return { files: [], safe: false }
    }
  } catch (error) {
    return isMissingPath(error)
      ? { files: [], safe: true }
      : { files: [], safe: false }
  }
  visit(rootDir, 0)
  return { files, safe }
}

function collectEvidenceTexts(projectDir: string): { readonly safe: boolean; readonly texts: readonly string[] } {
  const configResult = loadHarnessConfigResult(projectDir)
  if (!configResult.safe) {
    return { safe: false, texts: [] }
  }
  const evidencePath = resolveConfiguredPathResult(projectDir, configResult.config.evidenceDir)
  if (!evidencePath.ok) {
    return { safe: false, texts: [] }
  }
  const walked = walkBoundedFiles(evidencePath.path, projectDir, {
    displayRoot: evidencePath.relativePath || configResult.config.evidenceDir,
    extensions: [".json"],
    includeText: true,
  })
  return {
    safe: walked.safe,
    texts: walked.files.flatMap((file) => file.text === undefined ? [] : [normalizePath(file.text)]),
  }
}

function evidenceRolesFor(role: JavaGeneratedRole): readonly string[] {
  if (role === "controller/presentation") return ["controller"]
  if (role === "service/application") return ["service"]
  if (role === "repository/domain port") return ["repository"]
  if (role === "infrastructure adapter") return ["repository"]
  if (role === "domain model") return ["domain", "entity"]
  if (role === "request DTO") return ["request-dto"]
  if (role === "response DTO") return ["response-dto"]
  return ["exception"]
}

function hasActionableReadEvidence(evidenceText: string): boolean {
  return ACTIONABLE_INJECTION_PATTERN.test(evidenceText) || !ANY_INJECTION_PATTERN.test(evidenceText)
}

function hasRoleReadEvidence(file: JavaRoleFile, evidenceTexts: readonly string[]): boolean {
  const evidenceRoles = evidenceRolesFor(file.role)
  return evidenceTexts.some((evidenceText) => {
    if (!hasActionableReadEvidence(evidenceText)) {
      return false
    }
    if (evidenceText.includes(file.path)) {
      return true
    }
    return evidenceRoles.some((role) => new RegExp(`"fileRole"\\s*:\\s*"${role}"`).test(evidenceText))
  })
}

function formatMissingFiles(missingFiles: readonly JavaRoleFile[]): string {
  return missingFiles.map((file) => `${file.role}: ${file.path}`).join("; ")
}

export function readJavaRoleReadCoverage(projectDir: string, implementationStatus: string): JavaRoleReadCoverageSummary {
  if (implementationStatus !== "filled") {
    return {
      javaRoleReadCoverage: "not checked until implementation report is filled",
      javaRoleReadCoverageBlocking: false,
      javaRoleReadCoverageFinding: "PASS",
    }
  }

  const javaResult = collectJavaRoleFiles(projectDir)
  if (!javaResult.safe) {
    return {
      javaRoleReadCoverage: "Java role discovery is unavailable; read-only recovery is required.",
      javaRoleReadCoverageBlocking: true,
      javaRoleReadCoverageFinding: "WARN",
    }
  }
  const javaFiles = javaResult.files
  if (javaFiles.length === 0) {
    return {
      javaRoleReadCoverage: "no generated Java role files observed",
      javaRoleReadCoverageBlocking: false,
      javaRoleReadCoverageFinding: "PASS",
    }
  }

  const evidenceTextsResult = collectEvidenceTexts(projectDir)
  if (!evidenceTextsResult.safe) {
    return {
      javaRoleReadCoverage: "configured evidence traversal is unsafe; read-only recovery is required",
      javaRoleReadCoverageBlocking: true,
      javaRoleReadCoverageFinding: "WARN",
    }
  }
  const evidenceTexts = evidenceTextsResult.texts
  const missingFiles = javaFiles.filter((file) => !hasRoleReadEvidence(file, evidenceTexts))
  if (missingFiles.length === 0) {
    return {
      javaRoleReadCoverage: "generated Java role files have role read evidence",
      javaRoleReadCoverageBlocking: false,
      javaRoleReadCoverageFinding: "PASS",
    }
  }

  return {
    javaRoleReadCoverage: `WARN: workflow evidence/read coverage missing; missing ${formatMissingFiles(missingFiles)}`,
    javaRoleReadCoverageBlocking: true,
    javaRoleReadCoverageFinding: "WARN",
  }
}

function safeJavaRelativePath(value: string): string {
  const normalized = normalizePath(value)
  if (
    normalized.length === 0
    || normalized.length > 240
    || !/^[A-Za-z0-9._@+/-]+$/u.test(normalized)
    || normalized.startsWith("../")
    || normalized.includes("/../")
    || redactEvidenceText(normalized).text !== normalized
  ) {
    return "[UNAVAILABLE]"
  }
  return normalized
}

function isMissingPath(error: unknown): boolean {
  return typeof error === "object"
    && error !== null
    && "code" in error
    && error.code === "ENOENT"
}
