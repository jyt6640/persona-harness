import { TextDecoder } from "node:util"

type DecodeCandidate = {
  readonly label: string
  readonly text: string
}

const WINDOWS_KOREAN_ENCODINGS = ["windows-949", "euc-kr", "ks_c_5601-1987"] as const

export function decodeCliStdinText(input: Buffer): string {
  const utf8 = decodeText("utf-8", input)
  if (utf8 === undefined) {
    return input.toString("utf8")
  }
  if (!hasReplacementCharacter(utf8)) {
    return utf8
  }

  const candidates = WINDOWS_KOREAN_ENCODINGS.flatMap((label) => {
    const text = decodeText(label, input)
    return text === undefined ? [] : [{ label, text }]
  })
  const best = candidates.reduce<DecodeCandidate | undefined>((current, candidate) => {
    if (current === undefined) {
      return candidate
    }
    return scoreCandidate(candidate.text) > scoreCandidate(current.text) ? candidate : current
  }, undefined)

  if (best !== undefined && scoreCandidate(best.text) > scoreCandidate(utf8)) {
    return best.text
  }
  return utf8
}

function decodeText(label: string, input: Buffer): string | undefined {
  try {
    return new TextDecoder(label).decode(input)
  } catch {
    return undefined
  }
}

function scoreCandidate(text: string): number {
  return hangulCharacterCount(text) * 4 - replacementCharacterCount(text) * 20
}

function hasReplacementCharacter(text: string): boolean {
  return text.includes("\uFFFD")
}

function replacementCharacterCount(text: string): number {
  return [...text].filter((character) => character === "\uFFFD").length
}

function hangulCharacterCount(text: string): number {
  return [...text].filter((character) => character >= "\uAC00" && character <= "\uD7A3").length
}
