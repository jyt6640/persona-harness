import { existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import process from "node:process"

import { afterEach, describe, expect, it, vi } from "vitest"

// Forced off so the degraded path is exercised wherever the suite runs. The
// project read boundary loads a native addon built for darwin and linux only,
// so on Windows this was the difference between `ph evidence read` working and
// returning "Evidence read unavailable." — and it is the only producer of the
// `fileRole` evidence `java-role-read-coverage` accepts, which put a
// cooperative PASS out of reach on that platform entirely.
vi.mock("../src/io/native-project-read.js", async () => {
  const actual = await vi.importActual<typeof import("../src/io/native-project-read.js")>(
    "../src/io/native-project-read.js",
  )
  return { ...actual, nativeProjectReadPlatformSupported: () => false }
})

const { runPersonaCli } = await import("../src/cli/index.js")

const tempProjects: string[] = []

afterEach(() => {
  while (tempProjects.length > 0) {
    const projectDir = tempProjects.pop()
    if (projectDir !== undefined) {
      rmSync(projectDir, { recursive: true, force: true })
    }
  }
})

function projectWithSource(): string {
  const projectDir = mkdtempSync(join(tmpdir(), "persona-evidence-read-"))
  tempProjects.push(projectDir)
  writeFileSync(
    join(projectDir, "package.json"),
    `${JSON.stringify({ name: "evidence-read-fixture", private: true }, null, 2)}\n`,
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

function evidenceRead(projectDir: string, target: string) {
  const original = process.cwd()
  process.chdir(projectDir)
  try {
    return runPersonaCli(["evidence", "read", target], { cwd: ".", env: {}, invocationName: "ph" })
  } finally {
    process.chdir(original)
  }
}

function recordedEvidence(projectDir: string): readonly Record<string, unknown>[] {
  const dir = join(projectDir, ".persona", "evidence", "phase0")
  // A refused read writes nothing, so the directory may not exist at all.
  const names = existsSync(dir) ? readdirSync(dir) : []
  return names
    .filter((name) => name.startsWith("workflow-read-"))
    .map((name) => JSON.parse(readFileSync(join(dir, name), "utf8")) as Record<string, unknown>)
}

describe("ph evidence read where no native artifact is built", () => {
  it("records a read that java-role-read-coverage can accept", () => {
    const projectDir = projectWithSource()

    const result = evidenceRead(projectDir, "src/main/java/com/example/TaskService.java")

    expect(result.status).toBe(0)

    const evidence = recordedEvidence(projectDir)
    expect(evidence).toHaveLength(1)
    expect(evidence[0]?.["fileRole"]).toBe("source-read")
    expect(evidence[0]?.["targetFile"]).toBe("src/main/java/com/example/TaskService.java")
    expect(String(evidence[0]?.["contentDigest"])).toMatch(/^sha256:[0-9a-f]{64}$/u)
  })

  it("writes the record the native path would have written", () => {
    // What this evidence attests is the content of the file that was read, and
    // that does not depend on which boundary opened it. Only the surrounding
    // snapshot guarantee is missing, which the finish states separately.
    const projectDir = projectWithSource()

    evidenceRead(projectDir, "src/main/java/com/example/TaskService.java")

    const record = recordedEvidence(projectDir)[0]
    expect(record?.["schemaVersion"]).toBe("workflow-read-evidence.1")
    expect(record?.["evidenceKind"]).toBe("workflow-read")
    expect(record?.["byteCount"]).toBe(
      readFileSync(join(projectDir, "src", "main", "java", "com", "example", "TaskService.java")).byteLength,
    )
  })

  it("still refuses a path that escapes the project", () => {
    const projectDir = projectWithSource()

    const result = evidenceRead(projectDir, "../outside.txt")

    // The degraded path may be weaker about the surrounding tree; it may not be
    // weaker about what counts as inside the project.
    expect(result.status).not.toBe(0)
    expect(recordedEvidence(projectDir)).toHaveLength(0)
  })

  it("refuses an absolute path", () => {
    const projectDir = projectWithSource()

    const result = evidenceRead(projectDir, join(projectDir, "src", "main", "java", "com", "example", "TaskService.java"))

    expect(result.status).not.toBe(0)
    expect(recordedEvidence(projectDir)).toHaveLength(0)
  })
})
