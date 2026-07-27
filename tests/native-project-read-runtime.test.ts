import { spawnSync } from "node:child_process"
import {
  chmodSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
  type BigIntStats,
} from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"

import { describe, expect, it } from "vitest"

import {
  inspectNativeProjectReadRuntime,
  readNativeProjectFile,
  runNativeProjectGradle,
} from "../src/io/native-project-read.js"
import { reserveProjectReadBoundary } from "../src/io/bootstrap-write-boundary.js"

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
    expect(invoke).toThrow("source-read-unsafe")
  })

  it("rejects a symlinked intermediate directory before opening its external target", () => {
    // Given: a project CWD capability and an external directory with a source marker.
    const root = mkdtempSync(join(tmpdir(), "persona-native-project-read-"))
    const project = join(root, "project")
    const outside = join(root, "outside")
    const sourceDirectory = join(project, "src", "main", "java")
    const draftDirectory = join(project, "src", "main", "java.draft")
    const artifact = nativeExecutable()
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

  it.each([
    ["selected project root", (project: string, outside: string) => {
      renameSync(project, `${project}.draft`)
      symlinkSync(outside, project)
    }],
    ["selected intermediate directory", (project: string, outside: string) => {
      const source = join(project, "src", "main", "java")
      renameSync(source, `${source}.draft`)
      symlinkSync(outside, source)
    }],
    ["selected source leaf", (project: string, outside: string) => {
      const source = join(project, "src", "main", "java", "App.java")
      unlinkSync(source)
      symlinkSync(join(outside, "App.java"), source)
    }],
  ])("rejects a %s alias without opening its external descriptor", (_name, replace) => {
    // Given: a held runner CWD, a selected child project, and an external marker directory.
    const runner = mkdtempSync(join(tmpdir(), "persona-native-root-"))
    const project = join(runner, "project")
    const outside = join(runner, "outside")
    mkdirSync(join(project, "src", "main", "java"), { recursive: true })
    mkdirSync(outside)
    writeFileSync(join(project, "src", "main", "java", "App.java"), "class App {}\n")
    writeFileSync(join(outside, "App.java"), "class External {}\n")
    const identity = lstatSync(outside, { bigint: true })
    replace(project, outside)

    try {
      // When: every traversal segment is opened relative to the held runner descriptor.
      const result = spawnSync(
        nativeExecutable(),
        [
          "read",
          "src/main/java/App.java",
          "4096",
          "--root",
          "project",
          "--audit",
          identity.dev.toString(),
          identity.ino.toString(),
        ],
        { cwd: runner, encoding: "buffer", env: {}, shell: false, stdio: ["ignore", "pipe", "ignore"] },
      )

      // Then: the hostile target remains unopened even when it replaces a selected segment.
      expect(result.status).toBe(0)
      expect(result.stdout).toEqual(Buffer.from([2, 0]))
    } finally {
      rmSync(runner, { force: true, recursive: true })
    }
  })

  it("rejects a captured regular source-parent replacement before opening its external descriptor", () => {
    // Given: a source identity manifest captured before an external regular directory replaces src/main.
    const project = mkdtempSync(join(tmpdir(), "persona-native-manifest-"))
    const sourceParent = join(project, "src", "main")
    const source = join(sourceParent, "java", "App.java")
    const outside = join(project, "outside")
    mkdirSync(join(sourceParent, "java"), { recursive: true })
    mkdirSync(join(outside, "java"), { recursive: true })
    writeFileSync(source, "class App {}\n")
    writeFileSync(join(outside, "java", "App.java"), "class External {}\n")
    const expectations = expectedManifest(project, ["src", "src/main", "src/main/java", "src/main/java/App.java"])
    const outsideIdentity = lstatSync(outside, { bigint: true })
    const boundary = withCurrentDirectory(project, () => reserveProjectReadBoundary("."))
    renameSync(sourceParent, `${sourceParent}.draft`)
    renameSync(outside, sourceParent)

    try {
      // When: the native reader receives the captured manifest at the real descriptor boundary.
      const result = spawnSync(
        nativeExecutable(),
        [
          "read",
          "src/main/java/App.java",
          "4096",
          "--expect-stdin",
          "--root",
          ".",
          "--audit",
          outsideIdentity.dev.toString(),
          outsideIdentity.ino.toString(),
        ],
        {
          cwd: project,
          encoding: "buffer",
          env: {},
          input: manifestInput(expectations),
          shell: false,
          stdio: ["pipe", "pipe", "ignore"],
        },
      )

      // Then: identity mismatch blocks before either the external parent or leaf descriptor is opened.
      expect(result.status).toBe(0)
      expect(result.stdout).toEqual(Buffer.from([2, 0]))
      expect(() => withCurrentDirectory(project, () => boundary.readProjectFile("src/main/java/App.java"))).toThrow(
        "source-read-unsafe",
      )
    } finally {
      boundary.close()
      rmSync(project, { force: true, recursive: true })
    }
  })

  it("runs only the fixed Gradle test catalog from the held project root", () => {
    // Given: a selected child project with a regular executable wrapper.
    const runner = mkdtempSync(join(tmpdir(), "persona-native-gradle-runtime-"))
    const project = join(runner, "project")
    mkdirSync(project)
    writeFileSync(
      join(project, "gradlew"),
      "#!/bin/sh\nprintf '%s\\n' '> Task :cleanTest' '> Task :test'\n",
    )
    chmodSync(join(project, "gradlew"), 0o755)

    try {
      // When: the fixed native command is executed through the selected root descriptor.
      const result = withCurrentDirectory(runner, () => runNativeProjectGradle("test", 1_000, "project"))

      // Then: it completes with the fixed task output and no shell-selected command path.
      expect(result).toMatchObject({ outcome: "passed", status: 0, timedOut: false })
      expect(result.stdout.toString("utf8")).toContain("> Task :cleanTest")
      expect(result.stdout.toString("utf8")).toContain("> Task :test")
    } finally {
      rmSync(runner, { force: true, recursive: true })
    }
  })
})

