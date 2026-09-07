import { spawnSync } from "node:child_process"
import { cpSync, existsSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import { proposePersonalizationCandidate } from "../src/cli/personalization-profile-store.js"
import { canonicalContextDigest } from "../src/context-core/context-digest.js"
import { cleanupProjects, createProject, writeHarnessConfig } from "./helpers/rule-fixtures.js"

afterEach(cleanupProjects)

function installedFixture(host: "codex" | "claude") {
  const root = realpathSync(createProject())
  const projectDir = join(root, "consumer project")
  const pluginDir = join(root, "installed plugin")
  const profileDir = join(root, "approved profile")
  mkdirSync(projectDir)
  writeHarnessConfig(projectDir, { context: { enabled: true, maxCapsules: 16, maxChars: 4_000 } })
  const source = host === "codex" ? "packages/host-plugins/codex/plugins/persona-harness" : "packages/host-plugins/claude"
  cpSync(join(process.cwd(), source), pluginDir, { recursive: true })
  proposePersonalizationCandidate({
    schemaVersion: "personalization-candidate.v1", candidateId: "atomic-transfer", topic: "transactions",
    rule: "Keep transfer writes and the outbox atomic.", scope: { kind: "personal", key: "personal" },
    provenance: { kind: "user", reference: "synthetic-approved-fixture" }, rationale: "Prevent partial transfer state.",
    tradeoffs: "A transaction spans both writes.", counterexample: "Reconsider for independent stores.", outcome: "No partial transfer is visible.",
  }, { storeRoot: profileDir })
  const input = { session_id: "package-fixture", cwd: projectDir, hook_event_name: "PreToolUse", tool_name: "apply_patch", tool_input: {
    command: "*** Begin Patch\n*** Add File: src/TransferService.java\n+class TransferService {}\n*** End Patch",
  } }
  const run = (value: unknown = input) => spawnSync(process.execPath, [join(pluginDir, "scripts/context-runtime.mjs"), "--host", host], {
    cwd: projectDir, encoding: "utf8", input: typeof value === "string" ? value : JSON.stringify(value),
    env: { PATH: process.env.PATH ?? "", PH_HOME: profileDir }, timeout: 10_000, maxBuffer: 64 * 1024,
  })
  const setup = (args: readonly string[], stdin?: string) => spawnSync(process.execPath, [join(pluginDir, "scripts/context-setup.mjs"), ...args], {
    cwd: projectDir, encoding: "utf8", input: stdin, env: { PATH: process.env.PATH ?? "", PH_HOME: profileDir },
    timeout: 10_000, maxBuffer: 64 * 1024,
  })
  return { input, pluginDir, profileDir, projectDir, run, setup, source }
}

describe("relocated portable Context package", () => {
  it.each(["codex", "claude"] as const)("resumes and ends a task through the relocated %s bridge", (host) => {
    const { input, profileDir, run, setup } = installedFixture(host)
    proposePersonalizationCandidate({
      schemaVersion: "personalization-candidate.v1", candidateId: "task-query", topic: "query-style",
      rule: "Use explicit task queries.", scope: { kind: "task", key: "task-a" },
      provenance: { kind: "user", reference: "synthetic-task-resume" }, rationale: "Keep query intent reviewable.",
      tradeoffs: "More explicit query definitions.", counterexample: "Reconsider for another task.", outcome: "Tests exercise declared queries.",
    }, { storeRoot: profileDir })
    const handle = canonicalContextDigest({ host, sessionId: input.session_id })
    const task = ["context", "task", "--session", handle]

    const resumed = setup([...task, "resume", "--task", "task-a"])

    expect(resumed).toMatchObject({ status: 0, stderr: "" })
    expect(run().stdout).toContain("Use explicit task queries.")
    const preview = setup([...task, "preview", "src/App.java", "--json", "--topic", "query-style"])
    expect(preview.status).toBe(0)
    expect(JSON.parse(preview.stdout)).toMatchObject({ envelope: { selected: [{ id: "rule-task-query", layer: "task" }] } })
    expect(run({ ...input, session_id: "new-session" }).stdout).not.toContain("Use explicit task queries.")
    expect(setup([...task, "end", "--task", "task-a"]).status).toBe(0)
    expect(run().stdout).not.toContain("Use explicit task queries.")
  })

  it.each(["codex", "claude"] as const)("reuses a checkout binding through the relocated %s setup and hook", (host) => {
    const { profileDir, run, setup } = installedFixture(host)
    proposePersonalizationCandidate({
      schemaVersion: "personalization-candidate.v1", candidateId: "project-query", topic: "query-style",
      rule: "Use explicit project queries.", scope: { kind: "project", key: "checkout-a" },
      provenance: { kind: "user", reference: "synthetic-project-consent" }, rationale: "Keep query intent reviewable.",
      tradeoffs: "More explicit query definitions.", counterexample: "Reconsider for trivial lookups.", outcome: "Tests exercise declared queries.",
    }, { storeRoot: profileDir })

    const binding = setup(["context", "scope", "bind", "--project", "checkout-a"])

    expect(binding.status).toBe(0)
    expect(JSON.parse(binding.stdout)).toEqual({ status: "bound", projectKey: "checkout-a" })
    expect(run().stdout).toContain("Use explicit project queries.")
    expect(setup(["context", "scope", "unbind", "--project", "checkout-a"]).status).toBe(0)
    expect(run().stdout).not.toContain("Use explicit project queries.")
  })

  it.each(["codex", "claude"] as const)("shows %s setup help without changing configuration or profile", (host) => {
    const { pluginDir, profileDir, projectDir, setup } = installedFixture(host)
    const paths = [join(projectDir, ".persona/harness.jsonc"), join(profileDir, "profile.json")]
    const before = paths.map((path) => readFileSync(path))
    const result = setup(["--help"])
    expect(result.status).toBe(0)
    expect(result.stderr).toBe("")
    expect(result.stdout).toContain("context init --enable")
    expect(result.stdout).toContain("philosophy propose --stdin")
    expect(result.stdout).toContain(join(pluginDir, "skills/philosophy-refinement/references/persistence.md"))
    expect(paths.map((path) => readFileSync(path))).toEqual(before)
  })

  it.each(["codex", "claude"] as const)("runs the %s packaged Java checker against consumer files", (host) => {
    const { pluginDir, projectDir } = installedFixture(host)
    const file = join(projectDir, "Sample.java")
    writeFileSync(file, "import java.util.List;\nclass Sample { List values; }\n")
    const result = spawnSync("bash", [join(pluginDir, "skills/programming/scripts/java/check-no-excuse-rules.sh"), file], {
      cwd: projectDir, encoding: "utf8", timeout: 10_000,
    })
    expect(result.status).toBe(1)
    expect(result.stderr).toContain("[raw-type]")
  })

  it.each(["codex", "claude"] as const)("accepts a clean Java source with the %s packaged checker", (host) => {
    const { pluginDir, projectDir } = installedFixture(host)
    const file = join(projectDir, "Sample.java")
    writeFileSync(file, "record Sample(String value) {}\n")
    const result = spawnSync("bash", [join(pluginDir, "skills/programming/scripts/java/check-no-excuse-rules.sh"), file], {
      cwd: projectDir, encoding: "utf8", timeout: 10_000,
    })
    expect(result.status).toBe(0)
    expect(result.stderr).toBe("")
  })

  it.each(["codex", "claude"] as const)("offers %s consent without changing an existing undecided config", (host) => {
    const { input, projectDir, run, setup } = installedFixture(host)
    const config = join(projectDir, ".persona/harness.jsonc")
    const before = '// Preserve user settings.\n{"features":{"runtimeInjection":false}}\n'
    writeFileSync(config, before)
    const result = run({ ...input, hook_event_name: "SessionStart", source: "startup" })
    expect(result.status).toBe(0)
    expect(result.stdout).toContain("context.enabled")
    expect(result.stdout).not.toContain("context init --enable")
    expect(readFileSync(config, "utf8")).toBe(before)
    expect(setup(["context", "init", "--enable"]).status).toBe(1)
    expect(readFileSync(config, "utf8")).toBe(before)
  })

  it.each(["codex", "claude"] as const)("keeps %s first-use guidance separate from explicitly invoked setup", (host) => {
    const { input, profileDir, projectDir, run, setup } = installedFixture(host)
    const config = join(projectDir, ".persona/harness.jsonc")
    const profile = readFileSync(join(profileDir, "profile.json"))
    rmSync(config)
    const guidance = run({ ...input, hook_event_name: "SessionStart", source: "startup" })
    expect(guidance.status).toBe(0)
    expect(guidance.stdout).toContain("first-use consent")
    expect(existsSync(config)).toBe(false)
    expect(setup(["context", "init", "--enable"]).status).toBe(0)
    const enabled = readFileSync(config)
    expect(JSON.parse(enabled.toString("utf8"))).toMatchObject({ context: { enabled: true, mode: "targeted" } })
    expect(setup(["context", "init", "--enable"]).status).toBe(1)
    expect(readFileSync(config)).toEqual(enabled)
    expect(readFileSync(join(profileDir, "profile.json"))).toEqual(profile)
    expect(run().stdout).toContain("Keep transfer writes and the outbox atomic.")
    writeHarnessConfig(projectDir, { context: { enabled: false } })
    const disabled = readFileSync(config)
    expect(setup(["context", "init", "--enable"]).status).toBe(1)
    expect(readFileSync(config)).toEqual(disabled)
    expect(run({ ...input, hook_event_name: "SessionStart", source: "resume" }).stdout).toBe("")
  })

  it("uses the existing approved candidate lifecycle through the relocated bridge", () => {
    const { run, setup } = installedFixture("claude")
    const candidate = {
      schemaVersion: "personalization-candidate.v1", candidateId: "explicit-queries", topic: "query-style",
      rule: "Use explicit repository queries.", scope: { kind: "personal", key: "personal" },
      provenance: { kind: "user", reference: "synthetic-approved-fixture" }, rationale: "Make query intent reviewable.",
      tradeoffs: "More explicit query definitions.", counterexample: "Reconsider for trivial lookups.", outcome: "Tests exercise the declared query behavior.",
    }
    const stored = setup(["philosophy", "propose", "--stdin"], JSON.stringify(candidate))
    expect(stored.status).toBe(0)
    expect(JSON.parse(stored.stdout)).toEqual({ status: "activated" })
    expect(run().stdout).toContain("Use explicit repository queries.")
    const conflict = setup(["philosophy", "propose", "--stdin"], JSON.stringify({ ...candidate, candidateId: "other-queries", rule: "Use implicit repository queries." }))
    expect(conflict.status).toBe(1)
    expect(run().stdout).toContain("Use explicit repository queries.")
    expect(run().stdout).not.toContain("Use implicit repository queries.")
  })

  it.each(["codex", "claude"] as const)("runs %s from its copied plugin without parent package or dependencies", (host) => {
    const { pluginDir, projectDir, run } = installedFixture(host)
    expect(existsSync(join(pluginDir, "node_modules"))).toBe(false)
    expect(existsSync(join(projectDir, "node_modules"))).toBe(false)
    const result = run()
    expect(result.status).toBe(0)
    expect(result.stderr).toBe("")
    const output: unknown = JSON.parse(result.stdout)
    expect(output).toMatchObject({ hookSpecificOutput: { hookEventName: "PreToolUse", additionalContext: expect.stringContaining("Keep transfer writes and the outbox atomic.") } })
    expect(result.stdout).not.toContain("permissionDecision")
    expect(result.stdout).not.toContain("updatedInput")
  })

  it("preserves user-owned files and approval through plugin removal and reinstall", () => {
    const { pluginDir, profileDir, projectDir, run, source } = installedFixture("claude")
    const customFiles = [join(projectDir, "AGENTS.md"), join(projectDir, "CLAUDE.md"), join(projectDir, "other-plugin.json")]
    for (const file of customFiles) writeFileSync(file, "user-owned customization\n")
    const paths = [...customFiles, join(projectDir, ".persona/harness.jsonc"), join(profileDir, "profile.json")]
    const before = paths.map((path) => readFileSync(path))
    expect(run().status).toBe(0)
    rmSync(pluginDir, { recursive: true })
    cpSync(join(process.cwd(), source), pluginDir, { recursive: true })
    expect(run().status).toBe(0)
    expect(paths.map((path) => readFileSync(path))).toEqual(before)
  })

  it("emits no rule payload for opt-out, malformed stdin, oversized stdin or an unsafe target", () => {
    const { input, projectDir, run } = installedFixture("codex")
    for (const invalid of ["{", "x".repeat(1_048_577), { ...input, tool_input: { command: "*** Add File: ../outside.java" } }]) {
      const result = run(invalid)
      expect(result.status).toBe(1)
      expect(result.stdout).toBe("")
      expect(result.stderr).toMatch(/^Persona Harness Context blocked: [a-z-]+\n$/u)
      expect(result.stderr).not.toContain("outside.java")
    }
    writeHarnessConfig(projectDir, { context: { enabled: false } })
    const disabled = run()
    expect(disabled.status).toBe(0)
    expect(disabled.stdout).toBe("")
    expect(disabled.stderr).toBe("")
  })
})
