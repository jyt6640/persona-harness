import { describe, expect, it } from "vitest"

import { stripJsonComments } from "../src/config/jsonc.js"

describe("JSONC helpers", () => {
  it("strips line and block comments while preserving comment markers inside strings", () => {
    const input = [
      "{",
      "  // leading comment",
      "  \"url\": \"https://example.test/path//still-string\",",
      "  \"glob\": \"src/**/*.java\", /* block comment */",
      "  \"note\": \"not /* a comment */\",",
      "  \"escaped\": \"quote: \\\" // still string\"",
      "}",
    ].join("\n")

    expect(JSON.parse(stripJsonComments(input))).toStrictEqual({
      escaped: "quote: \" // still string",
      glob: "src/**/*.java",
      note: "not /* a comment */",
      url: "https://example.test/path//still-string",
    })
  })
})
