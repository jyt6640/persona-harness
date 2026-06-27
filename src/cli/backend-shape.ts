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

type ShapeCheckContext = {
  readonly projectDir: string
  readonly files: readonly string[]
}

type ShapeCheck = {
  readonly criterion: string
  readonly run: (context: ShapeCheckContext) => ShapeFinding
}

type JavaFieldDeclaration = {
  readonly typeName: string
  readonly fieldName: string
}

export const BACKEND_SHAPE_REPORT_PATH = ".persona/workflow/backend-shape-report.md"
const FAKE_SHIM_FILES = ["gradle-shim.js", join("tools", "gradle-shim.js")] as const
const VERIFICATION_TEXT_LIMIT = 200_000
const VERIFICATION_TEXT_EXTENSIONS = [".json", ".log", ".md", ".txt"] as const

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

function normalizeBackendShapePath(filePath: string): string {
  return filePath.replace(/\\/g, "/")
}

export function normalizeBackendShapePathForTest(filePath: string): string {
  return normalizeBackendShapePath(filePath)
}

function hasPathPart(files: readonly string[], part: string): boolean {
  return files.some((filePath) => normalizeBackendShapePath(filePath).includes(`/${part}/`))
}

function hasAnyPathPart(filePath: string, parts: readonly string[]): boolean {
  const normalized = normalizeBackendShapePath(filePath)
  return parts.some((part) => normalized.includes(`/${part}/`))
}

function hasOrderedPathParts(filePath: string, parts: readonly string[]): boolean {
  const pathParts = normalizeBackendShapePath(filePath).split("/")
  let offset = 0
  for (const part of parts) {
    const index = pathParts.indexOf(part, offset)
    if (index === -1) {
      return false
    }
    offset = index + 1
  }
  return true
}

function fileName(filePath: string): string {
  return normalizeBackendShapePath(filePath).split("/").at(-1) ?? filePath
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
  const required = [
    { label: "presentation", parts: ["presentation", "controller", "web"] },
    { label: "application", parts: ["application", "service"] },
    { label: "domain", parts: ["domain"] },
    { label: "infrastructure", parts: ["infrastructure", "infra", "adapter", "persistence"] },
  ] as const
  const missing = required.filter((entry) => !files.some((filePath) => hasAnyPathPart(filePath, entry.parts))).map((entry) => entry.label)
  const evidence = required.map((entry) => `${entry.label}=${entry.parts.join("/")}`).join(", ")
  return missing.length === 0 ? pass("Layer/package structure", evidence) : warn("Layer/package structure", `missing: ${missing.join(", ")}`)
}

function boundaryShape(files: readonly string[]): ShapeFinding {
  const hasController = files.some((filePath) => filePath.endsWith("Controller.java") || hasAnyPathPart(filePath, ["presentation", "controller", "web"]))
  const hasService = files.some((filePath) => filePath.endsWith("Service.java") || hasAnyPathPart(filePath, ["application", "service"]))
  const hasRepository = files.some((filePath) => filePath.endsWith("Repository.java"))
  const hasDto = files.some((filePath) => hasAnyPathPart(filePath, ["dto", "request", "response"]) || /(?:Request|Response|Dto|DTO)\.java$/.test(fileName(filePath)))
  const hasDomain = files.some((filePath) => hasPathPart([filePath], "domain") && !filePath.endsWith("Repository.java"))
  const missing = [
    ...(!hasController ? ["Controller"] : []),
    ...(!hasService ? ["Service"] : []),
    ...(!hasRepository ? ["Repository"] : []),
    ...(!hasDto ? ["DTO"] : []),
    ...(!hasDomain ? ["Domain"] : []),
  ]
  return missing.length === 0 ? pass("Controller/Service/Repository/DTO/Domain boundary", "role files observed") : warn("Controller/Service/Repository/DTO/Domain boundary", `missing: ${missing.join(", ")}`)
}

export function backendShapeBoundaryForTest(files: readonly string[]): ShapeFinding {
  return boundaryShape(files)
}

function repositoryPort(projectDir: string, files: readonly string[]): ShapeFinding {
  const ports = repositoryPortFiles(files)
  return ports.length > 0
    ? pass("Domain repository port", ports.map((filePath) => relative(projectDir, filePath)).join(", "))
    : warn("Domain repository port", "no domain or application/port/out *Repository.java")
}

