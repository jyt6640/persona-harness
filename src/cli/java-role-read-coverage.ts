import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative } from "node:path"

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

const EVIDENCE_DIR = ".persona/evidence"
const JAVA_MAIN_DIR = join("src", "main", "java")
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

function collectJavaRoleFiles(projectDir: string): readonly JavaRoleFile[] {
  const rootDir = join(projectDir, JAVA_MAIN_DIR)
  const files: JavaRoleFile[] = []

  function visit(dirPath: string): void {
    if (!existsSync(dirPath)) {
      return
    }
    for (const entry of readdirSync(dirPath)) {
      const entryPath = join(dirPath, entry)
      const stat = statSync(entryPath)
      if (stat.isDirectory()) {
        visit(entryPath)
        continue
      }
      if (!stat.isFile() || !entryPath.endsWith(".java")) {
        continue
      }
      const relativePath = normalizePath(relative(projectDir, entryPath))
      const role = javaRoleFor(relativePath)
      if (role !== undefined) {
        files.push({ path: relativePath, role })
      }
    }
  }

  visit(rootDir)
  return files
}

function collectEvidenceTexts(projectDir: string): readonly string[] {
  const evidenceDir = join(projectDir, EVIDENCE_DIR)
  const texts: string[] = []

  function visit(dirPath: string): void {
    if (!existsSync(dirPath)) {
      return
    }
    for (const entry of readdirSync(dirPath)) {
      const entryPath = join(dirPath, entry)
      const stat = statSync(entryPath)
      if (stat.isDirectory()) {
        visit(entryPath)
        continue
      }
      if (stat.isFile() && entry.toLowerCase().endsWith(".json")) {
        texts.push(normalizePath(readFileSync(entryPath, "utf8")))
      }
    }
  }

  visit(evidenceDir)
  return texts
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

  const javaFiles = collectJavaRoleFiles(projectDir)
  if (javaFiles.length === 0) {
    return {
      javaRoleReadCoverage: "no generated Java role files observed",
      javaRoleReadCoverageBlocking: false,
      javaRoleReadCoverageFinding: "PASS",
    }
  }

  const evidenceTexts = collectEvidenceTexts(projectDir)
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
