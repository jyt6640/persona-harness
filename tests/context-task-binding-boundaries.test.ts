import { readFileSync, readdirSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import { runContextCommand } from "../src/cli/context-command.js"
import { canonicalContextDigest } from "../src/context-core/context-digest.js"
import { runPortableContextHook } from "../src/context-delivery/portable-context-hook.js"
import { approveTaskRule, checkoutScopeFixture } from "./helpers/context-scope-fixtures.js"
import { cleanupProjects, writeHarnessConfig } from "./helpers/rule-fixtures.js"

afterEach(cleanupProjects)

const session = canonicalContextDigest({ host: "codex", sessionId: "boundary-session" })
const prefix = ["task", "--session", session]

function fixture() {
  const input = checkoutScopeFixture()
  approveTaskRule(input)
  expect(runContextCommand([...prefix, "resume", "--task", "task-a"], "ph", input).status).toBe(0)
  const directory = join(input.personalization.storeRoot, "task-bindings")
  const file = readdirSync(directory)[0]
  if (file === undefined) throw new Error("expected task record")
  const hookInput = { session_id: "boundary-session", hook_event_name: "PreToolUse", cwd: input.projectDir,
    tool_name: "Read", tool_input: { file_path: "src/App.java" } }
  return { ...input, directory, record: join(directory, file), hookInput }
}

describe("task connection boundaries", () => {
  it("stores only a composite digest and approved key", () => {
    const input = fixture()

    const stored: unknown = JSON.parse(readFileSync(input.record, "utf8"))

    expect(stored).toEqual({ schemaVersion: "persona-context-task-binding.1", bindingDigest: expect.stringMatching(/^[a-f0-9]{64}$/u), taskKey: "task-a" })
  })

  it("keeps the same host session id isolated between Codex and Claude", () => {
    const input = fixture()

    const result = runPortableContextHook(input.hookInput, input.projectDir, { ...input, host: "claude" })

    expect(result).toMatchObject({ status: "offered", selection: { warningCodes: expect.arrayContaining(["task-scope-unbound"]) } })
    if (result.status !== "offered") throw new Error("expected inspectable unbound session")
    expect(result.selection.ruleIds).not.toContain("rule-approved-task-a")
  })

  it("requires the existing key to end and never silently switches tasks", () => {
    const input = fixture()
    approveTaskRule(input, "task-b")
    const before = readFileSync(input.record)

    const resume = runContextCommand([...prefix, "resume", "--task", "task-b"], "ph", input)
    const end = runContextCommand([...prefix, "end", "--task", "task-b"], "ph", input)

    expect(resume).toMatchObject({ status: 1, stderr: "context-scope-existing-binding\n" })
    expect(end).toMatchObject({ status: 1, stderr: "context-scope-key-mismatch\n" })
    expect(readFileSync(input.record)).toEqual(before)
  })

  it.each(["{", '{"schemaVersion":"persona-context-task-binding.1","bindingDigest":"wrong","taskKey":"task-a"}'])
    ("blocks corrupt task state without falling back to other scoped rules: %s", (text) => {
      const input = fixture()
      writeFileSync(input.record, text)

      const result = runPortableContextHook(input.hookInput, input.projectDir, { ...input, host: "codex" })

      expect(result).toEqual({ status: "blocked", reason: "context-read-unavailable" })
      expect(runContextCommand([...prefix, "preview", "src/App.java", "--json"], "ph", input).status).toBe(1)
      expect(readFileSync(input.record, "utf8")).toBe(text)
    })

  it("honors explicit opt-out before reading corrupt task state", () => {
    const input = fixture()
    writeFileSync(input.record, "{")
    writeHarnessConfig(input.projectDir, { context: { enabled: false } })

    const result = runPortableContextHook(input.hookInput, input.projectDir, { ...input, host: "codex" })

    expect(result).toEqual({ status: "skipped", reason: "context-disabled" })
  })

  it("refuses a symlinked task record without changing the target", () => {
    const input = fixture()
    const target = join(input.personalization.storeRoot, "profile.json")
    const before = readFileSync(target)
    unlinkSync(input.record)
    symlinkSync(target, input.record)

    const result = runContextCommand([...prefix, "end", "--task", "task-a"], "ph", input)

    expect(result).toMatchObject({ status: 1, stderr: "context-scope-unavailable\n" })
    expect(readFileSync(target)).toEqual(before)
  })

  it.each([
    ["task"], ["task", "--session", "../session"], [...prefix, "resume", "--task", "../other"],
    [...prefix, "preview", "src/App.java", "--task", "task-b"], [...prefix, "resume", "--task", "task-a", "extra"],
  ].map((args) => ({ args })))("rejects malformed or conflicting selectors without changing the connection: $args", ({ args }) => {
    const input = fixture()
    const before = readFileSync(input.record)

    const result = runContextCommand(args, "ph", input)

    expect(result).toMatchObject({ status: 1, stderr: "context-task-arguments-invalid\n" })
    expect(readFileSync(input.record)).toEqual(before)
  })
})
