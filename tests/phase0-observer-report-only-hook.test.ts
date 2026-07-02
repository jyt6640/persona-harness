import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { join } from "node:path"

import { afterEach, describe, expect, it, vi } from "vitest"

import { createPhase0Hooks } from "../src/runtime/hooks.js"

const fixtureWorkspace = join(process.cwd(), ".persona-observer-report-only-hook-fixtures")
const fixtureRoot = join(fixtureWorkspace, "src", "main", "java", "com", "example")

afterEach(() => {
  vi.restoreAllMocks()
  rmSync(fixtureWorkspace, { recursive: true, force: true })
})

function writeOptInHarnessConfig(): void {
  mkdirSync(join(fixtureWorkspace, ".persona"), { recursive: true })
  writeFileSync(
    join(fixtureWorkspace, ".persona", "harness.jsonc"),
    `${JSON.stringify({ features: { runtimeInjection: true }, enabledDomains: ["backend", "programming", "workflow"] }, null, 2)}\n`,
  )
}

function writeJavaFixture(fileName: string, source: string): string {
  mkdirSync(fixtureRoot, { recursive: true })
  const targetFile = join(fixtureRoot, fileName)
  writeFileSync(targetFile, source)
  return targetFile
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function evidencePayloads(): readonly Record<string, unknown>[] {
  const evidenceDir = join(fixtureWorkspace, ".persona", "evidence", "phase0")
  if (!existsSync(evidenceDir)) {
    return []
  }

  return readdirSync(evidenceDir)
    .filter((fileName) => fileName.endsWith(".json"))
    .map((fileName) => {
      const parsed: unknown = JSON.parse(readFileSync(join(evidenceDir, fileName), "utf8"))
      if (!isRecord(parsed)) {
        throw new Error(`expected evidence payload object: ${fileName}`)
      }
      return parsed
    })
}

describe("phase0 report-only observer hook", () => {
  it("writes observer evidence when a Java Service file is written", async () => {
    writeOptInHarnessConfig()
    const hooks = createPhase0Hooks({ projectDir: fixtureWorkspace })
    const sessionID = "session-observer-service"
    const targetFile = writeJavaFixture(
      "ReservationService.java",
      [
        "import java.util.Map;",
        "class ReservationService {",
        "  private final Map<Long, String> reservations;",
        "  ReservationService(Map<Long, String> reservations) {",
        "    this.reservations = reservations;",
        "  }",
        "}",
        "",
      ].join("\n"),
    )

    await hooks["tool.execute.after"]?.(
      { tool: "write", sessionID, callID: "call-observer-service", args: { path: targetFile } },
      { title: "write", output: "ok", metadata: {} },
    )

    const observerEvidence = evidencePayloads().find((payload) => payload["evidenceKind"] === "observer-report-only")
    expect(observerEvidence).toMatchObject({
      schemaVersion: "phase0.observer-report-only.1",
      hook: "tool.execute.after",
      sessionID,
      callID: "call-observer-service",
      injectedInto: "observer-report-only",
      reportOnly: true,
      enforcement: false,
      targetFile,
    })
    expect(observerEvidence?.["findings"]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ruleId: "service.storage-ownership",
          result: "WARN",
          confidence: "HIGH",
          source: "live-hook/text",
        }),
      ]),
    )
  })

  it("injects a non-blocking write guard warning for high-confidence Controller Repository dependency", async () => {
    writeOptInHarnessConfig()
    const hooks = createPhase0Hooks({ projectDir: fixtureWorkspace })
    const sessionID = "session-write-guard-controller"
    const targetFile = writeJavaFixture(
      "ReservationController.java",
      [
        "import roomescape.ReservationRepository;",
        "class ReservationController {",
        "  ReservationController(ReservationRepository repository) {",
        "  }",
        "}",
        "",
      ].join("\n"),
    )
    const output = { title: "write", output: "ok", metadata: {} }

    await hooks["tool.execute.after"]?.(
      { tool: "write", sessionID, callID: "call-write-guard-controller", args: { path: targetFile } },
      output,
    )

    expect(output.output).toContain("[Persona Harness Write Guard]")
    expect(output.output).toContain("Mode: non-blocking warning")
    expect(output.output).toContain("Rule: controller.repository-dependency")
    expect(output.output).toContain("route the Controller through a Service layer")
    expect(output.output).toContain("[Persona Harness Injection]")
  })

  it("keeps Java write hooks alive when the observer cannot read the target", async () => {
    writeOptInHarnessConfig()
    const hooks = createPhase0Hooks({ projectDir: fixtureWorkspace })
    const sessionID = "session-observer-directory"
    const targetFile = writeJavaFixture("BrokenService.java", "class BrokenService {}\n")
    rmSync(targetFile, { force: true })
    mkdirSync(targetFile, { recursive: true })
    const output = { title: "write", output: "ok", metadata: {} }
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined)

    await expect(
      hooks["tool.execute.after"]?.(
        { tool: "write", sessionID, callID: "call-observer-directory", args: { path: targetFile } },
        output,
      ),
    ).resolves.toBeUndefined()

    expect(output.output).toContain("[Persona Harness Injection]")
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("[Persona Harness Runtime Warning]"))
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("kind=observer-report-only"))
  })
})
