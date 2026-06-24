import { spawnSync } from "node:child_process"
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

export const BACKEND_SHAPE_REPORT_PATH = ".persona/workflow/backend-shape-report.md"
const FAKE_SHIM_FILES = ["gradle-shim.js", join("tools", "gradle-shim.js")] as const

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

function readBuildText(projectDir: string): string {
  return [join(projectDir, "build.gradle"), join(projectDir, "build.gradle.kts")]
    .filter((buildPath) => existsSync(buildPath))
    .map((buildPath) => readFileSync(buildPath, "utf8"))
    .join("\n")
}

function pass(criterion: string, evidence: string): ShapeFinding {
  return { criterion, result: "PASS", evidence }
}

function warn(criterion: string, evidence: string): ShapeFinding {
  return { criterion, result: "WARN", evidence }
}

function springBootApp(projectDir: string, files: readonly string[]): ShapeFinding {
  const buildText = readBuildText(projectDir)
  const hasSpringBuildSignal = /org\.springframework\.boot|spring-boot-starter/.test(buildText)
  const appFiles = files.filter((filePath) => /Application\.java$/.test(filePath))
  const hasSpringBootApplication = appFiles.some((filePath) => readFileSync(filePath, "utf8").includes("@SpringBootApplication"))
  return hasSpringBuildSignal && hasSpringBootApplication
    ? pass("Spring Boot app", appFiles.map((filePath) => relative(projectDir, filePath)).join(", "))
    : warn("Spring Boot app", "missing Spring Boot build signal or @SpringBootApplication")
}

function gradleExecutableAvailable(projectDir: string): boolean {
  const result = spawnSync("gradle", ["--version"], { cwd: projectDir, encoding: "utf8", timeout: 3_000 })
  return result.status === 0
}

function gradleRuntime(projectDir: string): ShapeFinding {
  const hasWrapper = existsSync(join(projectDir, "gradlew")) || existsSync(join(projectDir, "gradlew.bat"))
  if (hasWrapper) {
    return pass("Gradle runtime", "Gradle wrapper present")
  }
  return gradleExecutableAvailable(projectDir)
    ? pass("Gradle runtime", "system Gradle executable available")
    : warn("Gradle runtime", "Gradle wrapper missing and system Gradle unavailable")
}

function gradleOnly(projectDir: string): ShapeFinding {
  const hasGradle = existsSync(join(projectDir, "build.gradle")) || existsSync(join(projectDir, "build.gradle.kts"))
  const hasSettings = existsSync(join(projectDir, "settings.gradle")) || existsSync(join(projectDir, "settings.gradle.kts"))
  const hasMaven = existsSync(join(projectDir, "pom.xml"))
  return hasGradle && hasSettings && !hasMaven ? pass("Gradle only", "Gradle files present and pom.xml absent") : warn("Gradle only", "Gradle/settings missing or pom.xml present")
}

function mavenAbsent(projectDir: string): ShapeFinding {
  return existsSync(join(projectDir, "pom.xml"))
    ? warn("Maven pom.xml absent", "pom.xml present")
    : pass("Maven pom.xml absent", "pom.xml absent")
}

function fakeBuildShimAbsent(projectDir: string): ShapeFinding {
  const shims = FAKE_SHIM_FILES.filter((shimPath) => existsSync(join(projectDir, shimPath)))
  return shims.length === 0 ? pass("Fake build shim absent", "no fake Gradle shim observed") : warn("Fake build shim absent", shims.join(", "))
}

function layerStructure(files: readonly string[]): ShapeFinding {
  const required = ["presentation", "application", "domain", "infrastructure"]
  const missing = required.filter((part) => !hasPathPart(files, part))
  return missing.length === 0 ? pass("Layer/package structure", required.join(", ")) : warn("Layer/package structure", `missing: ${missing.join(", ")}`)
}

function boundaryShape(files: readonly string[]): ShapeFinding {
  const hasController = files.some((filePath) => filePath.endsWith("Controller.java") || filePath.includes("/presentation/"))
  const hasService = files.some((filePath) => filePath.endsWith("Service.java") || filePath.includes("/application/"))
  const hasRepository = files.some((filePath) => filePath.endsWith("Repository.java"))
  const hasDto = files.some((filePath) => filePath.includes("/dto/"))
  const hasDomain = files.some((filePath) => filePath.includes("/domain/") && !filePath.endsWith("Repository.java"))
  const missing = [
    ...(!hasController ? ["Controller"] : []),
    ...(!hasService ? ["Service"] : []),
    ...(!hasRepository ? ["Repository"] : []),
    ...(!hasDto ? ["DTO"] : []),
    ...(!hasDomain ? ["Domain"] : []),
  ]
  return missing.length === 0 ? pass("Controller/Service/Repository/DTO/Domain boundary", "role files observed") : warn("Controller/Service/Repository/DTO/Domain boundary", `missing: ${missing.join(", ")}`)
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

function entityDirectExposure(projectDir: string, files: readonly string[]): ShapeFinding {
  const domainNames = files
    .filter((filePath) => filePath.includes("/domain/") && !filePath.endsWith("Repository.java"))
    .map((filePath) => filePath.split("/").at(-1)?.replace(/\.java$/, ""))
    .filter((name): name is string => name !== undefined)
  const controllerFiles = files.filter((filePath) => filePath.endsWith("Controller.java") || filePath.includes("/presentation/"))
  const hits = controllerFiles.flatMap((filePath) => {
    const content = readFileSync(filePath, "utf8")
    return domainNames.filter((domainName) => new RegExp(`\\b${domainName}\\b`).test(content)).map((domainName) => `${relative(projectDir, filePath)} exposes ${domainName}`)
  })
  return hits.length === 0 ? pass("Entity direct exposure", "no controller domain entity exposure observed") : warn("Entity direct exposure", hits.join(", "))
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
    springBootApp(projectDir, files),
    gradleRuntime(projectDir),
    gradleOnly(projectDir),
    mavenAbsent(projectDir),
    fakeBuildShimAbsent(projectDir),
    layerStructure(files),
    boundaryShape(files),
    repositoryPort(projectDir, files),
    repositoryAdapter(projectDir, files),
    serviceStorage(projectDir, files),
    domainBehavior(projectDir, files),
    dtoBoundary(files),
    entityDirectExposure(projectDir, files),
    bootJar(projectDir),
    verificationReport(projectDir),
  ]
  return [
    "# Backend Shape Report",
    "",
    "Report-only workflow/structure observation report for Java/Spring backend shape.",
    "",
    "This is not enforcement/linter output and not generated app product-quality certification.",
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
  const reportPath = join(projectDir, BACKEND_SHAPE_REPORT_PATH)
  mkdirSync(dirname(reportPath), { recursive: true })
  writeFileSync(reportPath, createReport(projectDir))
  return { status: 0, stdout: `Backend shape report written: ${reportPath}\n`, stderr: "" }
}
