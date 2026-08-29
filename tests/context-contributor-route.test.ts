import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"

import { describe, expect, it } from "vitest"

const repositoryRoot = resolve(process.cwd())

const REQUIRED_OWNERSHIP = [
  { id: "context-core", paths: ["src/context-core/"] },
  { id: "context-profile", paths: ["src/context-profile/"] },
  { id: "context-cli", paths: ["src/cli/context-command.ts"] },
  { id: "context-delivery", paths: ["src/context-delivery/opencode-context-hooks.ts"] },
  { id: "context-external-validation", paths: ["src/context-external-validation/"] },
  { id: "workflow-integrity", paths: ["src/cli/workflow-command.ts", "src/cli/authority-command.ts"] },
] as const

const REQUIRED_LOCAL_CHECKS = [
  { script: "test", command: "npm test" },
  { script: "typecheck", command: "npm run typecheck" },
  { script: "check:docs", command: "npm run check:docs" },
] as const

const REQUIRED_SEPARATE_BOUNDARIES = [
  { id: "installed-package", reference: "test:package" },
  { id: "repository-contract", reference: "test:repository" },
  { id: "p0-implementation-release", reference: "#414" },
  { id: "generic-compatibility-release", reference: "#412" },
  { id: "host-observation", reference: "#410" },
] as const

const REQUIRED_OPERATIONAL_ROUTES = [
  {
    id: "private-security-report",
    marker: "## Reporting a vulnerability",
    path: "SECURITY.md",
  },
  {
    id: "context-local-verification",
    marker: "## Context contribution route",
    path: "CONTRIBUTING.md",
    script: "test",
  },
  {
    id: "owner-release-operations",
    marker: "# Release Operations",
    path: "docs/current/release/README.md",
  },
  {
    command: "npx ph doctor",
    id: "bootstrap-intake-diagnosis",
    marker: 'if (command === "doctor")',
    path: "src/cli/index.ts",
  },
] as const

describe("Context contributor route", () => {
  it("binds contributor ownership and local checks to current source and scripts", () => {
    const map = readContributorMap()
    const scripts = readPackageScripts()
    const contributing = readFileSync(resolve(repositoryRoot, "CONTRIBUTING.md"), "utf8")

    expect(map.schemaVersion).toBe("persona-context-contributor-map.2")
    expect(contributing).toContain("docs/current/context-contributor-map.json")
    expect(contributing).toContain("## Context operational routes")

    for (const required of REQUIRED_OWNERSHIP) {
      const ownership = map.ownership.find((entry) => entry.id === required.id)
      expect(ownership?.paths).toEqual(required.paths)
      for (const path of required.paths) {
        expect(existsSync(resolve(repositoryRoot, path))).toBe(true)
      }
    }

    for (const required of REQUIRED_LOCAL_CHECKS) {
      expect(map.localChecks.find((entry) => entry.script === required.script)?.command).toBe(required.command)
      expect(scripts[required.script]).toBeDefined()
    }

    for (const required of REQUIRED_SEPARATE_BOUNDARIES) {
      expect(map.separateBoundaries.find((entry) => entry.id === required.id)?.reference).toBe(required.reference)
      if (required.reference.startsWith("test:")) {
        expect(scripts[required.reference]).toBeDefined()
      }
    }

    for (const required of REQUIRED_OPERATIONAL_ROUTES) {
      expect(map.operationalRoutes.find((entry) => entry.id === required.id)).toEqual(required)
      expect(existsSync(resolve(repositoryRoot, required.path))).toBe(true)
      expect(readFileSync(resolve(repositoryRoot, required.path), "utf8")).toContain(required.marker)
      if ("script" in required) {
        expect(scripts[required.script]).toBeDefined()
      }
    }
  })
})

type ContributorMap = {
  readonly localChecks: readonly ScriptCheck[]
  readonly ownership: readonly Ownership[]
  readonly operationalRoutes: readonly OperationalRoute[]
  readonly schemaVersion: string
  readonly separateBoundaries: readonly Boundary[]
}

