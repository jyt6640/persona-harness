import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { createPhase0Hooks } from "../src/phase0/hooks.js"
import type { TransformMessagesOutput } from "../src/phase0/types.js"

const tempProjects: string[] = []

function createTempProject(): string {
  const projectDir = mkdtempSync(join(tmpdir(), "persona-role-discovery-"))
  tempProjects.push(projectDir)
  return projectDir
}

function evidencePayloads(projectDir: string): readonly Record<string, unknown>[] {
  const evidenceDir = join(projectDir, ".persona", "evidence", "phase0")
  if (!existsSync(evidenceDir)) {
    return []
  }

  return readdirSync(evidenceDir)
    .filter((fileName) => fileName.endsWith(".json"))
    .map((fileName) => JSON.parse(readFileSync(join(evidenceDir, fileName), "utf8")))
    .filter((payload): payload is Record<string, unknown> => {
      return typeof payload === "object" && payload !== null && !Array.isArray(payload)
    })
}

function modelInput(sessionID: string, prompt = "계속 구현해줘."): TransformMessagesOutput {
  return {
    messages: [
      {
        info: {
          id: "message-1",
          sessionID,
          role: "user",
          time: { created: Date.now() },
          agent: "build",
          model: {
            providerID: "test",
            modelID: "test-model",
          },
        },
        parts: [
          {
            id: "part-1",
            sessionID,
            messageID: "message-1",
            type: "text",
            text: prompt,
          },
        ],
      },
    ],
  }
}

function firstText(output: TransformMessagesOutput): string {
  const part = output.messages[0]?.parts[0]
  return part?.type === "text" ? part.text : ""
}

afterEach(() => {
  for (const projectDir of tempProjects) {
    rmSync(projectDir, { recursive: true, force: true })
  }
  tempProjects.length = 0
})

describe("Phase 0 Java role discovery", () => {
  it("records role evidence from glob output for Controller, Repository, and DTO Java files", async () => {
    const projectDir = createTempProject()
    const hooks = createPhase0Hooks({ projectDir })
    const toolOutput = {
      title: "Glob",
      output: [
        "src/main/java/com/example/library/presentation/BookController.java",
        "src/main/java/com/example/library/application/BookService.java",
        "src/main/java/com/example/library/domain/Book.java",
        "src/main/java/com/example/library/domain/BookRepository.java",
        "src/main/java/com/example/library/infrastructure/JdbcBookRepository.java",
        "src/main/java/com/example/library/global/error/BookNotFoundException.java",
        "src/main/java/com/example/library/presentation/dto/request/CreateBookRequest.java",
        "src/main/java/com/example/library/presentation/dto/response/BookResponse.java",
        "src/test/java/com/example/library/BookControllerTest.java",
      ].join("\n"),
      metadata: {},
    }

    await hooks["tool.execute.after"]?.(
      {
        tool: "glob",
        sessionID: "role-discovery-session",
        callID: "role-discovery-call",
        args: { pattern: "src/main/java/**/*.java" },
      },
      toolOutput,
    )

    expect(toolOutput.output).toContain("[Persona Harness Java Role Discovery]")
    expect(toolOutput.output).toContain("controller: src/main/java/com/example/library/presentation/BookController.java")
    expect(toolOutput.output).toContain("service: src/main/java/com/example/library/application/BookService.java")
    expect(toolOutput.output).toContain("domain: src/main/java/com/example/library/domain/Book.java")
    expect(toolOutput.output).toContain("repository: src/main/java/com/example/library/domain/BookRepository.java")
    expect(toolOutput.output).toContain("exception: src/main/java/com/example/library/global/error/BookNotFoundException.java")
    expect(toolOutput.output).toContain(
      "request-dto: src/main/java/com/example/library/presentation/dto/request/CreateBookRequest.java",
    )
    expect(toolOutput.output).toContain(
      "response-dto: src/main/java/com/example/library/presentation/dto/response/BookResponse.java",
    )
    expect(toolOutput.output).toContain("test: src/test/java/com/example/library/BookControllerTest.java")

    const roles = evidencePayloads(projectDir).map((payload) => payload.fileRole)

    expect(roles).toEqual(
      expect.arrayContaining([
        "controller",
        "service",
        "domain",
        "repository",
        "exception",
        "request-dto",
        "response-dto",
        "test",
      ]),
    )
  })

  it("injects a follow-up read plan into the next model input for discovered role files", async () => {
    const projectDir = createTempProject()
    const hooks = createPhase0Hooks({ projectDir })
    const sessionID = "role-read-followup-session"
    const toolOutput = {
      title: "Glob",
      output: [
        "src/main/java/com/example/library/presentation/BookController.java",
        "src/main/java/com/example/library/application/BookService.java",
        "src/main/java/com/example/library/domain/BookRepository.java",
        "src/main/java/com/example/library/infrastructure/JdbcBookRepository.java",
        "src/main/java/com/example/library/presentation/dto/request/CreateBookRequest.java",
        "src/main/java/com/example/library/presentation/dto/response/BookResponse.java",
      ].join("\n"),
      metadata: {},
    }

    await hooks["tool.execute.after"]?.(
      {
        tool: "glob",
        sessionID,
        callID: "role-read-followup-call",
        args: { pattern: "src/main/java/**/*.java" },
      },
      toolOutput,
    )

    const output = modelInput(sessionID)
    await hooks["experimental.chat.messages.transform"]?.({}, output)

    const text = firstText(output)
    expect(text).toContain("[Persona Harness Java Role Read Follow-up]")
    expect(text).toContain("read src/main/java/com/example/library/presentation/BookController.java")
    expect(text).toContain("read src/main/java/com/example/library/application/BookService.java")
    expect(text).toContain("read src/main/java/com/example/library/domain/BookRepository.java")
    expect(text).toContain("read src/main/java/com/example/library/infrastructure/JdbcBookRepository.java")
    expect(text).toContain("read src/main/java/com/example/library/presentation/dto/request/CreateBookRequest.java")
    expect(text).toContain("read src/main/java/com/example/library/presentation/dto/response/BookResponse.java")
    expect(text).toContain("역할별 rule injection을 실제 model input에 태운다")

    const payloads = evidencePayloads(projectDir)
    expect(payloads).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fileRole: "java-common",
          injectedInto: "model-input",
          targetFile: "<java-role-read-follow-up>",
        }),
      ]),
    )
  })
})
