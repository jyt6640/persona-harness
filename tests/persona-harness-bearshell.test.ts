import { existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { runPersonaCli } from "../src/cli/index.js"
import { runBearshell } from "../src/cli/bearshell.js"

const tempDirs: string[] = []

function createTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "persona-bearshell-test-"))
  tempDirs.push(dir)
  return dir
}

function createClosureProject(): string {
  const projectDir = createTempDir()
  mkdirSync(join(projectDir, ".persona", "workflow"), { recursive: true })
  writeFileSync(join(projectDir, ".persona", "workflow", "plan.md"), "Status: accepted\n")
  writeFileSync(
    join(projectDir, ".persona", "workflow", "implementation-report.md"),
    [
      "Status: filled",
      "- README ranges read: 1-220",
      "- Project profile ranges read: all",
      "- `npx ph bearshell --shell './gradlew test'`",
      "- BUILD SUCCESSFUL",
    ].join("\n"),
  )
  writeFileSync(
    join(projectDir, ".persona", "workflow", "review-report.md"),
    ["Status: filled", "- `npx ph bearshell --shell './gradlew bootRun'`"].join("\n"),
  )
  return projectDir
}

function closureJson(projectDir: string) {
  const result = runPersonaCli(["workflow", "closure", "next", "--json"], { cwd: projectDir, env: {}, invocationName: "ph" })
  expect(result.status).toBe(0)
  return JSON.parse(result.stdout)
}

function bearshellEvidencePayloads(projectDir: string): readonly Record<string, unknown>[] {
  const evidenceDir = join(projectDir, ".persona", "evidence", "phase0")
  if (!existsSync(evidenceDir)) {
    return []
  }
  return readdirSync(evidenceDir)
    .filter((fileName) => fileName.endsWith(".json"))
    .map((fileName) => JSON.parse(readFileSync(join(evidenceDir, fileName), "utf8")))
    .filter((payload): payload is Record<string, unknown> => typeof payload === "object" && payload !== null && !Array.isArray(payload))
    .filter((payload) => payload["tool"] === "bearshell")
}

afterEach(() => {
  for (const dir of tempDirs) {
    rmSync(dir, { recursive: true, force: true })
  }
  tempDirs.length = 0
})

