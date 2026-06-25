import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { runPersonaCli } from "../src/cli/index.js"

const tempProjects: string[] = []

function createTempProject(): string {
  const projectDir = mkdtempSync(join(tmpdir(), "persona-plan-prompt-test-"))
  tempProjects.push(projectDir)
  return projectDir
}

function createProfiledTempProject(): string {
  const projectDir = createTempProject()
  const result = runPersonaCli(["intake", "--default", "backend"], { cwd: projectDir, env: {}, invocationName: "ph" })
  expect(result.status).toBe(0)
  return projectDir
}

afterEach(() => {
  for (const projectDir of tempProjects) {
    rmSync(projectDir, { recursive: true, force: true })
  }
  tempProjects.length = 0
})

describe("ph plan prompt and usage output", () => {
  it("prints an implementation prompt after the workflow plan is accepted", () => {
    const projectDir = createProfiledTempProject()
    const draft = runPersonaCli(["plan"], { cwd: projectDir, env: {}, invocationName: "ph" })
    const accepted = runPersonaCli(["plan", "--accept"], { cwd: projectDir, env: {}, invocationName: "ph" })

    const implement = runPersonaCli(["plan", "--implement"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(draft.status).toBe(0)
    expect(accepted.status).toBe(0)
    expect(implement.status).toBe(0)
    expect(implement.stderr).toBe("")
    expect(implement.stdout).toContain("Persona Harness implementation gate passed.")
    expect(implement.stdout).toContain("Status: accepted")
    expect(implement.stdout).toContain("README.md")
    expect(implement.stdout).toContain(".persona/project-profile.jsonc")
    expect(implement.stdout).toContain(".persona/policies")
    expect(implement.stdout).toContain(".persona/workflow/plan.md")
    expect(implement.stdout).toContain("node_modules, .opencode, .persona/rules, .persona/evidence")
    expect(implement.stdout).toContain(".persona/rules를 직접 열어 규칙 원문을 읽지 마")
    expect(implement.stdout).toContain("package/vendor/setup 문서를 구현 컨텍스트로 읽지 마")
    expect(implement.stdout).toContain("codegraph MCP를 먼저 사용해줘")
    expect(implement.stdout).toContain("codegraph MCP first for code structure analysis")
    expect(implement.stdout).toContain("기존 Java/Spring 코드가 있으면")
    expect(implement.stdout).toContain("existing code wins over greenfield guidance")
    expect(implement.stdout).toContain(".persona/workflow/implementation-report.md")
    expect(implement.stdout).toContain(".persona/workflow/review-report.md")
    expect(implement.stdout).toContain("npx ph workflow implement")
    expect(implement.stdout).toContain("README.md 보고 구현해줘")
    expect(implement.stdout).toContain("npx ph workflow finish implement")
    expect(implement.stdout).toContain("finish가 실패하면 완료했다고 말하지 마")
    expect(implement.stdout).toContain("긴 README.md나 plan은 한 번에 다 읽었다고 가정하지 말고")
    expect(implement.stdout).toContain("macOS/Linux: `npx ph bearshell --shell 'sed -n \"1,220p\" README.md'`")
    expect(implement.stdout).toContain(
      'Windows PowerShell: `npx ph bearshell powershell -NoProfile -Command "Get-Content README.md -TotalCount 220"`',
    )
    expect(implement.stdout).toContain(
      'npx ph bearshell powershell -NoProfile -Command "Get-Content README.md | Select-Object -Skip 220 -First 220"',
    )
    expect(implement.stdout).toContain("Get-ChildItem -Path README.md,src,.persona -Recurse -File -ErrorAction SilentlyContinue")
    expect(implement.stdout).toContain("| Select-String -Pattern TODO")
    expect(implement.stdout).not.toContain("Get-ChildItem -Recurse -File | Select-String -Pattern TODO")
    expect(implement.stdout).not.toContain('npx ph bearshell --shell "powershell')
    expect(implement.stdout).not.toContain("npx ph bearshell --shell 'powershell")
    expect(implement.stdout).not.toContain("Select-String -Recurse")
    expect(implement.stdout).toContain("README read method")
    expect(implement.stdout).toContain("README ranges read")
    expect(implement.stdout).toContain("bootJar")
    expect(implement.stdout).toContain(":bootJar SKIPPED")
    expect(implement.stdout).toContain("Spring Boot plugin / Gradle wrapper")
    expect(implement.stdout).toContain("./gradlew test")
    expect(implement.stdout).toContain("gradlew.bat")
    expect(implement.stdout).toContain("중간에 멈추면")
    expect(implement.stdout).toContain("npx ph plan --report-filled implementation")
    expect(implement.stdout).toContain("Before final answer, fill the review report after manual QA")
    expect(implement.stdout).toContain("최종 답변 전에 리뷰와 manual QA 결과")
    expect(implement.stdout).toContain("npx ph plan --report-filled review")
    expect(implement.stdout).toContain("npx ph workflow finish implement")
  })

  it("prints a reusable plan-only OpenCode prompt", () => {
    const projectDir = createTempProject()

    const prompt = runPersonaCli(["plan", "--prompt"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(prompt.status).toBe(0)
    expect(prompt.stderr).toBe("")
    expect(prompt.stdout).toContain("README.md")
    expect(prompt.stdout).toContain(".persona/project-profile.jsonc")
    expect(prompt.stdout).toContain(".persona/policies")
    expect(prompt.stdout).toContain(".persona/workflow/plan.md")
    expect(prompt.stdout).toContain("node_modules, .opencode, .persona/rules, .persona/evidence")
    expect(prompt.stdout).toContain(".persona/rules를 직접 열어 규칙 원문을 읽지 마")
    expect(prompt.stdout).toContain("package/vendor/setup 문서를 계획 컨텍스트로 읽지 마")
    expect(prompt.stdout).toContain("codegraph MCP를 먼저 사용해줘")
    expect(prompt.stdout).toContain("구현하지 말고")
    expect(prompt.stdout).toContain("architecture/technology plan")
    expect(prompt.stdout).toContain("기존 Java/Spring 코드가 있으면")
    expect(prompt.stdout).toContain("existing code wins over greenfield guidance")
    expect(prompt.stdout).toContain("긴 README.md나 plan은 한 번에 다 읽었다고 가정하지 말고")
    expect(prompt.stdout).toContain("macOS/Linux: `npx ph bearshell --shell 'sed -n \"1,220p\" README.md'`")
    expect(prompt.stdout).toContain(
      'Windows PowerShell: `npx ph bearshell powershell -NoProfile -Command "Get-Content README.md -TotalCount 220"`',
    )
    expect(prompt.stdout).toContain(
      'npx ph bearshell powershell -NoProfile -Command "Get-Content README.md | Select-Object -Skip 220 -First 220"',
    )
    expect(prompt.stdout).toContain("Get-ChildItem -Path README.md,src,.persona -Recurse -File -ErrorAction SilentlyContinue")
    expect(prompt.stdout).toContain("| Select-String -Pattern TODO")
    expect(prompt.stdout).not.toContain("Get-ChildItem -Recurse -File | Select-String -Pattern TODO")
    expect(prompt.stdout).not.toContain('npx ph bearshell --shell "powershell')
    expect(prompt.stdout).not.toContain("npx ph bearshell --shell 'powershell")
    expect(prompt.stdout).not.toContain("Select-String -Recurse")
    expect(prompt.stdout).toContain("플랜 보고 구현해줘")
    expect(prompt.stdout).toContain("npx ph workflow implement")
    expect(prompt.stdout).toContain("명령 실행이 필요하면 `npx ph bearshell`을 우선 사용")
  })

  it("shows usage, rejects unknown options, and advertises plan in shared usage", () => {
    const projectDir = createTempProject()

    const help = runPersonaCli(["plan", "--help"], { cwd: projectDir, env: {}, invocationName: "ph" })
    const invalid = runPersonaCli(["plan", "--unknown"], { cwd: projectDir, env: {}, invocationName: "ph" })
    const rootHelp = runPersonaCli(["--help"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(help.status).toBe(0)
    expect(help.stdout).toContain(
      "Usage: ph plan [--force | --auto-accept | --status | --accept | --revise | --prompt | --implement | --next | --resume | --report-filled <implementation|review>]",
    )
    expect(help.stdout).toContain("--auto-accept")
    expect(help.stdout).toContain("--accept")
    expect(help.stdout).toContain("--revise")
    expect(help.stdout).toContain("--prompt")
    expect(help.stdout).toContain("--implement")
    expect(help.stdout).toContain("--next")
    expect(help.stdout).toContain("--resume")
    expect(help.stdout).toContain("--report-filled")
    expect(help.stdout).toContain(".persona/workflow/implementation-report.md")
    expect(help.stdout).toContain(".persona/workflow/review-report.md")
    expect(invalid.status).toBe(1)
    expect(invalid.stderr).toContain("Unknown option: --unknown")
    expect(rootHelp.stdout).toContain("plan")
    expect(rootHelp.stdout).toContain("Create a blackbear architecture plan draft")
  })
})
