import { existsSync, mkdtempSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { runPersonaCli } from "../src/cli/index.js"

const tempProjects: string[] = []

function createTempProject(): string {
  const projectDir = mkdtempSync(join(tmpdir(), "persona-workflow-ticket-test-"))
  tempProjects.push(projectDir)
  return projectDir
}

function createHarnessProject(): string {
  const projectDir = createTempProject()
  mkdirSync(join(projectDir, ".persona"), { recursive: true })
  return projectDir
}

function writeStepReadme(projectDir: string): void {
  writeFileSync(
    join(projectDir, "README.md"),
    [
      "# Calendar API",
      "",
      "## Step 1. 기본 일정 구현",
      "",
      "- 일정을 등록한다.",
      "- 일정을 조회한다.",
      "",
      "### Step 2. iCal Import/Export",
      "",
      "- iCal 파일을 import 한다.",
      "- 서버 일정을 export 한다.",
      "",
      "### Step 3. 반복 일정",
      "",
      "- 반복 일정을 등록한다.",
    ].join("\n"),
  )
}

afterEach(() => {
  for (const projectDir of tempProjects) {
    rmSync(projectDir, { recursive: true, force: true })
  }
  tempProjects.length = 0
})

describe("ph workflow ticket backlog", () => {
  it("drafts requirement backlog artifacts from a vague product idea without creating implementation tickets", () => {
    const projectDir = createHarnessProject()

    const result = runPersonaCli(["workflow", "draft", "--stdin"], {
      cwd: projectDir,
      env: {},
      invocationName: "ph",
      stdin: "TODO 웹 서비스 만들래",
    })

    expect(result.status).toBe(0)
    expect(result.stdout).toContain("Requirements draft complete")
    expect(result.stdout).toContain(".persona/workflow/requirements/backlog.md")
    expect(result.stdout).toContain("Say `진행하자`")
    const draftBacklog = readFileSync(join(projectDir, ".persona", "workflow", "requirements", "backlog.md"), "utf8")
    const questions = readFileSync(join(projectDir, ".persona", "workflow", "requirements", "questions.md"), "utf8")
    const assumptions = readFileSync(join(projectDir, ".persona", "workflow", "requirements", "assumptions.md"), "utf8")
    expect(draftBacklog).toContain("Status: draft")
    expect(draftBacklog).toContain("## Step 1. Product scope and core use cases")
    expect(draftBacklog).toContain("TODO 웹 서비스 만들래")
    expect(questions).toContain("Status: draft")
    expect(assumptions).toContain("Status: draft")
    expect(existsSync(join(projectDir, ".persona", "workflow", "backlog.md"))).toBe(false)
    expect(existsSync(join(projectDir, ".persona", "workflow", "work"))).toBe(false)
  })

  it("approves a drafted requirements backlog and then splits it into implementation tickets", () => {
    const projectDir = createHarnessProject()
    expect(
      runPersonaCli(["workflow", "draft", "--stdin"], {
        cwd: projectDir,
        env: {},
        invocationName: "ph",
        stdin: "장비 대여 웹 서비스 만들래",
      }).status,
    ).toBe(0)

    const approve = runPersonaCli(["workflow", "approve", "requirements"], {
      cwd: projectDir,
      env: {},
      invocationName: "ph",
    })
    const split = runPersonaCli(["workflow", "split", ".persona/workflow/requirements/backlog.md"], {
      cwd: projectDir,
      env: {},
      invocationName: "ph",
    })

    expect(approve.status).toBe(0)
    expect(approve.stdout).toContain("Requirements draft approved")
    const approvedBacklog = readFileSync(join(projectDir, ".persona", "workflow", "requirements", "backlog.md"), "utf8")
    expect(approvedBacklog).toContain("Status: accepted")
    expect(split.status).toBe(0)
    expect(split.stdout).toContain("Tickets created: 4")
    const ticket = readFileSync(join(projectDir, ".persona", "workflow", "work", "step-1", "00-task-card.md"), "utf8")
    expect(ticket).toContain("# Task Card: Step 1. Product scope and core use cases")
    expect(ticket).toContain("Source path: .persona/workflow/requirements/backlog.md")
  })

  it("splits README Step sections into backlog rows and task cards", () => {
    const projectDir = createHarnessProject()
    writeStepReadme(projectDir)

    const result = runPersonaCli(["workflow", "split", "README.md"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(result.status).toBe(0)
    expect(result.stdout).toContain("Workflow split complete")
    expect(result.stdout).toContain("Tickets created: 3")
    expect(result.stdout).toContain("Work one ticket at a time")
    expect(result.stdout).toContain("split a smaller requirements source")
    const backlog = readFileSync(join(projectDir, ".persona", "workflow", "backlog.md"), "utf8")
    const card = readFileSync(join(projectDir, ".persona", "workflow", "work", "step-1", "00-task-card.md"), "utf8")
    expect(backlog).toContain("| 1 | step-1 | 기본 일정 구현 | pending | .persona/workflow/work/step-1/00-task-card.md |")
    expect(backlog).toContain("| 2 | step-2 | iCal Import/Export | pending | .persona/workflow/work/step-2/00-task-card.md |")
    expect(card).toContain("# Task Card: Step 1. 기본 일정 구현")
    expect(card).toContain("Source: README.md")
    expect(card).toContain("Source kind: file")
    expect(card).toContain("Source path: README.md")
    expect(card).toContain("- 일정을 등록한다.")
    expect(card).toContain("No automatic code generation")
  })

  it("captures prompt requirements from stdin and splits the latest prompt source by default", () => {
    const projectDir = createHarnessProject()
    const promptRequirements = [
      "# Prompt Requirements",
      "",
      "## Step 1. 기본 일정 구현",
      "",
      "- 프롬프트로 받은 일정을 등록한다.",
      "",
      "## Step 2. iCal Import/Export",
      "",
      "- 프롬프트 기반 iCal export를 구현한다.",
      "",
      "## Step 3. 반복 일정",
      "",
      "- 프롬프트 기반 반복 일정을 구현한다.",
      "",
      "## Step 4. 캘린더 연동",
      "",
      "- 외부 캘린더 연동을 검토한다.",
      "",
      "## Step 5. 다양한 조회",
      "",
      "- 일간/주간/월간 조회를 구현한다.",
      "",
      "## Step 6. 초대 기능",
      "",
      "- 공유 링크를 만든다.",
      "",
      "## Step 7. 성능 테스트",
      "",
      "- 성능 테스트 계획을 만든다.",
    ].join("\n")

    const capture = runPersonaCli(["workflow", "capture", "--stdin"], {
      cwd: projectDir,
      env: {},
      invocationName: "ph",
      stdin: promptRequirements,
    })
    const split = runPersonaCli(["workflow", "split"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(capture.status).toBe(0)
    expect(capture.stdout).toContain("Workflow requirements captured")
    expect(existsSync(join(projectDir, ".persona", "workflow", "requirements", "latest.md"))).toBe(true)
    expect(split.status).toBe(0)
    expect(split.stdout).toContain("Tickets created: 7")
    const card = readFileSync(join(projectDir, ".persona", "workflow", "work", "step-1", "00-task-card.md"), "utf8")
    expect(card).toContain("Source kind: prompt")
    expect(card).toContain("Source path: .persona/workflow/requirements/latest.md")
    expect(card).toContain("- 프롬프트로 받은 일정을 등록한다.")
  })

  it("prints the first pending ticket with its task card path", () => {
    const projectDir = createHarnessProject()
    writeStepReadme(projectDir)
    expect(runPersonaCli(["workflow", "split", "README.md"], { cwd: projectDir, env: {}, invocationName: "ph" }).status).toBe(0)

    const result = runPersonaCli(["workflow", "next"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(result.status).toBe(0)
    expect(result.stdout).toContain("Persona Workflow Next Ticket")
    expect(result.stdout).toContain("Ticket: step-1")
    expect(result.stdout).toContain(".persona/workflow/work/step-1/00-task-card.md")
    expect(result.stdout).toContain("Implement only this ticket")
    expect(result.stdout).toContain("do not open later tickets")
  })

  it("archives a work ticket into immutable history and advances next ticket", () => {
    const projectDir = createHarnessProject()
    writeStepReadme(projectDir)
    expect(runPersonaCli(["workflow", "split", "README.md"], { cwd: projectDir, env: {}, invocationName: "ph" }).status).toBe(0)

    const archive = runPersonaCli(["workflow", "archive", "step-1"], { cwd: projectDir, env: {}, invocationName: "ph" })
    const next = runPersonaCli(["workflow", "next"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(archive.status).toBe(0)
    expect(archive.stdout).toContain("Workflow ticket archived: step-1")
    expect(existsSync(join(projectDir, ".persona", "workflow", "work", "step-1"))).toBe(false)
    expect(existsSync(join(projectDir, ".persona", "workflow", "history", "step-1", "00-task-card.md"))).toBe(true)
    const backlog = readFileSync(join(projectDir, ".persona", "workflow", "backlog.md"), "utf8")
    expect(backlog).toContain("| 1 | step-1 | 기본 일정 구현 | archived | .persona/workflow/history/step-1/00-task-card.md |")
    expect(next.stdout).toContain("Ticket: step-2")
  })

  it("repairs backlog state when a pending ticket already exists in history", () => {
    const projectDir = createHarnessProject()
    writeFileSync(
      join(projectDir, "README.md"),
      [
        "# Decision Memory API",
        "",
        "## API Endpoints",
        "",
        "- Store and list decisions.",
        "",
        "## Ambiguities To Resolve",
        "",
        "- Record selected assumptions for alternatives, tags, follow-up notes, and status transitions.",
        "",
        "## Filtering",
        "",
        "- Filter decisions by status and tag.",
      ].join("\n"),
    )
    mkdirSync(join(projectDir, ".persona", "workflow"), { recursive: true })
    writeFileSync(join(projectDir, ".persona", "workflow", "plan.md"), "Status: accepted\n")
    writeFileSync(
      join(projectDir, ".persona", "workflow", "implementation-report.md"),
      [
        "Status: filled",
        "## README ranges read",
        "- 1-80",
        "- `npx ph bearshell --shell './gradlew test'`",
      ].join("\n"),
    )
    writeFileSync(join(projectDir, ".persona", "workflow", "review-report.md"), "Status: filled\n- `npx ph bearshell --shell './gradlew build'`\n")
    mkdirSync(join(projectDir, ".persona", "evidence", "phase0"), { recursive: true })
    writeFileSync(join(projectDir, ".persona", "evidence", "phase0", "sample.json"), "{}\n")
    expect(runPersonaCli(["workflow", "split", "README.md"], { cwd: projectDir, env: {}, invocationName: "ph" }).status).toBe(0)
    renameSync(
      join(projectDir, ".persona", "workflow", "work", "req-2"),
      join(projectDir, ".persona", "workflow", "history", "req-2"),
    )
    expect(runPersonaCli(["workflow", "archive", "req-1"], { cwd: projectDir, env: {}, invocationName: "ph" }).status).toBe(0)
    expect(runPersonaCli(["workflow", "archive", "req-3"], { cwd: projectDir, env: {}, invocationName: "ph" }).status).toBe(0)

    const check = runPersonaCli(["workflow", "check"], { cwd: projectDir, env: {}, invocationName: "ph" })
    const finish = runPersonaCli(["workflow", "finish", "implement"], { cwd: projectDir, env: {}, invocationName: "ph" })
    const repair = runPersonaCli(["workflow", "archive", "req-2"], { cwd: projectDir, env: {}, invocationName: "ph" })
    const backlog = readFileSync(join(projectDir, ".persona", "workflow", "backlog.md"), "utf8")

    expect(check.status).toBe(0)
    expect(check.stdout).toContain("State: history exists but backlog still marks this ticket pending.")
    expect(check.stdout).toContain("Repair backlog state: `npx ph workflow archive req-2`")
    expect(check.stdout).toContain("Next: repair archived ticket backlog state with `npx ph workflow archive req-2`")
    expect(finish.status).toBe(1)
    expect(finish.stderr).toContain("Pending workflow tickets remain")
    expect(finish.stderr).toContain("State: history exists but backlog still marks this ticket pending.")
    expect(finish.stderr).toContain("Repair backlog state: `npx ph workflow archive req-2`")
    expect(repair.status).toBe(0)
    expect(repair.stdout).toContain("Workflow ticket archive state repaired: req-2")
    expect(backlog).toContain("| 2 | req-2 | Ambiguities To Resolve | archived | .persona/workflow/history/req-2/00-task-card.md |")
  })

  it("refuses to overwrite an existing history ticket", () => {
    const projectDir = createHarnessProject()
    writeStepReadme(projectDir)
    expect(runPersonaCli(["workflow", "split", "README.md"], { cwd: projectDir, env: {}, invocationName: "ph" }).status).toBe(0)
    expect(runPersonaCli(["workflow", "archive", "step-1"], { cwd: projectDir, env: {}, invocationName: "ph" }).status).toBe(0)
    mkdirSync(join(projectDir, ".persona", "workflow", "work", "step-1"), { recursive: true })
    writeFileSync(join(projectDir, ".persona", "workflow", "work", "step-1", "00-task-card.md"), "# Duplicate\n")

    const result = runPersonaCli(["workflow", "archive", "step-1"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(result.status).toBe(1)
    expect(result.stderr).toContain("History already exists")
    expect(result.stderr).toContain("Refusing to overwrite")
  })

  it("splits generic README requirements into an analysis-backed fallback ticket", () => {
    const projectDir = createHarnessProject()
    writeFileSync(
      join(projectDir, "README.md"),
      [
        "# Equipment Rental API",
        "",
        "- 장비를 등록한다.",
        "- 장비 목록을 조회한다.",
        "- 회원이 장비를 대여한다.",
      ].join("\n"),
    )

    const result = runPersonaCli(["workflow", "split", "README.md"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(result.status).toBe(0)
    expect(result.stdout).toContain("Requirements analysis: .persona/workflow/requirements-analysis.md")
    expect(result.stdout).toContain("Tickets created: 1")
    const analysis = readFileSync(join(projectDir, ".persona", "workflow", "requirements-analysis.md"), "utf8")
    const backlog = readFileSync(join(projectDir, ".persona", "workflow", "backlog.md"), "utf8")
    const card = readFileSync(join(projectDir, ".persona", "workflow", "work", "req-1", "00-task-card.md"), "utf8")
    expect(analysis).toContain("Split strategy: single-ticket-fallback")
    expect(analysis).toContain("Source kind: file")
    expect(backlog).toContain("| 1 | req-1 | Equipment Rental API | pending | .persona/workflow/work/req-1/00-task-card.md |")
    expect(card).toContain("# Task Card: Requirement 1. Equipment Rental API")
    expect(card).toContain("- 장비를 등록한다.")
  })

  it("splits prompt requirements without Step headings into backlog automatically", () => {
    const projectDir = createHarnessProject()
    const promptRequirements = [
      "장비 대여 API를 만들어줘.",
      "",
      "## 장비 관리",
      "",
      "- 장비 등록",
      "- 장비 목록 조회",
      "",
      "## 대여 흐름",
      "",
      "- 회원 등록",
      "- 장비 대여",
      "- 본인 대여만 반납 가능",
    ].join("\n")

    const capture = runPersonaCli(["workflow", "capture", "--stdin"], {
      cwd: projectDir,
      env: {},
      invocationName: "ph",
      stdin: promptRequirements,
    })
    const split = runPersonaCli(["workflow", "split"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(capture.status).toBe(0)
    expect(split.status).toBe(0)
    expect(split.stdout).toContain("Tickets created: 2")
    const analysis = readFileSync(join(projectDir, ".persona", "workflow", "requirements-analysis.md"), "utf8")
    const card = readFileSync(join(projectDir, ".persona", "workflow", "work", "req-1", "00-task-card.md"), "utf8")
    expect(analysis).toContain("Split strategy: heading-fallback")
    expect(analysis).toContain("Source kind: prompt")
    expect(card).toContain("Source kind: prompt")
    expect(card).toContain("# Task Card: Requirement 1. 장비 관리")
    expect(card).toContain("- 장비 등록")
  })

  it("fails split without a source file or captured prompt source", () => {
    const projectDir = createHarnessProject()

    const result = runPersonaCli(["workflow", "split"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(result.status).toBe(1)
    expect(result.stderr).toContain("Workflow requirement source not found")
    expect(result.stderr).toContain("npx ph workflow capture --stdin")
  })

  it("blocks implementation finish while pending workflow tickets remain", () => {
    const projectDir = createHarnessProject()
    writeStepReadme(projectDir)
    mkdirSync(join(projectDir, ".persona", "workflow"), { recursive: true })
    writeFileSync(join(projectDir, ".persona", "workflow", "plan.md"), "Status: accepted\n")
    writeFileSync(
      join(projectDir, ".persona", "workflow", "implementation-report.md"),
      [
        "Status: filled",
        "## README ranges read",
        "- 1-220",
        "- `npx ph bearshell --shell './gradlew test'`",
      ].join("\n"),
    )
    writeFileSync(join(projectDir, ".persona", "workflow", "review-report.md"), "Status: filled\n- `npx ph bearshell --shell './gradlew bootRun'`\n")
    mkdirSync(join(projectDir, ".persona", "evidence", "phase0"), { recursive: true })
    writeFileSync(join(projectDir, ".persona", "evidence", "phase0", "sample.json"), "{}\n")
    expect(runPersonaCli(["workflow", "split", "README.md"], { cwd: projectDir, env: {}, invocationName: "ph" }).status).toBe(0)
    expect(runPersonaCli(["workflow", "archive", "step-1"], { cwd: projectDir, env: {}, invocationName: "ph" }).status).toBe(0)

    const result = runPersonaCli(["workflow", "finish", "implement"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(result.status).toBe(1)
    expect(result.stderr).toContain("Pending workflow tickets remain: step-2, step-3")
    expect(result.stderr).toContain("Ticket: step-2")
    expect(result.stderr).toContain("Title: iCal Import/Export")
    expect(result.stderr).toContain("Path: .persona/workflow/work/step-2/00-task-card.md")
    expect(result.stderr).toContain("Run `npx ph workflow next`")
    expect(result.stderr).toContain("If this ticket is complete: `npx ph workflow archive step-2`")
    expect(result.stderr).toContain("Do not claim overall completion while pending tickets remain.")
  })

  it("suggests reviewing and archiving a satisfied technical constraints ticket instead of auto-completing it", () => {
    const projectDir = createHarnessProject()
    writeFileSync(
      join(projectDir, "README.md"),
      [
        "# Calendar API",
        "",
        "## Step 1. Basic CRUD",
        "",
        "- 일정을 등록한다.",
        "",
        "## Step 2. Technical Constraints",
        "",
        "- Use Gradle only.",
        "- Keep Java source under src/main/java.",
        "- Fill implementation and review reports.",
      ].join("\n"),
    )
    mkdirSync(join(projectDir, ".persona", "workflow"), { recursive: true })
    mkdirSync(join(projectDir, ".persona", "evidence", "phase0"), { recursive: true })
    mkdirSync(join(projectDir, "src", "main", "java", "com", "example"), { recursive: true })
    writeFileSync(join(projectDir, "settings.gradle"), "rootProject.name = 'calendar'\n")
    writeFileSync(join(projectDir, "build.gradle"), "plugins { id 'org.springframework.boot' version '3.5.0' }\n")
    writeFileSync(join(projectDir, "src", "main", "java", "com", "example", "Application.java"), "class Application {}\n")
    writeFileSync(join(projectDir, ".persona", "project-profile.jsonc"), "{\"status\":\"ready\",\"questions\":[]}\n")
    writeFileSync(join(projectDir, ".persona", "workflow", "plan.md"), "Status: accepted\n")
    writeFileSync(
      join(projectDir, ".persona", "workflow", "implementation-report.md"),
      [
        "Status: filled",
        "- README ranges read: 1-220",
        "- Project profile ranges read: all",
        "- `npx ph bearshell --shell './gradlew test'`",
      ].join("\n"),
    )
    writeFileSync(join(projectDir, ".persona", "workflow", "review-report.md"), "Status: filled\n- `npx ph bearshell --shell './gradlew bootRun'`\n")
    writeFileSync(join(projectDir, ".persona", "evidence", "phase0", "sample.json"), "{}\n")
    expect(runPersonaCli(["workflow", "split", "README.md"], { cwd: projectDir, env: {}, invocationName: "ph" }).status).toBe(0)
    expect(runPersonaCli(["workflow", "archive", "step-1"], { cwd: projectDir, env: {}, invocationName: "ph" }).status).toBe(0)

    const result = runPersonaCli(["workflow", "finish", "implement"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(result.status).toBe(1)
    expect(result.stderr).toContain("Ticket: step-2")
    expect(result.stderr).toContain("Title: Technical Constraints")
    expect(result.stderr).toContain("may already be satisfied")
    expect(result.stderr).toContain("Archive only after review: `npx ph workflow archive step-2`")
  })

  it("keeps workflow ticket commands inactive before Persona Harness opt-in", () => {
    const projectDir = createTempProject()
    writeStepReadme(projectDir)

    const result = runPersonaCli(["workflow", "split", "README.md"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(result.status).toBe(1)
    expect(result.stderr).toContain("Persona Harness is not initialized")
    expect(result.stderr).toContain("npx ph init")
  })
})
