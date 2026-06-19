import { existsSync, readdirSync, readFileSync } from "node:fs"
import { join, relative } from "node:path"

export type DriftKind =
  | "Service nextId"
  | "HTTP DELETE reset"
  | "Repository clear id reset missing"
  | "Spring bean missing"
  | "Response DTO storage usage"
  | "Controller repository access"
  | "API status drift"
  | "Test contract drift"
  | "Timeout"
  | "Unknown"

export type DriftSeverity = "fail" | "warn"

export type DriftFinding = {
  kind: DriftKind
  severity: DriftSeverity
  file?: string
  evidence: string
}

export type BackendDriftReport = {
  inspectedFiles: string[]
  findings: DriftFinding[]
  falsePositiveRisk: string[]
  hasFail: boolean
  hasWarning: boolean
}

export type DetectBackendDriftInput = {
  sandboxDir: string
  runOutput: string
  timedOut: boolean
  buildSuccessDetected: boolean
  testFailureDetected: boolean
}

type JavaFile = {
  path: string
  relativePath: string
  content: string
  fileName: string
  className: string
}

function listFiles(dir: string, predicate = (_path: string) => true): string[] {
  const result: string[] = []
  const visit = (current: string): void => {
    if (!existsSync(current)) return
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const fullPath = join(current, entry.name)
      if (entry.isDirectory()) {
        if (entry.name === "node_modules" || entry.name === ".git" || entry.name === "target") continue
        visit(fullPath)
      } else if (predicate(fullPath)) {
        result.push(fullPath)
      }
    }
  }
  visit(dir)
  return result.sort()
}

function readJavaFiles(sandboxDir: string): JavaFile[] {
  return listFiles(join(sandboxDir, "src"), (file) => file.endsWith(".java")).map((path) => {
    const fileName = path.replace(/\\/g, "/").split("/").at(-1) ?? path
    return {
      path,
      relativePath: relative(sandboxDir, path),
      content: readFileSync(path, "utf8"),
      fileName,
      className: fileName.replace(/\.java$/, ""),
    }
  })
}

function addFinding(findings: DriftFinding[], finding: DriftFinding): void {
  if (
    findings.some(
      (existing) =>
        existing.kind === finding.kind &&
        existing.file === finding.file &&
        existing.evidence === finding.evidence,
    )
  ) {
    return
  }
  findings.push(finding)
}

function hasBeanAnnotation(content: string): boolean {
  return /@(Service|Repository|Component)\b/.test(content)
}

function hasBeanFactory(javaFiles: JavaFile[], className: string): boolean {
  return javaFiles.some((file) => /@Bean\b/.test(file.content) && new RegExp(`\\b${className}\\b`).test(file.content))
}

function extractMethodBody(content: string, methodName: string): string | undefined {
  const methodIndex = content.search(new RegExp(`\\b${methodName}\\s*\\(`))
  if (methodIndex < 0) return undefined

  const openBraceIndex = content.indexOf("{", methodIndex)
  if (openBraceIndex < 0) return undefined

  let depth = 0
  for (let index = openBraceIndex; index < content.length; index += 1) {
    const char = content[index]
    if (char === "{") depth += 1
    if (char === "}") {
      depth -= 1
      if (depth === 0) {
        return content.slice(openBraceIndex + 1, index)
      }
    }
  }

  return undefined
}

function firstMatch(content: string, pattern: RegExp): string | undefined {
  return content.match(pattern)?.[0]
}

function detectServiceNextId(javaFiles: JavaFile[], findings: DriftFinding[]): void {
  const serviceFiles = javaFiles.filter((file) => file.fileName.endsWith("Service.java"))
  for (const file of serviceFiles) {
    const match = firstMatch(file.content, /\b(AtomicLong|nextId|sequence|idCounter)\b/i)
    if (match) {
      addFinding(findings, {
        kind: "Service nextId",
        severity: "fail",
        file: file.relativePath,
        evidence: `Service contains id sequence state token: ${match}`,
      })
    }
  }
}

