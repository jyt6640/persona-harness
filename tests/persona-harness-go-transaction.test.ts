import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { runPersonaCli } from "../src/cli/index.js"
import {
  createReadyGoProject,
  removeGoProject,
  workflowSnapshot,
} from "./helpers/go-fixtures.js"

const tempProjects: string[] = []
const tempPaths: string[] = []

function readyProject(): string {
  const projectDir = createReadyGoProject()
  tempProjects.push(projectDir)
  return projectDir
}

function expectSingleNextCommand(stderr: string, command: string): void {
  expect(stderr).toContain(`Next command: ${command}`)
  expect(stderr.match(/npx ph/gu)).toHaveLength(1)
}

afterEach(() => {
  for (const projectDir of tempProjects) {
    removeGoProject(projectDir)
  }
  tempProjects.length = 0
  for (const path of tempPaths) {
    rmSync(path, { force: true, recursive: true })
  }
  tempPaths.length = 0
})

describe("ph go transaction safety", () => {
  it("rolls back every workflow artifact when an injected failure occurs after capture", () => {
    const projectDir = readyProject()
    const before = workflowSnapshot(projectDir)

    const result = runPersonaCli(["go", "Add task creation."], {
      cwd: projectDir,
      env: {},
      invocationName: "ph",
      onBeforeGoStep: (step: string) => {
        if (step === "implement") {
          throw new RangeError("injected go transaction failure")
        }
      },
    })

    expect(result.status).toBe(1)
    expect(result.stderr).toContain("pre-command workflow state restored")
    expect(result.stderr).not.toContain("injected go transaction failure")
    expect(workflowSnapshot(projectDir)).toEqual(before)
  })

  it("preserves workflow writes made outside the staged transaction when a later step fails", () => {
    const projectDir = readyProject()
    const externalWrite = join(projectDir, ".persona", "workflow", "external-note.md")

    const result = runPersonaCli(["go", "Add task creation."], {
      cwd: projectDir,
      env: {},
      invocationName: "ph",
      onBeforeGoStep: (step: string) => {
        if (step === "implement") {
          writeFileSync(externalWrite, "concurrent workflow note\n")
          throw new Error("stop after external write")
        }
      },
    })

    expect(result.status).toBe(1)
    expect(readFileSync(externalWrite, "utf8")).toBe("concurrent workflow note\n")
    expect(existsSync(join(projectDir, ".persona", "workflow", "requirements", "latest.md"))).toBe(false)
  })

  it("refuses to commit staged ticket state when the original workflow changes concurrently", () => {
    const projectDir = readyProject()
    const externalWrite = join(projectDir, ".persona", "workflow", "external-note.md")

    const result = runPersonaCli(["go", "Add task creation."], {
      cwd: projectDir,
      env: {},
      invocationName: "ph",
      onBeforeGoStep: (step: string) => {
        if (step === "implement") {
          writeFileSync(externalWrite, "concurrent workflow note\n")
        }
      },
    })

    expect(result.status).toBe(1)
    expectSingleNextCommand(result.stderr, "npx ph workflow check")
    expect(readFileSync(externalWrite, "utf8")).toBe("concurrent workflow note\n")
    expect(existsSync(join(projectDir, ".persona", "workflow", "requirements", "latest.md"))).toBe(false)
  })

  it("rejects a workflow change that lands while the staging copy is being prepared", () => {
    const projectDir = readyProject()
    const externalWrite = join(projectDir, ".persona", "workflow", "copy-window-note.md")

    const result = runPersonaCli(["go", "Add task creation."], {
      cwd: projectDir,
      env: {},
      invocationName: "ph",
      onAfterGoTransactionCopy: () => {
        writeFileSync(externalWrite, "copy-window workflow note\n")
      },
    })

    expect(result.status).toBe(1)
    expectSingleNextCommand(result.stderr, "npx ph workflow check")
    expect(readFileSync(externalWrite, "utf8")).toBe("copy-window workflow note\n")
    expect(existsSync(join(projectDir, ".persona", "workflow", "requirements", "latest.md"))).toBe(false)
  })

  it("rejects replacement of the persona parent with an external symlink after staging", () => {
    const projectDir = readyProject()
    const externalDir = mkdtempSync(join(tmpdir(), "persona-go-persona-race-"))
    tempPaths.push(externalDir)
    const personaPath = join(projectDir, ".persona")
    const displacedPath = join(projectDir, ".persona-displaced")
    const externalPersona = join(externalDir, "persona")

    const result = runPersonaCli(["go", "Add task creation."], {
      cwd: projectDir,
      env: {},
      invocationName: "ph",
      onAfterGoTransactionCopy: () => {
        cpSync(personaPath, externalPersona, { recursive: true })
        renameSync(personaPath, displacedPath)
        symlinkSync(externalPersona, personaPath, "dir")
      },
    })

    expect(result.status).toBe(1)
    expectSingleNextCommand(result.stderr, "npx ph workflow check")
    expect(existsSync(join(externalPersona, "workflow", "requirements", "latest.md"))).toBe(false)
  })

  it("preserves a concurrent file created after commit starts", () => {
    const projectDir = readyProject()
    const externalWrite = join(projectDir, ".persona", "workflow", "work", "concurrent-note.md")
    let injected = false

    const result = runPersonaCli(["go", "Add task creation."], {
      cwd: projectDir,
      env: {},
      invocationName: "ph",
      onAfterGoCommitFile: (relativePath: string) => {
        if (!injected && relativePath.endsWith("00-task-card.md")) {
          injected = true
          writeFileSync(externalWrite, "commit-window workflow note\n")
        }
      },
    })

    expect(result.status).toBe(1)
    expectSingleNextCommand(result.stderr, "npx ph workflow check")
    expect(readFileSync(externalWrite, "utf8")).toBe("commit-window workflow note\n")
    expect(existsSync(join(projectDir, ".persona", "workflow", "requirements", "latest.md"))).toBe(false)
    expect(existsSync(join(projectDir, ".persona", "workflow", "backlog.md"))).toBe(false)
  })

  it("preserves a concurrent replacement of a file created during commit", () => {
    const projectDir = readyProject()
    const latestPath = join(projectDir, ".persona", "workflow", "requirements", "latest.md")

    const result = runPersonaCli(["go", "Add task creation."], {
      cwd: projectDir,
      env: {},
      invocationName: "ph",
      onAfterGoCommitFile: (relativePath: string) => {
        if (relativePath.endsWith("latest.md")) {
          writeFileSync(latestPath, "concurrent replacement\n")
        }
      },
    })

    expect(result.status).toBe(1)
    expectSingleNextCommand(result.stderr, "npx ph workflow check")
    expect(readFileSync(latestPath, "utf8")).toBe("concurrent replacement\n")
    expect(existsSync(join(projectDir, ".persona", "workflow", "backlog.md"))).toBe(false)
  })

  it("rejects symlinked workflow write boundaries without touching the external target", () => {
    const projectDir = readyProject()
    const externalDir = mkdtempSync(join(tmpdir(), "persona-go-external-"))
    tempPaths.push(externalDir)
    symlinkSync(externalDir, join(projectDir, ".persona", "workflow", "requirements"), "dir")

    const result = runPersonaCli(["go", "Add task creation."], {
      cwd: projectDir,
      env: {},
      invocationName: "ph",
    })

    expect(result.status).toBe(1)
    expectSingleNextCommand(result.stderr, "npx ph workflow check")
    expect(existsSync(join(externalDir, "latest.md"))).toBe(false)
  })

  it("preserves an external directory when a workflow parent becomes a symlink during commit", () => {
    const projectDir = readyProject()
    const externalDir = mkdtempSync(join(tmpdir(), "persona-go-parent-race-"))
    tempPaths.push(externalDir)
    const externalTicketDir = join(externalDir, "req-1")
    const workPath = join(projectDir, ".persona", "workflow", "work")
    mkdirSync(externalTicketDir)
    let injected = false

    const result = runPersonaCli(["go", "Add task creation."], {
      cwd: projectDir,
      env: {},
      invocationName: "ph",
      onAfterGoCommitFile: () => {
        if (!injected) {
          injected = true
          symlinkSync(externalDir, workPath, "dir")
        }
      },
    })

    expect(result.status).toBe(1)
    expectSingleNextCommand(result.stderr, "npx ph workflow check")
    expect(existsSync(externalTicketDir)).toBe(true)
    expect(readdirSync(externalTicketDir)).toEqual([])
  })

  it("serializes concurrent go commands before either can create ticket state", () => {
    const projectDir = readyProject()
    let concurrentStatus: number | undefined
    let concurrentStderr = ""

    const result = runPersonaCli(["go", "Add the first task endpoint."], {
      cwd: projectDir,
      env: {},
      invocationName: "ph",
      onBeforeGoStep: (step: string) => {
        if (step === "split") {
          const concurrent = runPersonaCli(["go", "Add the second task endpoint."], {
            cwd: projectDir,
            env: {},
            invocationName: "ph",
          })
          concurrentStatus = concurrent.status
          concurrentStderr = concurrent.stderr
        }
      },
    })

    expect(result.status).toBe(0)
    expect(concurrentStatus).toBe(1)
    expectSingleNextCommand(concurrentStderr, "npx ph workflow check")
    expect(readFileSync(join(projectDir, ".persona", "workflow", "requirements", "latest.md"), "utf8"))
      .toBe("Add the first task endpoint.\n")
  })
})
