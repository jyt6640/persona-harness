import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { mkdirSync, mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import process from "node:process"

const mocks = vi.hoisted(() => ({
  nativeTreeFailure: undefined as Error | undefined,
  reserveProjectReadBoundary: vi.fn(),
}))

vi.mock("../src/io/native-project-read.js", async () => {
  const actual = await vi.importActual<typeof import("../src/io/native-project-read.js")>(
    "../src/io/native-project-read.js",
  )
  const identity = {
    ctimeNs: "1",
    dev: "1",
    ino: "1",
    mode: "16877",
    mtimeNs: "1",
    size: "0",
  }
  return {
    ...actual,
    captureNativeProjectReadRootContext: (projectPath: string) => ({
      anchor: "current" as const,
      parent: identity,
      projectPath,
      root: identity,
      rootName: "fixture",
    }),
    nativeProjectReadPlatformSupported: () => true,
    readNativeProjectDirectoryIdentity: () => identity,
    readNativeProjectTree: () => {
      throw mocks.nativeTreeFailure ?? new actual.NativeProjectReadLimitError()
    },
  }
})

vi.mock("../src/io/bootstrap-write-boundary.js", async () => {
  const actual = await vi.importActual<typeof import("../src/io/bootstrap-write-boundary.js")>(
    "../src/io/bootstrap-write-boundary.js",
  )
  return { ...actual, reserveProjectReadBoundary: mocks.reserveProjectReadBoundary }
})

vi.mock("../src/cli/workflow-status.js", async () => {
  const actual = await vi.importActual<typeof import("../src/cli/workflow-status.js")>(
    "../src/cli/workflow-status.js",
  )
  return {
    ...actual,
    readWorkflowStatus: (projectDir?: string) => ({
      projectDir: projectDir ?? process.cwd(),
    } as ReturnType<typeof actual.readWorkflowStatus>),
  }
})

const boundary = await import("../src/io/bootstrap-write-boundary.js")
const nativeRead = await import("../src/io/native-project-read.js")
const actualBoundary = await vi.importActual<typeof import("../src/io/bootstrap-write-boundary.js")>(
  "../src/io/bootstrap-write-boundary.js",
)
const { runPersonaCli } = await import("../src/cli/index.js")
const { prepareCooperativeFinishContext } = await import("../src/cli/cooperative-finish-context.js")
const {
  runCooperativeGradleVerification,
  runProjectFinishAttestationGradleVerification,
} = await import("../src/cli/cooperative-gradle-verification.js")
const { runWorkflowClosureCommand } = await import("../src/cli/workflow-closure.js")

const originalCwd = process.cwd()
let projectDir: string

beforeEach(() => {
  projectDir = mkdtempSync(join(tmpdir(), "source-read-failure-"))
  mkdirSync(join(projectDir, ".persona"))
  process.chdir(projectDir)
  mocks.reserveProjectReadBoundary.mockReset()
  mocks.nativeTreeFailure = undefined
})

afterEach(() => {
  process.chdir(originalCwd)
  rmSync(projectDir, { force: true, recursive: true })
})

describe.sequential("source-read failure classification", () => {
  it.each([
    ["limit", () => new nativeRead.NativeProjectReadLimitError(), "source-read-limit"],
    ["unsafe", () => new nativeRead.NativeProjectReadUnsafeError(), "source-read-unsafe"],
    ["runtime", () => new nativeRead.NativeProjectReadRuntimeError(), "source-read-runtime-unavailable"],
  ])("normalizes native %s failures without losing their cause", (_name, createError, expectedCode) => {
    mocks.nativeTreeFailure = createError()
    let thrown: unknown
    try {
      actualBoundary.reserveProjectReadBoundary(process.cwd())
    } catch (error) {
      thrown = error
    }

    expect(boundary.projectReadBoundaryFailureCode(thrown)).toBe(expectedCode)
    if (expectedCode === "source-read-limit") {
      expect(thrown).toBeInstanceOf(boundary.ProjectReadBoundaryLimitError)
    } else {
      expect(thrown).toBeInstanceOf(boundary.ProjectReadBoundaryError)
    }
  })

  it.each([
    ["unsafe", new boundary.ProjectReadBoundaryError("source-read-unsafe"), "source-read-unsafe", "source-read-unsafe"],
    ["limit", new boundary.ProjectReadBoundaryLimitError(), "source-read-limit", "source-read-limit"],
    ["runtime", new boundary.ProjectReadBoundaryError("source-read-runtime-unavailable"), "source-read-runtime-unavailable", "source-read-runtime-unavailable"],
    ["untyped", new Error("native operation failed"), "source-read-runtime-unavailable", "project-finish-producer-profile"],
  ])("keeps %s failures distinct in closure, Finish, and cooperative preparation", (_name, failure, expectedCode, expectedAttestationCode) => {
    mocks.reserveProjectReadBoundary.mockImplementation(() => {
      throw failure
    })

    const closure = runWorkflowClosureCommand("status", { projectDir: "." })
    expect(closure.stderr).toBe(`${expectedCode}\n`)

    const finish = runPersonaCli(
      ["workflow", "finish", "implement", "--assurance", "cooperative"],
      { cwd: ".", env: {}, invocationName: "ph" },
    )
    expect(finish.status).toBe(1)
    expect(finish.stderr).toContain(expectedCode)
    if (expectedCode !== "source-read-runtime-unavailable") {
      expect(finish.stderr).not.toContain("Blocker: source-read-runtime-unavailable")
    }

    expect(prepareCooperativeFinishContext(projectDir)).toEqual({
      code: expectedCode,
      kind: "blocked",
    })

    const context = {
      evidenceRoot: join(projectDir, ".persona", "evidence"),
      evidenceRootRelativePath: ".persona/evidence",
      workspace: { dev: "1", ino: "1", realpath: projectDir },
    }
    expect(runCooperativeGradleVerification(projectDir, context)).toEqual({
      code: expectedCode,
      kind: "blocked",
    })
    expect(runProjectFinishAttestationGradleVerification(projectDir, context)).toEqual({
      code: expectedAttestationCode,
      kind: "blocked",
    })
  })
})
