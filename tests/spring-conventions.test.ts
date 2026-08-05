import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import {
  findAstGrepBinary,
  loadAstGrepConventionDefinitions,
  runAstGrepConvention,
} from "../src/cli/ast-grep-convention-runner.js"

const tempProjects: string[] = []
const astGrepAvailable = findAstGrepBinary() !== undefined
const repoRoot = process.cwd()

afterEach(() => {
  while (tempProjects.length > 0) {
    const projectDir = tempProjects.pop()
    if (projectDir !== undefined) {
      rmSync(projectDir, { recursive: true, force: true })
    }
  }
})

function projectWithSource(source: string): string {
  const projectDir = mkdtempSync(join(tmpdir(), "persona-spring-convention-test-"))
  tempProjects.push(projectDir)
  const conventionsDir = join(projectDir, ".persona", "conventions")
  mkdirSync(conventionsDir, { recursive: true })
  for (const name of ["spring-autowired-field-injection.yml", "spring-transactional-no-proxy.yml"]) {
    writeFileSync(
      join(conventionsDir, name),
      readRepoConvention(name),
    )
  }
  const javaDir = join(projectDir, "src", "main", "java", "com", "example")
  mkdirSync(javaDir, { recursive: true })
  writeFileSync(join(javaDir, "OrderService.java"), source)
  return projectDir
}

function readRepoConvention(name: string): string {
  return readFileSync(join(repoRoot, ".persona", "conventions", name), "utf8")
}

function matchedLines(projectDir: string, conventionId: string): readonly number[] {
  const definition = loadAstGrepConventionDefinitions(projectDir).find((candidate) => candidate.id === conventionId)
  if (definition === undefined) {
    throw new Error(`convention ${conventionId} was not loaded`)
  }
  const result = runAstGrepConvention(projectDir, definition, {
    scanPath: join(projectDir, "src", "main", "java"),
  })
  return result.status === "checked" ? result.findings.map((finding) => finding.line) : []
}

const MIXED_SERVICE = [
  "package com.example;",
  "",
  "import org.springframework.beans.factory.annotation.Autowired;",
  "import org.springframework.transaction.annotation.Transactional;",
  "import org.springframework.stereotype.Service;",
  "",
  "@Service",
  "public class OrderService {",
  "",
  "    @Autowired private OrderRepository injected;",
  "",
  "    private final OrderRepository constructed;",
  "",
  "    public OrderService(OrderRepository constructed) {",
  "        this.constructed = constructed;",
  "    }",
  "",
  "    @Transactional private void hidden() {}",
  "",
  "    @Transactional public final void sealed() {}",
  "",
  "    @Transactional public void proxied() {}",
  "}",
  "",
].join("\n")

describe("Spring-specific AST conventions", () => {
  it.runIf(astGrepAvailable)("flags field injection and leaves constructor injection alone", () => {
    const projectDir = projectWithSource(MIXED_SERVICE)

    const lines = matchedLines(projectDir, "spring.autowired-field-injection")

    expect(lines).toHaveLength(1)
    expect(lines[0]).toBe(10)
  })

  it.runIf(astGrepAvailable)("flags private and final transactional methods but not a proxied one", () => {
    const projectDir = projectWithSource(MIXED_SERVICE)

    const lines = matchedLines(projectDir, "spring.transactional-no-proxy")

    // `hidden()` is private and `sealed()` is final, so neither is proxied.
    // `proxied()` is public and non-final and must not be reported.
    expect(lines).toHaveLength(2)
    expect(lines).toContain(18)
    expect(lines).toContain(20)
  })

  it.runIf(astGrepAvailable)("reports nothing for a service that follows both conventions", () => {
    const projectDir = projectWithSource([
      "package com.example;",
      "",
      "import org.springframework.transaction.annotation.Transactional;",
      "",
      "public class OrderService {",
      "",
      "    private final OrderRepository orderRepository;",
      "",
      "    public OrderService(OrderRepository orderRepository) {",
      "        this.orderRepository = orderRepository;",
      "    }",
      "",
      "    @Transactional public void place() {}",
      "}",
      "",
    ].join("\n"))

    expect(matchedLines(projectDir, "spring.autowired-field-injection")).toHaveLength(0)
    expect(matchedLines(projectDir, "spring.transactional-no-proxy")).toHaveLength(0)
  })
})
