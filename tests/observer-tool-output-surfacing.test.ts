import { mkdirSync, rmSync, writeFileSync } from "node:fs"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { createPhase0Hooks } from "../src/runtime/hooks.js"
import type { ObserverReportOnlyFinding } from "../src/runtime/evidence.js"
import {
  appendObserverFindingsToToolOutput,
  formatObserverFindingsBlock,
  OBSERVER_OUTPUT_MARKER,
} from "../src/runtime/observer-report-only.js"

const fixtureWorkspace = join(process.cwd(), ".persona-observer-surfacing-fixtures")
const fixtureRoot = join(fixtureWorkspace, "src", "main", "java", "com", "example")

afterEach(() => {
  rmSync(fixtureWorkspace, { recursive: true, force: true })
})

function writeHarnessConfig(runtimeInjection: boolean, observerFindings = runtimeInjection): void {
  mkdirSync(join(fixtureWorkspace, ".persona"), { recursive: true })
  writeFileSync(
    join(fixtureWorkspace, ".persona", "harness.jsonc"),
    `${JSON.stringify({ features: { runtimeInjection, observerFindings }, enabledDomains: ["backend", "programming", "workflow"] }, null, 2)}\n`,
  )
}

function writeControllerFixture(): string {
  mkdirSync(fixtureRoot, { recursive: true })
  const targetFile = join(fixtureRoot, "OrderController.java")
  writeFileSync(
    targetFile,
    [
      "import com.example.OrderRepository;",
      "class OrderController {",
      "  private OrderRepository orderRepository;",
      "  Object all() { return orderRepository.findAll(); }",
      "}",
      "",
    ].join("\n"),
  )
  return targetFile
}

function finding(overrides: Partial<ObserverReportOnlyFinding>): ObserverReportOnlyFinding {
  return {
    ruleId: "controller.repository-dependency",
    result: "WARN",
    evidence: { fields: ["private OrderRepository orderRepository;"] },
    confidence: "HIGH",
    source: "live-hook/text",
    limitations: [],
    filePath: "src/main/java/com/example/OrderController.java",
    ...overrides,
  }
}

describe("observer findings surfaced to the acting agent", () => {
  it("formats a high-confidence finding with its concrete evidence spans", () => {
    const block = formatObserverFindingsBlock([finding({})], "OrderController.java")

    expect(block).toContain(OBSERVER_OUTPUT_MARKER)
    expect(block).toContain("OrderController.java")
    expect(block).toContain("controller.repository-dependency")
    expect(block).toContain("private OrderRepository orderRepository;")
    expect(block).toContain("Report-only")
  })

  it("omits findings below high confidence", () => {
    const block = formatObserverFindingsBlock([finding({ confidence: "MEDIUM" })], "OrderController.java")

    expect(block).toBeUndefined()
  })

  it("omits PASS findings even at high confidence", () => {
    const block = formatObserverFindingsBlock([finding({ result: "PASS" })], "OrderController.java")

    expect(block).toBeUndefined()
  })

  it("omits a high-confidence finding that carries no concrete evidence span", () => {
    const block = formatObserverFindingsBlock(
      [finding({ ruleId: "controller.service-dependency", evidence: { fields: [], methodCalls: [] } })],
      "OrderController.java",
    )

    expect(block).toBeUndefined()
  })

  it("marks truncation explicitly instead of silently dropping findings", () => {
    const many = Array.from({ length: 40 }, (_unused, index) =>
      finding({ ruleId: `rule.${index}`, evidence: { fields: [`span ${index} `.repeat(12)] } }))

    const block = formatObserverFindingsBlock(many, "OrderController.java")

    expect(block).toContain("truncated")
    expect(block?.length).toBeLessThan(2_000)
  })

  it("appends the block to tool output exactly once", () => {
    const output = { output: "written" }

    appendObserverFindingsToToolOutput(output, [finding({})], "OrderController.java")
    const afterFirst = output.output
    appendObserverFindingsToToolOutput(output, [finding({})], "OrderController.java")

    expect(afterFirst).toContain(OBSERVER_OUTPUT_MARKER)
    expect(output.output).toBe(afterFirst)
  })

  it("leaves non-string tool output untouched", () => {
    const output = { output: undefined }

    appendObserverFindingsToToolOutput(output, [finding({})], "OrderController.java")

    expect(output.output).toBeUndefined()
  })

  it("reaches the agent through tool.execute.after when runtime injection is enabled", async () => {
    writeHarnessConfig(true)
    const targetFile = writeControllerFixture()
    const hooks = createPhase0Hooks({ projectDir: fixtureWorkspace })
    const output = { title: "write", output: "ok", metadata: {} }

    await hooks["tool.execute.after"]?.(
      { tool: "write", sessionID: "session-surfacing", callID: "call-surfacing", args: { path: targetFile } },
      output,
    )

    expect(output.output).toContain(OBSERVER_OUTPUT_MARKER)
    expect(output.output).toContain("controller.repository-dependency")
    expect(output.output).toContain("orderRepository")
  })

  it("runs without the measured-negative guidance injection", async () => {
    writeHarnessConfig(false, true)
    const targetFile = writeControllerFixture()
    const hooks = createPhase0Hooks({ projectDir: fixtureWorkspace })
    const output = { title: "write", output: "ok", metadata: {} }

    await hooks["tool.execute.after"]?.(
      { tool: "write", sessionID: "session-findings-only", callID: "call-findings-only", args: { path: targetFile } },
      output,
    )

    // The guidance block is what the accepted A/B measured as negative. Findings
    // must be able to reach the agent without switching it back on.
    expect(output.output).toContain(OBSERVER_OUTPUT_MARKER)
    expect(output.output).not.toContain("[Persona Harness Injection]")
  })

  it("stays silent when both surfaces are disabled", async () => {
    writeHarnessConfig(false)
    const targetFile = writeControllerFixture()
    const hooks = createPhase0Hooks({ projectDir: fixtureWorkspace })
    const output = { title: "write", output: "ok", metadata: {} }

    await hooks["tool.execute.after"]?.(
      { tool: "write", sessionID: "session-surfacing-off", callID: "call-surfacing-off", args: { path: targetFile } },
      output,
    )

    expect(output.output).not.toContain(OBSERVER_OUTPUT_MARKER)
  })
})
