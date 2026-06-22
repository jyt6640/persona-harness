import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import process from "node:process"

import type { CliRunResult } from "./bearshell.js"

type BackendShapeOptions = {
  readonly projectDir?: string
}

type ShapeFinding = {
  readonly criterion: string
  readonly result: "PASS" | "WARN"
  readonly evidence: string
}

const REPORT_PATH = ".persona/workflow/backend-shape-report.md"

function listFiles(dirPath: string): readonly string[] {
  if (!existsSync(dirPath)) {
    return []
  }
  const files: string[] = []
  for (const entry of readdirSync(dirPath)) {
    const entryPath = join(dirPath, entry)
    const stat = statSync(entryPath)
    if (stat.isDirectory()) {
      files.push(...listFiles(entryPath))
    } else if (stat.isFile()) {
      files.push(entryPath)
    }
  }
  return files
}

function relative(projectDir: string, filePath: string): string {
  return filePath.slice(projectDir.length + 1).replace(/\\/g, "/")
}

function hasPathPart(files: readonly string[], part: string): boolean {
  return files.some((filePath) => filePath.includes(`/${part}/`))
}

function javaFiles(projectDir: string): readonly string[] {
  return listFiles(join(projectDir, "src", "main", "java")).filter((filePath) => filePath.endsWith(".java"))
}

function pass(criterion: string, evidence: string): ShapeFinding {
  return { criterion, result: "PASS", evidence }
}

function warn(criterion: string, evidence: string): ShapeFinding {
  return { criterion, result: "WARN", evidence }
}

function gradleOnly(projectDir: string): ShapeFinding {
  const hasGradle = existsSync(join(projectDir, "build.gradle")) || existsSync(join(projectDir, "build.gradle.kts"))
  const hasSettings = existsSync(join(projectDir, "settings.gradle")) || existsSync(join(projectDir, "settings.gradle.kts"))
  const hasMaven = existsSync(join(projectDir, "pom.xml"))
  return hasGradle && hasSettings && !hasMaven ? pass("Gradle only", "Gradle files present and pom.xml absent") : warn("Gradle only", "Gradle/settings missing or pom.xml present")
}

function layerStructure(files: readonly string[]): ShapeFinding {
  const required = ["presentation", "application", "domain", "infrastructure"]
  const missing = required.filter((part) => !hasPathPart(files, part))
  return missing.length === 0 ? pass("Layer/package structure", required.join(", ")) : warn("Layer/package structure", `missing: ${missing.join(", ")}`)
}

function repositoryPort(projectDir: string, files: readonly string[]): ShapeFinding {
  const ports = files.filter((filePath) => filePath.includes("/domain/") && filePath.endsWith("Repository.java"))
  return ports.length > 0 ? pass("Domain repository port", ports.map((filePath) => relative(projectDir, filePath)).join(", ")) : warn("Domain repository port", "no domain *Repository.java")
}

function repositoryAdapter(projectDir: string, files: readonly string[]): ShapeFinding {
  const repositoryPorts = files
    .filter((filePath) => filePath.includes("/domain/") && filePath.endsWith("Repository.java"))
    .map((filePath) => filePath.split("/").at(-1)?.replace(/\.java$/, ""))
    .filter((name): name is string => name !== undefined)
  const adapters = files.filter((filePath) => {
    if (!filePath.includes("/infrastructure/")) {
      return false
    }
    if (filePath.endsWith("Repository.java")) {
      return true
    }
    const content = readFileSync(filePath, "utf8")
    return repositoryPorts.some((port) => new RegExp(`\\bimplements\\s+[\\w\\s,]*\\b${port}\\b`).test(content))
  })
  return adapters.length > 0 ? pass("Infrastructure repository adapter", adapters.map((filePath) => relative(projectDir, filePath)).join(", ")) : warn("Infrastructure repository adapter", "no infrastructure *Repository.java or *Repository implementation")
}

function serviceStorage(projectDir: string, files: readonly string[]): ShapeFinding {
  const serviceFiles = files.filter((filePath) => filePath.endsWith("Service.java"))
  const hits = serviceFiles.flatMap((filePath) => {
    const lines = readFileSync(filePath, "utf8").split(/\r?\n/)
    return lines.flatMap((line) => {
      if (!/\bprivate\b/.test(line)) {
        return []
      }
      const terms = ["Map", "List", "AtomicLong", "nextId", "idCounter"].filter((term) => line.includes(term))
      return terms.map((term) => `${relative(projectDir, filePath)}:${term}`)
    })
  })
  return hits.length === 0 ? pass("Service storage/id sequence ownership", "no Map/List/AtomicLong/nextId/idCounter in *Service.java") : warn("Service storage/id sequence ownership", hits.join(", "))
}

