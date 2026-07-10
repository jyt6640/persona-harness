import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, relative } from "node:path"

import { runPersonaCli } from "../../src/cli/index.js"

export function createGoProject(): string {
  return mkdtempSync(join(tmpdir(), "persona-go-test-"))
}

export function initializeHarness(projectDir: string): void {
  mkdirSync(join(projectDir, ".persona"), { recursive: true })
  writeFileSync(
    join(projectDir, ".persona", "harness.jsonc"),
    `${JSON.stringify({ features: { runtimeInjection: false } }, null, 2)}\n`,
  )
}

export function prepareProfile(projectDir: string): void {
  const result = runPersonaCli(["intake", "--default", "backend"], {
    cwd: projectDir,
    env: {},
    invocationName: "ph",
  })
  if (result.status !== 0) {
    throw new TypeError(result.stderr)
  }
}

export function prepareAcceptedPlan(projectDir: string): void {
  const result = runPersonaCli(["plan", "--auto-accept"], {
    cwd: projectDir,
    env: {},
    invocationName: "ph",
  })
  if (result.status !== 0) {
    throw new TypeError(result.stderr)
  }
}

export function createReadyGoProject(): string {
  const projectDir = createGoProject()
  initializeHarness(projectDir)
  prepareProfile(projectDir)
  prepareAcceptedPlan(projectDir)
  return projectDir
}

export function removeGoProject(projectDir: string): void {
  rmSync(projectDir, { recursive: true, force: true })
}

export function workflowSnapshot(projectDir: string): Readonly<Record<string, string>> {
  const workflowDir = join(projectDir, ".persona", "workflow")
  if (!existsSync(workflowDir)) {
    return {}
  }
  const snapshot: Record<string, string> = {}
  const pending = [workflowDir]
  while (pending.length > 0) {
    const current = pending.pop()
    if (current === undefined) {
      continue
    }
    for (const entry of readdirSync(current)) {
      const path = join(current, entry)
      const key = relative(workflowDir, path)
      if (statSync(path).isDirectory()) {
        snapshot[`${key}/`] = "<directory>"
        pending.push(path)
      } else {
        snapshot[key] = readFileSync(path, "utf8")
      }
    }
  }
  return snapshot
}
