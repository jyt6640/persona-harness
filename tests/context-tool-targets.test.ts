import { describe, expect, it } from "vitest"
import { extractContextTargets, MAX_CONTEXT_TARGETS } from "../src/context-delivery/context-tool-targets.js"

describe("host Context tool targets", () => {
  it("accepts Codex's documented hook command field without parsing shell commands", () => {
    const command = "*** Begin Patch\n*** Add File: src/TransferService.java\n+class TransferService {}\n*** End Patch"
    expect(extractContextTargets("apply_patch", { command })).toEqual({ kind: "targets", paths: ["src/TransferService.java"] })
    expect(extractContextTargets("Bash", { command })).toEqual({ kind: "unsupported" })
  })

  it("collects every apply_patch target, including a move destination", () => {
    expect(extractContextTargets("functions.apply_patch", [
      "*** Begin Patch", "*** Update File: src/Old.java", "*** Move to: src/New.java",
      "@@", "-old", "+new", "*** Add File: test/New.test.ts", "+test", "*** Delete File: docs/old.md", "*** End Patch",
    ].join("\n"))).toEqual({ kind: "targets", paths: ["docs/old.md", "src/New.java", "src/Old.java", "test/New.test.ts"] })
  })

  it("deduplicates multi-edit paths without preferring Java over another language", () => {
    expect(extractContextTargets("MultiEdit", { edits: [{ file_path: "src/a.ts" }, { file_path: "src/b.java" }, { file_path: "src/a.ts" }] }))
      .toEqual({ kind: "targets", paths: ["src/a.ts", "src/b.java"] })
  })

  it("collects both sides of unified diffs and excludes the null device", () => {
    expect(extractContextTargets("patch", { patch: "--- a/src/old.ts\n+++ b/src/new.ts\n--- /dev/null\n+++ b/src/extra.ts" }))
      .toEqual({ kind: "targets", paths: ["src/extra.ts", "src/new.ts", "src/old.ts"] })
  })

  it.each(["Bash", "write_stdin", "read_thread", "WebSearch"])("does not infer targets for %s", (tool) => {
    expect(extractContextTargets(tool, { path: "src/a.ts" })).toEqual({ kind: "unsupported" })
  })

  it.each([null, {}, { file_path: 42 }, { edits: [null] }, { input: "x".repeat(262_145) }])("rejects malformed input", (input) => {
    expect(extractContextTargets("apply_patch", input)).toEqual({ kind: "blocked", reason: "tool-input-invalid" })
  })

  it("rejects oversized target sets rather than silently selecting a prefix", () => {
    expect(extractContextTargets("MultiEdit", { edits: Array.from({ length: MAX_CONTEXT_TARGETS + 1 }, (_, i) => ({ path: `src/${i}.ts` })) }))
      .toEqual({ kind: "blocked", reason: "target-limit" })
  })
})
