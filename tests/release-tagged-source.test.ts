import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { describe, expect, it } from "vitest"
import { parse } from "yaml"
import { z } from "zod"

import { CLEAN_PACKAGE_SOURCE_FIXTURE_PATHS } from "./fixtures/clean-package-source-fixture-closure.mjs"

const workflowSchema = z.object({ jobs: z.object({ verify: z.object({
  steps: z.array(z.object({ name: z.string(), run: z.string().optional() })),
}) }) })

describe("release tagged-source verification", () => {
  it.each(["approved", "not-ancestor", "wrong-version"] as const)("uses trusted main policy before selecting a %s tag", (scenario) => {
    // Given: main has advanced; the tag contains a deliberately untrusted policy.
    const root = mkdtempSync(join(tmpdir(), "release-tagged-source-"))
    const seed = join(root, "seed")
    const consumer = join(root, "consumer")
    const envPath = join(root, "github-env")
    const environment = {
      PATH: process.env.PATH ?? "", HOME: root, GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: "/dev/null",
      GIT_TERMINAL_PROMPT: "0", LC_ALL: "C", TZ: "UTC",
    }
    function git(cwd: string, ...args: string[]): string {
      const result = spawnSync("git", ["-c", "user.name=Release Fixture", "-c", "user.email=fixture@example.invalid", ...args], {
        cwd, env: environment, encoding: "utf8", timeout: 10000,
      })
      assert.equal(result.status, 0, result.stderr)
      return result.stdout.trim()
    }
    try {
      mkdirSync(join(seed, "scripts"), { recursive: true })
      git(seed, "init", "--initial-branch=main")
      writeFileSync(join(seed, "package.json"), JSON.stringify({ name: "persona-harness", version: scenario === "wrong-version" ? "1.0.0" : "1.1.0" }))
      for (const path of CLEAN_PACKAGE_SOURCE_FIXTURE_PATHS) copyFileSync(path, join(seed, path))
      writeFileSync(join(seed, "scripts/release-workflow-policy.mjs"), 'process.stderr.write("untrusted-tag-policy-executed\\n"); process.exit(77);\n')
      git(seed, "add", ".")
      git(seed, "commit", "-m", "tagged fixture")
      git(seed, "tag", "v1.1.0")
      const tagHead = git(seed, "rev-parse", "HEAD")
      if (scenario === "not-ancestor") git(seed, "checkout", "--orphan", "later-main")
      writeFileSync(join(seed, "package.json"), JSON.stringify({ name: "persona-harness", version: "1.2.0" }))
      copyFileSync("scripts/release-workflow-policy.mjs", join(seed, "scripts/release-workflow-policy.mjs"))
      git(seed, "add", ".")
      git(seed, "commit", "-m", "protected main policy")
      if (scenario === "not-ancestor") git(seed, "branch", "-M", "main")
      const mainHead = git(seed, "rev-parse", "HEAD")
      git(root, "clone", "--quiet", seed, consumer)
      writeFileSync(envPath, "")
      const parsed: unknown = parse(readFileSync(".github/workflows/release.yml", "utf8"))
      const steps = workflowSchema.parse(parsed).jobs.verify.steps
      const step = steps.find((entry) => entry.name === "Verify approved release source")
      assert.ok(step?.run)
      function boundary(githubSha: string) {
        return spawnSync(process.execPath, ["scripts/verify-clean-package-boundary.mjs", "--git-boundary-only"], {
          cwd: consumer, encoding: "utf8", timeout: 10000, env: { ...environment, GITHUB_SHA: githubSha },
        })
      }
      expect(boundary(mainHead).status).toBe(0)

      // When: execute the actual workflow script with a local-only Git remote.
      const result = spawnSync("bash", ["-c", step.run], {
        cwd: consumer, encoding: "utf8", timeout: 10000,
        env: { ...environment, GITHUB_REF: "refs/heads/main", GITHUB_REPOSITORY: "jyt6640/persona-harness",
          GITHUB_SHA: mainHead, GITHUB_ENV: envPath, TAG_NAME: "v1.1.0", APPROVAL_SCOPE: "ga-approved" },
      })

      // Then: rejected tags never execute their policy or replace the checkout.
      expect(result.error).toBeUndefined()
      expect(result.status).toBe(scenario === "approved" ? 0 : 1)
      expect(result.stderr).not.toContain("untrusted-tag-policy-executed")
      const mainBoundary = boundary(mainHead)
      expect(mainBoundary.stderr).toBe("")
      expect(mainBoundary.status).toBe(0)
      expect(git(consumer, "rev-parse", "HEAD")).toBe(mainHead)
      expect(readFileSync(envPath, "utf8")).toBe(scenario === "approved" ? `RELEASE_SOURCE_HEAD=${tagHead}\n` : "")
      if (scenario !== "approved") return

      const select = steps.find((entry) => entry.name === "Select approved tagged source")
      assert.ok(select?.run)
      const selected = spawnSync("bash", ["-c", select.run], {
        cwd: consumer, encoding: "utf8", timeout: 10000,
        env: { ...environment, TAG_NAME: "v1.1.0", RELEASE_SOURCE_HEAD: tagHead },
      })
      expect(selected.status).toBe(0)
      expect(git(consumer, "rev-parse", "HEAD")).toBe(tagHead)
      expect(git(consumer, "rev-parse", "refs/remotes/origin/main")).toBe(mainHead)
      expect(git(consumer, "status", "--porcelain=v1")).toBe("")
      for (const githubSha of [mainHead, tagHead]) {
        const historicalBoundary = boundary(githubSha)
        expect(historicalBoundary.status).toBe(1)
        expect(historicalBoundary.stderr).toBe("clean-package-ancestry\n")
      }
      git(consumer, "checkout", "--detach", mainHead)
      expect(boundary(tagHead).status).toBe(0)

      const mismatch = spawnSync("bash", ["-c", select.run], {
        cwd: consumer, encoding: "utf8", timeout: 10000,
        env: { ...environment, TAG_NAME: "v1.1.0", RELEASE_SOURCE_HEAD: mainHead },
      })
      expect(mismatch.status).toBe(1)
      expect(git(consumer, "rev-parse", "HEAD")).toBe(mainHead)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it("finishes the protected-main contract before isolated tagged tests and packing", () => {
    // Given: the release workflow owns both source boundaries.
    const parsed: unknown = parse(readFileSync(".github/workflows/release.yml", "utf8"))
    const steps = workflowSchema.parse(parsed).jobs.verify.steps
    const commands = steps.map((step) => step.run ?? "")

    // When: locate the executable boundaries in workflow order.
    const repository = commands.findIndex((run) => run === "npm run test:repository")
    const select = steps.findIndex((step) => step.name === "Select approved tagged source")
    const install = steps.findIndex((step) => step.name === "Install tagged dependencies")
    const taggedTests = steps.findIndex((step) => step.name === "Test approved tagged source")
    const pack = steps.findIndex((step) => step.name === "Create one canonical package tarball")

    // Then: keep the full main contract, reinstall the tag lockfile, and test the exact tag.
    expect(repository).toBeGreaterThan(-1)
    expect(select).toBeGreaterThan(repository)
    expect(install).toBeGreaterThan(select)
    expect(commands[install]).toBe("npm ci")
    expect(taggedTests).toBeGreaterThan(install)
    expect(commands[taggedTests]).toBe("npx --no-install vitest run --testTimeout=15000")
    expect(pack).toBeGreaterThan(taggedTests)
  })
})
