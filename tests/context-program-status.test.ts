import { readFileSync } from "node:fs"
import { resolve } from "node:path"

import { describe, expect, it } from "vitest"

describe("Context program status", () => {
  it("distinguishes the released P0 boundary from the remaining live-host and product-value evidence", () => {
    const status = readFileSync(resolve(process.cwd(), "docs/current/context-program-status.md"), "utf8")
    const matrix = section(status, "## Historical P0 Problem Matrix", "## Invariants")
    const delivery = section(status, "## Current Delivery Order", "## Historical Candidate Evidence")
    const m12 = matrixRow(status, "M12")
    const m13 = matrixRow(status, "M13")
    const m14 = matrixRow(status, "M14")

    expect(m12).toContain("#431")
    expect(m12).toContain("#443")
    expect(m12).toContain("delivered")

    expect(m13).toContain("#412")
    expect(m13).toContain("#430")
    expect(m13).toContain("#435")
    expect(m13).toContain("#443")
    expect(m13).toContain("delivered")

    expect(m14).toContain("#433")
    expect(m14).toContain("#443")
    expect(m14).toContain("delivered")
    expect(m14).toContain("INCONCLUSIVE")

    expect(status).toContain("a82b85ddef7e9fd9518348bff16deb38f53b4676")
    expect(status).toContain("persona-harness@0.8.37")
    expect(status).toContain("persona-harness@0.8.38")
    expect(status).toContain("#442")
    expect(status).toContain("#443")
    expect(status).toContain("#446")
    expect(status).toContain("TECHNICAL_GO")
    expect(status).toContain("#410")
    expect(status).toContain("hosted-unavailable")
    expect(status).toContain("non-retryable")
    expect(status).toContain("export --sanitize")
    expect(status).toContain("#429")
    expect(status).toContain("external-validation")
    expect(status).toContain("#436")
    expect(status).toContain("--current-checkout")
    expect(status).toContain("clean-package-observer-gh-required")
    expect(matrix).not.toContain("local candidate")
    expect(delivery).not.toContain("Current local P0 candidates")
    expect(status).not.toContain("#410 still needs its own named Delivery Control start predicate")
  })
})

function matrixRow(document: string, item: string): string {
  return document.split("\n").find((line) => line.startsWith(`| ${item} |`)) ?? ""
}

function section(document: string, start: string, end: string): string {
  const startIndex = document.indexOf(start)
  const endIndex = document.indexOf(end, startIndex)

  return document.slice(startIndex, endIndex)
}
