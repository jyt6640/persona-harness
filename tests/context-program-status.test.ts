import { readFileSync } from "node:fs"
import { resolve } from "node:path"

import { describe, expect, it } from "vitest"

describe("Context program status", () => {
  it("distinguishes released compatibility work, local contributors, live host delivery, and independent value evidence", () => {
    const status = readFileSync(resolve(process.cwd(), "docs/current/context-program-status.md"), "utf8")
    const m12 = matrixRow(status, "M12")
    const m13 = matrixRow(status, "M13")
    const m14 = matrixRow(status, "M14")

    expect(m12).toContain("#431")
    expect(m12).toContain("local candidate")

    expect(m13).toContain("#412")
    expect(m13).toContain("#430")
    expect(m13).toContain("#435")
    expect(m13).toContain("local candidate")

    expect(m14).toContain("#433")
    expect(m14).toContain("local candidate")
    expect(m14).toContain("INCONCLUSIVE")

    expect(status).toContain("#410")
    expect(status).toContain("named Delivery Control start predicate")
    expect(status).toContain("#429")
    expect(status).toContain("external-validation")
    expect(status).toContain("#436")
    expect(status).toContain("--current-checkout")
    expect(status).toContain("clean-package-observer-gh-required")
    expect(status).toContain("local candidate")
  })
})

function matrixRow(document: string, item: string): string {
  return document.split("\n").find((line) => line.startsWith(`| ${item} |`)) ?? ""
}
