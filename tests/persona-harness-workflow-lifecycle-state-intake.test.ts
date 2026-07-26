import fs, {
  chmodSync,
  existsSync,
  mkdirSync,
  realpathSync,
  mkdtempSync,
  renameSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from "node:fs"
import { syncBuiltinESMExports } from "node:module"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { runPersonaCli } from "../src/cli/index.js"

const projects: string[] = []
const WORKFLOW_STATE_FILES = ["workflow-loop-state.json", "ralph-loop-state.json"] as const

afterEach(() => {
  for (const projectDir of projects.splice(0)) {
    rmSync(projectDir, { force: true, recursive: true })
  }
})

describe("workflow lifecycle state intake", () => {
  it("blocks a symlinked workflow parent before strict bootstrap can write either loop state", () => {
    const projectDir = createProject()
    expect(runBootstrap(projectDir).status).toBe(0)
    const workflowDir = join(projectDir, ".persona", "workflow")
    const preserved = join(projectDir, ".persona", "workflow-preserved")
    const outside = join(projectDir, "outside-workflow")
    mkdirSync(outside)
    renameSync(workflowDir, preserved)
    symlinkSync(outside, workflowDir)

    const rerun = runBootstrap(projectDir)

    expect(rerun.status).toBe(1)
    expect(externalStateFiles(outside)).toEqual([])
    expect(`${rerun.stdout}${rerun.stderr}`).not.toContain(outside)
    expect(existsSync(join(preserved, "workflow-loop-state.json"))).toBe(true)
    expect(existsSync(join(preserved, "ralph-loop-state.json"))).toBe(true)
  })

  it("blocks either symlinked loop-state leaf without replacing the alias", () => {
    for (const stateName of WORKFLOW_STATE_FILES) {
      const projectDir = createProject()
      expect(runBootstrap(projectDir).status).toBe(0)
      const workflowDir = join(projectDir, ".persona", "workflow")
      const statePath = join(workflowDir, stateName)
      const outside = join(projectDir, `outside-${stateName}`)
      unlinkSync(statePath)
      symlinkSync(outside, statePath)

      const rerun = runBootstrap(projectDir)

      expect(rerun.status).toBe(1)
      expect(existsSync(outside)).toBe(false)
      expect(fs.lstatSync(statePath).isSymbolicLink()).toBe(true)
      expect(`${rerun.stdout}${rerun.stderr}`).not.toContain(outside)
    }
  })

  it("blocks a workflow-parent replacement race before a state leaf is reserved", () => {
    const projectDir = createProject()
    expect(runBootstrap(projectDir).status).toBe(0)
    const workflowDir = join(projectDir, ".persona", "workflow")
    const canonicalWorkflowDir = realpathSync(workflowDir)
    const preserved = join(projectDir, ".persona", "workflow-preserved")
    const outside = join(projectDir, "outside-workflow")
    mkdirSync(outside)
    const originalOpen = fs.openSync
    let swapped = false

    fs.openSync = ((...args: Parameters<typeof fs.openSync>) => {
      if (!swapped && args[0] === canonicalWorkflowDir) {
        swapped = true
        renameSync(workflowDir, preserved)
        symlinkSync(outside, workflowDir)
      }
      return originalOpen(...args)
    }) as typeof fs.openSync
    syncBuiltinESMExports()
    try {
      const rerun = runBootstrap(projectDir)

      expect(swapped).toBe(true)
      expect(rerun.status).toBe(1)
      expect(externalStateFiles(outside)).toEqual([])
      expect(`${rerun.stdout}${rerun.stderr}`).not.toContain(outside)
    } finally {
      fs.openSync = originalOpen
      syncBuiltinESMExports()
      if (swapped) {
        unlinkSync(workflowDir)
        renameSync(preserved, workflowDir)
      }
    }
  })

  it("blocks a loop-state replacement race before either existing leaf is opened", () => {
    for (const stateName of WORKFLOW_STATE_FILES) {
      const projectDir = createProject()
      expect(runBootstrap(projectDir).status).toBe(0)
      const workflowDir = join(projectDir, ".persona", "workflow")
      const statePath = join(realpathSync(workflowDir), stateName)
      const outside = join(projectDir, `outside-race-${stateName}`)
      const originalOpen = fs.openSync
      let swapped = false

      fs.openSync = ((...args: Parameters<typeof fs.openSync>) => {
        if (!swapped && args[0] === statePath) {
          swapped = true
          unlinkSync(statePath)
          symlinkSync(outside, statePath)
        }
        return originalOpen(...args)
      }) as typeof fs.openSync
      syncBuiltinESMExports()
      try {
        const rerun = runBootstrap(projectDir)

        expect(swapped).toBe(true)
        expect(rerun.status).toBe(1)
        expect(existsSync(outside)).toBe(false)
        expect(fs.lstatSync(statePath).isSymbolicLink()).toBe(true)
        expect(`${rerun.stdout}${rerun.stderr}`).not.toContain(outside)
      } finally {
        fs.openSync = originalOpen
        syncBuiltinESMExports()
      }
    }
  })
})

function createProject(): string {
  const projectDir = mkdtempSync(join(tmpdir(), "persona-lifecycle-state-intake-"))
  projects.push(projectDir)
  mkdirSync(join(projectDir, "src", "main", "java"), { recursive: true })
  writeFileSync(join(projectDir, "README.md"), "# Lifecycle state intake fixture\\n")
  writeFileSync(join(projectDir, "settings.gradle"), "rootProject.name = 'lifecycle-state-intake'\\n")
  writeFileSync(join(projectDir, "build.gradle"), "plugins { id 'java' }\\n")
  writeFileSync(join(projectDir, "src", "main", "java", "App.java"), "class App {}\\n")
  writeFileSync(join(projectDir, "gradlew"), "#!/bin/sh\\nprintf '%s\\n' 'BUILD SUCCESSFUL'\\n")
  chmodSync(join(projectDir, "gradlew"), 0o755)
  return projectDir
}

function runBootstrap(projectDir: string) {
  return runPersonaCli(["bootstrap", "backend", "--strict"], {
    cwd: projectDir,
    env: {},
    invocationName: "ph",
  })
}

function externalStateFiles(directory: string): readonly string[] {
  return WORKFLOW_STATE_FILES.filter((name) => existsSync(join(directory, name)))
}