function isRepositoryPortPath(filePath: string): boolean {
  return filePath.endsWith("Repository.java")
    && (hasPathPart([filePath], "domain") || hasOrderedPathParts(filePath, ["application", "port", "out"]))
}

function repositoryPortFiles(files: readonly string[]): readonly string[] {
  return files.filter(isRepositoryPortPath)
}

function repositoryAdapter(projectDir: string, files: readonly string[]): ShapeFinding {
  const repositoryPorts = repositoryPortFiles(files)
    .map((filePath) => fileName(filePath).replace(/\.java$/, ""))
    .filter((name): name is string => name !== undefined)
  const adapters = files.filter((filePath) => {
    if (!hasAnyPathPart(filePath, ["infrastructure", "infra", "adapter", "persistence"])) {
      return false
    }
    if (filePath.endsWith("Repository.java")) {
      return true
    }
    const content = readFileSync(filePath, "utf8")
    return repositoryPorts.some((port) => new RegExp(`\\bimplements\\s+[\\w\\s,]*\\b${port}\\b`).test(content))
  })
  return adapters.length > 0 ? pass("Infrastructure repository adapter", adapters.map((filePath) => relative(projectDir, filePath)).join(", ")) : warn("Infrastructure repository adapter", "no infrastructure/infra *Repository.java or *Repository implementation")
}

function parsePrivateFieldDeclaration(declaration: string): JavaFieldDeclaration | undefined {
  const normalized = declaration.replace(/\s+/g, " ").trim()
  const match = /\bprivate\s+(?:(?:static|final|volatile|transient)\s+)*(?<typeName>.+?)\s+(?<fieldName>[A-Za-z_$][\w$]*)\s*(?:=|;)/u.exec(normalized)
  if (match?.groups === undefined) {
    return undefined
  }
  return {
    typeName: match.groups.typeName.trim(),
    fieldName: match.groups.fieldName,
  }
}

function javaPrivateFieldDeclarations(content: string): readonly JavaFieldDeclaration[] {
  const codeOnly = stripJavaCommentsAndLiterals(content)
  return [...codeOnly.matchAll(/\bprivate\b[^;{}]*;/gu)]
    .map((match) => parsePrivateFieldDeclaration(match[0]))
    .filter((field): field is JavaFieldDeclaration => field !== undefined)
}

function rawJavaType(typeName: string): string {
  const rawType = typeName.split("<", 1)[0]?.trim() ?? typeName
  return rawType.split(".").at(-1) ?? rawType
}

function serviceStorageTerms(field: JavaFieldDeclaration): readonly string[] {
  const rawType = rawJavaType(field.typeName)
  const terms = [
    ...(["Map", "List"].includes(rawType) ? [rawType] : []),
    ...(rawType === "AtomicLong" ? ["AtomicLong"] : []),
    ...(/\bnextId\b/u.test(field.fieldName) ? ["nextId"] : []),
    ...(/\bidCounter\b/u.test(field.fieldName) ? ["idCounter"] : []),
  ]
  return [...new Set(terms)]
}

function serviceStorage(projectDir: string, files: readonly string[]): ShapeFinding {
  const serviceFiles = files.filter((filePath) => filePath.endsWith("Service.java"))
  const hits = serviceFiles.flatMap((filePath) => {
    const fields = javaPrivateFieldDeclarations(readFileSync(filePath, "utf8"))
    return fields.flatMap((field) => serviceStorageTerms(field).map((term) => `${relative(projectDir, filePath)}:${term}`))
  })
  return hits.length === 0 ? pass("Service storage/id sequence ownership", "no Map/List/AtomicLong/nextId/idCounter in *Service.java") : warn("Service storage/id sequence ownership", hits.join(", "))
}

