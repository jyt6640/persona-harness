import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { runBoundedProcess } from "../src/cli/bounded-process.js"
import { runPersonaCli } from "../src/cli/index.js"

const tempProjects: string[] = []

function createWorkflowProject(): string {
  const projectDir = mkdtempSync(join(tmpdir(), "persona-workflow-loop-test-"))
  tempProjects.push(projectDir)
  mkdirSync(join(projectDir, ".persona", "workflow"), { recursive: true })
  writeFileSync(join(projectDir, ".persona", "workflow", "plan.md"), "Status: accepted\n")
  writeFileSync(join(projectDir, ".persona", "workflow", "implementation-report.md"), "Status: template\n")
  writeFileSync(join(projectDir, ".persona", "workflow", "review-report.md"), "Status: template\n")
  return projectDir
}

function writeFakeOpencode(projectDir: string): string {
  const command = join(projectDir, "fake-opencode.mjs")
  const logPath = join(projectDir, "fake-opencode.log")
  writeFileSync(
    command,
    [
      "#!/usr/bin/env node",
      "import { appendFileSync } from 'node:fs'",
      `appendFileSync(${JSON.stringify(logPath)}, JSON.stringify(process.argv.slice(2)) + "\\n")`,
      "process.stdout.write('fake opencode completed\\n')",
    ].join("\n"),
  )
  chmodSync(command, 0o755)
  return command
}

function writeProfile(projectDir: string): void {
  mkdirSync(join(projectDir, ".persona"), { recursive: true })
  writeFileSync(
    join(projectDir, ".persona", "project-profile.jsonc"),
    `${JSON.stringify(
      {
        defaults: { buildTool: "gradle", framework: "spring", language: "java" },
        questions: [
          { answer: "simple-layered", id: "architecture-style" },
          { answer: "h2 database", id: "storage" },
          { answer: "jpa", id: "persistence-technology" },
          { answer: "schema.sql", id: "migration-style" },
        ],
        schema: "persona.project-profile.v1",
        scope: { mvp: "java-spring-clean-code", role: "backend" },
      },
      null,
      2,
    )}\n`,
  )
}

function writePassingWorkflowReportsAndEvidence(projectDir: string): void {
  writeFileSync(join(projectDir, "settings.gradle"), "rootProject.name = 'sample'\n")
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
  writeFileSync(join(projectDir, "gradlew"), "#!/bin/sh\nexit 0\n")
  mkdirSync(join(projectDir, "src", "main", "resources"), { recursive: true })
  writeFileSync(join(projectDir, "src", "main", "resources", "schema.sql"), "create table sample (id bigint primary key);\n")
  mkdirSync(join(projectDir, "src", "main", "java", "com", "example"), { recursive: true })
  writeFileSync(
    join(projectDir, "src", "main", "java", "com", "example", "Stage18Application.java"),
    "import org.springframework.boot.autoconfigure.SpringBootApplication;\n@SpringBootApplication\nclass Stage18Application {}\n",
  )
  writeFileSync(
    join(projectDir, "src", "main", "java", "com", "example", "CustomTrigger.java"),
    "class CustomTrigger { String marker() { return \"UNMAPPED_TRIGGER\"; } }\n",
  )
  writeFileSync(
    join(projectDir, ".persona", "workflow", "implementation-report.md"),
    [
      "Status: filled",
      "- README ranges read: all",
      "- Project profile ranges read: all",
      "- `npx ph bearshell --shell './gradlew test'`",
      "- BUILD SUCCESSFUL",
    ].join("\n"),
  )
  writeFileSync(
    join(projectDir, ".persona", "workflow", "review-report.md"),
    [
      "Status: filled",
      "- Manual QA reviewed the tiny fixture.",
      "- `npx ph bearshell --shell './gradlew build'`",
      "- BUILD SUCCESSFUL",
    ].join("\n"),
  )
  mkdirSync(join(projectDir, ".persona", "evidence", "phase0"), { recursive: true })
  writeFileSync(
    join(projectDir, ".persona", "evidence", "phase0", "workflow.json"),
    `${JSON.stringify(
      {
        command: "npx ph bearshell --shell './gradlew test'",
        status: 0,
        tool: "bearshell",
        toolOutput: [
          ".persona/project-profile.jsonc",
          "src/main/java/com/example/Stage18Application.java",
          "src/main/java/com/example/CustomTrigger.java",
          "BUILD SUCCESSFUL",
        ].join("\n"),
      },
      null,
      2,
    )}\n`,
  )
}

