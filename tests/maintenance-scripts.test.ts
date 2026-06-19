import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { spawnSync } from "node:child_process"
import { afterEach, describe, expect, it } from "vitest"

const checkScopeScript = resolve("scripts/check-mvp-scope.mjs")
const cleanupScript = resolve("scripts/cleanup-phase-artifacts.mjs")

let tempDirs: string[] = []

function createTempDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix))
  tempDirs.push(dir)
  return dir
}

function runNodeScript(scriptPath: string, args: readonly string[], cwd: string) {
  return spawnSync(process.execPath, [scriptPath, ...args], {
    cwd,
    encoding: "utf8",
  })
}

function writeScopeProject(projectDir: string, activeSkills: readonly string[] = ["programming", "frontend"]): void {
  mkdirSync(join(projectDir, "docs"), { recursive: true })
  mkdirSync(join(projectDir, "src", "phase0"), { recursive: true })
  writeFileSync(
    join(projectDir, "docs", "mvp-scope-status.json"),
    `${JSON.stringify(
      {
        mvpScope: "java-spring-backend-clean-code",
        activeSharedSkills: activeSkills,
        inactiveVendoredReferences: ["ast-grep", "debugging", "visual-qa", "review-work"],
        experimentalFileRoles: ["typescript", "frontend"],
        parkingFileRoles: ["infra", "shared-skill"],
        scopeDecision: "java-backend-mvp-first",
      },
      null,
      2,
    )}\n`,
  )
  writeFileSync(
    join(projectDir, "src", "phase0", "shared-skill-router.ts"),
    [
      'export const ACTIVE_SHARED_SKILL_NAMES = ["programming", "frontend"] as const',
      'export const INACTIVE_VENDORED_SHARED_SKILL_NAMES = ["ast-grep", "debugging", "visual-qa", "review-work"] as const',
      "",
    ].join("\n"),
  )
  writeFileSync(
    join(projectDir, "src", "phase0", "types.ts"),
    [
      "export type FileRole =",
      '  | "typescript"',
      '  | "frontend"',
      '  | "infra"',
      '  | "shared-skill"',
      "",
    ].join("\n"),
  )
  writeFileSync(
    join(projectDir, "docs", "phase2-scope-settlement.md"),
    "Java/Spring backend Clean Code injection. TypeScript is experimental. Infra is parking. ast-grep is inactive reference.\n",
  )
  writeFileSync(
    join(projectDir, "docs", "project-progress-board.md"),
    "Shared skills have limited active routing. TypeScript is experimental. Infra and shared-skill are parking surfaces. Vendored tools are inactive references.\n",
  )
}

afterEach(() => {
  for (const dir of tempDirs) {
    rmSync(dir, { recursive: true, force: true })
  }
  tempDirs = []
})

describe("maintenance scripts", () => {
  it("reports PASS when structured scope status matches source and docs", () => {
    const projectDir = createTempDir("persona-scope-pass-")
    writeScopeProject(projectDir)

    const result = runNodeScript(checkScopeScript, [projectDir], projectDir)

    expect(result.status).toBe(0)
    expect(result.stdout).toContain("MVP scope diagnostics finding: PASS")
    expect(result.stdout).toContain("MVP scope diagnostics count: 0")
  })

  it("reports WARN when structured scope status disagrees with active router skills", () => {
    const projectDir = createTempDir("persona-scope-warn-")
    writeScopeProject(projectDir, ["programming"])

    const result = runNodeScript(checkScopeScript, [projectDir], projectDir)

    expect(result.status).toBe(0)
    expect(result.stdout).toContain("MVP scope diagnostics finding: WARN")
    expect(result.stdout).toContain("active shared skills changed")
  })

  it("keeps packaged scope checks usable when source and docs are absent", () => {
    const projectDir = createTempDir("persona-scope-packaged-")
    mkdirSync(join(projectDir, "docs"), { recursive: true })
    writeFileSync(
      join(projectDir, "docs", "mvp-scope-status.json"),
      `${JSON.stringify(
        {
          mvpScope: "java-spring-backend-clean-code",
          activeSharedSkills: ["programming", "frontend"],
          inactiveVendoredReferences: ["ast-grep", "debugging", "visual-qa", "review-work"],
          experimentalFileRoles: ["typescript", "frontend"],
          parkingFileRoles: ["infra", "shared-skill"],
          scopeDecision: "java-backend-mvp-first",
        },
        null,
        2,
      )}\n`,
    )

    const result = runNodeScript(checkScopeScript, [projectDir], projectDir)

    expect(result.status).toBe(0)
    expect(result.stdout).toContain("MVP scope diagnostics finding: PASS")
    expect(result.stdout).toContain("shared-skill-router.ts is absent")
    expect(result.stdout).toContain("progress board is absent")
  })

  it("keeps cleanup dry-run non-destructive and apply destructive for generated artifacts", () => {
    const projectDir = createTempDir("persona-cleanup-")
    const runDir = join(projectDir, "experiments", "phase0-runs", "run-a")
    const sandboxDir = join(runDir, "sandbox", ".gradle")
    mkdirSync(sandboxDir, { recursive: true })
    writeFileSync(join(runDir, "run-metadata.json"), "{}\n")
    writeFileSync(join(runDir, "prompt.md"), "prompt\n")
    writeFileSync(join(runDir, "raw.log"), "x".repeat(3_000))

    const dryRun = runNodeScript(cleanupScript, ["--root", runDir, "--max-log-bytes", "1000"], projectDir)

    expect(dryRun.status).toBe(0)
    expect(dryRun.stdout).toContain("Phase artifact cleanup mode: DRY-RUN")
    expect(dryRun.stdout).toContain("Directories to delete: 1")
    expect(dryRun.stdout).toContain("Logs to trim: 1")
    expect(existsSync(join(runDir, "sandbox"))).toBe(true)
    expect(existsSync(join(runDir, "raw.log"))).toBe(true)
    expect(existsSync(join(runDir, "raw.trimmed.log"))).toBe(false)

    const apply = runNodeScript(cleanupScript, ["--root", runDir, "--max-log-bytes", "1000", "--apply"], projectDir)

    expect(apply.status).toBe(0)
    expect(apply.stdout).toContain("Phase artifact cleanup mode: APPLY")
    expect(existsSync(join(runDir, "sandbox"))).toBe(false)
    expect(existsSync(join(runDir, "raw.log"))).toBe(false)
    expect(readFileSync(join(runDir, "raw.trimmed.log"), "utf8")).toContain("Original bytes: 3000")
  })

  it("rejects non-positive max log byte limits", () => {
    const projectDir = createTempDir("persona-cleanup-invalid-")

    const result = runNodeScript(cleanupScript, ["--max-log-bytes", "-1"], projectDir)

    expect(result.status).toBe(1)
    expect(result.stderr).toContain("--max-log-bytes requires a positive integer")
  })
})
