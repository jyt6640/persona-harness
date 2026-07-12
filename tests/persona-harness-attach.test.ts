import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { loadHarnessConfig } from "../src/config/harness-config.js"
import { runPersonaCli } from "../src/cli/index.js"

const projects: string[] = []

function createJavaProject(): string {
  const projectDir = mkdtempSync(join(tmpdir(), "persona-attach-test-"))
  projects.push(projectDir)
  writeFileSync(join(projectDir, "settings.gradle"), "rootProject.name = 'tasks'\n")
  writeFileSync(
    join(projectDir, "build.gradle"),
    [
      "plugins {",
      "  id 'java'",
      "  id 'org.springframework.boot' version '3.5.0'",
      "}",
      "dependencies { implementation 'org.springframework.boot:spring-boot-starter-web' }",
      "",
    ].join("\n"),
  )
  const sourceDir = join(projectDir, "src", "main", "java", "com", "example", "tasks")
  mkdirSync(sourceDir, { recursive: true })
  writeFileSync(join(sourceDir, "TasksApplication.java"), "package com.example.tasks;\n")
  return projectDir
}

function cli(projectDir: string, args: readonly string[], extra: Record<string, unknown> = {}) {
  return runPersonaCli(args, {
    cwd: projectDir,
    env: {
      PH_DOCTOR_OPENCODE_VERSION: "1.0.0-test",
      PH_DOCTOR_REGISTRY_DIST_TAGS: JSON.stringify({ latest: "0.7.0-rc.1" }),
    },
    invocationName: "ph",
    packageRoot: process.cwd(),
    ...extra,
  })
}

function count(output: string, text: string): number {
  return output.split(text).length - 1
}

afterEach(() => {
  for (const projectDir of projects) {
    rmSync(projectDir, { recursive: true, force: true })
  }
  projects.length = 0
})

