import { spawnSync } from "node:child_process"
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import { assertCanonicalPartialCloneRemote } from "../scripts/clean-package-boundary-core.mjs"

const repositoryRoot = process.cwd()

describe("clean package partial source materialization", () => {
  it("hydrates only the fixed base from a blobless origin before source bundle materialization", () => {
    const fixture = createFixture("partial")

    try {
      expect(gitText(fixture.clone, ["config", "--get", "remote.origin.promisor"])).toBe("true")
      expect(gitText(fixture.clone, ["config", "--get", "remote.origin.partialclonefilter"])).toBe("blob:none")
      git(fixture.clone, ["fetch", "--refetch", "--no-filter", "--no-tags", "--no-write-fetch-head", "origin", fixture.base])
      expect(gitText(fixture.clone, ["rev-parse", "refs/remotes/origin/main"])).toBe(fixture.base)

      const after = fetchFromPartial(fixture.materialized, fixture.clone, fixture.head, fixture.base)
      expect(after.status).toBe(0)
      expect(gitText(fixture.materialized, ["rev-parse", "refs/heads/clean-package-source"])).toBe(fixture.head)
      expect(gitText(fixture.materialized, ["rev-parse", "refs/remotes/origin/main"])).toBe(fixture.base)
    } finally {
      fixture.cleanup()
    }
  })

  it("leaves an ordinary clone on the direct local source materialization route", () => {
    const fixture = createFixture("ordinary")

    try {
      expect(runGit(fixture.clone, ["config", "--get", "remote.origin.promisor"]).status).not.toBe(0)
      const result = fetchFromPartial(fixture.materialized, fixture.clone, fixture.head, fixture.base)
      expect(result.status).toBe(0)
    } finally {
      fixture.cleanup()
    }
  })

  it("rejects a foreign promisor remote before any base hydration", () => {
    expect(assertCanonicalPartialCloneRemote("https://github.com/jyt6640/persona-harness.git"))
      .toBe("https://github.com/jyt6640/persona-harness.git")
    expect(() => assertCanonicalPartialCloneRemote("file:///attacker/repository.git"))
      .toThrow("clean-package-source-hydrate")
  })

  it("requires the source bundle verifier to hydrate the exact retained base without moving it", () => {
    const verifier = readVerifier()

    expect(verifier).toContain("hydratePartialSource(sourceRoot, base, git)")
    expect(verifier).toMatch(/\[\s*"fetch",\s*"--refetch",\s*"--no-filter",\s*"--no-tags",\s*"--no-write-fetch-head",\s*"origin",\s*base/u)
    expect(verifier).toContain("BUNDLE_REFERENCE_POLICY.mainRef")
  })
})

function createFixture(mode: "ordinary" | "partial") {
  const root = mkdtempSync(join(tmpdir(), "persona-clean-package-partial-source-"))
  const remote = join(root, "origin.git")
  const source = join(root, "source")
  const clone = join(root, "clone")
  const materialized = join(root, "materialized.git")
  git(root, ["init", "--bare", remote])
  git(remote, ["config", "uploadpack.allowFilter", "true"])
  git(remote, ["config", "uploadpack.allowAnySHA1InWant", "true"])
  git(root, ["init", source])
  git(source, ["config", "user.email", "tests@example.invalid"])
  git(source, ["config", "user.name", "Persona Harness Tests"])
  writeFileSync(join(source, "historical.txt"), "historical\n")
  git(source, ["add", "historical.txt"])
  git(source, ["commit", "-m", "historical"])
  writeFileSync(join(source, "current.txt"), "current\n")
  git(source, ["add", "current.txt"])
  git(source, ["commit", "-m", "current"])
  git(source, ["branch", "-M", "main"])
  git(source, ["remote", "add", "origin", `file://${remote}`])
  git(source, ["push", "origin", "main"])
  git(root, ["clone", ...(mode === "partial" ? ["--filter=blob:none"] : []), "--no-checkout", `file://${remote}`, clone])
  git(clone, ["checkout", "--detach", "origin/main"])
  git(clone, ["config", "user.email", "tests@example.invalid"])
  git(clone, ["config", "user.name", "Persona Harness Tests"])
  writeFileSync(join(clone, "candidate.txt"), "candidate\n")
  git(clone, ["add", "candidate.txt"])
  git(clone, ["commit", "-m", "candidate"])
  const base = gitText(clone, ["rev-parse", "refs/remotes/origin/main"])
  const head = gitText(clone, ["rev-parse", "HEAD"])
  git(root, ["init", "--bare", materialized])
  return { base, cleanup: () => rmSync(root, { force: true, recursive: true }), clone, head, materialized }
}

function fetchFromPartial(materialized: string, partial: string, head: string, base: string) {
  return runGit(materialized, [
    "-c",
    "protocol.file.allow=always",
    "fetch",
    "--no-tags",
    "--no-write-fetch-head",
    partial,
    `${head}:refs/heads/clean-package-source`,
    `${base}:refs/remotes/origin/main`,
  ])
}

function git(cwd: string, args: readonly string[]): void {
  const result = runGit(cwd, args)
  if (result.status !== 0) throw new Error(`git fixture command failed: ${args.join(" ")}`)
}

function gitText(cwd: string, args: readonly string[]): string {
  const result = runGit(cwd, args)
  if (result.status !== 0) throw new Error(`git fixture query failed: ${args.join(" ")}`)
  return result.stdout.trim()
}

function readVerifier(): string {
  return readFileSync(join(repositoryRoot, "scripts", "verify-clean-package-boundary.mjs"), "utf8")
}

function runGit(cwd: string, args: readonly string[]) {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" })
  return { status: result.status, stdout: result.stdout ?? "" }
}
