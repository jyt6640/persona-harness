import { readFileSync } from "node:fs"
import { join } from "node:path"
import process from "node:process"

import { describe, expect, it } from "vitest"

import { passedFinishOutput } from "../src/cli/workflow-output.js"

const HISTORY = readFileSync(join(process.cwd(), "src", "cli", "history.ts"), "utf8")

/**
 * `workflow finish` points at `ph history` as the way to archive a completed
 * workflow, and "archived" reads as "that cycle is closed, start another".
 *
 * It is not: the finish attestation record is terminal per workspace, which is
 * what makes a replay refusable. Someone who archived and then could not finish
 * again had nothing telling them the two are separate — measured in #225.
 *
 * Wording only. `ph history` archives exactly what it archived before.
 */
describe("history does not read as releasing finish authority", () => {
  it("says what it archives and what it leaves alone", () => {
    expect(HISTORY).toContain("This archives workflow reports only.")
    expect(HISTORY).toContain("is not released here")
  })

  it("does not claim to clear the terminal record", () => {
    // The record lives under the evidence root, and nothing in this command
    // touches it. The text must not imply otherwise.
    expect(HISTORY).not.toContain("consumption.json")
  })

  it("carries the same caveat where finish recommends it", () => {
    // The recommendation is where a reader meets `ph history` first, so it is
    // the place the misreading starts.
    const rail = passedFinishOutput("implement", "cooperative").stdout

    expect(rail).toContain("npx ph history --id <run-id>")
    expect(rail).toContain("a consumed finish attestation stays consumed")
  })
})
