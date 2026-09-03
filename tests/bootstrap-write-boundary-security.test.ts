import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import {
  BootstrapWriteBoundaryError,
  BootstrapWriteBoundaryLimitError,
  reserveExistingBootstrapWriteBoundary,
} from "../src/io/bootstrap-write-boundary.js"

const temporaryProjects: string[] = []

afterEach(() => {
  for (const project of temporaryProjects) rmSync(project, { force: true, recursive: true })
  temporaryProjects.length = 0
})

describe("bootstrap write boundary security", () => {
  it("rejects Windows separators and caps a no-follow identity read before exposing bytes", () => {
    const project = createProject()
    const boundary = reserveExistingBootstrapWriteBoundary(project)

    try {
      writeFileSync(join(project, ".persona", "oversized.json"), "x".repeat(1025))

      expect(() => boundary.writeProjectFileAtomically("decisions\\..\\outside.json", "{}\n")).toThrow(
        BootstrapWriteBoundaryError,
      )
      expect(() => boundary.readProjectFileWithIdentity(".persona/oversized.json", 1024)).toThrow(
        BootstrapWriteBoundaryLimitError,
      )
      expect(existsSync(join(project, "outside.json"))).toBe(false)
    } finally {
      boundary.close()
    }
  })

  it("recovers a dead-process lock without retaining the marker after an atomic write", () => {
    const project = createProject()
    const lockPath = join(project, ".persona", "decisions", ".socratic-interview.json.lock")
    mkdirSync(join(project, ".persona", "decisions"), { recursive: true })
    writeFileSync(lockPath, "999999999\n")
    const boundary = reserveExistingBootstrapWriteBoundary(project)

    try {
      expect(boundary.writeProjectFileAtomically(".persona/decisions/socratic-interview.json", "{}\n")).toBe(true)
      expect(readFileSync(join(project, ".persona", "decisions", "socratic-interview.json"), "utf8")).toBe("{}\n")
      expect(existsSync(lockPath)).toBe(false)
    } finally {
      boundary.close()
    }
  })
})

function createProject(): string {
  const project = mkdtempSync(join(tmpdir(), "persona-bootstrap-write-boundary-"))
  temporaryProjects.push(project)
  mkdirSync(join(project, ".persona", "workflow"), { recursive: true })
  return project
}
