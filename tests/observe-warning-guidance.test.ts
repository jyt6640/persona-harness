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

function projectWith(files: Readonly<Record<string, string>>): string {
  const projectDir = mkdtempSync(join(tmpdir(), "persona-observe-guidance-test-"))
  tempProjects.push(projectDir)
  mkdirSync(join(projectDir, ".persona"), { recursive: true })
  writeFileSync(
    join(projectDir, ".persona", "harness.jsonc"),
    `${JSON.stringify({ enabledDomains: ["backend", "programming", "workflow"] }, null, 2)}\n`,
  )
  const javaDir = join(projectDir, "src", "main", "java", "com", "example")
  mkdirSync(javaDir, { recursive: true })
  for (const [name, source] of Object.entries(files)) {
    writeFileSync(join(javaDir, name), source)
  }
  return projectDir
}

type Finding = Record<string, unknown>

function observe(projectDir: string): { readonly findings: readonly Finding[]; readonly text: string } {
  const result = runPersonaCli(["observe", "--json", "src/main/java"], {
    cwd: projectDir,
    env: {},
    invocationName: "ph",
  })
  const start = result.stdout.indexOf("{")
  expect(start).toBeGreaterThanOrEqual(0)
  const report = JSON.parse(result.stdout.slice(start)) as { findings?: readonly Finding[] }
  return { findings: report.findings ?? [], text: result.stdout }
}

function byRule(findings: readonly Finding[], ruleId: string): Finding {
  const finding = findings.find((candidate) => candidate["ruleId"] === ruleId)
  if (finding === undefined) {
    throw new Error(`no finding for ${ruleId}`)
  }
  return finding
}

const REPOSITORY_CONTROLLER = [
  "package com.example;",
  "",
  "import org.springframework.web.bind.annotation.RestController;",
  "",
  "@RestController",
  "public class OrderController {",
  "",
  "    private final OrderRepository orderRepository;",
  "",
  "    public OrderController(OrderRepository orderRepository) {",
  "        this.orderRepository = orderRepository;",
  "    }",
  "",
  "    public Object one() { return orderRepository.findById(1L); }",
  "}",
  "",
].join("\n")

// Spring's own reference application ships Controllers shaped like this.
const VIEW_ONLY_CONTROLLER = [
  "package com.example;",
  "",
  "import org.springframework.stereotype.Controller;",
  "import org.springframework.web.bind.annotation.GetMapping;",
  "",
  "@Controller",
  "class WelcomeController {",
  "",
  "    private static final String VIEW = \"welcome\";",
  "",
  "    @GetMapping(\"/\")",
  "    public String welcome() {",
  "        return VIEW;",
  "    }",
  "}",
  "",
].join("\n")

describe("observe explains its warnings", () => {
  it("gives a Controller that uses a Repository directly a reason and a fix", () => {
    const { findings } = observe(projectWith({ "OrderController.java": REPOSITORY_CONTROLLER }))

    const finding = byRule(findings, "controller.repository-dependency")

    expect(finding["result"]).toBe("WARN")
    expect(String(finding["message"])).toContain("Repository directly")
    expect(String(finding["fixPath"]).length).toBeGreaterThan(0)
  })

  it("distinguishes the two Controller rules that fire on the same file", () => {
    const { findings } = observe(projectWith({ "OrderController.java": REPOSITORY_CONTROLLER }))

    // One warns because a Repository is present, the other because a Service is
    // absent. Sharing a rendering made them indistinguishable to a reader.
    const repository = byRule(findings, "controller.repository-dependency")
    const service = byRule(findings, "controller.service-dependency")

    expect(repository["result"]).toBe("WARN")
    expect(service["result"]).toBe("WARN")
    expect(repository["message"]).not.toBe(service["message"])
  })

  it("prints the reason and fix in the human summary", () => {
    const projectDir = projectWith({ "OrderController.java": REPOSITORY_CONTROLLER })

    // `--json` suppresses the human summary, so this is the unflagged surface.
    const result = runPersonaCli(["observe", "src/main/java"], {
      cwd: projectDir,
      env: {},
      invocationName: "ph",
    })

    expect(result.stdout).toContain("    why: ")
    expect(result.stdout).toContain("    fix: ")
  })

  it("does not attach a fix path to a finding that passed", () => {
    const { findings } = observe(projectWith({
      "OrderController.java": [
        "package com.example;",
        "",
        "import org.springframework.web.bind.annotation.RestController;",
        "",
        "@RestController",
        "public class OrderController {",
        "",
        "    private final OrderService orderService;",
        "",
        "    public OrderController(OrderService orderService) {",
        "        this.orderService = orderService;",
        "    }",
        "}",
        "",
      ].join("\n"),
    }))

    const service = byRule(findings, "controller.service-dependency")

    expect(service["result"]).toBe("PASS")
    expect(service["fixPath"]).toBeUndefined()
    expect(service["message"]).toBeUndefined()
  })
})

describe("a Controller that injects nothing", () => {
  it("is not reported as missing a Service layer", () => {
    const { findings } = observe(projectWith({ "WelcomeController.java": VIEW_ONLY_CONTROLLER }))

    const service = byRule(findings, "controller.service-dependency")

    // There is no orchestration in the file to place anywhere, so claiming the
    // Service layer is missing asserts something the source cannot show.
    expect(service["result"]).toBe("UNKNOWN")
  })

  it("still reports a Controller that injects a non-Service collaborator", () => {
    const { findings } = observe(projectWith({ "OrderController.java": REPOSITORY_CONTROLLER }))

    // A Repository is a collaborator, so the missing Service remains observable.
    expect(byRule(findings, "controller.service-dependency")["result"]).toBe("WARN")
  })
})
