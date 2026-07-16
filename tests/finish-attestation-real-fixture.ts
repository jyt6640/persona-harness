import { spawnSync } from "node:child_process"
import { copyFileSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

export const PROTECTED_MAIN_HEAD = "84901174235f0a9c7bc08f0dbd5be6d94c02d500"
export const REAL_ATTESTATION_NOW = new Date("2026-07-16T16:00:00.000Z")
export const EXPIRED_ATTESTATION_NOW = new Date("2026-07-16T17:35:45.394Z")

const BUNDLE_FIXTURE = join(process.cwd(), "tests", "fixtures", "finish-attestation", "protected-main-29511625395.bundle.json")

export type RealArtifactProject = {
  readonly cleanup: () => void
  readonly projectDir: string
}

export function createRealArtifactProject(workflowReady = false): RealArtifactProject {
  const tempRoot = mkdtempSync(join(tmpdir(), "persona-finish-attestation-real-"))
  const projectDir = join(tempRoot, "project")
  const worktree = spawnSync("git", ["worktree", "add", "--detach", projectDir, PROTECTED_MAIN_HEAD], {
    cwd: process.cwd(),
    encoding: "utf8",
    shell: false,
  })
  if (worktree.status !== 0) {
    rmSync(tempRoot, { force: true, recursive: true })
    throw new Error(`could not create protected-main fixture worktree: ${worktree.stderr}`)
  }

  const bundlePath = join(projectDir, ".persona", "evidence", "finish-attestation", "bundle.json")
  mkdirSync(join(bundlePath, ".."), { recursive: true })
  copyFileSync(BUNDLE_FIXTURE, bundlePath)
  if (workflowReady) writeWorkflowFixture(projectDir)

  return {
    cleanup: () => {
      spawnSync("git", ["worktree", "remove", "--force", projectDir], {
        cwd: process.cwd(),
        encoding: "utf8",
        shell: false,
      })
      rmSync(tempRoot, { force: true, recursive: true })
    },
    projectDir,
  }
}

function writeWorkflowFixture(projectDir: string): void {
  const workflowDir = join(projectDir, ".persona", "workflow")
  mkdirSync(workflowDir, { recursive: true })
  writeFileSync(join(workflowDir, "plan.md"), "Status: accepted\n")
  writeFileSync(
    join(workflowDir, "implementation-report.md"),
    "Status: filled\n- README ranges read: all\n- Project profile ranges read: all\n- `npx ph bearshell --shell './gradlew test'`\n",
  )
  writeFileSync(
    join(workflowDir, "review-report.md"),
    "Status: filled\n- Requirements reviewed against the accepted plan.\n- Manual QA completed.\n",
  )
  const evidencePath = join(projectDir, ".persona", "evidence", "phase0", "verification.json")
  mkdirSync(join(evidencePath, ".."), { recursive: true })
  writeFileSync(
    evidencePath,
    `${JSON.stringify({
      command: "npx ph bearshell --shell './gradlew test'",
      status: 0,
      tool: "bearshell",
      toolOutput: "BUILD SUCCESSFUL",
    })}\n`,
  )
}
