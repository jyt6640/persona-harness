import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { runPersonaCli } from "../src/cli/index.js"

const tempProjects: string[] = []

afterEach(() => {
  while (tempProjects.length > 0) {
    const projectDir = tempProjects.pop()
    if (projectDir !== undefined) {
      rmSync(projectDir, { recursive: true, force: true })
    }
  }
})

const CONTROLLER = [
  "package com.example;",
  "",
  "import jakarta.persistence.EntityManager;",
  "import org.springframework.beans.factory.annotation.Autowired;",
  "import org.springframework.web.bind.annotation.RestController;",
  "",
  "@RestController",
  "public class OrderController {",
  "",
  "    @Autowired private OrderRepository orderRepository;",
  "",
  "    private EntityManager em;",
  "",
  "    public Object all() { return orderRepository.findAll(); }",
  "}",
  "",
].join("\n")

function projectWithController(): string {
  const projectDir = mkdtempSync(join(tmpdir(), "persona-observe-paths-"))
  tempProjects.push(projectDir)
  mkdirSync(join(projectDir, ".persona"), { recursive: true })
  writeFileSync(
    join(projectDir, ".persona", "harness.jsonc"),
    `${JSON.stringify({ enabledDomains: ["backend", "programming", "workflow"] }, null, 2)}\n`,
  )
  const javaDir = join(projectDir, "src", "main", "java", "com", "example")
  mkdirSync(javaDir, { recursive: true })
  writeFileSync(join(javaDir, "OrderController.java"), CONTROLLER)
  return projectDir
}

function report(projectDir: string): Record<string, unknown> {
  const result = runPersonaCli(["observe", "--json", "src/main/java"], {
    cwd: projectDir,
    env: {},
    invocationName: "ph",
  })
  const start = result.stdout.indexOf("{")
  expect(start).toBeGreaterThanOrEqual(0)
  return JSON.parse(result.stdout.slice(start)) as Record<string, unknown>
}

/**
 * `relative()` yields backslashes on Windows while ast-grep always emits forward
 * slashes, so one report described the same file two ways:
 *
 *   controller.repository-dependency   src\main\java\…\OrderController.java
 *   spring.autowired-field-injection   src/main/java/…/OrderController.java
 *
 * Anything grouping findings by `filePath` saw two files. Measured on a real
 * Windows host; invisible on POSIX, where both forms coincide.
 */
describe("observe reports one path form", () => {
  // One observe run, three assertions. `observe` spawns ast-grep per
  // convention, and running it once per assertion in the parallel project group
  // starved an unrelated test into a timeout.
  it("uses one POSIX path form across the whole report", () => {
    const value = report(projectWithController())
    const findings = (value["findings"] ?? []) as readonly Record<string, unknown>[]
    const inspected = (value["inspectedFiles"] ?? []) as readonly string[]

    const paths = [String(value["targetPath"]), ...inspected, ...findings.map((f) => String(f["filePath"]))]
    for (const path of paths) {
      expect(path).not.toContain("\\")
    }

    // The controller draws both text-observer and ast-grep findings when
    // ast-grep is available, and text-observer findings alone when it is not.
    // Either way one source file must produce exactly one path.
    const findingPaths = new Set(findings.map((f) => String(f["filePath"])))
    expect(findingPaths.size).toBe(1)
    expect([...findingPaths][0]).toBe("src/main/java/com/example/OrderController.java")

    // And the report's own file list must use the same form it reports findings in.
    const inspectedSet = new Set(inspected)
    for (const finding of findings) {
      expect(inspectedSet.has(String(finding["filePath"]))).toBe(true)
    }
  })
})
