import {
  chmodSync,
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
  discoverJUnitResults,
  JUNIT_RESULT_DISCOVERY_LIMITS,
} from "../src/cli/junit-result-discovery.js"
import { readExecutionEvidenceVerification } from "../src/cli/workflow-execution-evidence.js"

const projects: string[] = []

afterEach(() => {
  for (const project of projects.splice(0)) {
    rmSync(project, { force: true, recursive: true })
  }
})

function createProject(): string {
  const project = mkdtempSync(join(tmpdir(), "persona-junit-discovery-"))
  projects.push(project)
  return project
}

function resultRoot(project: string): string {
  const root = join(project, "build", "test-results", "test")
  mkdirSync(root, { recursive: true })
  return root
}

function junitXml(name = "works"): string {
  return `<testsuite tests="1" failures="0" errors="0"><testcase classname="ExampleTest" name="${name}"/></testsuite>\n`
}

describe("bounded JUnit result discovery", () => {
  it("returns readable XML-only files in deterministic order", () => {
    const project = createProject()
    const buildRoot = resultRoot(project)
    mkdirSync(join(buildRoot, "nested"), { recursive: true })
    writeFileSync(join(buildRoot, "z.xml"), junitXml("z"))
    writeFileSync(join(buildRoot, "nested", "a.xml"), junitXml("a"))
    writeFileSync(join(buildRoot, "ignored.txt"), "not XML\n")
    const mavenRoot = join(project, "target", "surefire-reports")
    mkdirSync(mavenRoot, { recursive: true })
    writeFileSync(join(mavenRoot, "maven.xml"), junitXml("maven"))

    const result = discoverJUnitResults(project)

    expect(result.safe).toBe(true)
    expect(result.diagnostics).toEqual([])
    expect(result.files.map((file) => file.ref)).toEqual([
      "build/test-results/test/nested/a.xml",
      "build/test-results/test/z.xml",
      "target/surefire-reports/maven.xml",
    ])
    expect(result.files.find((file) => file.ref.endsWith("/a.xml"))?.text).toContain('tests="1"')
  })

  it("fails closed on deep traversal and huge entry counts", () => {
    const deepProject = createProject()
    let deepPath = resultRoot(deepProject)
    for (let index = 0; index <= JUNIT_RESULT_DISCOVERY_LIMITS.maxDepth; index += 1) {
      deepPath = join(deepPath, `level-${index}`)
      mkdirSync(deepPath, { recursive: true })
    }
    writeFileSync(join(deepPath, "deep.xml"), junitXml("deep"))

    const deep = discoverJUnitResults(deepProject)

    expect(deep.safe).toBe(false)
    expect(deep.files).toEqual([])
    expect(deep.diagnostics).toContain("junit-depth-exceeded")

    const wideProject = createProject()
    const wideRoot = resultRoot(wideProject)
    for (let index = 0; index <= JUNIT_RESULT_DISCOVERY_LIMITS.maxEntries; index += 1) {
      writeFileSync(join(wideRoot, `${String(index).padStart(4, "0")}.xml`), junitXml(String(index)))
    }

    const wide = discoverJUnitResults(wideProject)

    expect(wide.safe).toBe(false)
    expect(wide.files).toEqual([])
    expect(wide.diagnostics).toContain("junit-entry-limit")
  })

  it("fails closed on oversized, over-total, binary, and malformed XML", () => {
    const oversizedProject = createProject()
    const oversizedRoot = resultRoot(oversizedProject)
    writeFileSync(
      join(oversizedRoot, "oversized.xml"),
      "x".repeat(JUNIT_RESULT_DISCOVERY_LIMITS.maxFileBytes + 1),
    )
    expect(discoverJUnitResults(oversizedProject).diagnostics).toContain("junit-file-byte-limit")

    const totalProject = createProject()
    const totalRoot = resultRoot(totalProject)
    for (let index = 0; index < 9; index += 1) {
      writeFileSync(
        join(totalRoot, `${String(index).padStart(2, "0")}.xml`),
        "x".repeat(JUNIT_RESULT_DISCOVERY_LIMITS.maxFileBytes),
      )
    }
    expect(discoverJUnitResults(totalProject).diagnostics).toContain("junit-total-byte-limit")

    const binaryProject = createProject()
    writeFileSync(join(resultRoot(binaryProject), "binary.xml"), Buffer.from([0, 1, 2, 3]))
    expect(discoverJUnitResults(binaryProject).diagnostics).toContain("junit-binary")

    if (process.platform !== "win32") {
      const unreadableProject = createProject()
      const unreadablePath = join(resultRoot(unreadableProject), "unreadable.xml")
      writeFileSync(unreadablePath, junitXml("unreadable"))
      chmodSync(unreadablePath, 0)
      try {
        expect(discoverJUnitResults(unreadableProject).diagnostics).toContain("junit-unreadable")
      } finally {
        chmodSync(unreadablePath, 0o600)
      }
    }

    const malformedProject = createProject()
    writeFileSync(join(resultRoot(malformedProject), "malformed.xml"), "<testsuite><testcase></testsuite>\n")
    const malformed = discoverJUnitResults(malformedProject)
    expect(malformed.safe).toBe(false)
    expect(malformed.files).toEqual([])
    expect(malformed.diagnostics).toContain("junit-malformed-xml")
  })

  it("rejects symlinked result entries without reading the target", () => {
    if (process.platform === "win32") {
      return
    }
    const project = createProject()
    const root = resultRoot(project)
    const outside = mkdtempSync(join(tmpdir(), "persona-junit-outside-"))
    projects.push(outside)
    writeFileSync(join(outside, "escaped.xml"), junitXml("escaped"))
    symlinkSync(outside, join(root, "linked"))

    const result = discoverJUnitResults(project)

    expect(result.safe).toBe(false)
    expect(result.files).toEqual([])
    expect(result.diagnostics).toContain("junit-symlink-rejected")
  })

  it("keeps legacy execution evidence unknown when JUnit XML is malformed", () => {
    const project = createProject()
    writeFileSync(join(resultRoot(project), "malformed.xml"), "<testsuite tests=\"1\"><testcase></testsuite>\n")

    const result = readExecutionEvidenceVerification(project)

    expect(result.verification).toBe("unknown")
    expect(result.reason).toContain("junit-malformed-xml")
  })
})
