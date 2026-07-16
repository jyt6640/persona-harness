import { SERVICE_STATE_OWNERSHIP_CONVENTION } from "../config/convention-registry.js"
import { readBoundedJavaSources } from "./bounded-java-source.js"

type ServiceStateField = {
  readonly fieldName: string
  readonly line: number
  readonly terms: readonly string[]
  readonly typeName: string
}

function className(filePath: string): string {
  return (filePath.replace(/\\/g, "/").split("/").at(-1) ?? filePath).replace(/\.java$/, "")
}

function stripJavaCommentsAndLiterals(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//gu, (match) => match.replace(/[^\n]/gu, " "))
    .replace(/\/\/[^\r\n]*/gu, "")
    .replace(/"""[\s\S]*?"""/gu, (match) => match.replace(/[^\n]/gu, " "))
    .replace(/"(?:\\.|[^"\\])*"/gu, "\"\"")
    .replace(/'(?:\\.|[^'\\])*'/gu, "''")
}

function rawJavaType(typeName: string): string {
  const withoutAnnotations = typeName.replace(/@\w+(?:\([^)]*\))?\s*/gu, "")
  const withoutGenerics = withoutAnnotations.replace(/<[\s\S]*>/gu, "")
  const parts = withoutGenerics.trim().split(/\s+/u)
  return parts.at(-1)?.replace(/\[\]$/u, "") ?? withoutGenerics.trim()
}

function lineNumberAt(source: string, index: number): number {
  return source.slice(0, Math.max(0, index)).split(/\r?\n/u).length
}

function serviceStateTerms(typeName: string, fieldName: string): readonly string[] {
  const terms: string[] = []
  const rawType = rawJavaType(typeName)
  if (rawType === "Map" || rawType === "AtomicLong") {
    terms.push(rawType)
  }
  if (/^(nextId|idCounter)$/u.test(fieldName)) {
    terms.push(fieldName)
  }
  return terms
}

function javaPrivateFields(source: string): readonly ServiceStateField[] {
  const codeOnly = stripJavaCommentsAndLiterals(source)
  const fields: ServiceStateField[] = []
  const fieldPattern = /\bprivate\s+(?:(?:static|final|volatile|transient)\s+)*(?<type>[A-Za-z_$][\w$]*(?:\s*<[^;{}=]+>)?(?:\[\])?)\s+(?<name>[A-Za-z_$][\w$]*)\b[^;{}]*;/gu
  for (const match of codeOnly.matchAll(fieldPattern)) {
    const typeName = match.groups?.type?.trim()
    const fieldName = match.groups?.name?.trim()
    if (typeName === undefined || fieldName === undefined || match.index === undefined) {
      continue
    }
    const terms = serviceStateTerms(typeName, fieldName)
    if (terms.length === 0) {
      continue
    }
    fields.push({
      fieldName,
      line: lineNumberAt(codeOnly, match.index),
      terms,
      typeName,
    })
  }
  return fields
}

export function serviceStateOwnershipConventionFindings(projectDir: string): readonly string[] {
  const sources = readBoundedJavaSources(projectDir)
  if (!sources.safe) {
    return ["Java convention discovery is unavailable; read-only recovery is required."]
  }
  return sources.files
    .filter((file) => file.relativePath.endsWith("Service.java"))
    .flatMap((file) => {
      const stateFields = javaPrivateFields(file.text)
      if (stateFields.length === 0) {
        return []
      }
      const evidence = stateFields
        .map((field) => `${field.typeName} ${field.fieldName} at ${file.relativePath}:${field.line}`)
        .join(", ")
      const terms = Array.from(new Set(stateFields.flatMap((field) => field.terms))).join("/")
      return [
        `${className(file.relativePath)} owns in-memory state/id sequence (${terms}); ${SERVICE_STATE_OWNERSHIP_CONVENTION.actionableMessage} Source: ${evidence}`,
      ]
    })
}