type ScriptCheck = {
  readonly command: string
  readonly script: string
}

type Ownership = {
  readonly id: string
  readonly paths: readonly string[]
}

type OperationalRoute = {
  readonly command?: string
  readonly id: string
  readonly marker: string
  readonly path: string
  readonly script?: string
}

type Boundary = {
  readonly id: string
  readonly reference: string
}

function readContributorMap(): ContributorMap {
  const value: unknown = JSON.parse(readFileSync(resolve(repositoryRoot, "docs/current/context-contributor-map.json"), "utf8"))
  if (!isRecord(value) || typeof value.schemaVersion !== "string") {
    throw new TypeError("context contributor map is unavailable")
  }

  return {
    localChecks: readScriptChecks(value.localChecks),
    ownership: readOwnership(value.ownership),
    operationalRoutes: readOperationalRoutes(value.operationalRoutes),
    schemaVersion: value.schemaVersion,
    separateBoundaries: readBoundaries(value.separateBoundaries),
  }
}

function readOperationalRoutes(value: unknown): readonly OperationalRoute[] {
  if (!Array.isArray(value)) {
    throw new TypeError("context contributor operational routes are unavailable")
  }
  return value.map((entry) => {
    if (!isRecord(entry) || typeof entry.id !== "string" || typeof entry.marker !== "string" || typeof entry.path !== "string") {
      throw new TypeError("context contributor operational route is invalid")
    }
    if (entry.command !== undefined && typeof entry.command !== "string") {
      throw new TypeError("context contributor operational route command is invalid")
    }
    if (entry.script !== undefined && typeof entry.script !== "string") {
      throw new TypeError("context contributor operational route script is invalid")
    }
    return {
      ...(typeof entry.command === "string" ? { command: entry.command } : {}),
      id: entry.id,
      marker: entry.marker,
      path: entry.path,
      ...(typeof entry.script === "string" ? { script: entry.script } : {}),
    }
  })
}

function readPackageScripts(): Readonly<Record<string, string>> {
  const value: unknown = JSON.parse(readFileSync(resolve(repositoryRoot, "package.json"), "utf8"))
  if (!isRecord(value) || !isRecord(value.scripts)) {
    throw new TypeError("package scripts are unavailable")
  }

  const scripts: Record<string, string> = {}
  for (const [name, command] of Object.entries(value.scripts)) {
    if (typeof command !== "string") {
      throw new TypeError("package scripts must be strings")
    }
    scripts[name] = command
  }
  return scripts
}

function readScriptChecks(value: unknown): readonly ScriptCheck[] {
  if (!Array.isArray(value)) {
    throw new TypeError("context contributor local checks are unavailable")
  }
  return value.map((entry) => {
    if (!isRecord(entry) || typeof entry.command !== "string" || typeof entry.script !== "string") {
      throw new TypeError("context contributor local check is invalid")
    }
    return { command: entry.command, script: entry.script }
  })
}

function readOwnership(value: unknown): readonly Ownership[] {
  if (!Array.isArray(value)) {
    throw new TypeError("context contributor ownership is unavailable")
  }
  return value.map((entry) => {
    if (!isRecord(entry) || typeof entry.id !== "string" || !isStringArray(entry.paths)) {
      throw new TypeError("context contributor ownership entry is invalid")
    }
    return { id: entry.id, paths: entry.paths }
  })
}

function readBoundaries(value: unknown): readonly Boundary[] {
  if (!Array.isArray(value)) {
    throw new TypeError("context contributor boundaries are unavailable")
  }
  return value.map((entry) => {
    if (!isRecord(entry) || typeof entry.id !== "string" || typeof entry.reference !== "string") {
      throw new TypeError("context contributor boundary is invalid")
    }
    return { id: entry.id, reference: entry.reference }
  })
}

function isStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string")
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
