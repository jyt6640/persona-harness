import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"

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

function writeHarnessConfig(projectDir: string, config: Record<string, unknown>): void {
  mkdirSync(join(projectDir, ".persona"), { recursive: true })
  writeFileSync(join(projectDir, ".persona", "harness.jsonc"), `${JSON.stringify(config, null, 2)}\n`)
}

function writeRule(projectDir: string, relativePath: string, frontmatter: string, policies: readonly string[]): void {
  const fullPath = join(projectDir, ".persona", "rules", relativePath)
  mkdirSync(dirname(fullPath), { recursive: true })
  writeFileSync(
    fullPath,
    `---\n${frontmatter.trim()}\n---\n\n# Test Rule\n\n${policies.map((policy) => `- ${policy}`).join("\n")}\n`,
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
    writeHarnessConfig(projectDir, { maxRulesPerInjection: 1 })
    writeRule(
      projectDir,
      "backend/test-writer-rule.md",
      `
id: backend.test-writer-rule
source: backend-policy
domain: backend
topic: verification
roles:
  - test-writer
globs:
  - "**/*.java"
severity: must
enforcement: inject_only
`,
      ["verification scoped policy"],
    )
    writeRule(
      projectDir,
      "backend/implementer-rule.md",
      `
id: backend.implementer-rule
source: backend-policy
domain: backend
topic: implementation
roles:
  - implementer
globs:
  - "**/*.java"
severity: must
enforcement: inject_only
`,
      ["implementation scoped policy"],
    )

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
    expect(output.promptPreview.join("\n")).toContain("Scoped PH rules (role: test-writer, stage: verification")
    expect(output.promptPreview.join("\n")).toContain("verification scoped policy")
    expect(output.promptPreview.join("\n")).not.toContain("implementation scoped policy")
    expect(output.promptPreview.join("\n")).not.toContain("read everything again")
    expect(output.termination).toEqual([
      "finish exit 0",
      "no remaining closure blockers",
      "unmapped closure blocker diagnostic",
      "iteration cap",
    ])
    expect(existsSync(join(projectDir, ".persona", "workflow", "workflow-loop-state.json"))).toBe(false)
  })

  it("uses the same action and after-action command in dry-run plaintext and JSON prompt preview", () => {
    const projectDir = createWorkflowProject()
    const json = runPersonaCli(["workflow", "loop", "--dry-run", "--json"], { cwd: projectDir, env: {}, invocationName: "ph" })
    const plaintext = runPersonaCli(["workflow", "loop", "--dry-run"], { cwd: projectDir, env: {}, invocationName: "ph" })
    const output = JSON.parse(json.stdout)
    const actionLine = output.promptPreview.find((line: string) => line.startsWith("Next action:"))
    const commandLine = output.promptPreview.find((line: string) => line.startsWith("Next command:"))

    expect(json.status).toBe(0)
    expect(plaintext.status).toBe(0)
    expect(actionLine).toBe("Next action: Run the project's supported test/build/runtime verification and record the outcome in workflow evidence.")
    expect(commandLine).toBe("Next command: after completing the action, run npx ph workflow check")
    expect(plaintext.stdout).toContain("Prompt preview:")
    expect(plaintext.stdout).toContain(actionLine)
    expect(plaintext.stdout).toContain(commandLine)
    expect(output.promptPreview.join("\n")).not.toContain("Next action: npx ph workflow check")
  })

  it("reads legacy unversioned workflow loop state for upgrade compatibility", () => {
    const projectDir = createWorkflowProject()
    writeFileSync(
      join(projectDir, ".persona", "workflow", "workflow-loop-state.json"),
      `${JSON.stringify(
        {
          finalDecision: "iteration-cap",
          iterations: [
            {
              blockerId: "verification-unknown",
              blockerIndex: 1,
              blockerTotal: 3,
              exitStatus: 0,
              iteration: 1,
              promptPath: ".persona/workflow/loop/iteration-1-prompt.md",
              stderrPath: ".persona/workflow/loop/iteration-1-stderr.log",
              stdoutPath: ".persona/workflow/loop/iteration-1-stdout.log",
              timedOut: false,
            },
          ],
          startedAt: "2026-07-05T00:00:00.000Z",
        },
        null,
        2,
      )}\n`,
    )

    const result = runPersonaCli(["workflow", "loop", "--dry-run", "--json"], { cwd: projectDir, env: {}, invocationName: "ph" })
    const output = JSON.parse(result.stdout)

    expect(result.status).toBe(0)
    expect(output.iterations).toHaveLength(1)
    expect(output.iterations[0].blockerId).toBe("verification-unknown")
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
    expect(state.schemaVersion).toBe("workflow-loop-state.2")
    expect(state.rulePackHash).toMatch(/^sha256:[a-f0-9]{64}$/u)
    expect(state.finalDecision).toBe("iteration-cap")
    expect(state.iterations).toHaveLength(2)
    expect(firstPrompt).toContain("[Persona Harness Workflow Loop]")
    expect(firstPrompt).toContain("Blocker: verification-unknown (blocker 1/")
    expect(firstPrompt).toContain("Scoped PH rules")
    expect(firstPrompt).toContain("Complete only the prioritized action")
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
      expect(result.status).toBe(1)
      expect(result.stderr).not.toContain("Summary:")
      expect(result.stderr).not.toContain("- first blocker: architecture-custom-unmapped-loop")
      expect(result.stderr).not.toContain("first next action: escalate to Persona Harness configuration/maintainer review")
      expect(result.stderr).toContain("Blocker: architecture-custom-unmapped-loop")
      expect(result.stderr).toContain("Next action: Escalate the missing Persona Harness blocker mapping for maintainer review before retrying automation.")
      expect(result.stderr).not.toContain("Next command:")
      expect(result.stderr).not.toContain("npx ph workflow finish implement")
      expect(result.stderr).not.toContain("npx ph workflow check")
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
