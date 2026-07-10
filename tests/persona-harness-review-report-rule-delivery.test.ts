import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { runPersonaCli } from "../src/cli/index.js"
import { selectRulesForDelivery } from "../src/rules/rule-delivery.js"

const tempProjects: string[] = []

function createProject(): string {
  const projectDir = mkdtempSync(join(tmpdir(), "persona-review-report-delivery-test-"))
  tempProjects.push(projectDir)
  mkdirSync(join(projectDir, ".persona", "workflow"), { recursive: true })
  writeFileSync(join(projectDir, ".persona", "workflow", "plan.md"), "Status: accepted\n")
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
  writeFileSync(join(projectDir, ".persona", "workflow", "review-report.md"), "Status: template\n")
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
  writeFileSync(
    join(projectDir, ".persona", "harness.jsonc"),
    `${JSON.stringify({ maxRulesPerInjection: 10 }, null, 2)}\n`,
  )
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
          "BUILD SUCCESSFUL",
        ].join("\n"),
      },
      null,
      2,
    )}\n`,
  )
  return projectDir
}

function writeRule(projectDir: string, path: string, topic: string, policy: string): void {
  const fullPath = join(projectDir, ".persona", "rules", path)
  mkdirSync(dirname(fullPath), { recursive: true })
  writeFileSync(
    fullPath,
    [
      "---",
      `id: backend.${topic}`,
      "source: backend-policy",
      "domain: common",
      `topic: ${topic}`,
      "roles:",
      "  - reviewer",
      "globs:",
      '  - "**/*.md"',
      "severity: should",
      "enforcement: inject_only",
      "---",
      "",
      "# Test Rule",
      "",
      `- ${policy}`,
      "",
    ].join("\n"),
  )
}

function writeReviewerRules(projectDir: string): void {
  writeRule(projectDir, "backend/reviewer-workflow.md", "feature-workflow", "reviewer workflow/report policy")
  writeRule(projectDir, "backend/reviewer-review.md", "code-review", "review quality policy")
  writeRule(projectDir, "backend/reviewer-refactoring.md", "refactoring", "review refactoring policy")
}

afterEach(() => {
  for (const projectDir of tempProjects) {
    rmSync(projectDir, { recursive: true, force: true })
  }
  tempProjects.length = 0
})

describe("review-report rule delivery", () => {
  it("selects review and refactoring candidates instead of workflow/report-only candidates", () => {
    const projectDir = createProject()
    writeReviewerRules(projectDir)

    const delivery = selectRulesForDelivery(projectDir, "reviewer", { stage: "review" })

    expect(delivery.rules.map((rule) => rule.path)).toEqual([
      "backend/reviewer-refactoring.md",
      "backend/reviewer-review.md",
    ])
    expect(delivery.rules.map((rule) => rule.path)).not.toContain("backend/reviewer-workflow.md")
  })

  it("uses review-stage guidance for the closure-generated review-report blocker", () => {
    const projectDir = createProject()
    writeReviewerRules(projectDir)

    const result = runPersonaCli(["workflow", "loop", "--dry-run", "--json"], {
      cwd: projectDir,
      env: {},
      invocationName: "ph",
    })
    const output = JSON.parse(result.stdout)
    const prompt = output.promptPreview.join("\n")

    expect(result.status).toBe(0)
    expect(prompt).toContain("Blocker: review-report-missing (blocker 1/")
    expect(prompt).toContain("Scoped PH rules (role: reviewer, stage: review")
    expect(prompt).toContain("review quality policy")
    expect(prompt).toContain("review refactoring policy")
    expect(prompt).not.toContain("reviewer workflow/report policy")
    expect(existsSync(join(projectDir, ".persona", "workflow", "workflow-loop-state.json"))).toBe(false)
  })
})
