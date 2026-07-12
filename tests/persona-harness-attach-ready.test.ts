import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { runPersonaCli } from "../src/cli/index.js"

const projects: string[] = []

function createJavaProject(): string {
  const projectDir = mkdtempSync(join(tmpdir(), "persona-attach-ready-test-"))
  projects.push(projectDir)
  writeFileSync(join(projectDir, "settings.gradle"), "rootProject.name = 'tasks'\n")
  writeFileSync(
    join(projectDir, "build.gradle"),
    "plugins { id 'java'; id 'org.springframework.boot' version '3.5.0' }\n",
  )
  const sourceDir = join(projectDir, "src", "main", "java", "com", "example", "tasks")
  mkdirSync(sourceDir, { recursive: true })
  writeFileSync(join(sourceDir, "TasksApplication.java"), "package com.example.tasks;\n")
  return projectDir
}

function attach(projectDir: string, args: readonly string[]) {
  return runPersonaCli(args, {
    cwd: projectDir,
    env: {},
    invocationName: "ph",
    packageRoot: process.cwd(),
  })
}

afterEach(() => {
  for (const projectDir of projects) {
    rmSync(projectDir, { recursive: true, force: true })
  }
  projects.length = 0
})

describe("ph attach ready installation", () => {
  it("reports ready and rejects unnecessary repair without writes", () => {
    const projectDir = createJavaProject()
    expect(attach(projectDir, ["attach", "--yes"]).status).toBe(0)
    const trackedPaths = [
      "AGENTS.md",
      ".persona/harness.jsonc",
      ".persona/project-profile.jsonc",
      ".persona/workflow/plan.md",
      ".persona/workflow/implementation-report.md",
      ".persona/workflow/review-report.md",
    ]
    const before = new Map(trackedPaths.map((path) => [path, readFileSync(join(projectDir, path), "utf8")]))

    const ordinary = attach(projectDir, ["attach", "--yes"])
    expect(ordinary.status).toBe(0)
    expect(ordinary.stdout).toContain("already prepared and ready")
    expect(ordinary.stdout).not.toContain("--repair")

    const repair = attach(projectDir, ["attach", "--repair", "--yes"])
    expect(repair.status).toBe(1)
    expect(repair.stderr).toContain("already prepared with strong enforcement")
    expect(repair.stderr).not.toContain("attach --repair")

    for (const [path, content] of before) {
      expect(readFileSync(join(projectDir, path), "utf8")).toBe(content)
    }
  })
})
