import { spawnSync } from "node:child_process"
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

const roots: string[] = []

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { force: true, recursive: true })
})

describe("clean package Git environment", () => {
  it("materializes a detached source checkout without inherited Git configuration", () => {
    const root = createSourceRoot(true)
    const result = runGitBoundary(root)

    expect(result.status).toBe(0)
    expect(result.stderr).toBe("")
    expect(JSON.parse(result.stdout)).toMatchObject({
      candidateRef: "refs/heads/clean-package-source",
      source: "detached-source",
    })
  })

  it("fails a non-Git source root with only the bounded Git diagnostic", () => {
    const root = createSourceRoot(false)
    const result = runGitBoundary(root)

    expect(result.status).toBe(1)
    expect(result.stdout).toBe("")
    expect(result.stderr).toBe("clean-package-git\n")
  })
})

function createSourceRoot(withGit: boolean): string {
  const root = track(mkdtempSync(join(tmpdir(), "persona-clean-package-git-")))
  const scripts = join(root, "scripts")
  mkdirSync(scripts)
  copyFileSync(join(process.cwd(), "scripts", "clean-package-boundary-core.mjs"), join(scripts, "clean-package-boundary-core.mjs"))
  copyFileSync(join(process.cwd(), "scripts", "verify-clean-package-boundary.mjs"), join(scripts, "verify-clean-package-boundary.mjs"))
  if (!withGit) return root

  writeFileSync(join(root, "README.md"), "# clean package Git fixture\n")
  git(root, ["init", "--initial-branch=main"])
  git(root, ["config", "user.email", "fixture@example.test"])
  git(root, ["config", "user.name", "Fixture"])
  git(root, ["add", "README.md", "scripts"])
  git(root, ["commit", "-m", "fixture"])
  git(root, ["update-ref", "refs/remotes/origin/main", "HEAD"])
  git(root, ["checkout", "--detach"])
  return root
}

function runGitBoundary(root: string): { readonly status: number | null; readonly stderr: string; readonly stdout: string } {
  const home = track(mkdtempSync(join(tmpdir(), "persona-clean-package-git-home-")))
  const result = spawnSync(process.execPath, [join(root, "scripts", "verify-clean-package-boundary.mjs"), "--git-boundary-only"], {
    cwd: root,
    encoding: "utf8",
    env: {
      GIT_CONFIG_GLOBAL: join(home, "global"),
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_DIR: join(home, "foreign-git"),
      GIT_TERMINAL_PROMPT: "0",
      GIT_WORK_TREE: join(home, "foreign-worktree"),
      HOME: home,
      LANG: "C",
      LC_ALL: "C",
      PATH: process.env.PATH ?? "",
    },
  })
  return {
    status: result.status,
    stderr: result.stderr ?? "",
    stdout: result.stdout ?? "",
  }
}

function git(root: string, args: readonly string[]): void {
  const result = spawnSync("git", args, { cwd: root, encoding: "utf8" })
  if (result.status !== 0) throw new Error(`fixture git command failed: ${args.join(" ")}`)
}

function track(root: string): string {
  roots.push(root)
  return root
}
