import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { describe, expect, it } from "vitest"
import { parse } from "yaml"
import { z } from "zod"

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
      const step = workflowSchema.parse(parsed).jobs.verify.steps.find((entry) => entry.name === "Verify approved release source")
      assert.ok(step?.run)

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
      expect(git(consumer, "rev-parse", "HEAD")).toBe(scenario === "approved" ? tagHead : mainHead)
      expect(readFileSync(envPath, "utf8")).toBe(scenario === "approved" ? `RELEASE_SOURCE_HEAD=${tagHead}\n` : "")
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})
