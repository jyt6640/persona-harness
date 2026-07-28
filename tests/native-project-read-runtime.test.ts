import { spawnSync } from "node:child_process"
import {
  closeSync,
  chmodSync,
  constants,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
  type BigIntStats,
} from "node:fs"
import { tmpdir } from "node:os"
import { basename, join, resolve } from "node:path"

import { afterAll, describe, expect, it } from "vitest"

import {
  inspectNativeProjectReadRuntime,
  readNativeProjectFile,
  runNativeProjectGradle,
} from "../src/io/native-project-read.js"
import { reserveProjectReadBoundary } from "../src/io/bootstrap-write-boundary.js"
import { createDirectProjectRoot } from "./helpers/direct-project-root.js"

let nativeTestExecutable: string | undefined
let nativeTestRoot: string | undefined

afterAll(() => {
  if (nativeTestRoot !== undefined) rmSync(nativeTestRoot, { force: true, recursive: true })
})

describe.sequential("native project read runtime", () => {
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

  it("rejects a nested project root outside the inherited direct-child capability", () => {
    // Given: a direct runner child and a nested caller-selected project.
    const runner = createDirectProjectRoot("persona-native-root-selection")
    const project = join(runner, "project")
    mkdirSync(project)
    writeFileSync(join(project, "package.json"), "{}\n")

    try {
      // When: TypeScript asks the native runtime to reopen the nested project root.
      const invoke = () => readNativeProjectFile("package.json", 4096, project)

      // Then: only one native-captured direct child can become a project capability.
      expect(invoke).toThrow("source-read-runtime-unavailable")
    } finally {
      rmSync(runner, { force: true, recursive: true })
    }
  })

  it("opens one captured direct child through the inherited runner capability", () => {
    // Given: a direct caller checkout and its captured directory identity.
    const project = createDirectProjectRoot("persona-native-captured-root")
    writeFileSync(join(project, "package.json"), "{}\n")
    const expectations = expectedRuntimeManifest(project, ["package.json"])

    try {
      // When: the native runtime receives the direct child with an expected root descriptor identity.
      const actual = readNativeProjectFile("package.json", 4096, project, expectations)

      // Then: it reads only through the held runner-to-caller descriptor transition.
      expect(actual).toEqual(Buffer.from("{}\n"))
    } finally {
      rmSync(project, { force: true, recursive: true })
    }
  })

  it("reserves a direct child project without reopening its caller path", () => {
    // Given: a direct regular child project.
    const project = createDirectProjectRoot("persona-native-boundary-child")
    writeFileSync(join(project, "package.json"), "{}\n")

    try {
      // When: the product boundary captures the direct child through native descriptor traversal.
      const boundary = reserveProjectReadBoundary(project)

      // Then: the selected root is readable only through the captured child identity.
      try {
        expect(boundary.readProjectFile("package.json")?.toString("utf8")).toBe("{}\n")
      } finally {
        boundary.close()
      }
    } finally {
      rmSync(project, { force: true, recursive: true })
    }
  })

  it("rejects an unbound direct child replacement before opening its external directory", () => {
    // Given: a runner path whose direct child is replaced by an external regular directory.
    const runner = realpathSync(mkdtempSync(join(tmpdir(), "persona-native-unbound-root-")))
    const project = join(runner, "project")
    const outside = join(runner, "outside")
    mkdirSync(join(project, "src", "main", "java"), { recursive: true })
    mkdirSync(join(outside, "src", "main", "java"), { recursive: true })
    writeFileSync(join(project, "src", "main", "java", "App.java"), "class App {}\n")
    writeFileSync(join(outside, "src", "main", "java", "App.java"), "class External {}\n")
    const outsideIdentity = lstatSync(outside, { bigint: true })
    renameSync(project, `${project}.draft`)
    renameSync(outside, project)

    try {
      // When: the native binary receives an unbound selected root under the held runner descriptor.
      const result = spawnSync(
        nativeExecutable(),
        [
          "read",
          "src/main/java/App.java",
          "4096",
          "--root",
          "project",
          "--audit",
          outsideIdentity.dev.toString(),
          outsideIdentity.ino.toString(),
        ],
        { cwd: runner, encoding: "buffer", env: {}, shell: false, stdio: ["ignore", "pipe", "ignore"] },
      )

      // Then: native traversal rejects before any descriptor from the external directory is opened.
      expect(result.status).toBe(0)
      expect(result.stdout).toEqual(Buffer.from([2, 0]))
    } finally {
      rmSync(runner, { force: true, recursive: true })
    }
  })

  it("rejects a captured regular source-parent replacement before opening its external descriptor", () => {
    // Given: a source identity manifest captured before an external regular directory replaces src/main.
    const project = createDirectProjectRoot("persona-native-manifest")
    const sourceParent = join(project, "src", "main")
    const source = join(sourceParent, "java", "App.java")
    const outside = join(project, "outside")
    mkdirSync(join(sourceParent, "java"), { recursive: true })
    mkdirSync(join(outside, "java"), { recursive: true })
    writeFileSync(source, "class App {}\n")
    writeFileSync(join(outside, "java", "App.java"), "class External {}\n")
    const expectations = expectedManifest(project, ["src", "src/main", "src/main/java", "src/main/java/App.java"])
    const outsideIdentity = lstatSync(outside, { bigint: true })
    const boundary = reserveProjectReadBoundary(project)
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
      expect(() => boundary.readProjectFile("src/main/java/App.java")).toThrow(
        "source-read-unsafe",
      )
    } finally {
      boundary.close()
      rmSync(project, { force: true, recursive: true })
    }
  })

  it("rejects same-inode source-byte drift after the project capability is captured", () => {
    const project = createDirectProjectRoot("persona-native-in-place-drift")
    const source = join(project, "src", "main", "java", "App.java")
    mkdirSync(join(project, "src", "main", "java"), { recursive: true })
    writeFileSync(source, "class AppOne {}\n")
    const boundary = reserveProjectReadBoundary(project)

    try {
      writeFileSync(source, "class AppTwo {}\n")

      expect(() => boundary.readProjectFile("src/main/java/App.java")).toThrow(
        "source-read-unsafe",
      )
    } finally {
      boundary.close()
      rmSync(project, { force: true, recursive: true })
    }
  })

  it("rejects a captured project-root replacement before opening its external descriptor", () => {
    const project = createDirectProjectRoot("persona-native-root-context")
    const preserved = `${project}-preserved`
    const outside = createDirectProjectRoot("persona-native-root-context-outside")
    const source = join(project, "src", "main", "java", "App.java")
    mkdirSync(join(project, "src", "main", "java"), { recursive: true })
    mkdirSync(join(outside, "src", "main", "java"), { recursive: true })
    writeFileSync(source, "class App {}\n")
    writeFileSync(join(outside, "src", "main", "java", "App.java"), "class External {}\n")
    const expectations = expectedManifest(project, ["src", "src/main", "src/main/java", "src/main/java/App.java"])
    const outsideIdentity = lstatSync(outside, { bigint: true })
    const parentIdentity = lstatSync(process.cwd(), { bigint: true })
    let boundary: ReturnType<typeof reserveProjectReadBoundary> | undefined
    let rootDescriptor: number | undefined
    let parentDescriptor: number | undefined

    try {
      boundary = reserveProjectReadBoundary(project)
      rootDescriptor = openSync(project, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW)
      parentDescriptor = openSync(process.cwd(), constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW)
      renameSync(project, preserved)
      renameSync(outside, project)

      const result = spawnSync(
        nativeExecutable(),
        [
          "read",
          "src/main/java/App.java",
          "4096",
          "--expect-stdin",
          "--root-fds",
          "3",
          "4",
          basename(project),
          parentIdentity.dev.toString(),
          parentIdentity.ino.toString(),
          "--root",
          ".",
          "--audit",
          outsideIdentity.dev.toString(),
          outsideIdentity.ino.toString(),
        ],
        {
          cwd: preserved,
          encoding: "buffer",
          env: {},
          input: manifestInput(expectations),
          shell: false,
          stdio: ["pipe", "pipe", "ignore", rootDescriptor, parentDescriptor],
        },
      )

      expect(result.status).toBe(0)
      expect(result.stdout).toEqual(Buffer.from([2, 0]))
      expect(() => boundary?.readProjectFile("src/main/java/App.java")).toThrow(
        "source-read-unsafe",
      )
    } finally {
      boundary?.close()
      if (parentDescriptor !== undefined) closeSync(parentDescriptor)
      if (rootDescriptor !== undefined) closeSync(rootDescriptor)
      rmSync(preserved, { force: true, recursive: true })
      rmSync(project, { force: true, recursive: true })
    }
  })

  it("rejects a captured evidence subtree replacement before opening its external descriptor", () => {
    const runner = mkdtempSync(join(tmpdir(), "persona-native-subtree-context-"))
    const project = join(runner, "project")
    const evidenceRoot = join(project, ".persona", "evidence", "project-finish-attestation")
    const preserved = `${evidenceRoot}-preserved`
    const outside = join(runner, "outside")
    mkdirSync(evidenceRoot, { recursive: true })
    mkdirSync(outside)
    writeFileSync(join(evidenceRoot, "bundle.json"), "{}\n")
    writeFileSync(join(outside, "bundle.json"), "external\n")
    const parentIdentity = lstatSync(runner, { bigint: true })
    const outsideIdentity = lstatSync(outside, { bigint: true })
    const expectations = [
      { kind: "directory" as const, path: ".", stat: lstatSync(evidenceRoot, { bigint: true }) },
      { kind: "directory" as const, path: ".persona", stat: lstatSync(join(project, ".persona"), { bigint: true }) },
      { kind: "directory" as const, path: ".persona/evidence", stat: lstatSync(join(project, ".persona", "evidence"), { bigint: true }) },
      { kind: "directory" as const, path: ".persona/evidence/project-finish-attestation", stat: lstatSync(evidenceRoot, { bigint: true }) },
      { kind: "file" as const, path: "bundle.json", stat: lstatSync(join(evidenceRoot, "bundle.json"), { bigint: true }) },
    ]
    let rootDescriptor: number | undefined
    let parentDescriptor: number | undefined

    try {
      rootDescriptor = openSync(project, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW)
      parentDescriptor = openSync(runner, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW)
      renameSync(evidenceRoot, preserved)
      renameSync(outside, evidenceRoot)
      const result = spawnSync(
        nativeExecutable(),
        [
          "tree",
          "4",
          "4096",
          "8192",
          "--expect-stdin",
          "--root-fds",
          "3",
          "4",
          basename(project),
          parentIdentity.dev.toString(),
          parentIdentity.ino.toString(),
          "--root",
          ".persona/evidence/project-finish-attestation",
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
          stdio: ["pipe", "pipe", "ignore", rootDescriptor, parentDescriptor],
        },
      )

      expect(result.status).toBe(0)
      expect(result.stdout).toEqual(Buffer.from([2, 0]))
    } finally {
      if (parentDescriptor !== undefined) closeSync(parentDescriptor)
      if (rootDescriptor !== undefined) closeSync(rootDescriptor)
      rmSync(runner, { force: true, recursive: true })
    }
  })

  it("rejects a generated JUnit root replacement before opening its external descriptor", () => {
    // Given: a generated-report manifest captured before build output is replaced by an external directory.
    const project = mkdtempSync(join(tmpdir(), "persona-native-junit-manifest-"))
    const generatedRoot = join(project, "build", "test-results", "test")
    const outside = join(project, "outside")
    mkdirSync(generatedRoot, { recursive: true })
    mkdirSync(join(outside, "test-results", "test"), { recursive: true })
    writeFileSync(join(generatedRoot, "TEST-App.xml"), "<testsuite tests=\"1\"/>\n")
    writeFileSync(join(outside, "test-results", "test", "TEST-App.xml"), "<testsuite tests=\"1\"/>\n")
    const expectations = expectedManifest(project, [
      "build",
      "build/test-results",
      "build/test-results/test",
      "build/test-results/test/TEST-App.xml",
    ])
    const outsideIdentity = lstatSync(outside, { bigint: true })
    renameSync(join(project, "build"), join(project, "build.draft"))
    renameSync(outside, join(project, "build"))

    try {
      // When: the bounded report reader traverses every captured generated-output segment.
      const result = spawnSync(
        nativeExecutable(),
        [
          "tree",
          "128",
          "65536",
          "262144",
          "--expect-stdin",
          "--root",
          "build/test-results/test",
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

      // Then: a replaced build parent blocks before an external report directory or leaf is opened.
      expect(result.status).toBe(0)
      expect(result.stdout).toEqual(Buffer.from([2, 0]))
    } finally {
      rmSync(project, { force: true, recursive: true })
    }
  })

  it("runs only the fixed Gradle test catalog from the held project root", () => {
    // Given: a selected direct child project with a regular executable wrapper.
    const project = createDirectProjectRoot("persona-native-gradle-runtime")
    writeFileSync(
      join(project, "gradlew"),
      "#!/bin/sh\nprintf '%s\\n' '> Task :cleanTest' '> Task :test'\n",
    )
    chmodSync(join(project, "gradlew"), 0o755)

    try {
      // When: the fixed native command is executed from the inherited project capability.
      const result = runNativeProjectGradle("test", 1_000, project, expectedRuntimeManifest(project, ["gradlew"]))

      // Then: it completes with the fixed task output and no shell-selected command path.
      expect(result).toMatchObject({ outcome: "passed", status: 0, timedOut: false })
      expect(result.stdout.toString("utf8")).toContain("> Task :cleanTest")
      expect(result.stdout.toString("utf8")).toContain("> Task :test")
    } finally {
      rmSync(project, { force: true, recursive: true })
    }
  })

  it("captures fresh generated JUnit output through the direct-child project capability", () => {
    // Given: a direct child Gradle project whose fixed test command creates a JUnit report.
    const project = createDirectProjectRoot("persona-native-generated-junit")
    mkdirSync(join(project, "build", "test-results", "test"), { recursive: true })
    writeFileSync(
      join(project, "gradlew"),
      "#!/bin/sh\nprintf '%s\\n' '<testsuite tests=\"1\" failures=\"0\" errors=\"0\" skipped=\"0\"><testcase name=\"ok\"/></testsuite>' > build/test-results/test/TEST-App.xml\nprintf '%s\\n' '> Task :cleanTest' '> Task :test'\n",
    )
    chmodSync(join(project, "gradlew"), 0o755)
    let boundary: ReturnType<typeof reserveProjectReadBoundary> | undefined

    try {
      // When: the same held capability snapshots before and after its fixed Gradle test command.
      boundary = reserveProjectReadBoundary(project)
      expect(boundary.readGeneratedProjectTreeAt("build/test-results/test", {
        excludedRoots: [],
        maxEntries: 128,
        maxFileBytes: 64 * 1024,
        maxTotalBytes: 256 * 1024,
      })).toEqual([])
      expect(boundary.runFixedGradle("test", 1_000)).toMatchObject({ outcome: "passed", status: 0, timedOut: false })
      const generated = boundary.readGeneratedProjectTreeAt("build/test-results/test", {
        excludedRoots: [],
        maxEntries: 128,
        maxFileBytes: 64 * 1024,
        maxTotalBytes: 256 * 1024,
      })

      // Then: generated bytes are read through the native boundary instead of a pathname reopen.
      expect(generated?.some((entry) => entry.kind === "file" && entry.path === "TEST-App.xml")).toBe(true)
    } finally {
      boundary?.close()
      rmSync(project, { force: true, recursive: true })
    }
  })
})

function nativeExecutable(): string {
  if ((process.platform !== "darwin" && process.platform !== "linux") || (process.arch !== "arm64" && process.arch !== "x64")) {
    throw new Error("native test platform unavailable")
  }
  if (nativeTestExecutable !== undefined) return nativeTestExecutable
  nativeTestRoot = mkdtempSync(join(tmpdir(), "persona-native-source-probe-"))
  nativeTestExecutable = join(nativeTestRoot, "ph-native-project-read")
  const compile = spawnSync(
    "cc",
    [
      "-std=c17",
      "-O2",
      "-Wall",
      "-Wextra",
      "-Werror",
      resolve("native/project-read/ph_native_project_read.c"),
      "-o",
      nativeTestExecutable,
    ],
    {
      encoding: "utf8",
      env: process.env,
      maxBuffer: 1024 * 1024,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    },
  )
  if (compile.status !== 0) throw new Error("native source probe compile failed")
  return nativeTestExecutable
}

function expectedManifest(project: string, paths: readonly string[]) {
  return [
    { kind: "directory" as const, path: ".", stat: lstatSync(project, { bigint: true }) },
    ...paths.map((path) => {
      const stat = lstatSync(join(project, path), { bigint: true })
      return { kind: stat.isFile() ? "file" as const : "directory" as const, path, stat }
    }),
  ]
}

function expectedRuntimeManifest(project: string, paths: readonly string[]) {
  return expectedManifest(project, paths).map((entry) => ({
    identity: {
      ctimeNs: entry.stat.ctimeNs.toString(),
      dev: entry.stat.dev.toString(),
      ino: entry.stat.ino.toString(),
      mode: Number(entry.stat.mode & 0o777n).toString(8).padStart(4, "0"),
      mtimeNs: entry.stat.mtimeNs.toString(),
      size: entry.stat.size.toString(),
    },
    kind: entry.kind,
    path: entry.path,
  }))
}

function manifestInput(entries: readonly { readonly kind: "directory" | "file"; readonly path: string; readonly stat: BigIntStats }[]): Buffer {
  const pathBytes = entries.map((entry) => Buffer.from(entry.path, "utf8"))
  const output = Buffer.allocUnsafe(4 + entries.reduce((size, entry, index) => size + 2 + pathBytes[index].byteLength + 1 + (8 * 6), 0))
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
    output.writeBigUInt64LE(BigInt(entry.stat.mode & 0o7777n), offset)
    offset += 8
    output.writeBigUInt64LE(BigInt(entry.stat.size), offset)
    offset += 8
    output.writeBigUInt64LE(BigInt(entry.stat.mtimeNs), offset)
    offset += 8
    output.writeBigUInt64LE(BigInt(entry.stat.ctimeNs), offset)
    offset += 8
  }
  return output
}
