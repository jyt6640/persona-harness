import type { FileRole } from "./types.js"

const JAVA_FILE_PATTERN = /\.java$/i

export function isJavaTargetFile(targetFile: string): boolean {
  return JAVA_FILE_PATTERN.test(targetFile)
}

export function resolveFileRole(targetFile: string): FileRole {
  const normalized = targetFile.replace(/\\/g, "/")
  const fileName = normalized.split("/").at(-1) ?? normalized

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
