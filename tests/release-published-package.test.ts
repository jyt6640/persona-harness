import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { chmodSync, copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"

import { describe, expect, it } from "vitest"
import { parse } from "yaml"
import { z } from "zod"
import { releaseWorkflowCheckerFixturePaths } from "../scripts/release-workflow-checker-inputs.mjs"

const stepSchema = z.object({
  name: z.string(),
  run: z.string().optional(),
  with: z.object({ ref: z.string().optional() }).passthrough().optional(),
})
const workflowSchema = z.object({ jobs: z.object({ verify: z.object({ steps: z.array(stepSchema) }) }) })
const HEAD = "a".repeat(40)

function verificationSteps() {
  const parsed: unknown = parse(readFileSync(".github/workflows/release.yml", "utf8"))
  return workflowSchema.parse(parsed).jobs.verify.steps
}

describe("GitHub Release after npm publication", () => {
  it.each(["checkout", "readback", "source", "publication"] as const)("rejects a release workflow that loses the %s boundary", (boundary) => {
    // Given
    const root = mkdtempSync(join(tmpdir(), "release-published-policy-"))
    try {
      for (const path of releaseWorkflowCheckerFixturePaths()) {
        mkdirSync(dirname(join(root, path)), { recursive: true })
        copyFileSync(path, join(root, path))
      }
      const path = join(root, ".github/workflows/release.yml")
      const current = readFileSync(path, "utf8")
      const mutations = {
        checkout: current.replace('git checkout --detach "$tag_commit"', "true"),
        readback: current.replace("node scripts/release-registry-readback.mjs", "node scripts/skip-readback.mjs"),
        source: current.replace('--source-head "$RELEASE_SOURCE_HEAD"', '--source-head "$GITHUB_SHA"'),
        publication: `${current}\n      - name: Unexpected publisher\n        run: npm publish --dry-run\n`,
      }
      writeFileSync(path, mutations[boundary])

      // When
      const result = spawnSync(process.execPath, ["scripts/check-release-workflows.mjs"], {
        cwd: root, encoding: "utf8", timeout: 10000,
      })

      // Then
      expect(result.status).not.toBe(0)
      expect(result.stderr).toContain("release canonical published artifact readback")
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it("validates the immutable tag with protected-main policy before checking out its source", () => {
    // Given
    const steps = verificationSteps()
    const checkout = steps.find((step) => step.name === "Checkout")
    const source = steps.find((step) => step.name === "Verify approved release source")

    // Then
    expect(checkout?.with?.ref).toBeUndefined()
    expect(source?.run).toContain('git show "${tag_commit}:package.json"')
    expect(source?.run).toContain('git checkout --detach "$tag_commit"')
    expect(source?.run).toContain('test "$(git rev-parse HEAD)" = "$tag_commit"')
    expect(source?.run).toContain('echo "RELEASE_SOURCE_HEAD=$tag_commit" >> "$GITHUB_ENV"')
    assert.ok(source?.run)
    expect(source.run.indexOf("release-workflow-policy.mjs dist-tag")).toBeLessThan(source.run.indexOf('git checkout --detach "$tag_commit"'))
  })

  it.each([false, true])("reads the published package without another publish command (readback blocked=%s)", (blocked) => {
    // Given
    const step = verificationSteps().find((entry) => entry.name === "Preflight canonical tar publisher handoff")
    assert.ok(step?.run)
    const root = mkdtempSync(join(tmpdir(), "release-published-package-"))
    const calls = join(root, "calls.jsonl")
    const bin = join(root, "bin")
    mkdirSync(bin)
    try {
      for (const command of ["node", "npm"]) {
        const path = join(bin, command)
        writeFileSync(path, `#!${process.execPath}\n${commandShim(command)}`)
        chmodSync(path, 0o755)
      }

      // When: npm models the exact observed duplicate-version refusal.
      const result = spawnSync("bash", ["-c", step.run], {
        cwd: root,
        encoding: "utf8",
        timeout: 10000,
        env: {
          ...process.env, PATH: `${bin}:${process.env.PATH ?? ""}`,
          RELEASE_CALLS: calls, RELEASE_READBACK_BLOCKED: String(blocked),
          RELEASE_SOURCE_HEAD: HEAD, GITHUB_SHA: "b".repeat(40),
          CANONICAL_PACKAGE_DIRECTORY: root, CANONICAL_PACKAGE_FACTS: join(root, "facts.json"),
          CANONICAL_TARBALL: join(root, "package.tgz"), PUBLISHER_RUNTIME_DIRECTORY: root,
          PUBLISHER_NPM_HOME: root, PUBLISHER_NPM_CACHE: root,
          PUBLISHER_NPM_GLOBALCONFIG: join(root, "global"), PUBLISHER_NPM_USERCONFIG: join(root, "user"),
        },
      })

      // Then: the real workflow shell must preserve readback failures.
      expect(result.error).toBeUndefined()
      expect(result.status).toBe(blocked ? 1 : 0)
      const observed = readFileSync(calls, "utf8").trim().split("\n").map((line) => z.array(z.string()).parse(JSON.parse(line)))
      expect(observed.some((call) => call[0] === "npm")).toBe(false)
      expect(observed).toContainEqual([
        "node", "scripts/release-registry-readback.mjs", "--dist-tag", "latest",
        "--package-facts", join(root, "facts.json"), "--source-head", HEAD, "--version", "1.1.0",
      ])
      expect(result.stdout).toContain(blocked ? '"status":"blocked"' : '"status":"passed"')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})

function commandShim(command: string): string {
  return `
const fs = require("node:fs");
const args = process.argv.slice(2);
fs.appendFileSync(process.env.RELEASE_CALLS, JSON.stringify([${JSON.stringify(command)}, ...args]) + "\\n");
if (${JSON.stringify(command)} === "npm") {
  process.stderr.write("You cannot publish over the previously published versions: 1.1.0.\\n");
  process.exit(1);
}
if (args[0] === "-p") { process.stdout.write("1.1.0\\n"); process.exit(0); }
if (args[0] === "scripts/canonical-package-publisher.mjs" && args.at(-1) === "true") process.exit(0);
if (args[0] === "scripts/release-registry-readback.mjs") {
  const blocked = process.env.RELEASE_READBACK_BLOCKED === "true";
  process.stdout.write(JSON.stringify({status: blocked ? "blocked" : "passed"}) + "\\n");
  process.exit(blocked ? 1 : 0);
}
process.exit(2);
`
}
