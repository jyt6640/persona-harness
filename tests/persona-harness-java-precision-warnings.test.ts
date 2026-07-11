import { spawnSync } from "node:child_process"
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { findAstGrepBinary, loadAstGrepConventionDefinitions } from "../src/cli/ast-grep-convention-runner.js"
import { readArchitectureConventions } from "../src/cli/architecture-conventions.js"
import { runPersonaCli } from "../src/cli/index.js"

const RULES = [
  { file: "java-raw-type.yml", id: "java.raw-type", positive: "RawGenericTypeCase.java" },
  { file: "java-optional-get.yml", id: "java.optional-get", positive: "UnsafeOptionalGetCase.java" },
  { file: "java-mutable-static.yml", id: "java.mutable-static", positive: "MutableStaticFieldCase.java" },
] as const
const FIXTURE_ROOT = join(process.cwd(), "tests", "fixtures", "java-precision-warnings")
const tempProjects: string[] = []

function scan(ruleFile: string, fixturePath: string): ReturnType<typeof spawnSync> {
  const binary = findAstGrepBinary()
  if (binary === undefined) {
    throw new Error("ast-grep is required for Java precision convention fixture tests")
  }
  return spawnSync(binary, ["scan", "--json", "--rule", join(process.cwd(), ".persona", "conventions", ruleFile), fixturePath], {
    encoding: "utf8",
  })
}

function createTempProject(): string {
  const projectDir = mkdtempSync(join(tmpdir(), "persona-java-precision-warning-"))
  tempProjects.push(projectDir)
  return projectDir
}

afterEach(() => {
  for (const projectDir of tempProjects) {
    rmSync(projectDir, { force: true, recursive: true })
  }
  tempProjects.length = 0
})

describe("Java precision warning conventions", () => {
  const astGrepIt = findAstGrepBinary() === undefined ? it.skip : it

  astGrepIt.each(RULES)("matches only the authorized positive fixture for $id", ({ file, positive }) => {
    const result = scan(file, join(FIXTURE_ROOT, "fail"))

    expect(result.status).toBe(0)
    expect(result.stderr).toBe("")
    expect(result.stdout).toContain(positive)
    for (const candidate of RULES) {
      if (candidate.positive !== positive) {
        expect(result.stdout).not.toContain(candidate.positive)
      }
    }
  })

  astGrepIt.each(RULES)("does not match legitimate exceptions for $id", ({ file }) => {
    const result = scan(file, join(FIXTURE_ROOT, "pass"))

    expect(result.status).toBe(0)
    expect(result.stderr).toBe("")
    expect(result.stdout).toBe("[]\n")
  })

  it("loads the adopted candidates as warning-only dynamic conventions", () => {
    const definitions = loadAstGrepConventionDefinitions(process.cwd()).filter((definition) =>
      RULES.some((candidate) => candidate.id === definition.id),
    )

    expect(definitions.map((definition) => definition.id).sort()).toEqual(RULES.map((candidate) => candidate.id).sort())
    for (const definition of definitions) {
      expect(definition.defaultLevel).toBe("warn")
      expect(definition.blockAllowed).toBe(false)
      expect(definition.highPrecision).toBe(true)
    }
  })

  it("copies all adopted warnings during bootstrap and never creates closure blockers", () => {
    const projectDir = createTempProject()
    const bootstrap = runPersonaCli(["bootstrap", "backend", "--no-developer-mcp"], {
      cwd: projectDir,
      env: {},
      invocationName: "ph",
    })

    expect(bootstrap.status).toBe(0)
    for (const candidate of RULES) {
      expect(existsSync(join(projectDir, ".persona", "conventions", candidate.file))).toBe(true)
    }
    const sourceDir = join(projectDir, "src", "main", "java", "sample")
    mkdirSync(sourceDir, { recursive: true })
    for (const candidate of RULES) {
      copyFileSync(join(FIXTURE_ROOT, "fail", candidate.positive), join(sourceDir, candidate.positive))
    }

    const summary = readArchitectureConventions(projectDir, "filled")
    expect(summary.architectureConventionsFinding).toBe("WARN")
    for (const candidate of RULES) {
      expect(summary.architectureConventions).toContain(`${candidate.id} warn`)
    }
    expect(summary.architectureConventionBlockers).toEqual([])
    expect(summary.architectureConventionsBlocking).toBe(false)

    writeFileSync(
      join(projectDir, ".persona", "harness.jsonc"),
      `${JSON.stringify({ conventions: Object.fromEntries(RULES.map((candidate) => [candidate.id, "block"])) }, null, 2)}\n`,
    )
    const attemptedPromotion = readArchitectureConventions(projectDir, "filled")
    expect(attemptedPromotion.architectureConventionBlockers).toEqual([])
    expect(attemptedPromotion.architectureConventionsBlocking).toBe(false)
    for (const candidate of RULES) {
      expect(attemptedPromotion.architectureConventions).toContain(`${candidate.id} warn`)
    }
  })
})
