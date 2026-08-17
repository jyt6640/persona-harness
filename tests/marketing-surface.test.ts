import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

type PackageMetadata = {
  readonly description: string
  readonly keywords: readonly string[]
}

const repositoryRoot = process.cwd()
const discoveryKeywords = [
  "ai-coding",
  "agentic-workflows",
  "coding-agents",
  "evidence",
  "opencode",
  "spring-boot",
] as const

describe("marketing discovery surface", () => {
  it("exposes the supported audience through npm search metadata", () => {
    const packageMetadata = parsePackageMetadata(
      JSON.parse(readFileSync(join(repositoryRoot, "package.json"), "utf8")),
    )

    expect(packageMetadata.description).toContain("AI coding")
    expect(packageMetadata.description).toContain("OpenCode")
    expect(packageMetadata.keywords).toEqual(expect.arrayContaining([...discoveryKeywords]))
  })

  it("ships a GitHub-sized social preview and structured early-adopter feedback", () => {
    const socialPreview = join(repositoryRoot, "img", "persona-harness-social-preview.png")
    const feedbackForm = join(repositoryRoot, ".github", "ISSUE_TEMPLATE", "early-adopter-feedback.yml")

    expect(existsSync(socialPreview)).toBe(true)
    expect(readPngDimensions(socialPreview)).toEqual({ height: 640, width: 1280 })
    expect(existsSync(feedbackForm)).toBe(true)

    const form = readFileSync(feedbackForm, "utf8")
    expect(form).toContain("id: install_result")
    expect(form).toContain("id: first_workflow_result")
    expect(form).toContain("id: blocker")
  })
})

function readPngDimensions(path: string): { readonly height: number; readonly width: number } {
  const bytes = readFileSync(path)

  expect(bytes.subarray(1, 4).toString("ascii")).toBe("PNG")
  return {
    height: bytes.readUInt32BE(20),
    width: bytes.readUInt32BE(16),
  }
}

function parsePackageMetadata(value: unknown): PackageMetadata {
  if (
    typeof value !== "object"
    || value === null
    || Array.isArray(value)
    || !("description" in value)
    || typeof value.description !== "string"
    || !("keywords" in value)
    || !Array.isArray(value.keywords)
    || !value.keywords.every((keyword) => typeof keyword === "string")
  ) {
    throw new TypeError("package-metadata")
  }

  return { description: value.description, keywords: value.keywords }
}
