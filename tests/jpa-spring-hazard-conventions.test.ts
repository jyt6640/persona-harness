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

const CONVENTIONS = [
  "jpa-entity-lombok-data.yml",
  "spring-controller-unbounded-find-all.yml",
] as const

afterEach(() => {
  while (tempProjects.length > 0) {
    const projectDir = tempProjects.pop()
    if (projectDir !== undefined) {
      rmSync(projectDir, { recursive: true, force: true })
    }
  }
})

function projectWith(fileName: string, source: string): string {
  const projectDir = mkdtempSync(join(tmpdir(), "persona-jpa-hazard-test-"))
  tempProjects.push(projectDir)
  const conventionsDir = join(projectDir, ".persona", "conventions")
  mkdirSync(conventionsDir, { recursive: true })
  for (const name of CONVENTIONS) {
    writeFileSync(join(conventionsDir, name), readFileSync(join(repoRoot, ".persona", "conventions", name), "utf8"))
  }
  const javaDir = join(projectDir, "src", "main", "java", "com", "example")
  mkdirSync(javaDir, { recursive: true })
  writeFileSync(join(javaDir, fileName), source)
  return projectDir
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

describe("JPA and Spring hazard conventions", () => {
  it.runIf(astGrepAvailable)("flags @Data on an @Entity and leaves a plain entity alone", () => {
    const projectDir = projectWith("Order.java", [
      "package com.example;",
      "",
      "import lombok.Data;",
      "import jakarta.persistence.*;",
      "",
      "@Data",
      "@Entity",
      "class Order { @Id private Long id; }",
      "",
      "@Entity",
      "class Invoice { @Id private Long id; }",
      "",
    ].join("\n"))

    // Lombok's generated equals/hashCode covers the generated id and every lazy
    // association, which breaks identity for a managed entity.
    expect(matchedLines(projectDir, "jpa.entity-lombok-data")).toHaveLength(1)
  })

  it.runIf(astGrepAvailable)("flags an unbounded findAll in a Controller but not a paged one", () => {
    const projectDir = projectWith("OrderController.java", [
      "package com.example;",
      "",
      "import org.springframework.data.domain.Pageable;",
      "import org.springframework.web.bind.annotation.*;",
      "",
      "@RestController",
      "class OrderController {",
      "    private OrderRepository repo;",
      "    @GetMapping(\"/all\") public Object all() { return repo.findAll(); }",
      "    @GetMapping(\"/page\") public Object page(Pageable p) { return repo.findAll(p); }",
      "}",
      "",
    ].join("\n"))

    const lines = matchedLines(projectDir, "spring.controller-unbounded-find-all")

    expect(lines).toHaveLength(1)
    expect(lines[0]).toBe(9)
  })

  it.runIf(astGrepAvailable)("reports nothing for sources that follow both conventions", () => {
    const projectDir = projectWith("OrderController.java", [
      "package com.example;",
      "",
      "import org.springframework.data.domain.Pageable;",
      "import org.springframework.web.bind.annotation.*;",
      "",
      "@RestController",
      "class OrderController {",
      "    private final OrderRepository repo;",
      "    OrderController(OrderRepository repo) { this.repo = repo; }",
      "    @GetMapping public Object page(Pageable p) { return repo.findAll(p); }",
      "}",
      "",
    ].join("\n"))

    expect(matchedLines(projectDir, "jpa.entity-lombok-data")).toHaveLength(0)
    expect(matchedLines(projectDir, "spring.controller-unbounded-find-all")).toHaveLength(0)
  })
})
