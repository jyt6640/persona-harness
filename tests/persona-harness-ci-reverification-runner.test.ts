import { execFileSync } from "node:child_process"
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import type { BoundedProcessResult } from "../src/cli/bounded-process.js"
import { captureGitIdentity, captureWorkspaceIdentity } from "../src/cli/ci-reverification-identity.js"
import { writeAndRereadCiReverificationArtifact } from "../src/cli/ci-reverification-artifact.js"
import { runCiReverification } from "../src/cli/ci-reverification-runner.js"

const projects: string[] = []

function runGit(projectDir: string, args: readonly string[]): string {
  return execFileSync("git", [...args], { cwd: projectDir, encoding: "utf8" }).trim()
}

function readyProfile(): string {
  return `${JSON.stringify({
    defaults: { buildTool: "gradle", framework: "spring", language: "java" },
    questions: [
      { answer: "ko", id: "user-language" },
      { answer: "team", id: "project-context" },
      { answer: "production-service", id: "project-goal" },
      { answer: "long-lived", id: "project-scale" },
      { answer: "rest-api", id: "application-type" },
      { answer: "database", id: "storage" },
      { answer: "jpa", id: "persistence-technology" },
      { answer: "flyway", id: "migration-style" },
      { answer: "domain-first", id: "package-style" },
      { answer: "clean-architecture-light", id: "architecture-style" },
      { answer: "strict", id: "boundary-strictness" },
    ],
    schema: "persona.project-profile.v1",
    scope: { mvp: "java-spring-clean-code", role: "backend" },
    status: "ready",
  }, null, 2)}\n`
}

function createProject(gradlew: string): string {
  const projectDir = mkdtempSync(join(tmpdir(), "persona-ci-reverify-"))
  projects.push(projectDir)
  mkdirSync(join(projectDir, ".persona", "evidence"), { recursive: true })
  mkdirSync(join(projectDir, "src", "main", "java"), { recursive: true })
  writeFileSync(join(projectDir, ".persona", "project-profile.jsonc"), readyProfile())
  writeFileSync(join(projectDir, ".persona", "evidence", ".keep"), "")
  writeFileSync(join(projectDir, "src", "main", "java", "App.java"), "class App {}\n")
  writeFileSync(join(projectDir, "gradlew"), gradlew)
  chmodSync(join(projectDir, "gradlew"), 0o755)
  runGit(projectDir, ["init", "-q"])
  runGit(projectDir, ["config", "user.email", "ph@example.invalid"])
  runGit(projectDir, ["config", "user.name", "PH Test"])
  runGit(projectDir, ["add", "."])
  runGit(projectDir, ["commit", "-qm", "fixture"])
  return projectDir
}

function successScript(): string {
  return "#!/bin/sh\nprintf 'secret-output-%s' \"$1\"\nexit 0\n"
}

afterEach(() => {
  for (const project of projects) rmSync(project, { force: true, recursive: true })
  projects.length = 0
})

