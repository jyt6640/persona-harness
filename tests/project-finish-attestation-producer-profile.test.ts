import { execFileSync } from "node:child_process"
import fs, {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  renameSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from "node:fs"
import { syncBuiltinESMExports } from "node:module"
import { tmpdir } from "node:os"
import { basename, dirname, join, relative } from "node:path"

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

    const result = runProducer(projectDir)

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
    const callerRoot = basename(projectDir)

    const result = withProjectCapability(dirname(projectDir), () => (
      runProjectFinishAttestationProducer(callerRoot, producerContext(projectDir), "0.7.0")
    ))

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

  it("keeps runner-owned producer symlinks outside the public caller source identity", () => {
    const runnerRoot = mkdtempSync(join(tmpdir(), "project-finish-producer-runner-"))
    const projectDir = createProject("absent", join(runnerRoot, ".project-finish-caller"))
    const producerBin = join(runnerRoot, ".persona-harness-producer", "node_modules", ".bin")
    projects.push(runnerRoot)
    mkdirSync(producerBin, { recursive: true })
    symlinkSync("../outside", join(producerBin, "node"))

    const result = withProjectCapability(runnerRoot, () => (
      runProjectFinishAttestationProducer(".project-finish-caller", producerContext(projectDir), "0.7.0")
    ))

    expect(result).toMatchObject({
      kind: "passed",
      value: { receipt: { source: { root: "." } } },
    })
  })

  it("blocks a producer root that differs from its prepared workspace identity", () => {
    const preparedProject = createProject("absent")
    const suppliedProject = createProject("absent")
    let calls = 0

    const result = withProjectCapability(suppliedProject, () => runProjectFinishAttestationGradleVerification(".", readyContext(preparedProject), {
      runProcess: () => {
        calls += 1
        return passed("")
      },
    }))

    expect(result).toEqual({ code: "workspace-identity-drift", kind: "blocked" })
    expect(calls).toBe(0)
  })

  it("blocks a symlinked caller root before it can capture source or execute Gradle", () => {
    const projectDir = createProject("absent")
    const alias = join(projectDir, "..", `${basename(projectDir)}-alias`)
    symlinkSync(projectDir, alias)
    let calls = 0

    const result = withProjectCapability(dirname(projectDir), () => runProjectFinishAttestationGradleVerification(alias, readyContext(projectDir), {
      runProcess: () => {
        calls += 1
        return passed("")
      },
    }))

    expect(result).toEqual({ code: "workspace-root-unavailable", kind: "blocked" })
    expect(calls).toBe(0)
  })

  it("preserves the public producer root blocker for a symlinked caller root", () => {
    const projectDir = createProject("absent")
    const alias = join(projectDir, "..", `${basename(projectDir)}-producer-alias`)
    symlinkSync(projectDir, alias)

    expect(withProjectCapability(dirname(projectDir), () => runProjectFinishAttestationProducer(alias, producerContext(projectDir), "0.7.0"))).toEqual({
      code: "workspace-root-unavailable",
      kind: "blocked",
    })
  })

  it("keeps ordinary cooperative Finish profile-less callers blocked", () => {
    const projectDir = createProject("absent")

    expect(withProjectCapability(projectDir, () => runCooperativeGradleVerification(".", readyContext(projectDir)))).toEqual({
      code: "profile-unready",
      kind: "blocked",
    })
  })

  it.each([
    ["malformed profile", "malformed" as const, "project-finish-producer-profile"],
    ["symlink profile", "symlink-profile" as const, "workspace-root-unavailable"],
    ["missing settings descriptor", "missing-settings" as const, "project-finish-producer-profile"],
    ["symlink settings descriptor", "symlink-settings" as const, "workspace-root-unavailable"],
  ])("blocks a %s before fixed Gradle commands", (_name, mode, code) => {
    const projectDir = createProject(mode === "symlink-profile" || mode === "symlink-settings" ? "canonical" : mode)
    const context = readyContext(projectDir)
    if (mode === "symlink-profile") {
      const profile = join(projectDir, ".persona", "project-profile.jsonc")
      const outside = join(projectDir, "outside-profile.jsonc")
      writeFileSync(outside, JSON.stringify(canonicalProfile()))
      unlinkSync(profile)
      symlinkSync(outside, profile)
    }
    if (mode === "symlink-settings") {
      const settings = join(projectDir, "settings.gradle")
      const outside = join(projectDir, "outside-settings.gradle")
      writeFileSync(outside, "rootProject.name = 'outside'\n")
      unlinkSync(settings)
      symlinkSync(outside, settings)
    }
    let calls = 0

    const result = withProjectCapability(projectDir, () => runProjectFinishAttestationGradleVerification(".", context, {
      runProcess: () => {
        calls += 1
        return passed("")
      },
    }))

    expect(result).toEqual({ code, kind: "blocked" })
    expect(calls).toBe(0)
  })

  it("binds root Gradle descriptor bytes and identity through the fixed attempt", () => {
    const projectDir = createProject("canonical")

    const result = withProjectCapability(projectDir, () => runProjectFinishAttestationGradleVerification(".", readyContext(projectDir), {
      runProcess: (options) => {
        if (options.args.includes("test")) {
          writeJUnit(projectDir)
          writeFileSync(join(projectDir, "settings.gradle"), "rootProject.name = 'changed'\n")
          return passed("> Task :cleanTest\n> Task :test\nBUILD SUCCESSFUL\n")
        }
        return passed("> Task :build\nBUILD SUCCESSFUL\n")
      },
    }))

    expect(result).toEqual({ code: "source-identity-drift", kind: "blocked" })
  })

  it("binds optional profile bytes and descriptor identity through the fixed attempt", () => {
    const projectDir = createProject("canonical")

    const result = withProjectCapability(projectDir, () => runProjectFinishAttestationGradleVerification(".", readyContext(projectDir), {
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
    }))

    expect(result).toEqual({ code: "source-identity-drift", kind: "blocked" })
  })

  it.each([
    ["profile leaf", (projectDir: string) => {
      const outside = join(projectDir, "outside-profile.jsonc")
      writeFileSync(outside, '{"token":"sk-live-aaaaaaaaaaaaaaaaaaaaaaaa"}\n')
      unlinkSync(join(projectDir, ".persona", "project-profile.jsonc"))
      symlinkSync(outside, join(projectDir, ".persona", "project-profile.jsonc"))
      return () => runProducer(projectDir)
    }],
    ["harness config leaf", (projectDir: string) => {
      const outside = join(projectDir, "outside-harness.jsonc")
      writeFileSync(join(projectDir, ".persona", "harness.jsonc"), "{}\n")
      writeFileSync(outside, '{"token":"sk-live-aaaaaaaaaaaaaaaaaaaaaaaa"}\n')
      unlinkSync(join(projectDir, ".persona", "harness.jsonc"))
      symlinkSync(outside, join(projectDir, ".persona", "harness.jsonc"))
      return () => runProducer(projectDir)
    }],
    ["Gradle settings leaf", (projectDir: string) => {
      const outside = join(projectDir, "outside-settings.gradle")
      writeFileSync(outside, "rootProject.name = 'sk-live-aaaaaaaaaaaaaaaaaaaaaaaa'\n")
      unlinkSync(join(projectDir, "settings.gradle"))
      symlinkSync(outside, join(projectDir, "settings.gradle"))
      return () => runProducer(projectDir)
    }],
    ["source leaf", (projectDir: string) => {
      const outside = join(projectDir, "outside-App.java")
      writeFileSync(outside, "class App { String token = \"sk-live-aaaaaaaaaaaaaaaaaaaaaaaa\"; }\n")
      unlinkSync(join(projectDir, "src", "main", "java", "App.java"))
      symlinkSync(outside, join(projectDir, "src", "main", "java", "App.java"))
      return () => runProducer(projectDir)
    }],
    ["source parent", (projectDir: string) => {
      const source = join(projectDir, "src", "main", "java")
      const outside = join(projectDir, "outside-source")
      mkdirSync(outside)
      writeFileSync(join(outside, "App.java"), "class App { String token = \"sk-live-aaaaaaaaaaaaaaaaaaaaaaaa\"; }\n")
      renameSync(source, `${source}.draft`)
      symlinkSync(outside, source)
      return () => runProducer(projectDir)
    }],
    ["selected project root", (projectDir: string) => {
      const context = producerContext(projectDir)
      const parent = dirname(projectDir)
      const name = basename(projectDir)
      const outside = `${projectDir}.outside`
      renameSync(projectDir, `${projectDir}.draft`)
      mkdirSync(outside)
      writeFileSync(join(outside, "build.gradle"), "// sk-live-aaaaaaaaaaaaaaaaaaaaaaaa\n")
      symlinkSync(outside, projectDir)
      return () => {
        try {
          return withProjectCapability(parent, () => runProjectFinishAttestationProducer(name, context, "0.7.0"))
        } finally {
          unlinkSync(projectDir)
          renameSync(`${projectDir}.draft`, projectDir)
        }
      }
    }],
  ])("rejects a native %s alias before a producer artifact can exist", (_name, createAlias) => {
    const projectDir = createProject("canonical")
    const result = createAlias(projectDir)()

    expect(result).toMatchObject({ kind: "blocked" })
    expect(result).not.toHaveProperty("value")
    expect(JSON.stringify(result)).not.toContain("sk-live-aaaaaaaaaaaaaaaaaaaaaaaa")
    expect(projectArtifactDirectoryExists(projectDir)).toBe(false)
  })
})

