import process from "node:process"

import { readHumanOutputLocale, type HumanOutputLocale } from "../config/project-profile.js"
import type { CliRunResult } from "./bearshell.js"

type ParsedLanguageArgs = { readonly kind: "run" } | { readonly kind: "help" } | { readonly kind: "invalid"; readonly message: string }

const SUPPORTED_LANGUAGES = [
  { code: "ko", label: "한국어", englishNote: "Korean help output", koreanNote: "한국어 도움말 출력" },
  { code: "en", label: "English", englishNote: "English help output", koreanNote: "영어 도움말 출력" },
  { code: "ja", label: "日本語", englishNote: "Japanese choice; English help currently", koreanNote: "일본어 선택값; 현재 도움말은 영어" },
  {
    code: "zh-cn",
    label: "简体中文",
    englishNote: "Simplified Chinese choice; English help currently",
    koreanNote: "중국어 간체 선택값; 현재 도움말은 영어",
  },
] as const

function englishLanguageUsage(invocation: string): string {
  return [
    `Usage: ${invocation} language`,
    "",
    "Shows supported user languages for intake, planning, and agent-facing workflow prompts.",
    "",
    "This command does not change files. Select the language in `ph intake --interactive` or edit `.persona/project-profile.jsonc` question `user-language`.",
    "",
    "Locale selection contract:",
    `- ${invocation} help and ${invocation} language render in Korean only when a supported non-default \`.persona/project-profile.jsonc\` has \`questions[].id == "user-language"\` with answer \`ko\`.`,
    "- Generated `ph intake --default backend` profiles and all other values, including en, ja, zh-cn, missing, unreadable, malformed, and unsupported profiles, render in English.",
  ].join("\n")
}

function koreanLanguageUsage(invocation: string): string {
  return [
    `사용법: ${invocation} language`,
    "",
    "intake, planning, agent-facing workflow prompts에서 지원되는 사용자 언어를 보여줍니다.",
    "",
    "이 명령은 파일을 변경하지 않습니다. `ph intake --interactive` 또는 `.persona/project-profile.jsonc`의 `user-language` 질문에서 언어를 선택합니다.",
    "",
    "로케일 선택 규칙:",
    `- 지원되는 기본값 이외의 \`.persona/project-profile.jsonc\`에서 \`questions[].id == "user-language"\` 답변이 정확히 \`ko\`이면 ${invocation} help와 ${invocation} language가 한국어로 표시됩니다.`,
    "- 생성된 `ph intake --default backend` profile과 en, ja, zh-cn, 누락, 읽을 수 없음, 잘못된 형식, 지원되지 않는 profile, 알 수 없는 값은 영어로 표시됩니다.",
  ].join("\n")
}

export function languageUsage(invocation = "ph", locale: HumanOutputLocale = "en"): string {
  return locale === "ko" ? koreanLanguageUsage(invocation) : englishLanguageUsage(invocation)
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

function englishLanguageOutput(invocationName: string): string {
  return [
    "Persona Harness supported languages",
    "",
    ...SUPPORTED_LANGUAGES.map((language) => `- ${language.code}: ${language.label} (${language.englishNote})`),
    "",
    "Profile question id: user-language",
    "",
    "Locale selection contract:",
    `- ${invocationName} help and ${invocationName} language render in Korean only when a supported non-default \`.persona/project-profile.jsonc\` has \`questions[].id == "user-language"\` with answer \`ko\`.`,
    "- Generated `ph intake --default backend` profiles and all other values, including en, ja, zh-cn, missing, unreadable, malformed, and unsupported profiles, render in English.",
    "",
    "Next:",
    `- Run ${invocationName} intake --interactive and answer the language question.`,
    "- Or edit `.persona/project-profile.jsonc` and set `questions[].id == \"user-language\"`.",
  ].join("\n") + "\n"
}

function koreanLanguageOutput(invocationName: string): string {
  return [
    "Persona Harness 지원 언어",
    "",
    ...SUPPORTED_LANGUAGES.map((language) => `- ${language.code}: ${language.label} (${language.koreanNote})`),
    "",
    "프로필 질문 ID: user-language",
    "",
    "로케일 선택 규칙:",
    `- 지원되는 기본값 이외의 \`.persona/project-profile.jsonc\`에서 \`questions[].id == "user-language"\` 답변이 정확히 \`ko\`이면 ${invocationName} help와 ${invocationName} language가 한국어로 표시됩니다.`,
    "- 생성된 `ph intake --default backend` profile과 en, ja, zh-cn, 누락, 읽을 수 없음, 잘못된 형식, 지원되지 않는 profile, 알 수 없는 값은 영어로 표시됩니다.",
    "",
    "다음:",
    `- ${invocationName} intake --interactive를 실행하고 언어 질문에 답하세요.`,
    "- 또는 `.persona/project-profile.jsonc`에서 `questions[].id == \"user-language\"` 값을 수정하세요.",
  ].join("\n") + "\n"
}

function languageOutput(invocationName: string, locale: HumanOutputLocale): string {
  return locale === "ko" ? koreanLanguageOutput(invocationName) : englishLanguageOutput(invocationName)
}

export function runLanguageCommand(
  args: readonly string[],
  invocationName = "ph",
  projectDir = process.cwd(),
): CliRunResult {
  const locale = readHumanOutputLocale(projectDir)
  const parsed = parseLanguageArgs(args)
  if (parsed.kind === "help") {
    return { status: 0, stdout: `${languageUsage(invocationName, locale)}\n`, stderr: "" }
  }
  if (parsed.kind === "invalid") {
    return { status: 1, stdout: "", stderr: `${parsed.message}\n\n${languageUsage(invocationName, locale)}\n` }
  }
  return { status: 0, stdout: languageOutput(invocationName, locale), stderr: "" }
}