describe("CI reverification runner", () => {
  it("runs fixed test/build argv and writes a digest-only strict artifact", () => {
    const projectDir = createProject(successScript())
    const result = runCiReverification(projectDir, "ci")

    expect(result.finalStatus).toBe("passed")
    expect(result.artifactPath).toBeDefined()
    const source = readFileSync(result.artifactPath ?? "", "utf8")
    expect(source).not.toContain("secret-output")
    const artifact = JSON.parse(source)
    expect(artifact.commands.map((command: { readonly fixedArgvId: string }) => command.fixedArgvId)).toEqual([
      "gradle-wrapper-test.1",
      "gradle-wrapper-build.1",
    ])
    expect(artifact.commands.every((command: { readonly stdoutSha256: string }) => /^[a-f0-9]{64}$/u.test(command.stdoutSha256))).toBe(true)
  })

  it("binds mutation snapshot artifact-parent paths to the configured evidence root", () => {
    const projectDir = createProject(successScript())
    const customRoot = join(projectDir, ".persona", "custom-evidence")
    mkdirSync(customRoot, { recursive: true })
    writeFileSync(
      join(projectDir, ".persona", "harness.jsonc"),
      `${JSON.stringify({ evidenceDir: ".persona/custom-evidence" }, null, 2)}\n`,
    )

    const result = runCiReverification(projectDir, "ci")
    const artifact = JSON.parse(readFileSync(result.artifactPath ?? "", "utf8")) as {
      readonly mutationSnapshot: {
        readonly artifactParent: {
          readonly pre: { readonly relativePath: string }
          readonly post: { readonly relativePath: string }
          readonly relativePath: string
        }
      }
    }

    expect(result.artifactPath).toContain(".persona/custom-evidence/ci-reverification/")
    expect(artifact.mutationSnapshot.artifactParent.relativePath).toBe(".persona/custom-evidence")
    expect(artifact.mutationSnapshot.artifactParent.pre.relativePath).toBe(".persona/custom-evidence")
    expect(artifact.mutationSnapshot.artifactParent.post.relativePath).toBe(".persona/custom-evidence")
  })

  it("rejects duplicate artifact IDs without replacing the original bytes", () => {
    const projectDir = createProject(successScript())
    const artifactId = "duplicate-artifact"
    const first = runCiReverification(projectDir, "ci", {
      writeArtifact: (evidenceParent, _attemptId, source) =>
        writeAndRereadCiReverificationArtifact(evidenceParent, artifactId, source),
    })
    const artifactPath = join(projectDir, ".persona", "evidence", "ci-reverification", `${artifactId}.json`)
    const before = readFileSync(artifactPath, "utf8")
    const second = runCiReverification(projectDir, "ci", {
      writeArtifact: (evidenceParent, _attemptId, source) =>
        writeAndRereadCiReverificationArtifact(
          evidenceParent,
          artifactId,
          source.replace('"diagnosticCodes": [],', '"diagnosticCodes": ["second-write-sentinel"],'),
        ),
    })

    expect(first.finalStatus).toBe("passed")
    expect(second.finalStatus).toBe("artifact-invalid")
    expect(second.diagnosticCodes).toContain("artifact-write-reread-invalid")
    expect(readFileSync(artifactPath, "utf8")).toBe(before)
    expect(readFileSync(artifactPath, "utf8")).not.toContain("second-write-sentinel")
    expect(existsSync(join(projectDir, ".persona", "evidence", "ci-reverification", `.${artifactId}.tmp`))).toBe(false)
  })

  it("distinguishes first failure, later partial, and timeout precedence", () => {
    const failed = createProject("#!/bin/sh\nexit 7\n")
    expect(runCiReverification(failed, "ci").finalStatus).toBe("failed")

    const partial = createProject("#!/bin/sh\n[ \"$1\" = test ] && exit 0\nexit 8\n")
    expect(runCiReverification(partial, "ci").finalStatus).toBe("partial")

    const timedOut = createProject(successScript())
    const timeoutResult = runCiReverification(timedOut, "ci", {
      beforeArtifactWrite: () => {
        renameSync(join(timedOut, ".persona", "evidence"), join(timedOut, ".persona", "evidence-old"))
        mkdirSync(join(timedOut, ".persona", "evidence"))
      },
      runProcess: () => ({
        killed: true,
        outcome: "timeout",
        outputLimited: false,
        signal: "SIGKILL",
        status: 137,
        stderr: "timeout secret",
        stdout: "",
        timedOut: true,
      }),
    })
    expect(timeoutResult.finalStatus).toBe("timeout")
  })

  it("blocks new tracked source mutation only in CI and preserves the file", () => {
    function mutate(projectDir: string): () => BoundedProcessResult {
      let calls = 0
      return (): BoundedProcessResult => {
        calls += 1
        if (calls === 1) writeFileSync(join(projectDir, "src", "main", "java", "App.java"), "class App { int changed; }\n")
        return { killed: false, outcome: "passed" as const, outputLimited: false, signal: null, status: 0, stderr: "", stdout: "", timedOut: false }
      }
    }
    const ciProject = createProject(successScript())
    expect(runCiReverification(ciProject, "ci", { runProcess: mutate(ciProject) }).finalStatus).toBe("partial")
    expect(readFileSync(join(ciProject, "src", "main", "java", "App.java"), "utf8")).toContain("changed")

    const localProject = createProject(successScript())
    expect(runCiReverification(localProject, "local", { runProcess: mutate(localProject) }).finalStatus).toBe("passed")
    expect(readFileSync(join(localProject, "src", "main", "java", "App.java"), "utf8")).toContain("changed")
  })

  it("maps unsupported platform, artifact failure, HEAD change, and root capture failure", () => {
    const unavailable = createProject(successScript())
    expect(runCiReverification(unavailable, "ci", { platform: "win32" }).finalStatus).toBe("unavailable")

    const artifactInvalid = createProject(successScript())
    expect(runCiReverification(artifactInvalid, "ci", {
      writeArtifact: (_parent, _attempt, _source) => ({ path: "invalid", valid: false }),
    }).finalStatus).toBe("artifact-invalid")

    const headChanged = createProject(successScript())
    let gitCaptures = 0
    expect(runCiReverification(headChanged, "ci", {
      captureGit: (projectDir, root) => {
        const captured = captureGitIdentity(projectDir, root)
        gitCaptures += 1
        return gitCaptures === 2 && captured.available
          ? { ...captured, head: "f".repeat(40) }
          : captured
      },
    }).finalStatus).toBe("partial")

    const rootUnavailable = createProject(successScript())
    let rootCaptures = 0
    expect(runCiReverification(rootUnavailable, "ci", {
      captureWorkspace: (projectDir) => {
        rootCaptures += 1
        return rootCaptures === 2
          ? { diagnosticCode: "workspace-root-unavailable", status: "unavailable" }
          : captureWorkspaceIdentity(projectDir)
      },
    }).finalStatus).toBe("partial")
  })
})
