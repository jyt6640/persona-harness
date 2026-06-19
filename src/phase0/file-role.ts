import type { FileRole } from "./types.js"

const JAVA_FILE_PATTERN = /\.java$/i
const GRADLE_BUILD_FILE_PATTERN = /(^|\/)(build|settings)\.gradle(\.kts)?$/i

export function isJavaTargetFile(targetFile: string): boolean {
  return JAVA_FILE_PATTERN.test(targetFile)
}

function normalizePath(targetFile: string): string {
  return targetFile.replace(/\\/g, "/")
}

function fileNameFor(targetFile: string): string {
  const normalized = normalizePath(targetFile)
  return normalized.split("/").at(-1) ?? normalized
}

export function isBackendBootstrapTargetFile(targetFile: string): boolean {
  const normalized = normalizePath(targetFile)
  const fileName = fileNameFor(targetFile).toLowerCase()
  if (normalized.includes("/docs/")) {
    return false
  }
  return fileName === "readme.md" || fileName === "requirements.md" || GRADLE_BUILD_FILE_PATTERN.test(normalized)
}

export function resolveBootstrapFileRole(targetFile: string): FileRole {
  const normalized = normalizePath(targetFile)
  const fileName = fileNameFor(targetFile).toLowerCase()
  if (GRADLE_BUILD_FILE_PATTERN.test(normalized)) {
    return "gradle-bootstrap"
  }
  if (fileName === "requirements.md") {
    return "requirements-bootstrap"
  }
  return "project-bootstrap"
}

export function resolveFileRole(targetFile: string): FileRole {
  const normalized = normalizePath(targetFile)
  const fileName = fileNameFor(targetFile)

  if (fileName.endsWith("Controller.java")) return "controller"
  if (fileName.endsWith("Service.java")) return "service"
  if (fileName.endsWith("Repository.java")) return "repository"
  if (fileName.endsWith("Entity.java")) return "entity"
  if (normalized.includes("/domain/")) return "domain"
  if (fileName.endsWith("Request.java")) return "request-dto"
  if (fileName.endsWith("Response.java")) return "response-dto"
  if (fileName.endsWith("Exception.java")) return "exception"
  if (fileName.endsWith("Test.java")) return "test"

  return "java-common"
}