describe("ph attach", () => {
  it("attaches a real existing Java project and reaches go without manual setup edits", () => {
    const projectDir = createJavaProject()

    const attached = cli(projectDir, ["attach", "--yes"])

    expect(attached.status).toBe(0)
    expect(attached.stdout).toContain("Inferred stack: Java / Spring / Gradle")
    expect(readFileSync(join(projectDir, "AGENTS.md"), "utf8")).toContain(
      "<!-- persona-harness:agents:start schema=persona-harness.agents.v1 -->",
    )
    const config = loadHarnessConfig(projectDir)
    expect(config.enforce.executeVerification).toBe(true)
    expect(config.features.runtimeInjection).toBe(false)
    expect(config.features.entrySteering).toBe(false)
    expect(config.enforce.systemConstitution).toBe(false)
    expect(config.enforce.idleContinuation).toBe(false)
    expect(config.enforce.ralphLoop.enabled).toBe(false)

    const doctor = cli(projectDir, ["doctor"])
    expect(doctor.status).toBe(0)
    expect(doctor.stdout).toContain("Session reachability: PASS")

    const go = cli(projectDir, ["go", "Add a task creation endpoint."])
    expect(go.status).toBe(0)
    expect(go.stdout).toContain("Status: ready")
    expect(go.stdout).toContain("Implementation rail status: PASS")
  })

  it("shows the inferred draft without writing until --yes confirms it", () => {
    const projectDir = createJavaProject()

    const result = cli(projectDir, ["attach"])

    expect(result.status).toBe(1)
    expect(result.stderr).toContain("Inferred stack: Java / Spring / Gradle")
    expect(result.stderr).toContain("Unresolved fields: none")
    expect(count(result.stderr, "Next action:")).toBe(1)
    expect(count(result.stderr, "Next command:")).toBe(1)
    expect(result.stderr).toContain("Next command: npx ph attach --yes")
    expect(existsSync(join(projectDir, ".persona"))).toBe(false)
    expect(existsSync(join(projectDir, "AGENTS.md"))).toBe(false)
  })

  it("fails closed on existing user files and leaves them byte-identical", () => {
    const projectDir = createJavaProject()
    const agentsPath = join(projectDir, "AGENTS.md")
    writeFileSync(agentsPath, "# User instructions\n")

    const result = cli(projectDir, ["attach", "--yes"])

    expect(result.status).toBe(1)
    expect(result.stderr).toContain("existing AGENTS.md is not a recognized Persona Harness installation")
    expect(count(result.stderr, "Next action:")).toBe(1)
    expect(count(result.stderr, "Next command:")).toBe(1)
    expect(readFileSync(agentsPath, "utf8")).toBe("# User instructions\n")
    expect(existsSync(join(projectDir, ".persona"))).toBe(false)
  })

  it("rolls back every invocation-owned write after an injected commit failure", () => {
    const projectDir = createJavaProject()
    writeFileSync(join(projectDir, ".gitignore"), "user-entry/\n")
    const before = readFileSync(join(projectDir, ".gitignore"), "utf8")

    const result = cli(projectDir, ["attach", "--yes"], {
      onAfterAttachCommitFile: (relativePath: string) => {
        if (relativePath === ".persona/harness.jsonc") {
          throw new Error("injected attach failure")
        }
      },
    })

    expect(result.status).toBe(1)
    expect(result.stderr).toContain("Attach transaction failed")
    expect(readFileSync(join(projectDir, ".gitignore"), "utf8")).toBe(before)
    expect(existsSync(join(projectDir, ".persona"))).toBe(false)
    expect(existsSync(join(projectDir, "AGENTS.md"))).toBe(false)
  })

  it("repairs only a recognized weak installation when explicitly requested", () => {
    const projectDir = createJavaProject()
    expect(cli(projectDir, ["bootstrap", "backend", "--no-developer-mcp"]).status).toBe(0)
    const legacyAgents = readFileSync(join(projectDir, "AGENTS.md"), "utf8")
    expect(loadHarnessConfig(projectDir).enforce.executeVerification).toBe(false)

    const ordinary = cli(projectDir, ["attach", "--yes"])
    expect(ordinary.status).toBe(1)
    expect(ordinary.stderr).toContain("Next command: npx ph attach --repair --yes")
    expect(readFileSync(join(projectDir, "AGENTS.md"), "utf8")).toBe(legacyAgents)

    const repaired = cli(projectDir, ["attach", "--repair", "--yes"])
    expect(repaired.status).toBe(0)
    expect(loadHarnessConfig(projectDir).enforce.executeVerification).toBe(true)
    expect(readFileSync(join(projectDir, "AGENTS.md"), "utf8")).toContain(
      "<!-- persona-harness:agents:start schema=persona-harness.agents.v1 -->",
    )
    expect(cli(projectDir, ["doctor"]).stdout).toContain("Session reachability: PASS")
  })

  it("repairs an init-only recognized installation without silently doing so in ordinary attach", () => {
    const projectDir = createJavaProject()
    expect(cli(projectDir, ["init"]).status).toBe(0)

    const go = cli(projectDir, ["go", "Add a task endpoint."])
    expect(go.status).toBe(1)
    expect(go.stderr).toContain("Next command: npx ph attach --yes")

    const ordinary = cli(projectDir, ["attach", "--yes"])
    expect(ordinary.status).toBe(1)
    expect(ordinary.stderr).toContain("Next command: npx ph attach --repair --yes")
    expect(existsSync(join(projectDir, "AGENTS.md"))).toBe(false)

    expect(cli(projectDir, ["attach", "--repair", "--yes"]).status).toBe(0)
    expect(cli(projectDir, ["doctor"]).stdout).toContain("Session reachability: PASS")
    expect(cli(projectDir, ["go", "Add a task endpoint."]).status).toBe(0)
  })

  it("preserves user-authored text outside a recognized managed AGENTS block during repair", () => {
    const projectDir = createJavaProject()
    expect(cli(projectDir, ["attach", "--yes"]).status).toBe(0)
    const agentsPath = join(projectDir, "AGENTS.md")
    const managed = readFileSync(agentsPath, "utf8")
    writeFileSync(agentsPath, `# Team rules\n\n${managed}\nFooter rule.\n`)
    const harnessPath = join(projectDir, ".persona", "harness.jsonc")
    writeFileSync(harnessPath, readFileSync(harnessPath, "utf8").replace('"executeVerification": true', '"executeVerification": false'))

    expect(cli(projectDir, ["attach", "--repair", "--yes"]).status).toBe(0)
    const repaired = readFileSync(agentsPath, "utf8")
    expect(repaired).toContain("# Team rules")
    expect(repaired).toContain("Footer rule.")
    expect(repaired.match(/persona-harness:agents:start/gu)).toHaveLength(1)
    expect(repaired.match(/persona-harness:agents:end/gu)).toHaveLength(1)
  })

  it("preserves a concurrent unowned file while committing owned paths", () => {
    const projectDir = createJavaProject()
    const concurrentPath = join(projectDir, ".persona", "concurrent.txt")
    const result = cli(projectDir, ["attach", "--yes"], {
      onAfterAttachCommitFile: (relativePath: string) => {
        if (relativePath === ".gitignore") {
          mkdirSync(join(projectDir, ".persona"), { recursive: true })
          writeFileSync(concurrentPath, "external\n")
        }
      },
    })

    expect(result.status).toBe(0)
    expect(readFileSync(concurrentPath, "utf8")).toBe("external\n")
    expect(existsSync(join(projectDir, ".persona", "harness.jsonc"))).toBe(true)
  })

  it("preserves a concurrent replacement of an owned path and rolls back earlier writes", () => {
    const projectDir = createJavaProject()
    const harnessPath = join(projectDir, ".persona", "harness.jsonc")
    const result = cli(projectDir, ["attach", "--yes"], {
      onAfterAttachCommitFile: (relativePath: string) => {
        if (relativePath === ".gitignore") {
          mkdirSync(join(projectDir, ".persona"), { recursive: true })
          writeFileSync(harnessPath, "external replacement\n")
        }
      },
    })

    expect(result.status).toBe(1)
    expect(result.stderr).toContain("Attach target changed before commit")
    expect(readFileSync(harnessPath, "utf8")).toBe("external replacement\n")
    expect(existsSync(join(projectDir, "AGENTS.md"))).toBe(false)
  })

  it("rejects invalid arguments without writing", () => {
    const projectDir = createJavaProject()
    for (const args of [
      ["attach", "--unknown"],
      ["attach", "--repair"],
      ["attach", "--yes", "--yes"],
    ]) {
      const result = cli(projectDir, args)
      expect(result.status).toBe(1)
      expect(existsSync(join(projectDir, ".persona"))).toBe(false)
    }
  })
})