describe("ph bearshell", () => {
  it("runs a command without shell interpretation by default", () => {
    const result = runBearshell(["node", "-e", "console.log(process.argv.slice(1).join('|'))", "alpha;beta"], {
      cwd: createTempDir(),
      env: {},
    })

    expect(result.status).toBe(0)
    expect(result.stdout).toBe("alpha;beta\n")
    expect(result.stderr).toBe("")
  })

  it("requires explicit --shell before interpreting shell metacharacters", () => {
    const raw = runBearshell(["node", "-e", "console.log('alpha && beta')"], {
      cwd: createTempDir(),
      env: {},
    })
    const shell = runBearshell(["--shell", "printf 'alpha' && printf ' beta'"], {
      cwd: createTempDir(),
      env: {},
    })

    expect(raw.stdout).toBe("alpha && beta\n")
    expect(shell.status).toBe(0)
    expect(shell.stdout).toBe("alpha beta")
  })

  it("condenses oversized output to the requested budget", () => {
    const result = runBearshell(["--budget", "120", "node", "-e", "console.log('x'.repeat(600))"], {
      cwd: createTempDir(),
      env: { PH_BEARSHELL_SPARK: "0" },
    })

    expect(result.status).toBe(0)
    expect(result.stdout.length).toBeLessThan(600)
    expect(result.stdout).toContain("[bearshell condensed]")
    expect(result.stdout).toContain("omitted")
  })

  it("terminates commands that exceed the configured timeout", () => {
    const result = runBearshell(["node", "-e", "setTimeout(() => {}, 5000)"], {
      cwd: createTempDir(),
      env: { PH_BEARSHELL_TIMEOUT_MS: "50" },
    })

    expect(result.status).toBeGreaterThan(0)
    expect(result.stderr).toContain("timed out after 50ms")
  })

  it("rejects invalid explicit budgets", () => {
    const result = runBearshell(["--budget", "nope", "node", "-e", "console.log('unused')"], {
      cwd: createTempDir(),
      env: {},
    })

    expect(result.status).toBe(1)
    expect(result.stderr).toContain("--budget requires a positive integer")
  })

  it("can disable condensation through the environment", () => {
    const result = runBearshell(["--budget", "80", "node", "-e", "console.log('y'.repeat(180))"], {
      cwd: createTempDir(),
      env: { PH_BEARSHELL_CONDENSE: "0" },
    })

    expect(result.status).toBe(0)
    expect(result.stdout).toContain("y".repeat(180))
    expect(result.stdout).not.toContain("[bearshell condensed]")
  })

  it("returns usage text for --help", () => {
    const result = runBearshell(["--help"], {
      cwd: createTempDir(),
      env: {},
    })

    expect(result.status).toBe(0)
    expect(result.stdout).toContain("Usage: ph bearshell <command> [args...]")
    expect(result.stdout).toContain("Windows PowerShell pipelines: prefer no `--shell`")
    expect(result.stdout).toContain(
      'npx ph bearshell powershell -NoProfile -Command "Select-String -Path README.md -Pattern TODO"',
    )
    expect(result.stdout).toContain("Avoid project-root or `.persona` root recursive search; it can traverse node_modules or package/vendor files.")
    expect(result.stdout).not.toContain("Get-ChildItem -Path README.md,src,.persona -Recurse")
    expect(result.stdout).not.toContain("Get-ChildItem -Recurse -File | Select-String -Pattern TODO")
    expect(result.stdout).not.toContain('npx ph bearshell --shell "powershell')
    expect(result.stdout).not.toContain("npx ph bearshell --shell 'powershell")
    expect(result.stdout).toContain("PH_BEARSHELL_CONDENSE=0")
  })

  it("reports command launch failures", () => {
    const result = runBearshell(["definitely-not-a-real-persona-command"], {
      cwd: createTempDir(),
      env: {},
    })

    expect(result.status).toBe(1)
    expect(result.stderr).toContain("failed to launch definitely-not-a-real-persona-command")
  })

  it("routes persona-harness and ph command names through the same CLI entry", () => {
    const first = runPersonaCli(["bearshell", "node", "-e", "console.log('ok')"], {
      cwd: createTempDir(),
      env: {},
      invocationName: "persona-harness",
    })
    const second = runPersonaCli(["bearshell", "node", "-e", "console.log('ok')"], {
      cwd: createTempDir(),
      env: {},
      invocationName: "ph",
    })

    expect(first).toMatchObject({ status: 0, stdout: "ok\n", stderr: "" })
    expect(second).toMatchObject({ status: 0, stdout: "ok\n", stderr: "" })
  })

  it("writes structured execution evidence that closure verification accepts on success", () => {
    const projectDir = createClosureProject()
    const before = closureJson(projectDir)

    const result = runPersonaCli(["bearshell", "node", "-e", "console.log('BUILD SUCCESSFUL')"], {
      cwd: projectDir,
      env: {},
      invocationName: "ph",
    })
    const after = closureJson(projectDir)
    const evidence = bearshellEvidencePayloads(projectDir)

    expect(before.state.verification).toBe("unknown")
    expect(result.status).toBe(0)
    expect(result.stdout).toBe("BUILD SUCCESSFUL\n")
    expect(evidence).toHaveLength(1)
    expect(evidence[0]).toMatchObject({
      command: "node -e console.log('BUILD SUCCESSFUL')",
      status: 0,
      tool: "bearshell",
    })
    expect(after.state.verification).toBe("passed")
  })

  it("writes failed execution evidence that keeps closure verification blocked", () => {
    const projectDir = createClosureProject()

    const result = runPersonaCli(["bearshell", "node", "-e", "console.error('BUILD FAILED'); process.exit(7)"], {
      cwd: projectDir,
      env: {},
      invocationName: "ph",
    })
    const closure = closureJson(projectDir)
    const evidence = bearshellEvidencePayloads(projectDir)

    expect(result.status).toBe(7)
    expect(result.stderr).toBe("BUILD FAILED\n")
    expect(evidence).toHaveLength(1)
    expect(evidence[0]).toMatchObject({
      status: 7,
      tool: "bearshell",
    })
    expect(closure.state.verification).toBe("failed")
    expect(closure.nextStep).toMatchObject({ blockerId: "verification-failed", id: "fix-verification" })
  })

  it("keeps init command routed through the shared CLI entry", () => {
    const projectDir = createTempDir()

    const result = runPersonaCli(["init"], {
      cwd: projectDir,
      env: {},
      invocationName: "ph",
      packageRoot: process.cwd(),
    })

    expect(result.status).toBe(0)
    expect(result.stdout).toContain("Persona Harness initialized.")
    expect(result.stderr).toBe("")
  })
})

describe("ph package bin", () => {
  it("exposes persona-harness and ph through the shared CLI entry", () => {
    const parsed: unknown = JSON.parse(readFileSync("package.json", "utf8"))
    expect(typeof parsed).toBe("object")
    expect(parsed).not.toBeNull()
    if (typeof parsed !== "object" || parsed === null || !("bin" in parsed)) {
      return
    }

    const bin = parsed.bin
    expect(bin).toEqual({
      "persona-harness": "dist/cli/index.js",
      "ph-codegraph-mcp": "packages/codegraph-mcp/bin/codegraph-mcp.mjs",
      ph: "dist/cli/index.js",
    })
  })
})