function detectHttpDeleteReset(javaFiles: JavaFile[], findings: DriftFinding[]): void {
  const controllerAndTestFiles = javaFiles.filter(
    (file) => file.fileName.endsWith("Controller.java") || file.fileName.endsWith("Test.java"),
  )

  for (const file of controllerAndTestFiles) {
    if (/@DeleteMapping\s*(?:\(\s*\)|\(\s*"\/?"\s*\))/.test(file.content)) {
      addFinding(findings, {
        kind: "HTTP DELETE reset",
        severity: "fail",
        file: file.relativePath,
        evidence: "DELETE mapping targets the collection rather than /{id}.",
      })
    }

    if (/restTemplate\.delete\(\s*"\/reservations"\s*\)/.test(file.content)) {
      addFinding(findings, {
        kind: "HTTP DELETE reset",
        severity: "fail",
        file: file.relativePath,
        evidence: 'Test reset uses restTemplate.delete("/reservations").',
      })
    }

    if (/HttpMethod\.DELETE[\s\S]{0,240}"\/reservations"[\s\S]{0,240}(clear|reset)/i.test(file.content)) {
      addFinding(findings, {
        kind: "HTTP DELETE reset",
        severity: "warn",
        file: file.relativePath,
        evidence: "DELETE /reservations appears near clear/reset behavior.",
      })
    }
  }
}

function detectRepositoryClearReset(javaFiles: JavaFile[], findings: DriftFinding[]): void {
  const repositoryFiles = javaFiles.filter(
    (file) => file.fileName.endsWith("Repository.java") || file.fileName.includes("Repository"),
  )

  for (const file of repositoryFiles) {
    const hasIdState = /\b(AtomicLong|nextId|sequence|idCounter)\b/i.test(file.content)
    if (!hasIdState) continue

    const clearBody = extractMethodBody(file.content, "clear") ?? extractMethodBody(file.content, "reset")
    if (!clearBody) {
      addFinding(findings, {
        kind: "Repository clear id reset missing",
        severity: "fail",
        file: file.relativePath,
        evidence: "Repository has id sequence state but no clear/reset method.",
      })
      continue
    }

    const resetsToFirstId = /(set\s*\(\s*1[L]?\s*\)|=\s*1[L]?\b)/.test(clearBody)
    const resetsBeforeIncrement = /(set\s*\(\s*0[L]?\s*\)|=\s*0[L]?\b)/.test(clearBody) &&
      /\bincrementAndGet\s*\(\s*\)/.test(file.content)
    if (!resetsToFirstId && !resetsBeforeIncrement) {
      addFinding(findings, {
        kind: "Repository clear id reset missing",
        severity: "fail",
        file: file.relativePath,
        evidence: "clear/reset method does not reset id sequence so the next created id is 1.",
      })
    }
  }
}

function detectSpringBeanMissing(javaFiles: JavaFile[], findings: DriftFinding[], runOutput: string): void {
  const serviceFiles = javaFiles.filter((file) => file.fileName.endsWith("Service.java"))
  const repositoryImplementationFiles = javaFiles.filter(
    (file) =>
      file.fileName.includes("Repository") &&
      !/\binterface\s+\w+Repository\b/.test(file.content) &&
      /\bclass\s+\w+/.test(file.content),
  )

  for (const file of [...serviceFiles, ...repositoryImplementationFiles]) {
    if (hasBeanAnnotation(file.content) || hasBeanFactory(javaFiles, file.className)) {
      continue
    }

    addFinding(findings, {
      kind: "Spring bean missing",
      severity: "fail",
      file: file.relativePath,
      evidence: `${file.className} has no @Service/@Repository/@Component annotation and no @Bean factory reference.`,
    })
  }

  const missingBeanMatch = runOutput.match(/No qualifying bean of type '([^']+)' available/)
  if (missingBeanMatch) {
    addFinding(findings, {
      kind: "Spring bean missing",
      severity: "fail",
      evidence: `Spring log reports missing bean: ${missingBeanMatch[1]}`,
    })
  }
}

