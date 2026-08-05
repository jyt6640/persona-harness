import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { findAstGrepBinary } from "../src/cli/ast-grep-convention-runner.js"
import { createPhase0Hooks } from "../src/runtime/hooks.js"
import { OBSERVER_OUTPUT_MARKER } from "../src/runtime/observer-report-only.js"

const tempProjects: string[] = []
const astGrepAvailable = findAstGrepBinary() !== undefined

afterEach(() => {
  while (tempProjects.length > 0) {
    const projectDir = tempProjects.pop()
    if (projectDir !== undefined) {
      rmSync(projectDir, { recursive: true, force: true })
    }
  }
})

function createProject(conventions: readonly { readonly name: string; readonly body: string }[]): string {
  const projectDir = mkdtempSync(join(tmpdir(), "persona-astgrep-hook-test-"))
  tempProjects.push(projectDir)
  mkdirSync(join(projectDir, ".persona", "conventions"), { recursive: true })
  writeFileSync(
    join(projectDir, ".persona", "harness.jsonc"),
    `${JSON.stringify({ features: { runtimeInjection: true }, enabledDomains: ["backend", "programming", "workflow"] }, null, 2)}\n`,
  )
  for (const convention of conventions) {
    writeFileSync(join(projectDir, ".persona", "conventions", convention.name), convention.body)
  }
  return projectDir
}

function writeJava(projectDir: string, fileName: string, source: string): string {
  const dir = join(projectDir, "src", "main", "java", "com", "example")
  mkdirSync(dir, { recursive: true })
  const target = join(dir, fileName)
  writeFileSync(target, source)
  return target
}

const SQL_CONCATENATION_CONVENTION = {
  name: "java-sql-string-concatenation.yml",
  body: [
    "id: java.sql-string-concatenation",
    "language: Java",
    "message: SQL built by string concatenation is injectable; bind parameters instead.",
    "# persona-harness-level: warn",
    "# persona-harness-high-precision: true",
    "rule:",
    "  any:",
    "    - pattern: $RECEIVER.createNativeQuery($LEFT + $RIGHT)",
    "",
  ].join("\n"),
}

const INJECTABLE_CONTROLLER = [
  "package com.example;",
  "import jakarta.persistence.EntityManager;",
  "class OrderController {",
  "  EntityManager em;",
  "  Object search(String name) {",
  "    return em.createNativeQuery(\"SELECT * FROM orders WHERE n = '\" + name + \"'\").getResultList();",
  "  }",
  "}",
  "",
].join("\n")

describe("AST conventions in the runtime observer hook", () => {
  it.runIf(astGrepAvailable)("surfaces an AST convention match to the acting agent", async () => {
    const projectDir = createProject([SQL_CONCATENATION_CONVENTION])
    const targetFile = writeJava(projectDir, "OrderController.java", INJECTABLE_CONTROLLER)
    const hooks = createPhase0Hooks({ projectDir })
    const output = { title: "write", output: "ok", metadata: {} }

    await hooks["tool.execute.after"]?.(
      { tool: "write", sessionID: "session-astgrep", callID: "call-astgrep", args: { path: targetFile } },
      output,
    )

    expect(output.output).toContain(OBSERVER_OUTPUT_MARKER)
    expect(output.output).toContain("java.sql-string-concatenation")
    expect(output.output).toContain("injectable")
  })

  it.runIf(astGrepAvailable)("does not report a convention that the written file satisfies", async () => {
    const projectDir = createProject([SQL_CONCATENATION_CONVENTION])
    const targetFile = writeJava(
      projectDir,
      "SafeController.java",
      [
        "package com.example;",
        "import jakarta.persistence.EntityManager;",
        "class SafeController {",
        "  EntityManager em;",
        "  Object search(String name) {",
        "    return em.createNativeQuery(\"SELECT * FROM orders WHERE n = ?1\").setParameter(1, name).getResultList();",
        "  }",
        "}",
        "",
      ].join("\n"),
    )
    const hooks = createPhase0Hooks({ projectDir })
    const output = { title: "write", output: "ok", metadata: {} }

    await hooks["tool.execute.after"]?.(
      { tool: "write", sessionID: "session-astgrep-safe", callID: "call-astgrep-safe", args: { path: targetFile } },
      output,
    )

    expect(output.output).not.toContain("java.sql-string-concatenation")
  })

  it("leaves the tool call working when no AST convention is defined", async () => {
    const projectDir = createProject([])
    const targetFile = writeJava(projectDir, "PlainController.java", INJECTABLE_CONTROLLER)
    const hooks = createPhase0Hooks({ projectDir })
    const output = { title: "write", output: "ok", metadata: {} }

    await hooks["tool.execute.after"]?.(
      { tool: "write", sessionID: "session-astgrep-none", callID: "call-astgrep-none", args: { path: targetFile } },
      output,
    )

    expect(output.output).not.toContain("java.sql-string-concatenation")
    expect(output.output.startsWith("ok")).toBe(true)
  })
})
