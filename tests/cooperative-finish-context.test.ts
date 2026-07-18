import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import {
  cooperativeWorkspaceKey,
  prepareCooperativeFinishContext,
} from "../src/cli/cooperative-finish-context.js"

const projects: string[] = []

afterEach(() => {
  for (const projectDir of projects.splice(0)) {
    rmSync(projectDir, { force: true, recursive: true })
  }
})

describe("cooperative Finish context", () => {
  it("uses a custom configured evidence root without creating the default root", () => {
    // Given: a workspace configured with an absent custom evidence root.
    const projectDir = createProject({ evidenceDir: ".persona/cooperative-evidence" })

    // When: cooperative Finish prepares its context.
    const result = prepareCooperativeFinishContext(projectDir)

    // Then: the canonical custom root is selected without evidence writes.
    expect(result.kind).toBe("ready")
    if (result.kind === "ready") {
      expect(result.value.evidenceRootRelativePath).toBe(".persona/cooperative-evidence")
      expect(cooperativeWorkspaceKey(result.value.workspace)).toContain("\u0000")
    }
    expect(existsSync(join(projectDir, ".persona", "evidence"))).toBe(false)
    expect(existsSync(join(projectDir, ".persona", "cooperative-evidence"))).toBe(false)
  })

  it("blocks malformed configuration without creating evidence paths", () => {
    // Given: a malformed harness configuration and no evidence directory.
    const projectDir = createProject("{ malformed")

    // When: cooperative Finish prepares its context.
    const result = prepareCooperativeFinishContext(projectDir)

    // Then: it blocks before creating either configured or default evidence.
    expect(result).toEqual({ code: "harness-config-invalid", kind: "blocked" })
    expect(existsSync(join(projectDir, ".persona", "evidence"))).toBe(false)
  })

  it("blocks escaping and symlinked evidence roots before snapshots", () => {
    // Given: unsafe configured evidence roots.
    const escaping = createProject({ evidenceDir: "../outside" })
    const linked = createProject({ evidenceDir: ".persona/link" })
    const target = join(linked, "target")
    mkdirSync(target)
    symlinkSync(target, join(linked, ".persona", "link"))

    // When: cooperative Finish prepares each context.
    const escapedResult = prepareCooperativeFinishContext(escaping)
    const linkedResult = prepareCooperativeFinishContext(linked)

    // Then: neither unsafe root can advance to source snapshots.
    expect(escapedResult).toEqual({ code: "harness-config-invalid", kind: "blocked" })
    expect(linkedResult).toEqual({ code: "harness-config-invalid", kind: "blocked" })
    expect(existsSync(join(escaping, ".persona", "evidence"))).toBe(false)
    expect(existsSync(join(linked, ".persona", "evidence"))).toBe(false)
  })
})

function createProject(config: string | { readonly evidenceDir: string }): string {
  const projectDir = mkdtempSync(join(tmpdir(), "persona-cooperative-context-"))
  projects.push(projectDir)
  mkdirSync(join(projectDir, ".persona"), { recursive: true })
  writeFileSync(
    join(projectDir, ".persona", "harness.jsonc"),
    typeof config === "string" ? config : `${JSON.stringify(config)}\n`,
  )
  return projectDir
}
