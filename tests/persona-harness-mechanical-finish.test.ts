import { execFileSync } from "node:child_process"
import { chmodSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { runPersonaCli } from "../src/cli/index.js"

const tempProjects: string[] = []
const FINISH_REACHABLE_CHAIN_DEPTH = 6

type ClosureStep = {
  readonly id: string
  readonly blockerId?: string
  readonly command?: string
  readonly commandAfterContent?: string
}

type ClosurePayload = {
  readonly nextStep: ClosureStep
  readonly state: {
    readonly finish: string
  }
}

function createTempProject(): string {
  const projectDir = mkdtempSync(join(tmpdir(), "persona-mechanical-finish-test-"))
  tempProjects.push(projectDir)
  return projectDir
}

function writeBaseWorkflow(projectDir: string): void {
  mkdirSync(join(projectDir, ".persona", "workflow"), { recursive: true })
  writeFileSync(join(projectDir, ".persona", "workflow", "plan.md"), "Status: accepted\n")
  writeFileSync(join(projectDir, ".persona", "workflow", "implementation-report.md"), "Status: template\n")
  writeFileSync(join(projectDir, ".persona", "workflow", "review-report.md"), "Status: template\n")
  writeFileSync(join(projectDir, "README.md"), "# Finish Reachable Fixture\n\nTiny backend fixture for mechanical workflow closure walking.\n")
}

function writeHarnessConfig(projectDir: string): void {
  mkdirSync(join(projectDir, ".persona"), { recursive: true })
  writeFileSync(join(projectDir, ".persona", "harness.jsonc"), `${JSON.stringify({ enforce: { executeVerification: true } }, null, 2)}\n`)
}

function writeReadyProfile(projectDir: string): void {
  mkdirSync(join(projectDir, ".persona"), { recursive: true })
  writeFileSync(
    join(projectDir, ".persona", "project-profile.jsonc"),
    `${JSON.stringify(
      {
        defaults: { buildTool: "gradle", framework: "spring", language: "java" },
        questions: [
          { answer: "ko", id: "user-language" },
          { answer: "team", id: "project-context" },
          { answer: "production-service", id: "project-goal" },
          { answer: "long-lived", id: "project-scale" },
          { answer: "rest-api", id: "application-type" },
          { answer: "clean-architecture-light", id: "architecture-style" },
          { answer: "database", id: "storage" },
          { answer: "jpa", id: "persistence-technology" },
          { answer: "schema.sql", id: "migration-style" },
          { answer: "domain-first", id: "package-style" },
          { answer: "strict", id: "boundary-strictness" },
        ],
        schema: "persona.project-profile.v1",
        scope: { mvp: "java-spring-clean-code", role: "backend" },
        status: "ready",
      },
      null,
      2,
    )}\n`,
  )
}

function writeSpringFixture(projectDir: string): readonly string[] {
  writeFileSync(join(projectDir, "settings.gradle"), "rootProject.name = 'mechanical-finish'\n")
  writeFileSync(
    join(projectDir, "build.gradle"),
    [
      "plugins { id 'java'; id 'org.springframework.boot' version '3.5.0' }",
      "dependencies {",
      "  implementation 'org.springframework.boot:spring-boot-starter-web'",
      "  implementation 'org.springframework.boot:spring-boot-starter-data-jpa'",
      "  runtimeOnly 'com.h2database:h2'",
      "}",
    ].join("\n"),
  )
  const gradlewPath = join(projectDir, "gradlew")
  writeFileSync(gradlewPath, "#!/bin/sh\necho 'BUILD SUCCESSFUL'\nexit 0\n")
  chmodSync(gradlewPath, 0o755)

  const javaRoot = join(projectDir, "src", "main", "java", "com", "example")
  mkdirSync(join(javaRoot, "presentation", "dto", "request"), { recursive: true })
  mkdirSync(join(javaRoot, "presentation", "dto", "response"), { recursive: true })
  mkdirSync(join(javaRoot, "application"), { recursive: true })
  mkdirSync(join(javaRoot, "domain"), { recursive: true })
  mkdirSync(join(javaRoot, "infrastructure"), { recursive: true })
  mkdirSync(join(projectDir, "src", "main", "resources"), { recursive: true })
  writeFileSync(join(projectDir, "src", "main", "resources", "schema.sql"), "create table task(id bigint primary key);\n")

  const files = [
    "src/main/java/com/example/MechanicalApplication.java",
    "src/main/java/com/example/presentation/TaskController.java",
    "src/main/java/com/example/application/TaskService.java",
    "src/main/java/com/example/domain/Task.java",
    "src/main/java/com/example/domain/TaskRepository.java",
    "src/main/java/com/example/infrastructure/JpaTaskRepository.java",
    "src/main/java/com/example/presentation/dto/request/CreateTaskRequest.java",
    "src/main/java/com/example/presentation/dto/response/TaskResponse.java",
  ] as const
  const sources = [
    "package com.example;\nimport org.springframework.boot.autoconfigure.SpringBootApplication;\n@SpringBootApplication\nclass MechanicalApplication {}\n",
    "package com.example.presentation;\nimport com.example.application.TaskService;\nimport org.springframework.web.bind.annotation.RestController;\n@RestController\nclass TaskController { TaskController(TaskService service) {} }\n",
    "package com.example.application;\nclass TaskService {}\n",
    "package com.example.domain;\nclass Task {}\n",
    "package com.example.domain;\ninterface TaskRepository {}\n",
    "package com.example.infrastructure;\nclass JpaTaskRepository implements com.example.domain.TaskRepository {}\n",
    "package com.example.presentation.dto.request;\nrecord CreateTaskRequest(String title) {}\n",
    "package com.example.presentation.dto.response;\nrecord TaskResponse(String title) {}\n",
  ] as const
  for (const [index, source] of sources.entries()) {
    writeFileSync(join(projectDir, files[index]), source)
  }
  return files.slice(1)
}

function writeImplementationReport(projectDir: string, includeFullCoverage: boolean): void {
  const coverageLines = includeFullCoverage
    ? [
        "- Project profile read method: npx ph bearshell sed",
        "- Project profile ranges read: all",
        "- Java role discovery method: workflow evidence",
        "- Java role files read: controller, service, domain, repository, request DTO, response DTO",
      ]
    : []
  writeFileSync(
    join(projectDir, ".persona", "workflow", "implementation-report.md"),
    [
      "Status: filled",
      "- README read method: npx ph bearshell sed",
      "- README ranges read: 1-40",
      "- Plan read method: npx ph bearshell sed",
      "- Plan ranges read: all",
      "- `npx ph bearshell --shell './gradlew test'`",
      "- Direct verification observed BUILD SUCCESSFUL.",
      ...coverageLines,
    ].join("\n"),
  )
}

function writeReviewReport(projectDir: string): void {
  writeFileSync(
    join(projectDir, ".persona", "workflow", "review-report.md"),
    [
      "Status: filled",
      "- [x] README/plan read method and ranges are recorded in the implementation report.",
      "- [x] Project profile read method and ranges are recorded in the implementation report.",
      "- [x] Generated Java role files have read evidence before finish.",
      "- `npx ph bearshell --shell './gradlew test'`",
      "- Manual QA reviewed the mechanical finish fixture.",
    ].join("\n"),
  )
}

function writeReadEvidence(projectDir: string, javaRoleFiles: readonly string[]): void {
  mkdirSync(join(projectDir, ".persona", "evidence", "phase0"), { recursive: true })
  writeFileSync(
    join(projectDir, ".persona", "evidence", "phase0", "read-coverage.json"),
    `${JSON.stringify(
      {
        injectedInto: "model-input",
        targetFile: ".persona/project-profile.jsonc",
        toolOutput: [".persona/project-profile.jsonc", ...javaRoleFiles, "BUILD SUCCESSFUL"].join("\n"),
      },
      null,
      2,
    )}\n`,
  )
}

function writeVerificationEvidence(projectDir: string): void {
  mkdirSync(join(projectDir, ".persona", "evidence", "phase0"), { recursive: true })
  writeFileSync(
    join(projectDir, ".persona", "evidence", "phase0", "verification.json"),
    `${JSON.stringify(
      {
        command: "npx ph bearshell --shell './gradlew test'",
        status: 0,
        tool: "bearshell",
        toolOutput: "BUILD SUCCESSFUL",
      },
      null,
      2,
    )}\n`,
  )
}

function runPh(projectDir: string, args: readonly string[]) {
  return runPersonaCli(args, { cwd: projectDir, env: {}, invocationName: "ph" })
}

function closureNext(projectDir: string): ClosurePayload {
  const result = runPh(projectDir, ["workflow", "closure", "next", "--json"])
  expect(result.status).toBe(0)
  expect(result.stderr).toBe("")
  return JSON.parse(result.stdout) as ClosurePayload
}

function runCommandAfterContent(projectDir: string, command: string | undefined): void {
  if (command === undefined) return
  const args =
    command === "npx ph plan --report-filled implementation"
      ? ["plan", "--report-filled", "implementation"]
      : command === "npx ph plan --report-filled review"
        ? ["plan", "--report-filled", "review"]
        : command === "npx ph workflow check"
          ? ["workflow", "check"]
          : undefined
  expect(args, `unhandled commandAfterContent: ${command}`).toBeDefined()
  const result = runPh(projectDir, args ?? [])
  expect(result.status).toBe(0)
}

afterEach(() => {
  for (const projectDir of tempProjects) {
    rmSync(projectDir, { recursive: true, force: true })
  }
  tempProjects.length = 0
})

describe("mechanical workflow finish reachability", () => {
  it("walks closure next steps to the trusted-authority boundary within the chain-depth contract", () => {
    const projectDir = createTempProject()
    writeBaseWorkflow(projectDir)
    writeHarnessConfig(projectDir)
    writeReadyProfile(projectDir)
    const javaRoleFiles = writeSpringFixture(projectDir)

    const visitedSteps: string[] = []
    const seenStepIds = new Set<string>()
    for (let stepIndex = 0; stepIndex < FINISH_REACHABLE_CHAIN_DEPTH; stepIndex += 1) {
      const payload = closureNext(projectDir)
      if (payload.state.finish === "passed") break

      const step = payload.nextStep
      expect(step.id).not.toBe("unmapped-blocker")
      expect(seenStepIds.has(step.id), `closure step repeated without progress: ${step.id}`).toBe(false)
      expect(step.command === "npx ph workflow finish implement" || step.command === "npx ph workflow check").toBe(false)
      seenStepIds.add(step.id)
      visitedSteps.push(step.id)

      if (step.id === "fill-implementation-report") {
        writeImplementationReport(projectDir, false)
      } else if (step.id === "fill-review-report") {
        writeReviewReport(projectDir)
      } else if (step.id === "fill-report-coverage") {
        writeImplementationReport(projectDir, true)
        writeReadEvidence(projectDir, javaRoleFiles)
      } else if (step.id === "record-workflow-evidence") {
        writeVerificationEvidence(projectDir)
      } else if (step.id === "trusted-authority-required") {
        break
      } else {
        throw new Error(`mechanical finish fixture does not know how to walk ${step.id}`)
      }
      runCommandAfterContent(projectDir, step.commandAfterContent)
    }

    const finish = runPh(projectDir, ["workflow", "finish", "implement"])
    expect(finish.status).toBe(1)
    expect(finish.stderr).toContain("Blocker: trusted-authority-required")
    expect(finish.stderr).not.toContain("Finish status: PASS")

    execFileSync("git", ["init", "-q"], { cwd: projectDir })
    execFileSync("git", ["config", "user.email", "ph@example.invalid"], { cwd: projectDir })
    execFileSync("git", ["config", "user.name", "PH Test"], { cwd: projectDir })
    execFileSync("git", ["add", "."], { cwd: projectDir })
    execFileSync("git", ["commit", "-qm", "finish-ready fixture"], { cwd: projectDir })
    const reverifiedFinish = runPh(projectDir, ["workflow", "finish", "implement", "--reverify", "--ci"])
    expect(reverifiedFinish.status, reverifiedFinish.stderr).toBe(1)
    expect(reverifiedFinish.stderr).toContain("Blocker: trusted-authority-required")
    expect(reverifiedFinish.stdout).not.toContain("Finish status: PASS")

    expect(visitedSteps).toEqual(["fill-implementation-report", "fill-review-report", "record-workflow-evidence", "fill-report-coverage", "trusted-authority-required"])
    expect(visitedSteps.length).toBeLessThanOrEqual(FINISH_REACHABLE_CHAIN_DEPTH)
  })
})
