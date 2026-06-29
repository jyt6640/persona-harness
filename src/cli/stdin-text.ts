import { TextDecoder } from "node:util"

type DecodeCandidate = {
  readonly label: string
  readonly text: string
}

const WINDOWS_KOREAN_ENCODINGS = ["windows-949", "euc-kr", "ks_c_5601-1987"] as const
const POWERSHELL_UTF8_AS_ANSI_MARKERS = /[媛留][\u0080-\u009f\uFFFD?꾨뚮]|[꾨떒뚮뱾ㅻ]{2,}/u
const REPLACEMENT_QUESTION_MARK_RUN = /\?{2,}/gu

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

export function stdinEncodingError(text: string): string | undefined {
  if (!looksLikePowerShellUtf8FileReadAsAnsi(text) && !looksLikeLossyQuestionMarkReplacement(text)) {
    return undefined
  }
  return [
    "Workflow stdin looks like mojibake from Windows PowerShell reading a UTF-8 file as ANSI.",
    "The original Korean text may already be lossy, so Persona Harness refused to save it.",
    "",
    "Re-run with explicit UTF-8 file input:",
    "- `Get-Content -LiteralPath <path> -Raw -Encoding UTF8 | npx ph workflow draft --stdin`",
    "- `Get-Content -LiteralPath <path> -Raw -Encoding UTF8 | npx ph workflow capture --stdin`",
  ].join("\n")
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

function looksLikePowerShellUtf8FileReadAsAnsi(text: string): boolean {
  return POWERSHELL_UTF8_AS_ANSI_MARKERS.test(text)
}

function looksLikeLossyQuestionMarkReplacement(text: string): boolean {
  const matches = [...text.matchAll(REPLACEMENT_QUESTION_MARK_RUN)]
  const replacementQuestionMarks = matches.reduce((count, match) => count + match[0].length, 0)
  return matches.length >= 2 && replacementQuestionMarks >= 6 && replacementQuestionMarks / text.length >= 0.25
}