function detectResponseDtoStorageUsage(javaFiles: JavaFile[], findings: DriftFinding[]): void {
  const responseDtoFiles = javaFiles.filter((file) => /(?:Response|ResponseDto)\.java$/.test(file.fileName))
  for (const file of responseDtoFiles) {
    const match = firstMatch(file.content, /\b(Map|List|ArrayList|HashMap|ConcurrentHashMap|AtomicLong|Repository|nextId|sequence|idCounter)\b/)
    if (match) {
      addFinding(findings, {
        kind: "Response DTO storage usage",
        severity: "fail",
        file: file.relativePath,
        evidence: `Response DTO contains storage/repository token: ${match}`,
      })
    }
  }

  const repositoryFiles = javaFiles.filter((file) => file.fileName.includes("Repository"))
  for (const file of repositoryFiles) {
    const match = firstMatch(
      file.content,
      /\b(?:private|protected|public)\s+(?:final\s+)?(?:Map|List|ArrayList|HashMap|ConcurrentHashMap)\s*<[^;]*Response(?:Dto)?[^;]*>\s+\w+\s*(?:=|;)/,
    )
    if (match) {
      addFinding(findings, {
        kind: "Response DTO storage usage",
        severity: "warn",
        file: file.relativePath,
        evidence: `Repository stores response DTO type: ${match}`,
      })
    }
  }
}

function detectControllerRepositoryAccess(javaFiles: JavaFile[], findings: DriftFinding[]): void {
  const controllerFiles = javaFiles.filter((file) => file.fileName.endsWith("Controller.java"))
  for (const file of controllerFiles) {
    const repositoryMatch = firstMatch(file.content, /\b\w*Repository\b/)
    const fieldMatch = firstMatch(
      file.content,
      /\b(?:private|protected|public)\s+(?:final\s+)?(?:Map|List|ArrayList|HashMap|ConcurrentHashMap|AtomicLong)(?:\s*<[^;]+>)?\s+\w+\s*(?:=|;)/,
    )
    const idStateMatch = firstMatch(file.content, /\b(nextId|sequence|idCounter)\b/i)
    const match = repositoryMatch ?? fieldMatch ?? idStateMatch
    if (match) {
      addFinding(findings, {
        kind: "Controller repository access",
        severity: "fail",
        file: file.relativePath,
        evidence: `Controller directly references repository/storage/id state: ${match}`,
      })
    }
  }
}