function domainBehavior(projectDir: string, files: readonly string[]): ShapeFinding {
  const domainFiles = files.filter((filePath) => filePath.includes("/domain/") && !filePath.endsWith("Repository.java"))
  const records = domainFiles.filter((filePath) => /\brecord\s+\w+/.test(readFileSync(filePath, "utf8")))
  if (records.length > 0) {
    return warn("Domain behavior", `domain record: ${records.map((filePath) => relative(projectDir, filePath)).join(", ")}`)
  }
  const hasBehavior = domainFiles.some((filePath) => /\b(public|private|protected)?\s*(boolean|void|String|int|long|[A-Z]\w*)\s+\w+\s*\(/.test(readFileSync(filePath, "utf8")))
  return hasBehavior ? pass("Domain behavior", "domain class contains behavior method") : warn("Domain behavior", "no domain behavior method observed")
}

function dtoBoundary(files: readonly string[]): ShapeFinding {
  const hasRequest = hasPathPart(files, "request")
  const hasResponse = hasPathPart(files, "response")
  return hasRequest && hasResponse ? pass("DTO boundary", "request and response DTO packages present") : warn("DTO boundary", "request/response DTO package missing")
}

function bootJar(projectDir: string): ShapeFinding {
  const buildPath = existsSync(join(projectDir, "build.gradle")) ? join(projectDir, "build.gradle") : join(projectDir, "build.gradle.kts")
  if (!existsSync(buildPath)) {
    return warn("bootJar", "build file missing")
  }
  const content = readFileSync(buildPath, "utf8")
  return /bootJar[\s\S]*(enabled\s*=\s*false|enabled\.set\(false\))/.test(content) ? warn("bootJar", "bootJar disabled") : pass("bootJar", "bootJar not disabled")
}

function verificationReport(projectDir: string): ShapeFinding {
  const reportPaths = [
    join(projectDir, ".persona", "workflow", "implementation-report.md"),
    join(projectDir, ".persona", "workflow", "review-report.md"),
  ].filter((reportPath) => existsSync(reportPath))
  if (reportPaths.length === 0) {
    return warn("Verification report", "implementation/review report missing")
  }
  const content = reportPaths.map((reportPath) => readFileSync(reportPath, "utf8")).join("\n")
  const hasCommands =
    /(?:\.\/gradlew|gradlew|gradle)\s+[^\n`]*\btest\b/.test(content) &&
    /(?:\.\/gradlew|gradlew|gradle)\s+[^\n`]*\bbuild\b/.test(content) &&
    content.includes("bootRun")
  return hasCommands ? pass("Verification report", "gradle test/build/bootRun mentioned") : warn("Verification report", "gradle test/build/bootRun evidence missing")
}

function createReport(projectDir: string): string {
  const files = javaFiles(projectDir)
  const findings = [
    gradleOnly(projectDir),
    layerStructure(files),
    repositoryPort(projectDir, files),
    repositoryAdapter(projectDir, files),
    serviceStorage(projectDir, files),
    domainBehavior(projectDir, files),
    dtoBoundary(files),
    bootJar(projectDir),
    verificationReport(projectDir),
  ]
  return [
    "# Backend Shape Report",
    "",
    "Report-only observation for Java/Spring backend clean-code shape.",
    "",
    "| Criterion | Result | Evidence |",
    "| --- | --- | --- |",
    ...findings.map((finding) => `| ${finding.criterion} | ${finding.result} | ${finding.evidence} |`),
    "",
    "## Limitations",
    "",
    "- String/path based observation only.",
    "- Not generated app product-quality certification.",
    "- Not rule enforcement, AST/linter, or build gate.",
    "",
  ].join("\n")
}

export function runBackendShapeReview(options: BackendShapeOptions = {}): CliRunResult {
  const projectDir = resolve(options.projectDir ?? process.cwd())
  const reportPath = join(projectDir, REPORT_PATH)
  mkdirSync(dirname(reportPath), { recursive: true })
  writeFileSync(reportPath, createReport(projectDir))
  return { status: 0, stdout: `Backend shape report written: ${reportPath}\n`, stderr: "" }
}