function nativeExecutable(): string {
  if ((process.platform !== "darwin" && process.platform !== "linux") || (process.arch !== "arm64" && process.arch !== "x64")) {
    throw new Error("native test platform unavailable")
  }
  return resolve(`native/project-read/bin/${process.platform}-${process.arch}/ph-native-project-read`)
}

function withCurrentDirectory<T>(directory: string, operation: () => T): T {
  const original = process.cwd()
  process.chdir(directory)
  try {
    return operation()
  } finally {
    process.chdir(original)
  }
}

function expectedManifest(project: string, paths: readonly string[]) {
  return [
    { kind: "directory" as const, path: ".", stat: lstatSync(project, { bigint: true }) },
    ...paths.map((path) => ({
      kind: path.endsWith(".java") ? "file" as const : "directory" as const,
      path,
      stat: lstatSync(join(project, path), { bigint: true }),
    })),
  ]
}

function manifestInput(entries: readonly { readonly kind: "directory" | "file"; readonly path: string; readonly stat: BigIntStats }[]): Buffer {
  const pathBytes = entries.map((entry) => Buffer.from(entry.path, "utf8"))
  const output = Buffer.allocUnsafe(4 + entries.reduce((size, entry, index) => size + 2 + pathBytes[index].byteLength + 1 + 8 + 8, 0))
  output.writeUInt32LE(entries.length, 0)
  let offset = 4
  for (const [index, entry] of entries.entries()) {
    const path = pathBytes[index]
    if (path === undefined) throw new Error("expected manifest path")
    output.writeUInt16LE(path.byteLength, offset)
    offset += 2
    path.copy(output, offset)
    offset += path.byteLength
    output[offset] = entry.kind === "directory" ? 1 : 2
    offset += 1
    output.writeBigUInt64LE(BigInt(entry.stat.dev), offset)
    offset += 8
    output.writeBigUInt64LE(BigInt(entry.stat.ino), offset)
    offset += 8
  }
  return output
}
