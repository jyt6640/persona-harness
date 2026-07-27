import { spawnSync } from "node:child_process"
import {
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"

import { describe, expect, it } from "vitest"

import {
  inspectNativeProjectReadRuntime,
  readNativeProjectFile,
} from "../src/io/native-project-read.js"

describe("native project read runtime", () => {
  it("reads a bounded regular file through the packaged native runtime", () => {
    // Given: the repository root is the inherited project capability.
    const expected = readFileSync("package.json")

    // When: the native runtime reads the same validated relative path.
    const actual = readNativeProjectFile("package.json", 128 * 1024)

    // Then: it returns exact bytes and a checksum-bound platform artifact.
    expect(actual).toEqual(expected)
    expect(inspectNativeProjectReadRuntime()).toMatchObject({
      availability: "ready",
      platform: process.platform,
    })
  })

  it("blocks traversal before opening a source path", () => {
    // Given: a caller-controlled traversal path.
    const traversal = "../package.json"

    // When: the runtime receives it at the relative-path boundary.
    const invoke = () => readNativeProjectFile(traversal, 128 * 1024)

    // Then: no pathname fallback is available.
    expect(invoke).toThrow("source-read-runtime-unavailable")
  })

  it("rejects a symlinked intermediate directory before opening its external target", () => {
    // Given: a project CWD capability and an external directory with a source marker.
    const root = mkdtempSync(join(tmpdir(), "persona-native-project-read-"))
    const project = join(root, "project")
    const outside = join(root, "outside")
    const sourceDirectory = join(project, "src", "main", "java")
    const draftDirectory = join(project, "src", "main", "java.draft")
    const artifact = resolve("native/project-read/bin/darwin-arm64/ph-native-project-read")
    mkdirSync(sourceDirectory, { recursive: true })
    mkdirSync(outside)
    writeFileSync(join(sourceDirectory, "App.java"), "class App {}\n")
    writeFileSync(join(outside, "App.java"), "class External {}\n")
    const identity = lstatSync(outside, { bigint: true })
    renameSync(sourceDirectory, draftDirectory)
    symlinkSync(outside, sourceDirectory)

    try {
      // When: the native audit command traverses the path through held directory descriptors.
      const result = spawnSync(
        artifact,
        ["read", "src/main/java/App.java", "4096", "--audit", identity.dev.toString(), identity.ino.toString()],
        { cwd: project, encoding: "buffer", env: {}, shell: false, stdio: ["ignore", "pipe", "ignore"] },
      )

      // Then: the native traversal blocks and records no external descriptor open.
      expect(result.status).toBe(0)
      expect(Buffer.isBuffer(result.stdout)).toBe(true)
      expect(result.stdout).toEqual(Buffer.from([2, 0]))
    } finally {
      rmSync(root, { force: true, recursive: true })
    }
  })
})
