import { existsSync, readFileSync } from "node:fs"
import { join, relative } from "node:path"

import { SPRING_BOOTJAR_ENABLED_CONVENTION } from "../config/convention-registry.js"
import { readBoundedJavaSources } from "./bounded-java-source.js"
import { readProfileIntent } from "./stack-alignment-profile.js"

const EXECUTABLE_SPRING_APPLICATION_TYPES = ["batch", "mvc-web", "rest-api"] as const
function executableSpringBootAppApplies(projectDir: string): boolean {
  const intent = readProfileIntent(projectDir)
  return intent?.language === "java"
    && intent.framework === "spring"
    && intent.buildTool === "gradle"
    && EXECUTABLE_SPRING_APPLICATION_TYPES.some((applicationType) => applicationType === intent.applicationType)
}

function lineNumberAt(source: string, index: number): number {
  return source.slice(0, Math.max(0, index)).split(/\r?\n/u).length
}

function stripGradleCommentsAndLiterals(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//gu, (match) => match.replace(/[^\n]/gu, " "))
    .replace(/\/\/[^\r\n]*/gu, "")
    .replace(/"""[\s\S]*?"""/gu, (match) => match.replace(/[^\n]/gu, " "))
    .replace(/'''[\s\S]*?'''/gu, (match) => match.replace(/[^\n]/gu, " "))
    .replace(/"(?:\\.|[^"\\])*"/gu, "\"\"")
    .replace(/'(?:\\.|[^'\\])*'/gu, "''")
}

function stripGradleComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//gu, (match) => match.replace(/[^\n]/gu, " "))
    .replace(/\/\/[^\r\n]*/gu, "")
}

function buildFilePaths(projectDir: string): readonly string[] {
  return [join(projectDir, "build.gradle"), join(projectDir, "build.gradle.kts")].filter((filePath) => existsSync(filePath))
}

function springBootBuildSignal(source: string): boolean {
  return /org\.springframework\.boot|spring-boot-starter/u.test(source)
}

function disabledBootJarLine(source: string): number | undefined {
  const codeOnly = stripGradleCommentsAndLiterals(source)
  const directMatch = /\b(?:tasks\.)?bootJar\s*\{[\s\S]{0,300}?\b(?:enabled\s*=\s*false|enabled\.set\(\s*false\s*\))/u.exec(codeOnly)
  if (directMatch?.index !== undefined) {
    return lineNumberAt(codeOnly, directMatch.index)
  }

  const commentsOnly = stripGradleComments(source)
  const namedMatch = /\btasks\.named(?:<[^>]+>)?\(\s*["']bootJar["']\s*\)\s*\{[\s\S]{0,300}?\b(?:enabled\s*=\s*false|enabled\.set\(\s*false\s*\))/u.exec(commentsOnly)
  return namedMatch?.index === undefined ? undefined : lineNumberAt(commentsOnly, namedMatch.index)
}

export function springBootJarEnabledConventionFindings(projectDir: string): readonly string[] {
  if (!executableSpringBootAppApplies(projectDir)) {
    return []
  }
  const sources = readBoundedJavaSources(projectDir)
  if (!sources.safe) {
    return ["Java convention discovery is unavailable; read-only recovery is required."]
  }
  if (!sources.files.some((file) => file.text.includes("@SpringBootApplication"))) return []
  return buildFilePaths(projectDir).flatMap((filePath) => {
    const source = readFileSync(filePath, "utf8")
    if (!springBootBuildSignal(source)) {
      return []
    }
    const line = disabledBootJarLine(source)
    if (line === undefined) {
      return []
    }
    return [
      `Executable Spring Boot app disables bootJar; ${SPRING_BOOTJAR_ENABLED_CONVENTION.actionableMessage} Source: ${relative(projectDir, filePath)}:${line}`,
    ]
  })
}
