import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"

import { describe, expect, it } from "vitest"

const repositoryRoot = resolve(process.cwd())

describe("npm contributor test contract", () => {
  it("separates fast, unit, integration, smoke, full, and package evidence", () => {
    const scripts = readPackageScripts()

    expect(scripts["test"]).toBe("node scripts/run-default-test.mjs")
    expect(scripts["test:fast"]).toBe("npm run test:unit && npm run test:integration")
    expect(scripts["test:smoke"]).toBe("npm run build && node dist/cli/index.js --help")
    expect(scripts["test:full"]).toBe("npm run test:repository")
    expect(scripts["test:package"]).toBe("node scripts/test-package-smoke.mjs")
    expect(scripts["benchmark:context"]).toBe("npm run build && node scripts/eval/run-context-comparison.mjs --manifest docs/current/context-comparison-manifest.json")
    expect(selectedTestFiles(scripts["test:unit"])).toContain("tests/context-compatibility-manifest.test.ts")
    expect(selectedTestFiles(scripts["test:unit"])).toContain("tests/context-comparison.test.ts")
    expect(selectedTestFiles(scripts["test:unit"])).toContain("tests/context-comparison-runner.test.ts")
    expect(selectedTestFiles(scripts["test:unit"])).toContain("tests/context-contributor-route.test.ts")
    expect(selectedTestFiles(scripts["test:unit"])).toContain("tests/context-external-validation.test.ts")
    expect(selectedTestFiles(scripts["test:unit"])).toContain("tests/context-readme-boundary.test.ts")
    expect(selectedTestFiles(scripts["test:integration"])).toContain("tests/opencode-context-delivery.test.ts")
    expect(selectedTestFiles(scripts["test:integration"])).toContain("tests/team-profile-v2-store.test.ts")
    expect(validateTestContract(scripts)).toEqual([])
  })

  it("isolates the installed package smoke from ambient personalization roots", () => {
    const source = readFileSync(resolve(repositoryRoot, "scripts/test-package-smoke.mjs"), "utf8")

    for (const entry of [
      'APPDATA: join(temporaryRoot, "appdata")',
      'HOME: join(temporaryRoot, "home")',
      'USERPROFILE: join(temporaryRoot, "home")',
      'XDG_CONFIG_HOME: join(temporaryRoot, "xdg-config")',
    ]) {
      expect(source).toContain(entry)
    }
  })

  it.each([
    ["a cyclic alias", { test: "npm run test:fast", "test:fast": "npm test" }, "script-cycle:test"],
    ["a missing alias target", { test: "npm run test:missing" }, "missing-script:test:missing"],
    ["help-only default evidence", { test: "node dist/cli/index.js --help" }, "help-only-default-test"],
    [
      "package evidence collapsed into smoke",
      { "test:package": "npm run test:smoke", "test:smoke": "node dist/cli/index.js --help" },
      "package-collapses-to-smoke",
    ],
    ["an empty-test escape hatch", { "test:unit": "vitest run --passWithNoTests" }, "empty-test-evidence:test:unit"],
  ])("rejects %s", (_label, overrides, diagnostic) => {
    const scripts = { ...validScriptFixture(), ...overrides }

    expect(validateTestContract(scripts)).toContain(diagnostic)
  })
})

function readPackageScripts(): Readonly<Record<string, string>> {
  const parsed: unknown = JSON.parse(readFileSync(resolve(repositoryRoot, "package.json"), "utf8"))
  if (!isRecord(parsed) || !isRecord(parsed["scripts"])) {
    throw new TypeError("package scripts are unavailable")
  }

  const scripts: Record<string, string> = {}
  for (const [name, value] of Object.entries(parsed["scripts"])) {
    if (typeof value !== "string") {
      throw new TypeError("package scripts must be strings")
    }
    scripts[name] = value
  }
  return scripts
}

