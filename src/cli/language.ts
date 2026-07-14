import type { CliRunResult } from "./bearshell.js"

type ParsedLanguageArgs = { readonly kind: "run" } | { readonly kind: "help" } | { readonly kind: "invalid"; readonly message: string }

const SUPPORTED_LANGUAGES = [
  { code: "ko", label: "한국어", note: "현재 기본 추천값" },
  { code: "en", label: "English", note: "English output" },
  { code: "ja", label: "日本語", note: "Japanese output" },
  { code: "zh-cn", label: "简体中文", note: "Simplified Chinese output" },
] as const

export function languageUsage(invocation = "ph"): string {
  return [
    `Usage: ${invocation} language`,
    "",
    "Shows supported user languages for intake, planning, and agent-facing workflow prompts.",
    "",
    "This command does not change files. Select the language in `ph intake --interactive` or edit `.persona/project-profile.jsonc` question `user-language`.",
    "For CLI help, select Korean explicitly with `ph --help --lang ko`.",
  ].join("\n")
}

function parseLanguageArgs(args: readonly string[]): ParsedLanguageArgs {
  if (args.length === 0) {
    return { kind: "run" }
  }
  if (args.length === 1 && (args[0] === "--help" || args[0] === "-h")) {
    return { kind: "help" }
  }
  return { kind: "invalid", message: `Unknown option: ${args[0] ?? ""}` }
}

function languageOutput(invocationName: string): string {
  return [
    "Persona Harness supported languages",
    "",
    ...SUPPORTED_LANGUAGES.map((language) => `- ${language.code}: ${language.label} (${language.note})`),
    "",
    "Profile question id: user-language",
    "",
    "Next:",
    `- Run ${invocationName} intake --interactive and answer the language question.`,
    "- Or edit `.persona/project-profile.jsonc` and set `questions[].id == \"user-language\"`.",
  ].join("\n") + "\n"
}

export function runLanguageCommand(args: readonly string[], invocationName = "ph"): CliRunResult {
  const parsed = parseLanguageArgs(args)
  if (parsed.kind === "help") {
    return { status: 0, stdout: `${languageUsage(invocationName)}\n`, stderr: "" }
  }
  if (parsed.kind === "invalid") {
    return { status: 1, stdout: "", stderr: `${parsed.message}\n\n${languageUsage(invocationName)}\n` }
  }
  return { status: 0, stdout: languageOutput(invocationName), stderr: "" }
}
