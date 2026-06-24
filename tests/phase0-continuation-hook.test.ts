import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { join } from "node:path"

import { beforeEach, describe, expect, it } from "vitest"

import { createPhase0Hooks } from "../src/runtime/hooks.js"
import type { TextCompleteOutput } from "../src/runtime/types.js"

const fixtureWorkspace = join(process.cwd(), ".persona-continuation-test-fixtures")

beforeEach(() => {
  rmSync(fixtureWorkspace, { recursive: true, force: true })
  mkdirSync(join(fixtureWorkspace, ".persona", "workflow"), { recursive: true })
  writeFileSync(
    join(fixtureWorkspace, ".persona", "harness.jsonc"),
    `${JSON.stringify({ enabledDomains: ["backend", "programming", "workflow"] }, null, 2)}\n`,
  )
})

function writeImplementationReport(body: string): void {
  writeFileSync(join(fixtureWorkspace, ".persona", "workflow", "implementation-report.md"), body)
}

function writeBacklog(body: string): void {
  writeFileSync(join(fixtureWorkspace, ".persona", "workflow", "backlog.md"), body)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function continuationPayloads(): readonly Record<string, unknown>[] {
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
    .filter((payload) => payload.schemaVersion === "phase0.continuation.1")
}

async function completeText(sessionID: string, text: string): Promise<TextCompleteOutput> {
  const hooks = createPhase0Hooks({ projectDir: fixtureWorkspace })
  const output: TextCompleteOutput = { text }
  await hooks["experimental.text.complete"]?.(
    {
      sessionID,
      messageID: `message-${sessionID}`,
      partID: `part-${sessionID}`,
    },
    output,
  )
  return output
}

describe("continuation hook", () => {
  it("appends continuation guidance and evidence when implementation report still has remaining scope", async () => {
    writeImplementationReport(`# Implementation Report

- 상태: filled
- 완료 요구사항: Step 1
- 미완료 요구사항: Step 2 iCal
- 남은 README/plan 범위: README.md 120-260
- 남은 구현 범위: Step 2-7
- 다음 프롬프트 힌트: Step 2부터 이어서 구현
`)
    writeBacklog(`| order | id | title | status | path |
| --- | --- | --- | --- | --- |
| 1 | step-1 | Basic Schedule | done | .persona/workflow/work/step-1/00-task-card.md |
| 2 | step-2 | iCal Import/Export | pending | .persona/workflow/work/step-2/00-task-card.md |
`)

    const output = await completeText("session-continuation", "구현 완료했습니다.")

    expect(output.text).toContain("[Persona Harness Continuation]")
    expect(output.text).toContain("Next pending ticket: iCal Import/Export")
    expect(output.text).toContain("Task card: .persona/workflow/work/step-2/00-task-card.md")
    expect(output.text).toContain("Remaining README/plan range: README.md 120-260")
    expect(output.text).toContain("Remaining scope: Step 2-7")
    expect(output.text).toContain("Next prompt hint: Step 2부터 이어서 구현")

    expect(continuationPayloads()).toContainEqual(
      expect.objectContaining({
        schemaVersion: "phase0.continuation.1",
        finding: "WARN",
        pendingTicket: "iCal Import/Export",
        pendingTicketPath: ".persona/workflow/work/step-2/00-task-card.md",
        remainingReadRange: "README.md 120-260",
        remainingScope: "Step 2-7",
        nextPromptHint: "Step 2부터 이어서 구현",
        reportOnly: true,
      }),
    )
  })

  it("appends continuation guidance when output claims completion while backlog still has a pending ticket", async () => {
    writeImplementationReport(`# Implementation Report

- 상태: filled
- 미완료 요구사항: 없음
- 남은 README/plan 범위: 없음
- 남은 구현 범위: 없음
- 다음 프롬프트 힌트: 없음
`)
    writeBacklog(`| order | id | title | status | path |
| --- | --- | --- | --- | --- |
| 2 | step-2 | iCal Import/Export | pending | .persona/workflow/work/step-2/00-task-card.md |
`)

    const output = await completeText("session-pending-ticket", "All done.")

    expect(output.text).toContain("[Persona Harness Continuation]")
    expect(output.text).toContain("Assistant output looks complete while workflow backlog still has pending tickets.")
    expect(output.text).toContain("Next pending ticket: iCal Import/Export")
  })

  it("does not append continuation guidance when no remaining scope or pending ticket exists", async () => {
    writeImplementationReport(`# Implementation Report

- 상태: filled
- 미완료 요구사항: 없음
- 남은 README/plan 범위: 없음
- 남은 구현 범위: 없음
- 다음 프롬프트 힌트: 없음
`)
    writeBacklog(`| order | id | title | status | path |
| --- | --- | --- | --- | --- |
| 1 | step-1 | Basic Schedule | done | .persona/workflow/work/step-1/00-task-card.md |
`)

    const output = await completeText("session-complete", "구현 완료했습니다.")

    expect(output.text).not.toContain("[Persona Harness Continuation]")
    expect(continuationPayloads()).toEqual([])
  })
})