function domainBehavior(projectDir: string, files: readonly string[]): ShapeFinding {
  const domainFiles = files.filter((filePath) => hasPathPart([filePath], "domain") && !filePath.endsWith("Repository.java"))
  const records = domainFiles.filter((filePath) => /\b(?:public\s+)?record\s+\w+\s*\(/.test(readFileSync(filePath, "utf8")))
  const hasBehavior = domainFiles.some((filePath) => /\b(public|private|protected)?\s*(boolean|void|String|int|long|[A-Z]\w*)\s+\w+\s*\(/.test(readFileSync(filePath, "utf8")))
  if (hasBehavior) {
    return pass("Domain behavior", "domain class contains behavior method")
  }
  return records.length > 0
    ? warn("Domain behavior", `domain record: ${records.map((filePath) => relative(projectDir, filePath)).join(", ")}`)
    : warn("Domain behavior", "no domain behavior method observed")
}

function dtoBoundary(files: readonly string[]): ShapeFinding {
  const requestFiles = files.filter((filePath) => hasPathPart([filePath], "request") || (hasPathPart([filePath], "dto") && fileName(filePath).endsWith("Request.java")))
  const responseFiles = files.filter((filePath) => hasPathPart([filePath], "response") || (hasPathPart([filePath], "dto") && fileName(filePath).endsWith("Response.java")))
  return requestFiles.length > 0 && responseFiles.length > 0
    ? pass("DTO boundary", [...requestFiles, ...responseFiles].map((filePath) => fileName(filePath)).join(", "))
    : warn("DTO boundary", "request/response DTO package or *Request/*Response DTO file missing")
}

function entityDirectExposure(projectDir: string, files: readonly string[]): ShapeFinding {
  const domainNames = files
    .filter((filePath) => hasPathPart([filePath], "domain") && !filePath.endsWith("Repository.java"))
    .map((filePath) => fileName(filePath).replace(/\.java$/, ""))
    .filter((name): name is string => name !== undefined)
  const controllerFiles = files.filter((filePath) => filePath.endsWith("Controller.java") || hasPathPart([filePath], "presentation"))
  const hits = controllerFiles.flatMap((filePath) => {
    const content = stripJavaCommentsAndLiterals(readFileSync(filePath, "utf8"))
    return domainNames.filter((domainName) => new RegExp(`\\b${domainName}\\b`).test(content)).map((domainName) => `${relative(projectDir, filePath)} exposes ${domainName}`)
  })
  return hits.length === 0 ? pass("Entity direct exposure", "no controller domain entity exposure observed") : warn("Entity direct exposure", hits.join(", "))
}

function stripJavaCommentsAndLiterals(content: string): string {
  return content
    .replace(/"""[\s\S]*?"""/g, "\"\"")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\/\/[^\r\n]*/g, " ")
    .replace(/"(?:\\.|[^"\\])*"/g, "\"\"")
    .replace(/'(?:\\.|[^'\\])*'/g, "''")
}

export function stripJavaCommentsAndLiteralsForTest(content: string): string {
  return stripJavaCommentsAndLiterals(content)
}

function bootJar(projectDir: string): ShapeFinding {
  const buildPath = existsSync(join(projectDir, "build.gradle")) ? join(projectDir, "build.gradle") : join(projectDir, "build.gradle.kts")
  if (!existsSync(buildPath)) {
    return warn("bootJar", "build file missing")
  }
  const content = readFileSync(buildPath, "utf8")
  return /bootJar[\s\S]*(enabled\s*=\s*false|enabled\.set\(false\))/.test(content) ? warn("bootJar", "bootJar disabled") : pass("bootJar", "bootJar not disabled")
}

function hasVerificationTextExtension(filePath: string): boolean {
  return VERIFICATION_TEXT_EXTENSIONS.some((extension) => filePath.endsWith(extension))
}

function verificationTextPaths(projectDir: string): readonly string[] {
  const reportPaths = [
    join(projectDir, ".persona", "workflow", "implementation-report.md"),
    join(projectDir, ".persona", "workflow", "review-report.md"),
  ].filter((reportPath) => existsSync(reportPath))
  const evidencePaths = listFiles(join(projectDir, ".persona", "evidence")).filter(hasVerificationTextExtension).sort()
  return [...reportPaths, ...evidencePaths]
}

function readBoundedVerificationText(filePaths: readonly string[]): string {
  let content = ""
  for (const filePath of filePaths) {
    if (content.length >= VERIFICATION_TEXT_LIMIT) {
      break
    }
    const remaining = VERIFICATION_TEXT_LIMIT - content.length
    content += `\n${readFileSync(filePath, "utf8").slice(0, remaining)}`
  }
  return content
}

function hasGradleTaskEvidence(content: string, task: "test" | "build" | "bootRun"): boolean {
  return new RegExp(`\\b(?:call\\s+)?(?:\\.\\/)?gradlew(?:\\.bat)?\\s+[^\\r\\n]*\\b${task}\\b|\\bgradle\\s+[^\\r\\n]*\\b${task}\\b`, "i").test(content)
}