function writeCustomUnmappedConvention(projectDir: string): void {
  mkdirSync(join(projectDir, ".persona", "conventions"), { recursive: true })
  writeFileSync(
    join(projectDir, ".persona", "conventions", "custom-unmapped.yml"),
    [
      "id: custom.unmapped-loop",
      "language: Java",
      "message: Custom unmapped convention matched.",
      "# persona-harness-level: block",
      "# persona-harness-scope: single-file",
      "# persona-harness-profile-scope: java-spring-service-architecture",
      "# persona-harness-high-precision: true",
      "# persona-harness-block-allowed: true",
      "# persona-harness-fix-path: register a closure step mapping for custom.unmapped-loop.",
      "rule:",
      "  pattern: UNMAPPED_TRIGGER",
    ].join("\n"),
  )
}

function writeFakeAstGrepBinary(projectDir: string): string {
  const command = join(projectDir, "fake-sg.mjs")
  writeFileSync(
    command,
    [
      "#!/usr/bin/env node",
      "import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'",
      "import { join } from 'node:path'",
      "const root = process.argv[process.argv.length - 1]",
      "const findings = []",
      "function visit(dir) {",
      "  if (!existsSync(dir)) return",
      "  for (const entry of readdirSync(dir)) {",
      "    const path = join(dir, entry)",
      "    const stat = statSync(path)",
      "    if (stat.isDirectory()) visit(path)",
      "    if (stat.isFile() && path.endsWith('.java') && readFileSync(path, 'utf8').includes('UNMAPPED_TRIGGER')) {",
      "      findings.push({ file: path, message: 'Custom unmapped convention matched.', range: { start: { line: 1 } } })",
      "    }",
      "  }",
      "}",
      "visit(root)",
      "process.stdout.write(JSON.stringify(findings))",
    ].join("\n"),
  )
  chmodSync(command, 0o755)
  return command
}

afterEach(() => {
  for (const projectDir of tempProjects) {
    rmSync(projectDir, { recursive: true, force: true })
  }
  tempProjects.length = 0
})