function detectApiStatusDrift(javaFiles: JavaFile[], findings: DriftFinding[]): void {
  const targetFiles = javaFiles.filter((file) => file.fileName.endsWith("Controller.java") || file.fileName.endsWith("Test.java"))
  for (const file of targetFiles) {
    const createdMatch = firstMatch(file.content, /\b(HttpStatus\.CREATED|status\(\)\.isCreated\(\)|isCreated\(\)|created\s*\()/)
    if (createdMatch) {
      addFinding(findings, {
        kind: "API status drift",
        severity: "fail",
        file: file.relativePath,
        evidence: `POST may drift to 201 Created: ${createdMatch}`,
      })
    }

    const noContentMatch = firstMatch(file.content, /\b(HttpStatus\.NO_CONTENT|status\(\)\.isNoContent\(\)|isNoContent\(\)|noContent\s*\()/)
    if (noContentMatch) {
      addFinding(findings, {
        kind: "API status drift",
        severity: "fail",
        file: file.relativePath,
        evidence: `DELETE may drift to 204 No Content: ${noContentMatch}`,
      })
    }
  }
}

function detectTestContractDrift(javaFiles: JavaFile[], findings: DriftFinding[]): void {
  const testFiles = javaFiles.filter((file) => file.fileName.endsWith("Test.java"))
  if (testFiles.length === 0) {
    addFinding(findings, {
      kind: "Test contract drift",
      severity: "fail",
      evidence: "No generated test file was found.",
    })
    return
  }

  const testContent = testFiles.map((file) => file.content).join("\n")
  const checksOk = /(HttpStatus\.OK|status\(\)\.isOk\(\)|status\(\)\.is\(200\)|getStatusCode\(\)\.value\(\)\s*[,)]\s*200|assertEquals\(\s*200\s*,)/.test(
    testContent,
  )
  const checksIdOne = /(jsonPath\([^;\n]*id[^;\n]*(?:is|value)\(\s*1\s*\)|jsonPath\([^)]*id[^)]*\)[\s\S]{0,120}(is\(\s*1\s*\)|value\(\s*1\s*\))|assertEquals\(\s*1\s*,[\s\S]{0,80}(id|getId\(\)))/.test(
    testContent,
  )
  const checksBodyFields = /\b(name|getName\(\)|jsonPath\([^)]*name)/.test(testContent) &&
    /\b(date|getDate\(\)|jsonPath\([^)]*date)/.test(testContent) &&
    /\b(time|getTime\(\)|jsonPath\([^)]*time)/.test(testContent)
  const hasListSizeAssertion = (expectedSize: 0 | 1): boolean =>
    new RegExp(
      [
        `hasSize\\(\\s*${expectedSize}\\s*\\)`,
        `size\\(\\)\\s*[,)]\\s*${expectedSize}`,
        `assertEquals\\(\\s*${expectedSize}\\s*,[\\s\\S]{0,80}size\\(\\)`,
        `jsonPath\\([^;\\n]*(?:length\\(\\)|size\\(\\))[^;\\n]*value\\(\\s*${expectedSize}\\s*\\)`,
        expectedSize === 0 ? `jsonPath\\([^;\\n]*\\$[^;\\n]*\\)\\.isEmpty\\(\\)` : "",
      ].filter(Boolean).join("|"),
    ).test(testContent)
  const checksListSizes = hasListSizeAssertion(0) && hasListSizeAssertion(1)

  const missing = [
    checksOk ? undefined : "200 OK status assertions",
    checksIdOne ? undefined : "first id=1 assertion",
    checksBodyFields ? undefined : "id/name/date/time body field assertions",
    checksListSizes ? undefined : "list size 0/1 assertions",
  ].filter((value): value is string => Boolean(value))

  if (missing.length > 0) {
    addFinding(findings, {
      kind: "Test contract drift",
      severity: "fail",
      evidence: `Generated tests miss contract checks: ${missing.join(", ")}.`,
    })
  }
}

export function detectBackendDrift(input: DetectBackendDriftInput): BackendDriftReport {
  const javaFiles = readJavaFiles(input.sandboxDir)
  const findings: DriftFinding[] = []

  if (input.timedOut) {
    addFinding(findings, {
      kind: "Timeout",
      severity: "fail",
      evidence: "OpenCode execution timed out or was terminated.",
    })
  }

  detectServiceNextId(javaFiles, findings)
  detectHttpDeleteReset(javaFiles, findings)
  detectRepositoryClearReset(javaFiles, findings)
  detectSpringBeanMissing(javaFiles, findings, input.runOutput)
  detectResponseDtoStorageUsage(javaFiles, findings)
  detectControllerRepositoryAccess(javaFiles, findings)
  detectApiStatusDrift(javaFiles, findings)
  detectTestContractDrift(javaFiles, findings)

  if (input.testFailureDetected && findings.length === 0) {
    addFinding(findings, {
      kind: "Unknown",
      severity: "warn",
      evidence: "Build/test failure was detected, but no minimal drift pattern matched.",
    })
  }

  const hasFail = findings.some((finding) => finding.severity === "fail")
  return {
    inspectedFiles: javaFiles.map((file) => file.relativePath),
    findings,
    falsePositiveRisk: [
      "This detector uses string patterns, not a Java AST.",
      "Bean detection treats @Bean methods as evidence when the class name appears near @Bean.",
      "Test contract detection checks representative assertions and may miss equivalent custom helpers.",
    ],
    hasFail,
    hasWarning: findings.some((finding) => finding.severity === "warn"),
  }
}

export function formatDriftReport(report: BackendDriftReport): string {
  const findingLines = report.findings.length > 0
    ? report.findings.map((finding) => {
        const file = finding.file ? ` (${finding.file})` : ""
        return `- [${finding.severity.toUpperCase()}] ${finding.kind}${file}: ${finding.evidence}`
      })
    : ["- 없음"]

  return `# Drift Report

## Inspected Files

${report.inspectedFiles.map((file) => `- ${file}`).join("\n") || "- none"}

## Findings

${findingLines.join("\n")}

## False Positive Risk

${report.falsePositiveRisk.map((risk) => `- ${risk}`).join("\n")}
`
}