function hasVerificationFailureEvidence(content: string): boolean {
  return /\bVerification failed\b|\bcompile\/test verification failed\b|\bBUILD FAILED\b|>\s*Task\s+:[^\r\n]+?\bFAILED\b|\bExecution failed for task\b|\bCould not resolve\b|\bgradlew(?:\.bat)?\s+(?:test|build)\b[^\r\n]*(?:exit(?:ed)?(?:\s+code)?\s*1|status\s*1)|\borg\.springframework\.boot:spring-boot-starter-[\w-]+:\.|\borg\.flywaydb:flyway-core:\./i.test(content)
}

function hasVerificationSuccessEvidence(content: string): boolean {
  return /\bBUILD SUCCESSFUL\b|\bTomcat started\b|\bStarted\s+\w+Application\b|\bsmoke-started\b|결과를 확인했다|통과/i.test(content)
}

function hasBootRunSuccessEvidence(content: string): boolean {
  return /\bTomcat started\b|\bStarted\s+\w+Application\b|\bsmoke-started\b/i.test(content)
}

function verificationReport(projectDir: string): ShapeFinding {
  const textPaths = verificationTextPaths(projectDir)
  if (textPaths.length === 0) {
    return warn("Verification report", "implementation/review report or evidence missing")
  }
  const content = readBoundedVerificationText(textPaths)
  if (hasVerificationFailureEvidence(content)) {
    return warn("Verification report", "failed verification evidence observed")
  }
  const hasTestEvidence = hasGradleTaskEvidence(content, "test")
  const hasBuildEvidence = hasGradleTaskEvidence(content, "build")
  const hasBootRunEvidence = hasGradleTaskEvidence(content, "bootRun")
  if (!hasTestEvidence || !hasBuildEvidence) {
    return warn("Verification report", "gradle test/build evidence missing")
  }
  if (!hasVerificationSuccessEvidence(content)) {
    return pass("Verification report", hasBootRunEvidence ? "gradle test/build/bootRun mentioned" : "gradle test/build mentioned; bootRun evidence not observed")
  }
  return hasBootRunEvidence && hasBootRunSuccessEvidence(content)
    ? pass("Verification report", "gradle test/build/bootRun success evidence observed")
    : pass("Verification report", "gradle test/build success evidence observed; bootRun evidence not observed")
}

const BACKEND_SHAPE_CHECKS = [
  { criterion: "Spring Boot app", run: ({ projectDir, files }) => springBootApp(projectDir, files) },
  { criterion: "Gradle runtime", run: ({ projectDir }) => gradleRuntime(projectDir) },
  { criterion: "Gradle only", run: ({ projectDir }) => gradleOnly(projectDir) },
  { criterion: "Maven pom.xml absent", run: ({ projectDir }) => mavenAbsent(projectDir) },
  { criterion: "Fake build shim absent", run: ({ projectDir }) => fakeBuildShimAbsent(projectDir) },
  { criterion: "Layer/package structure", run: ({ files }) => layerStructure(files) },
  { criterion: "Controller/Service/Repository/DTO/Domain boundary", run: ({ files }) => boundaryShape(files) },
  { criterion: "Domain repository port", run: ({ projectDir, files }) => repositoryPort(projectDir, files) },
  { criterion: "Infrastructure repository adapter", run: ({ projectDir, files }) => repositoryAdapter(projectDir, files) },
  { criterion: "Service storage/id sequence ownership", run: ({ projectDir, files }) => serviceStorage(projectDir, files) },
  { criterion: "Domain behavior", run: ({ projectDir, files }) => domainBehavior(projectDir, files) },
  { criterion: "DTO boundary", run: ({ files }) => dtoBoundary(files) },
  { criterion: "Entity direct exposure", run: ({ projectDir, files }) => entityDirectExposure(projectDir, files) },
  { criterion: "bootJar", run: ({ projectDir }) => bootJar(projectDir) },
  { criterion: "Verification report", run: ({ projectDir }) => verificationReport(projectDir) },
] as const satisfies readonly ShapeCheck[]

export function backendShapeCheckCriteriaForTest(): readonly string[] {
  return BACKEND_SHAPE_CHECKS.map((check) => check.criterion)
}

function createReport(projectDir: string): string {
  const files = javaFiles(projectDir)
  const findings = BACKEND_SHAPE_CHECKS.map((check) => check.run({ projectDir, files }))
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