function createProject(
  mode: "absent" | "canonical" | "malformed" | "missing-settings" | "symlink-profile" | "symlink-settings",
  projectDir = mkdtempSync(join(tmpdir(), "project-finish-producer-profile-")),
): string {
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
  const result = withProjectCapability(projectDir, () => prepareCooperativeFinishContext("."))
  if (result.kind !== "ready") throw new Error(`expected ready context, received ${result.code}`)
  return result.value
}

function runProducer(projectDir: string) {
  return withProjectCapability(projectDir, () => (
    runProjectFinishAttestationProducer(".", producerContext(projectDir), "0.7.0")
  ))
}

function withProjectCapability<T>(projectDir: string, operation: () => T): T {
  const original = process.cwd()
  process.chdir(projectDir)
  try {
    return operation()
  } finally {
    process.chdir(original)
  }
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

function swapAtCapturedLeafLookup<T>(
  profilePath: string,
  draftPath: string,
  outsidePath: string,
  leafName: string,
  action: () => T,
): { readonly didSwap: boolean; readonly openedExternal: boolean; readonly value: T } {
  const originalLstat = fs.lstatSync
  const originalOpen = fs.openSync
  let openedExternal = false
  let swapped = false
  const replacementLstat = (...args: Parameters<typeof fs.lstatSync>) => {
    if (!swapped && args[0] === leafName) {
      swapped = true
      renameSync(profilePath, draftPath)
      symlinkSync(outsidePath, profilePath)
    }
    return originalLstat(...args)
  }
  Object.defineProperty(fs, "lstatSync", { configurable: true, value: replacementLstat, writable: true })
  fs.openSync = ((...args: Parameters<typeof fs.openSync>) => {
    if (args[0] === outsidePath) openedExternal = true
    return originalOpen(...args)
  }) as typeof fs.openSync
  syncBuiltinESMExports()
  try {
    const value = action()
    return { didSwap: swapped, openedExternal, value }
  } finally {
    Object.defineProperty(fs, "lstatSync", { configurable: true, value: originalLstat, writable: true })
    fs.openSync = originalOpen
    syncBuiltinESMExports()
    if (swapped) {
      unlinkSync(profilePath)
      renameSync(draftPath, profilePath)
    }
  }
}

function swapParentAtCapturedLeafLookup<T>(
  sourceDirectory: string,
  draftDirectory: string,
  outsideDirectory: string,
  outsideSource: string,
  leafName: string,
  action: () => T,
): { readonly didSwap: boolean; readonly openedExternal: boolean; readonly value: T } {
  const originalLstat = fs.lstatSync
  const originalOpen = fs.openSync
  let openedExternal = false
  let swapped = false
  const replacementLstat = (...args: Parameters<typeof fs.lstatSync>) => {
    if (!swapped && args[0] === leafName) {
      swapped = true
      renameSync(sourceDirectory, draftDirectory)
      symlinkSync(outsideDirectory, sourceDirectory)
    }
    return originalLstat(...args)
  }
  Object.defineProperty(fs, "lstatSync", { configurable: true, value: replacementLstat, writable: true })
  fs.openSync = ((...args: Parameters<typeof fs.openSync>) => {
    if (args[0] === outsideSource) openedExternal = true
    return originalOpen(...args)
  }) as typeof fs.openSync
  syncBuiltinESMExports()
  try {
    const value = action()
    return { didSwap: swapped, openedExternal, value }
  } finally {
    Object.defineProperty(fs, "lstatSync", { configurable: true, value: originalLstat, writable: true })
    fs.openSync = originalOpen
    syncBuiltinESMExports()
    if (swapped) {
      unlinkSync(sourceDirectory)
      renameSync(draftDirectory, sourceDirectory)
    }
  }
}

function swapProjectRootAtCapturedLeafLookup<T>(
  projectDir: string,
  draftPath: string,
  outsidePath: string,
  leafName: string,
  action: () => T,
): { readonly didSwap: boolean; readonly openedExternal: boolean; readonly value: T } {
  const originalLstat = fs.lstatSync
  const originalOpen = fs.openSync
  let openedExternal = false
  let swapped = false
  const replacementLstat = (...args: Parameters<typeof fs.lstatSync>) => {
    if (!swapped && args[0] === leafName) {
      swapped = true
      renameSync(projectDir, draftPath)
      symlinkSync(outsidePath, projectDir)
    }
    return originalLstat(...args)
  }
  Object.defineProperty(fs, "lstatSync", { configurable: true, value: replacementLstat, writable: true })
  fs.openSync = ((...args: Parameters<typeof fs.openSync>) => {
    if (args[0] === join(outsidePath, leafName)) openedExternal = true
    return originalOpen(...args)
  }) as typeof fs.openSync
  syncBuiltinESMExports()
  try {
    const value = action()
    return { didSwap: swapped, openedExternal, value }
  } finally {
    Object.defineProperty(fs, "lstatSync", { configurable: true, value: originalLstat, writable: true })
    fs.openSync = originalOpen
    syncBuiltinESMExports()
    if (swapped) {
      unlinkSync(projectDir)
      renameSync(draftPath, projectDir)
    }
  }
}

function projectArtifactDirectoryExists(projectDir: string): boolean {
  try {
    return fs.existsSync(join(projectDir, ".ci", "project-finish-attestation"))
  } catch {
    return false
  }
}
