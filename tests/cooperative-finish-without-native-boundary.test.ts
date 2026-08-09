import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import process from "node:process"

import { afterEach, describe, expect, it, vi } from "vitest"

/**
 * Forced off so the no-artifact path runs wherever the suite runs.
 *
 * This mock is the whole reason the file exists. On darwin and linux
 * `reserveProjectReadBoundary` always succeeds, so the degraded branch is
 * indistinguishable from the normal one and no platform in the matrix can
 * reach it — which is why #235 was found by running Windows rather than by any
 * of the 2,192 tests, and why the #214 fallback shipped defeated one layer
 * below the branch that skipped the boundary on purpose.
 */
vi.mock("../src/io/native-project-read.js", async () => {
  const actual = await vi.importActual<typeof import("../src/io/native-project-read.js")>(
    "../src/io/native-project-read.js",
  )
  return { ...actual, nativeProjectReadPlatformSupported: () => false }
})

const { runPersonaCli } = await import("../src/cli/index.js")
const { prepareCooperativeFinishContext } = await import("../src/cli/cooperative-finish-context.js")
const { runCurrentProcessCooperativeFinish } = await import("../src/cli/cooperative-finish-authority.js")

const tempProjects: string[] = []

afterEach(() => {
  while (tempProjects.length > 0) {
    const projectDir = tempProjects.pop()
    if (projectDir !== undefined) {
      rmSync(projectDir, { recursive: true, force: true })
    }
  }
})

function bootstrappedProject(): string {
  const projectDir = mkdtempSync(join(tmpdir(), "persona-cooperative-no-boundary-"))
  tempProjects.push(projectDir)
  writeFileSync(
    join(projectDir, "package.json"),
    `${JSON.stringify({ name: "cooperative-no-boundary-fixture", private: true }, null, 2)}\n`,
  )
  const javaDir = join(projectDir, "src", "main", "java", "com", "example")
  mkdirSync(javaDir, { recursive: true })
  writeFileSync(join(javaDir, "TaskService.java"), "package com.example; public class TaskService { }\n")
  // The write boundary refuses a workspace it did not bootstrap, so the fixture
  // has to be built the way a user builds one.
  const original = process.cwd()
  process.chdir(projectDir)
  try {
    runPersonaCli(["init"], { cwd: ".", env: {}, invocationName: "ph" })
    runPersonaCli(["bootstrap", "backend"], { cwd: ".", env: {}, invocationName: "ph" })
  } finally {
    process.chdir(original)
  }
  return projectDir
}

describe("cooperative finish where no native project-read artifact is built", () => {
  it("prepares a context instead of blocking on the runtime", () => {
    // The regression: this returned `source-read-runtime-unavailable` because
    // it re-reserved the boundary the platform branch had skipped, so the
    // finish never evaluated a single blocker.
    const prepared = prepareCooperativeFinishContext(bootstrappedProject())

    expect(prepared.kind).toBe("ready")
  })

  it("still refuses to reach a passed decision", () => {
    // `doctor` states this platform "cannot reach a cooperative PASS", and the
    // boundary is what runs the build. Opening the context above puts
    // `runCooperativeGradleVerification` — a non-boundary path that returns
    // `passed` — directly in reach, so the refusal has to live here.
    const result = runCurrentProcessCooperativeFinish(bootstrappedProject())

    expect(result.kind).toBe("blocked")
    expect(result).toMatchObject({ code: "cooperative-pass-unavailable-on-this-platform" })
  })

  it("refuses a symlinked workspace root without the boundary", () => {
    // Weaker than an atomic `O_NOFOLLOW` open and stated as such, but a
    // symlinked root must still not be read as the thing it points at.
    const linkParent = mkdtempSync(join(tmpdir(), "persona-cooperative-link-"))
    tempProjects.push(linkParent)
    const target = bootstrappedProject()
    const link = join(linkParent, "project")
    symlinkSync(target, link, "dir")

    const prepared = prepareCooperativeFinishContext(link)

    expect(prepared).toMatchObject({ code: "workspace-root-unavailable", kind: "blocked" })
  })

  it("reports the project's real blockers through the rail", () => {
    const projectDir = bootstrappedProject()
    const original = process.cwd()
    process.chdir(projectDir)
    let result
    try {
      result = runPersonaCli(["workflow", "finish", "implement", "--assurance", "cooperative"], {
        cwd: ".",
        env: {},
        invocationName: "ph",
      })
    } finally {
      process.chdir(original)
    }

    const output = `${result.stdout}${result.stderr}`

    // The gate is unchanged: this project has done no work, so it must not pass.
    expect(result.status).not.toBe(0)
    // But it must fail on what the project is missing, not on the platform's
    // build matrix.
    expect(output).not.toContain("Cooperative verification blocked: source-read-runtime-unavailable.")

    // "reports blockers but cannot reach a cooperative PASS" is what `doctor`
    // promises such a platform, and the first half of it is a list this long.
    // Asserting only the absence above would pass just as well if the finish
    // reported nothing at all.
    for (const blocker of [
      "verification-unknown",
      "implementation-report-missing",
      "review-report-missing",
      "evidence-missing",
    ]) {
      expect(output).toContain(`Closure blocker: ${blocker}`)
    }
  })
})
