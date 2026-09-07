import { mkdirSync, realpathSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import { runPortableContextHook } from "../src/context-delivery/portable-context-hook.js"
import { cleanupProjects, createProject, writeHarnessConfig } from "./helpers/rule-fixtures.js"

afterEach(cleanupProjects)

function fixture(enabled = true) {
  const projectDir = realpathSync(createProject())
  writeHarnessConfig(projectDir, { context: { enabled, maxChars: 4_000 } })
  return {
    projectDir,
    options: { personalization: { storeRoot: join(projectDir, "personalization") } },
    input: { session_id: "fixture-session", hook_event_name: "PreToolUse", cwd: projectDir, tool_name: "Read", tool_input: { file_path: "src/TransferService.java" } },
  }
}

describe("portable Context hook contract", () => {
  it.each([
    { tool_name: "Read", tool_input: { file_path: "src/TransferService.java" } },
    { tool_name: "Edit", tool_input: { file_path: "src/TransferService.java", old_string: "old", new_string: "new" } },
    { tool_name: "apply_patch", tool_input: { command: "*** Begin Patch\n*** Add File: src/TransferService.java\n+class TransferService {}\n*** End Patch" } },
  ])("offers bounded Context through the documented tool input $tool_name", (tool) => {
    const { input, projectDir, options } = fixture()
    const result = runPortableContextHook({ ...input, ...tool }, projectDir, options)
    if (result.status !== "offered") throw new Error("fixture not offered")
    expect(result.output).toEqual({ hookSpecificOutput: { hookEventName: "PreToolUse", additionalContext: result.selection.block } })
    expect(result.selection.usedChars).toBe(result.output.hookSpecificOutput.additionalContext.length)
    expect(result.selection.usedChars).toBeLessThanOrEqual(result.selection.maxChars)
    expect(result.selection.warningCodes).toContain("personal-profile-missing")
    expect(result).not.toHaveProperty("delivered")
  })

  it("honors explicit disable without rewriting any configuration", () => {
    const { input, projectDir, options } = fixture(false)
    expect(runPortableContextHook(input, projectDir, options)).toEqual({ status: "skipped", reason: "context-disabled" })
  })

  it("does not inspect a corrupt personal store when Context is explicitly disabled", () => {
    const { input, projectDir, options } = fixture(false)
    mkdirSync(options.personalization.storeRoot)
    writeFileSync(join(options.personalization.storeRoot, "profile.json"), "corrupt private profile")
    expect(runPortableContextHook(input, projectDir, options)).toEqual({ status: "skipped", reason: "context-disabled" })
  })

  it("does not accept repository or tool data as a different host working directory", () => {
    const { input, projectDir, options } = fixture()
    expect(runPortableContextHook({ ...input, cwd: "/outside" }, projectDir, options)).toEqual({ status: "blocked", reason: "hook-project-invalid" })
  })

  it("refreshes after resume, profile changes and repeated calls without an unobservable delivery cache", () => {
    const { input, projectDir, options } = fixture()
    expect(runPortableContextHook(input, projectDir, options).status).toBe("offered")
    expect(runPortableContextHook(input, projectDir, options).status).toBe("offered")
    writeFileSync(join(projectDir, ".persona", "team-profile.json"), "invalid json")
    expect(runPortableContextHook(input, projectDir, options)).toEqual({ status: "blocked", reason: "preview-unavailable" })
  })

  it("does not read transcripts or act on unsupported event and tool fields", () => {
    const { input, projectDir, options } = fixture()
    expect(runPortableContextHook({ ...input, tool_name: "Bash", transcript_path: "/private/secret", tool_input: { command: "rm -rf /" } }, projectDir, options))
      .toEqual({ status: "skipped", reason: "tool-unsupported" })
    expect(runPortableContextHook({ ...input, hook_event_name: "PermissionRequest" }, projectDir, options))
      .toEqual({ status: "skipped", reason: "event-unsupported" })
    expect(runPortableContextHook(null, projectDir, options)).toEqual({ status: "blocked", reason: "hook-input-invalid" })
  })
})
