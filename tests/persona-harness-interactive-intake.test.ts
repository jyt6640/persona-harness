import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { runInteractiveIntakeCommand } from "../src/cli/intake.js"

const tempProjects: string[] = []

function createTempProject(): string {
  const projectDir = mkdtempSync(join(tmpdir(), "persona-interactive-intake-test-"))
  tempProjects.push(projectDir)
  return projectDir
}

function readProfile(projectDir: string): Record<string, unknown> {
  const raw = readFileSync(join(projectDir, ".persona", "project-profile.jsonc"), "utf8")
  return JSON.parse(raw) as Record<string, unknown>
}

function questionsById(profile: Record<string, unknown>): ReadonlyMap<string, string | null> {
  const questions = profile.questions
  if (!Array.isArray(questions)) {
    throw new Error("Expected profile questions")
  }

  const answers = new Map<string, string | null>()
  for (const question of questions) {
    if (
      typeof question === "object" &&
      question !== null &&
      "id" in question &&
      "answer" in question &&
      typeof question.id === "string" &&
      (typeof question.answer === "string" || question.answer === null)
    ) {
      answers.set(question.id, question.answer)
    }
  }
  return answers
}

async function runInteractiveInputs(projectDir: string, inputs: readonly string[]): Promise<{
  readonly status: number
  readonly stdout: string
  readonly stderr: string
}> {
  let cursor = 0
  let stdout = ""
  const result = await runInteractiveIntakeCommand(
    ["--interactive"],
    {
      projectDir,
      isTty: true,
      write: (text) => {
        stdout += text
      },
      readLine: () => {
        const input = inputs[cursor]
        cursor += 1
        if (input === undefined) {
          throw new Error("test input exhausted")
        }
        return Promise.resolve(input)
      },
    },
    "ph",
  )
  return { status: result.status, stdout, stderr: result.stderr }
}

afterEach(() => {
  for (const projectDir of tempProjects) {
    rmSync(projectDir, { recursive: true, force: true })
  }
  tempProjects.length = 0
})

describe("ph intake --interactive", () => {
  it("writes a profile from numeric, enter, Korean recommendation, and recommend inputs", async () => {
    const projectDir = createTempProject()

    const result = await runInteractiveInputs(projectDir, [
      "2",
      "2",
      "추천",
      "2",
      "",
      "4",
      "recommend",
      "2",
      "",
      "",
      "3",
      "관리자 기능은 이번 범위에서 제외한다.",
    ])

    expect(result.status).toBe(0)
    expect(result.stderr).toBe("")
    expect(result.stdout).toContain("Persona Harness backend project intake")
    expect(result.stdout).toContain("Persona Harness project intake profile created.")

    const profile = readProfile(projectDir)
    const answers = questionsById(profile)
    expect(answers.get("user-language")).toBe("en")
    expect(answers.get("project-context")).toBe("team")
    expect(answers.get("project-goal")).toBe("production-service")
    expect(answers.get("project-scale")).toBe("small")
    expect(answers.get("application-type")).toBe("rest-api")
    expect(answers.get("storage")).toBe("database")
    expect(answers.get("persistence-technology")).toBe("jdbc-template")
    expect(answers.get("migration-style")).toBe("flyway")
    expect(answers.get("package-style")).toBe("domain-first")
    expect(answers.get("architecture-style")).toBe("clean-architecture-light")
    expect(answers.get("boundary-strictness")).toBe("strict")
    expect(profile.notes).toEqual({ project: "관리자 기능은 이번 범위에서 제외한다." })
  })

  it("stores undecided from Korean undecided input and re-prompts invalid choices", async () => {
    const projectDir = createTempProject()

    const result = await runInteractiveInputs(projectDir, [
      "99",
      "미정",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
    ])

    expect(result.status).toBe(0)
    expect(result.stdout).toContain("다시 입력해 주세요.")
    expect(questionsById(readProfile(projectDir)).get("user-language")).toBe("undecided")
  })

  it("skips the migration prompt when persistence is not needed", async () => {
    const projectDir = createTempProject()

    const result = await runInteractiveInputs(projectDir, ["", "", "", "", "", "1", "1", "", "", "", ""])

    expect(result.status).toBe(0)
    expect(result.stdout).not.toContain("DB schema/migration 방식")

    const answers = questionsById(readProfile(projectDir))
    expect(answers.get("storage")).toBe("none")
    expect(answers.get("persistence-technology")).toBe("not-needed")
    expect(answers.get("migration-style")).toBe("not-needed")
  })

  it("does not write a partial profile when interactive intake aborts", async () => {
    const projectDir = createTempProject()
    let stdout = ""

    const result = await runInteractiveIntakeCommand(
      ["--interactive"],
      {
        projectDir,
        isTty: true,
        write: (text) => {
          stdout += text
        },
        readLine: () => {
          throw new Error("simulated abort")
        },
      },
      "ph",
    )

    expect(result.status).toBe(1)
    expect(result.stderr).toContain("Interactive intake aborted")
    expect(stdout).toContain("Persona Harness backend project intake")
    expect(existsSync(join(projectDir, ".persona", "project-profile.jsonc"))).toBe(false)
  })

  it("fails in non-TTY mode without writing a profile", async () => {
    const projectDir = createTempProject()

    const result = await runInteractiveIntakeCommand(
      ["--interactive"],
      {
        projectDir,
        isTty: false,
        write: () => {},
        readLine: () => Promise.resolve(""),
      },
      "ph",
    )

    expect(result.status).toBe(1)
    expect(result.stderr).toContain("Interactive intake requires a TTY")
    expect(existsSync(join(projectDir, ".persona", "project-profile.jsonc"))).toBe(false)
  })
})
