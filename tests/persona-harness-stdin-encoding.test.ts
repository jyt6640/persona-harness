import { describe, expect, it } from "vitest"

import { decodeCliStdinText } from "../src/cli/stdin-text.js"

describe("CLI stdin encoding", () => {
  const koreanIdea = "TODO 웹 서비스 만들래"

  it("preserves UTF-8 Korean stdin text", () => {
    expect(decodeCliStdinText(Buffer.from(koreanIdea, "utf8"))).toBe(koreanIdea)
  })

  it("recovers Korean stdin text from Windows Korean codepage bytes", () => {
    const cp949Bytes = Buffer.from([
      0x54, 0x4f, 0x44, 0x4f, 0x20, 0xc0, 0xa5, 0x20, 0xbc, 0xad, 0xba, 0xf1, 0xbd, 0xba, 0x20, 0xb8, 0xb8, 0xb5, 0xe9,
      0xb7, 0xa1,
    ])

    expect(decodeCliStdinText(cp949Bytes)).toBe(koreanIdea)
  })
})
