import {
  existsSync,
  linkSync,
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
  it("rejects Windows path forms and caps every bounded decision-record read", () => {
    const project = createProject()
    const boundary = reserveExistingBootstrapWriteBoundary(project)

    try {
      writeFileSync(join(project, ".persona", "oversized.json"), "x".repeat(1025))

      expect(() => boundary.writeProjectFileAtomically("decisions\\..\\outside.json", "{}\n")).toThrow(
        BootstrapWriteBoundaryError,
      )
      expect(() => boundary.writeProjectFileAtomically("C:outside.json", "{}\n")).toThrow(BootstrapWriteBoundaryError)
      expect(() => boundary.writeProjectFileAtomically("decision.json:alternate-stream", "{}\n")).toThrow(BootstrapWriteBoundaryError)
      expect(() => boundary.readProjectFileWithIdentity(".persona/oversized.json", 1024)).toThrow(
        BootstrapWriteBoundaryLimitError,
      )
      expect(() => boundary.writeProjectFileAtomicallyIfUnchanged(
        ".persona/oversized.json",
        undefined,
        "{}\n",
        1024,
      )).toThrow(BootstrapWriteBoundaryLimitError)
      expect(existsSync(join(project, "outside.json"))).toBe(false)
    } finally {
      boundary.close()
    }
  })

  it("rejects a hardlinked target before a descriptor write can alter the external inode", () => {
    const project = createProject()
    const decisions = join(project, ".persona", "decisions")
    const external = join(project, "external-record.json")
    const target = join(decisions, "socratic-interview.json")
    mkdirSync(decisions, { recursive: true })
    writeFileSync(external, "external-original\n")
    linkSync(external, target)
    const boundary = reserveExistingBootstrapWriteBoundary(project)

    try {
      expect(() => boundary.writeProjectFileAtomically(".persona/decisions/socratic-interview.json", "replacement\n", 1024)).toThrow(
        BootstrapWriteBoundaryError,
      )
      expect(readFileSync(external, "utf8")).toBe("external-original\n")
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

  it("does not reclaim a stale lock while another boundary writer owns the reclaim guard", () => {
    const project = createProject()
    const decisions = join(project, ".persona", "decisions")
    const lockPath = join(decisions, ".socratic-interview.json.lock")
    const reclaimPath = `${lockPath}.reclaim`
    mkdirSync(decisions, { recursive: true })
    writeFileSync(lockPath, "999999999\n")
    writeFileSync(reclaimPath, "12345\n")
    const boundary = reserveExistingBootstrapWriteBoundary(project)

    try {
      expect(() => boundary.writeProjectFileAtomically(".persona/decisions/socratic-interview.json", "{}\n")).toThrow(
        BootstrapWriteBoundaryError,
      )
      expect(readFileSync(lockPath, "utf8")).toBe("999999999\n")
      expect(readFileSync(reclaimPath, "utf8")).toBe("12345\n")
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
