import { existsSync, readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import { runContextCommand } from "../src/cli/context-command.js"
import { runPortableContextHook } from "../src/context-delivery/portable-context-hook.js"
import { canonicalContextDigest } from "../src/context-core/context-digest.js"
import { approveTaskRule, checkoutScopeFixture } from "./helpers/context-scope-fixtures.js"
import { cleanupProjects } from "./helpers/rule-fixtures.js"

afterEach(cleanupProjects)

const session = canonicalContextDigest({ host: "codex", sessionId: "task-session-a" })
const prefix = ["task", "--session", session]

function fixture() {
  const input = checkoutScopeFixture()
  approveTaskRule(input)
  return input
}

function hook(input: ReturnType<typeof fixture>, sessionId = "task-session-a") {
  return runPortableContextHook({
    session_id: sessionId, hook_event_name: "PreToolUse", cwd: input.projectDir,
    tool_name: "Read", tool_input: { file_path: "src/App.java" },
  }, input.projectDir, { ...input, host: "codex" })
}

describe("explicit session-local task resume", () => {
  it("does not create task state during inspection", () => {
    const input = checkoutScopeFixture()

    const result = runContextCommand(prefix, "ph", input)

    expect(result).toEqual({ status: 0, stdout: '{"status":"unbound"}\n', stderr: "" })
    expect(existsSync(input.personalization.storeRoot)).toBe(false)
  })

  it("uses a resumed task in read-only Preview and supported hooks without modifying the profile", () => {
    const input = fixture()
    const profile = readFileSync(join(input.personalization.storeRoot, "profile.json"))

    const result = runContextCommand([...prefix, "resume", "--task", "task-a"], "ph", input)

    expect(result).toMatchObject({ status: 0, stdout: '{"status":"bound","taskKey":"task-a"}\n' })
    const preview = runContextCommand([...prefix, "preview", "src/App.java", "--json", "--topic", "naming"], "ph", input)
    expect(preview.status).toBe(0)
    expect(JSON.parse(preview.stdout)).toMatchObject({ envelope: { selected: [{ layer: "task", id: "rule-approved-task-a" }] } })
    expect(hook(input)).toMatchObject({ status: "offered", selection: { ruleIds: expect.arrayContaining(["rule-approved-task-a"]) } })
    expect(readFileSync(join(input.personalization.storeRoot, "profile.json"))).toEqual(profile)
  })

  it("does not inherit the last task in a new session or another checkout", () => {
    const input = fixture()
    expect(runContextCommand([...prefix, "resume", "--task", "task-a"], "ph", input).status).toBe(0)
    const other = { ...checkoutScopeFixture(), personalization: input.personalization }

    const results = [hook(input, "task-session-b"), hook(other)]

    for (const result of results) {
      expect(result).toMatchObject({ status: "offered", selection: { warningCodes: expect.arrayContaining(["task-scope-unbound"]) } })
      if (result.status !== "offered") throw new Error("expected scope diagnostics")
      expect(result.selection.ruleIds).not.toContain("rule-approved-task-a")
    }
  })

  it("ends only the matching task connection without deleting the approved decision", () => {
    const input = fixture()
    expect(runContextCommand([...prefix, "resume", "--task", "task-a"], "ph", input).status).toBe(0)

    const result = runContextCommand([...prefix, "end", "--task", "task-a"], "ph", input)

    expect(result).toEqual({ status: 0, stdout: '{"status":"unbound"}\n', stderr: "" })
    expect(hook(input)).toMatchObject({ status: "offered", selection: { warningCodes: expect.arrayContaining(["task-scope-unbound"]) } })
    expect(JSON.parse(readFileSync(join(input.personalization.storeRoot, "profile.json"), "utf8")).profile.activeRules).toHaveLength(1)
    expect(readdirSync(join(input.personalization.storeRoot, "task-bindings"))).toEqual([])
  })

  it("rejects task selection when no matching active task rule exists", () => {
    const input = checkoutScopeFixture()

    const result = runContextCommand([...prefix, "resume", "--task", "task-a"], "ph", input)

    expect(result).toMatchObject({ status: 1, stderr: "context-task-rule-missing\n" })
    expect(existsSync(input.personalization.storeRoot)).toBe(false)
  })
})