function validateTestContract(scripts: Readonly<Record<string, string>>): readonly string[] {
  const diagnostics = new Set<string>()
  const requiredScripts = [
    "test",
    "test:fast",
    "test:unit",
    "test:integration",
    "test:smoke",
    "test:full",
    "test:package",
    "test:repository",
    "test:installed-package-contract",
  ] as const

  for (const name of requiredScripts) {
    if (scripts[name] === undefined) diagnostics.add(`missing-script:${name}`)
  }

  for (const [name, command] of Object.entries(scripts)) {
    for (const reference of npmRunReferences(command)) {
      if (scripts[reference] === undefined) diagnostics.add(`missing-script:${reference}`)
    }
    if ((name === "test:unit" || name === "test:integration") && command.includes("--passWithNoTests")) {
      diagnostics.add(`empty-test-evidence:${name}`)
    }
  }

  if (resolvesToHelp(scripts, "test")) diagnostics.add("help-only-default-test")
  if (reachesScript(scripts, "test:package", "test:smoke") || resolvesToHelp(scripts, "test:package")) {
    diagnostics.add("package-collapses-to-smoke")
  }

  for (const name of requiredScripts) {
    if (hasCycle(scripts, name)) diagnostics.add(`script-cycle:${name}`)
  }

  const unitFiles = selectedTestFiles(scripts["test:unit"])
  const integrationFiles = selectedTestFiles(scripts["test:integration"])
  if (unitFiles.length === 0) diagnostics.add("missing-selected-tests:test:unit")
  if (integrationFiles.length === 0) diagnostics.add("missing-selected-tests:test:integration")
  for (const file of [...unitFiles, ...integrationFiles]) {
    if (!existsSync(resolve(repositoryRoot, file))) diagnostics.add(`missing-test-file:${file}`)
  }
  const integrationSet = new Set(integrationFiles)
  for (const file of unitFiles) {
    if (integrationSet.has(file)) diagnostics.add(`duplicate-test-file:${file}`)
  }

  return [...diagnostics].sort()
}

function npmRunReferences(command: string): readonly string[] {
  const references = [...command.matchAll(/(?:^|\s)npm run ([a-zA-Z0-9:_-]+)/g)].map((match) => match[1] ?? "")
  if (/(?:^|\s)npm test(?:\s|$)/.test(command)) references.push("test")
  return references
}

function selectedTestFiles(command: string | undefined): readonly string[] {
  if (command === undefined) return []
  return command.split(/\s+/).filter((part) => part.startsWith("tests/") && part.endsWith(".test.ts"))
}

function resolvesToHelp(scripts: Readonly<Record<string, string>>, start: string): boolean {
  return walkCommands(scripts, start).some((command) => command.includes("--help"))
}

function reachesScript(scripts: Readonly<Record<string, string>>, start: string, target: string): boolean {
  const pending = [start]
  const visited = new Set<string>()
  while (pending.length > 0) {
    const current = pending.shift()
    if (current === undefined || visited.has(current)) continue
    if (current === target) return true
    visited.add(current)
    const command = scripts[current]
    if (command !== undefined) pending.push(...npmRunReferences(command))
  }
  return false
}

function walkCommands(scripts: Readonly<Record<string, string>>, start: string): readonly string[] {
  const commands: string[] = []
  const pending = [start]
  const visited = new Set<string>()
  while (pending.length > 0) {
    const current = pending.shift()
    if (current === undefined || visited.has(current)) continue
    visited.add(current)
    const command = scripts[current]
    if (command === undefined) continue
    commands.push(command)
    pending.push(...npmRunReferences(command))
  }
  return commands
}

function hasCycle(scripts: Readonly<Record<string, string>>, start: string): boolean {
  return visit(start, new Set<string>(), new Set<string>())

  function visit(current: string, visiting: Set<string>, visited: Set<string>): boolean {
    if (visiting.has(current)) return true
    if (visited.has(current)) return false
    const command = scripts[current]
    if (command === undefined) return false

    const nextVisiting = new Set(visiting).add(current)
    for (const reference of npmRunReferences(command)) {
      if (visit(reference, nextVisiting, visited)) return true
    }
    visited.add(current)
    return false
  }
}

function validScriptFixture(): Readonly<Record<string, string>> {
  return {
    test: "node scripts/run-default-test.mjs",
    "test:fast": "npm run test:unit && npm run test:integration",
    "test:unit": "vitest run tests/unit.test.ts",
    "test:integration": "vitest run tests/integration.test.ts",
    "test:smoke": "npm run build && node dist/cli/index.js --help",
    "test:full": "npm run test:repository",
    "test:package": "node scripts/test-package-smoke.mjs",
    "test:repository": "vitest run",
    "test:installed-package-contract": "node scripts/test-installed-package-contract.mjs --package-acceptance",
    build: "node scripts/package-root-build.mjs",
  }
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