describe("ph workflow loop", () => {
  it("previews a minimal blocker-depth prompt without writing loop state", () => {
    const projectDir = createWorkflowProject()

    const result = runPersonaCli(["workflow", "loop", "--dry-run", "--json"], { cwd: projectDir, env: {}, invocationName: "ph" })
    const output = JSON.parse(result.stdout)

    expect(result.status).toBe(0)
    expect(output).toMatchObject({
      defaultOff: true,
      finalDecision: "not-run",
      maxIterations: 3,
      mode: "dry-run",
      schemaVersion: "workflow-loop.1",
    })
    expect(output.promptPreview.join("\n")).toContain("Blocker: verification-unknown (blocker 1/")
    expect(output.promptPreview.join("\n")).not.toContain("read everything again")
    expect(output.termination).toEqual([
      "finish exit 0",
      "no remaining closure blockers",
      "unmapped closure blocker diagnostic",
      "iteration cap",
    ])
    expect(existsSync(join(projectDir, ".persona", "workflow", "workflow-loop-state.json"))).toBe(false)
  })

  it("runs capped fresh-session iterations and records prompt/log state", () => {
    const projectDir = createWorkflowProject()
    const fakeOpencode = writeFakeOpencode(projectDir)

    const result = runPersonaCli(
      [
        "workflow",
        "loop",
        "--json",
        "--max-iterations",
        "2",
        "--timeout-ms",
        "5000",
        "--grace-ms",
        "10",
        "--opencode-command",
        fakeOpencode,
      ],
      { cwd: projectDir, env: {}, invocationName: "ph" },
    )
    const output = JSON.parse(result.stdout)
    const state = JSON.parse(readFileSync(join(projectDir, ".persona", "workflow", "workflow-loop-state.json"), "utf8"))
    const firstPrompt = readFileSync(join(projectDir, ".persona", "workflow", "loop", "iteration-1-prompt.md"), "utf8")

    expect(result.status).toBe(0)
    expect(output.finalDecision).toBe("iteration-cap")
    expect(output.iterations).toHaveLength(2)
    expect(state.finalDecision).toBe("iteration-cap")
    expect(state.iterations).toHaveLength(2)
    expect(firstPrompt).toContain("[Persona Harness Workflow Loop]")
    expect(firstPrompt).toContain("Blocker: verification-unknown (blocker 1/")
    expect(firstPrompt).toContain("Fix only this blocker")
    expect(readFileSync(join(projectDir, "fake-opencode.log"), "utf8").split("\n").filter(Boolean)).toHaveLength(2)
  })

  it("stops on an unmapped blocker before consuming an iteration", () => {
    const projectDir = createWorkflowProject()
    writeProfile(projectDir)
    writePassingWorkflowReportsAndEvidence(projectDir)
    writeCustomUnmappedConvention(projectDir)
    const fakeOpencode = writeFakeOpencode(projectDir)
    const previousAstGrep = process.env.PH_AST_GREP_BIN
    process.env.PH_AST_GREP_BIN = writeFakeAstGrepBinary(projectDir)
    try {
      const closure = runPersonaCli(["workflow", "closure", "next", "--json"], {
        cwd: projectDir,
        env: {},
        invocationName: "ph",
      })
      const closureJson = JSON.parse(closure.stdout)
      const result = runPersonaCli(
        [
          "workflow",
          "loop",
          "--json",
          "--max-iterations",
          "2",
          "--opencode-command",
          fakeOpencode,
        ],
        { cwd: projectDir, env: {}, invocationName: "ph" },
      )
      const output = JSON.parse(result.stdout)
      const state = JSON.parse(readFileSync(join(projectDir, ".persona", "workflow", "workflow-loop-state.json"), "utf8"))

      expect(closureJson.nextStep).toMatchObject({
        blockerId: "architecture-custom-unmapped-loop",
        id: "unmapped-blocker",
      })
      expect(result.status).toBe(0)
      expect(output.finalDecision).toBe("unmapped-blocker")
      expect(output.iterations).toHaveLength(0)
      expect(state.finalDecision).toBe("unmapped-blocker")
      expect(state.iterations).toHaveLength(0)
      expect(existsSync(join(projectDir, "fake-opencode.log"))).toBe(false)
      expect(existsSync(join(projectDir, ".persona", "workflow", "loop", "iteration-1-prompt.md"))).toBe(false)
    } finally {
      if (previousAstGrep === undefined) {
        delete process.env.PH_AST_GREP_BIN
      } else {
        process.env.PH_AST_GREP_BIN = previousAstGrep
      }
    }
  })

  it("explains unmapped blockers as escalation in failed finish output", () => {
    const projectDir = createWorkflowProject()
    writeProfile(projectDir)
    writePassingWorkflowReportsAndEvidence(projectDir)
    writeCustomUnmappedConvention(projectDir)
    const previousAstGrep = process.env.PH_AST_GREP_BIN
    process.env.PH_AST_GREP_BIN = writeFakeAstGrepBinary(projectDir)
    try {
      const result = runPersonaCli(["workflow", "finish", "implement"], {
        cwd: projectDir,
        env: {},
        invocationName: "ph",
      })
      const unmappedSection = result.stderr.slice(result.stderr.indexOf("Closure blocker: architecture-custom-unmapped-loop"))

      expect(result.status).toBe(1)
      expect(result.stderr).not.toContain("Summary:")
      expect(result.stderr).not.toContain("- first blocker: architecture-custom-unmapped-loop")
      expect(result.stderr).not.toContain("first next action: escalate to Persona Harness configuration/maintainer review")
      expect(result.stderr).toContain("Required fixes:")
      expect(unmappedSection).toContain("blocker id has no closure step mapping")
      expect(unmappedSection).toContain("PH bug or unregistered convention")
      expect(unmappedSection).toContain("escalate to Persona Harness configuration/maintainer review")
      expect(unmappedSection).toContain("Do not directly rerun `npx ph workflow finish implement` or `npx ph workflow check`")
      expect(unmappedSection).not.toMatch(/Required next actions:\n- Re-run `npx ph workflow (?:finish implement|check)`/u)
    } finally {
      if (previousAstGrep === undefined) {
        delete process.env.PH_AST_GREP_BIN
      } else {
        process.env.PH_AST_GREP_BIN = previousAstGrep
      }
    }
  })

  it("advertises the explicit loop command in workflow and root help", () => {
    const workflowHelp = runPersonaCli(["workflow", "--help"], { env: {}, invocationName: "ph" })
    const rootHelp = runPersonaCli(["--help"], { env: {}, invocationName: "ph" })

    expect(workflowHelp.status).toBe(0)
    expect(workflowHelp.stdout).toContain("workflow loop")
    expect(rootHelp.status).toBe(0)
    expect(rootHelp.stdout).toContain("workflow loop")
  })

  it("escalates a timed-out child that ignores SIGTERM", () => {
    const projectDir = createWorkflowProject()
    const command = join(projectDir, "ignore-term.mjs")
    writeFileSync(command, "process.on('SIGTERM', () => {}); setInterval(() => {}, 1000)\n")

    const result = runBoundedProcess({
      args: [command],
      command: process.execPath,
      cwd: projectDir,
      graceMs: 50,
      timeoutMs: 50,
    })

    expect(result.timedOut).toBe(true)
    expect(result.killed).toBe(true)
  })
})
