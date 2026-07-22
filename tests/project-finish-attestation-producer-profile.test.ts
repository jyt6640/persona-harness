import { execFileSync } from "node:child_process"
import fs, {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  renameSync,
  realpathSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from "node:fs"
import { syncBuiltinESMExports } from "node:module"
import { tmpdir } from "node:os"
import { join, relative } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { type BoundedProcessResult } from "../src/cli/bounded-process.js"
import { prepareCooperativeFinishContext } from "../src/cli/cooperative-finish-context.js"
import {
  runCooperativeGradleVerification,
  runProjectFinishAttestationGradleVerification,
} from "../src/cli/cooperative-gradle-verification.js"
import { runProjectFinishAttestationProducer } from "../src/cli/project-finish-attestation-producer-runner.js"
import type { ProjectFinishAttestationProducerContext } from "../src/cli/project-finish-attestation-producer-runner.js"

const projects: string[] = []

afterEach(() => {
  for (const project of projects.splice(0)) {
    rmSync(project, { force: true, recursive: true })
  }
})

describe("project finish producer input readiness", () => {
  it("constructs a receipt for a profile-less public Gradle caller through the default producer runner", () => {
    const projectDir = createProject("absent")

    const result = runProjectFinishAttestationProducer(projectDir, producerContext(projectDir), "0.7.0")

    expect(result).toMatchObject({
      kind: "passed",
      value: {
        receipt: {
          source: { head: sourceHead(projectDir) },
          test: { count: 1, failed: 0, passed: 1, skipped: 0 },
        },
      },
    })
  })

  it("accepts a relative public caller root through the producer verification boundary", () => {
    const projectDir = createProject("absent")
    const callerRoot = relative(process.cwd(), projectDir)

    const result = runProjectFinishAttestationProducer(callerRoot, producerContext(callerRoot), "0.7.0")

    expect(result).toMatchObject({
      kind: "passed",
      value: {
        receipt: {
          source: { root: "." },
          test: { count: 1, failed: 0, passed: 1, skipped: 0 },
        },
      },
    })
  })

  it("blocks a producer root that differs from its prepared workspace identity", () => {
    const preparedProject = createProject("absent")
    const suppliedProject = createProject("absent")
    let calls = 0

    const result = runProjectFinishAttestationGradleVerification(suppliedProject, readyContext(preparedProject), {
      runProcess: () => {
        calls += 1
        return passed("")
      },
    })

    expect(result).toEqual({ code: "workspace-identity-drift", kind: "blocked" })
    expect(calls).toBe(0)
  })

  it("keeps ordinary cooperative Finish profile-less callers blocked", () => {
    const projectDir = createProject("absent")

    expect(runCooperativeGradleVerification(projectDir, readyContext(projectDir))).toEqual({
      code: "profile-unready",
      kind: "blocked",
    })
  })

  it.each([
    ["malformed profile", "malformed" as const],
    ["symlink profile", "symlink-profile" as const],
    ["missing settings descriptor", "missing-settings" as const],
    ["symlink settings descriptor", "symlink-settings" as const],
  ])("blocks a %s before fixed Gradle commands", (_name, mode) => {
    const projectDir = createProject(mode)
    let calls = 0

    const result = runProjectFinishAttestationGradleVerification(projectDir, readyContext(projectDir), {
      runProcess: () => {
        calls += 1
        return passed("")
      },
    })

    expect(result).toEqual({ code: "project-finish-producer-profile", kind: "blocked" })
    expect(calls).toBe(0)
  })

  it("binds root Gradle descriptor bytes and identity through the fixed attempt", () => {
    const projectDir = createProject("canonical")

    const result = runProjectFinishAttestationGradleVerification(projectDir, readyContext(projectDir), {
      runProcess: (options) => {
        if (options.args.includes("test")) {
          writeJUnit(projectDir)
          writeFileSync(join(projectDir, "settings.gradle"), "rootProject.name = 'changed'\n")
          return passed("> Task :cleanTest\n> Task :test\nBUILD SUCCESSFUL\n")
        }
        return passed("> Task :build\nBUILD SUCCESSFUL\n")
      },
    })

    expect(result).toEqual({ code: "source-identity-drift", kind: "blocked" })
  })

  it("binds optional profile bytes and descriptor identity through the fixed attempt", () => {
    const projectDir = createProject("canonical")

    const result = runProjectFinishAttestationGradleVerification(projectDir, readyContext(projectDir), {
      runProcess: (options) => {
        if (options.args.includes("test")) {
          writeJUnit(projectDir)
          writeFileSync(
            join(projectDir, ".persona", "project-profile.jsonc"),
            `${JSON.stringify(canonicalProfile(), null, 2)}\n`,
          )
          return passed("> Task :cleanTest\n> Task :test\nBUILD SUCCESSFUL\n")
        }
        return passed("> Task :build\nBUILD SUCCESSFUL\n")
      },
    })

    expect(result).toEqual({ code: "source-identity-drift", kind: "blocked" })
  })

  it("rejects a regular profile replaced with an external symlink at the real producer input boundary", () => {
    const projectDir = createProject("canonical")
    const profilePath = join(projectDir, ".persona", "project-profile.jsonc")
    const draftPath = join(projectDir, ".persona", "project-profile.draft.jsonc")
    const outsidePath = join(projectDir, "outside-profile.jsonc")
    writeFileSync(profilePath, `${JSON.stringify({ ...canonicalProfile(), status: "draft" })}\n`)
    writeFileSync(outsidePath, `${JSON.stringify(canonicalProfile())}\n`)

    const swapped = swapAtNoFollowOpen(realpathSync(profilePath), draftPath, outsidePath, () => (
      runProjectFinishAttestationProducer(projectDir, producerContext(projectDir), "0.7.0")
    ))

    expect(swapped.didSwap).toBe(true)
    expect(swapped.value).toEqual({ code: "project-finish-producer-profile", kind: "blocked" })
    expect(swapped.value).not.toHaveProperty("value")
    expect(JSON.stringify(swapped.value)).not.toContain(outsidePath)
    expect(JSON.stringify(swapped.value)).not.toContain("sk-live-aaaaaaaaaaaaaaaaaaaaaaaa")
  })
})

function createProject(
  mode: "absent" | "canonical" | "malformed" | "missing-settings" | "symlink-profile" | "symlink-settings",
): string {
  const projectDir = mkdtempSync(join(tmpdir(), "project-finish-producer-profile-"))
  projects.push(projectDir)
  mkdirSync(join(projectDir, "src", "main", "java"), { recursive: true })
  writeFileSync(join(projectDir, "build.gradle"), "plugins { id 'java' }\n")
  if (mode !== "missing-settings" && mode !== "symlink-settings") {
    writeFileSync(join(projectDir, "settings.gradle"), "rootProject.name = 'profile-ready'\n")
  }
  if (mode === "symlink-settings") {
    const outside = join(projectDir, "outside-settings.gradle")
    writeFileSync(outside, "rootProject.name = 'outside'\n")
    symlinkSync(outside, join(projectDir, "settings.gradle"))
  }
  writeFileSync(join(projectDir, "src", "main", "java", "App.java"), "class App {}\n")
  writeFileSync(
    join(projectDir, "gradlew"),
    [
      "#!/bin/sh",
      "case \"$*\" in",
      "  *cleanTest*)",
      "    mkdir -p build/test-results/test",
      "    printf '%s\\n' '<testsuite tests=\"1\" failures=\"0\" errors=\"0\" skipped=\"0\"><testcase name=\"works\"/></testsuite>' > build/test-results/test/TEST-profile.xml",
      "    printf '%s\\n' '> Task :cleanTest' '> Task :test' 'BUILD SUCCESSFUL'",
      "    ;;",
      "  *)",
      "    printf '%s\\n' '> Task :build' 'BUILD SUCCESSFUL'",
      "    ;;",
      "esac",
      "",
    ].join("\n"),
  )
  chmodSync(join(projectDir, "gradlew"), 0o755)
  if (mode !== "absent") mkdirSync(join(projectDir, ".persona"), { recursive: true })
  if (mode === "canonical") writeProfile(projectDir, canonicalProfile())
  if (mode === "malformed") writeFileSync(join(projectDir, ".persona", "project-profile.jsonc"), "{\n")
  if (mode === "symlink-profile") {
    const outside = join(projectDir, "outside-profile.jsonc")
    writeFileSync(outside, JSON.stringify(canonicalProfile()))
    symlinkSync(outside, join(projectDir, ".persona", "project-profile.jsonc"))
  }
  execFileSync("git", ["init", "-q"], { cwd: projectDir })
  execFileSync("git", ["config", "user.email", "ph@example.invalid"], { cwd: projectDir })
  execFileSync("git", ["config", "user.name", "PH Test"], { cwd: projectDir })
  execFileSync("git", ["add", "."], { cwd: projectDir })
  execFileSync("git", ["commit", "-qm", "profile fixture"], { cwd: projectDir })
  return projectDir
}

function readyContext(projectDir: string) {
  const result = prepareCooperativeFinishContext(projectDir)
  if (result.kind !== "ready") throw new Error(`expected ready context, received ${result.code}`)
  return result.value
}

function producerContext(projectDir: string): ProjectFinishAttestationProducerContext {
  const head = sourceHead(projectDir)
  return {
    callerWorkflowRef: "example/public-gradle-app/.github/workflows/project-finish.yml@refs/heads/main",
    callerWorkflowSha: head,
    issuedAt: "2026-07-22T01:00:00.000Z",
    repository: { id: 123, slug: "example/public-gradle-app", visibility: "public" },
    reusableWorkflowSha: "b".repeat(40),
    runAttempt: 1,
    runId: "42",
    sourceHead: head,
  }
}

function sourceHead(projectDir: string): string {
  return execFileSync("git", ["rev-parse", "HEAD"], { cwd: projectDir, encoding: "utf8" }).trim()
}

function writeJUnit(projectDir: string): void {
  const root = join(projectDir, "build", "test-results", "test")
  mkdirSync(root, { recursive: true })
  writeFileSync(
    join(root, "TEST-profile.xml"),
    '<testsuite tests="1" failures="0" errors="0" skipped="0"><testcase name="works"/></testsuite>',
  )
}

function writeProfile(projectDir: string, profile: Readonly<Record<string, unknown>>): void {
  writeFileSync(join(projectDir, ".persona", "project-profile.jsonc"), `${JSON.stringify(profile)}\n`)
}

function canonicalProfile(): Readonly<Record<string, unknown>> {
  return {
    defaults: { buildTool: "gradle", framework: "spring", language: "java" },
    schema: "persona.project-profile.v1",
    scope: { mvp: "java-spring-clean-code", role: "backend" },
    status: "ready",
  }
}

function passed(stdout: string): BoundedProcessResult {
  return {
    killed: false,
    outcome: "passed",
    outputLimited: false,
    signal: null,
    status: 0,
    stderr: "",
    stdout,
    timedOut: false,
  }
}

function swapAtNoFollowOpen<T>(
  profilePath: string,
  draftPath: string,
  outsidePath: string,
  action: () => T,
): { readonly didSwap: boolean; readonly value: T } {
  const originalOpen = fs.openSync
  let swapped = false
  fs.openSync = ((...args: Parameters<typeof fs.openSync>) => {
    if (!swapped && args[0] === profilePath) {
      swapped = true
      renameSync(profilePath, draftPath)
      symlinkSync(outsidePath, profilePath)
    }
    return originalOpen(...args)
  }) as typeof fs.openSync
  syncBuiltinESMExports()
  try {
    const value = action()
    return { didSwap: swapped, value }
  } finally {
    fs.openSync = originalOpen
    syncBuiltinESMExports()
    if (swapped) {
      unlinkSync(profilePath)
      renameSync(draftPath, profilePath)
    }
  }
}
