import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

const repositoryRoot = process.cwd()

function readRepositoryFile(path: string) {
  return readFileSync(join(repositoryRoot, path), "utf8")
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim()
}

describe("security reporting policy", () => {
  it("points public reporters to the enabled private GitHub route without soliciting sensitive details", () => {
    const securityPolicy = normalizeWhitespace(readRepositoryFile("SECURITY.md"))
    const bugReport = normalizeWhitespace(readRepositoryFile(".github/ISSUE_TEMPLATE/bug_report.yml"))
    const issueTemplateConfig = readRepositoryFile(".github/ISSUE_TEMPLATE/config.yml")

    expect(securityPolicy).toContain("https://github.com/jyt6640/persona-harness/security/advisories/new")
    expect(securityPolicy).toContain("Do not include credentials, tokens, private keys, exploit details, or private code in a public issue or email.")
    expect(securityPolicy).toContain("jyt6640@naver.com")
    expect(securityPolicy).toContain("request a private reporting channel")
    expect(securityPolicy).not.toContain("address on the npm package page")

    expect(bugReport).toContain("Do not use this form to report a vulnerability")
    expect(bugReport).toContain("Do not include credentials, tokens, private keys, exploit details, or private code.")

    expect(issueTemplateConfig).toContain("Report a security vulnerability")
    expect(issueTemplateConfig).toContain("https://github.com/jyt6640/persona-harness/security/advisories/new")
  })

  it("discloses the owner-verified GitHub security controls without treating disabled controls as promises", () => {
    const securityPolicy = normalizeWhitespace(readRepositoryFile("SECURITY.md"))

    expect(securityPolicy).toContain("Last owner settings read: 2026-08-22.")
    expect(securityPolicy).toContain("Private vulnerability reporting is enabled.")
    expect(securityPolicy).toContain("GitHub secret scanning, push protection, Dependabot alerts, and Dependabot security updates are disabled.")
    expect(securityPolicy).toContain("No statement in this repository should treat those disabled controls as a protection promise.")
  })
})
