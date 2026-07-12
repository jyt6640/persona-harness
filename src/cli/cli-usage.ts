import type { HumanOutputLocale } from "../config/project-profile.js"

function englishUsage(invocationName: string): string {
  return [
    `Usage: ${invocationName} <command> [args...]`,
    "",
    "Public commands:",
    "  version                      Print the packaged Persona Harness version.",
    "  init                         Install Persona Harness config and OpenCode plugin config.",
    "  attach [--yes]               Prepare an existing Java/Spring/Gradle project for the workflow.",
    "  go <goal> | --stdin           Host-neutral single entry from a concrete goal to the current ticket and implementation rail.",
    "  doctor                       Diagnose local OpenCode and Persona Harness installation state.",
    "",
    "Examples:",
    `  ${invocationName} version`,
    `  ${invocationName} --version`,
    `  ${invocationName} init`,
    `  ${invocationName} attach --yes`,
    `  ${invocationName} go "Add a task creation endpoint."`,
    `  printf "Add task creation." | ${invocationName} go --stdin`,
    `  ${invocationName} doctor`,
    "",
    "Language output:",
    `  ${invocationName} help and ${invocationName} language use Korean only when a supported non-default \`.persona/project-profile.jsonc\` has \`user-language\` answer \`ko\`.`,
    "  Generated `ph intake --default backend` profiles and all other, missing, unreadable, or invalid profile values use English.",
  ].join("\n")
}

function koreanUsage(invocationName: string): string {
  return [
    `사용법: ${invocationName} <command> [args...]`,
    "",
    "공개 명령:",
    "  version                      설치된 Persona Harness 버전을 출력합니다.",
    "  init                         Persona Harness 설정과 OpenCode 플러그인 설정을 설치합니다.",
    "  attach [--yes]               기존 Java/Spring/Gradle 프로젝트를 workflow에 맞게 준비합니다.",
    "  go <goal> | --stdin           구체적인 목표를 현재 ticket과 implementation rail로 연결하는 host-neutral 단일 진입점입니다.",
    "  doctor                       로컬 OpenCode 및 Persona Harness 설치 상태를 진단합니다.",
    "",
    "예시:",
    `  ${invocationName} version`,
    `  ${invocationName} --version`,
    `  ${invocationName} init`,
    `  ${invocationName} attach --yes`,
    `  ${invocationName} go "Add a task creation endpoint."`,
    `  printf "Add task creation." | ${invocationName} go --stdin`,
    `  ${invocationName} doctor`,
    "",
    "언어 표시:",
    `  지원되는 기본값 이외의 \`.persona/project-profile.jsonc\`에서 \`user-language\` 답변이 정확히 \`ko\`일 때만 ${invocationName} help와 ${invocationName} language가 한국어로 표시됩니다.`,
    "생성된 `ph intake --default backend` profile과 그 외 값, 누락된 profile, 읽을 수 없는 profile, 잘못된 profile은 영어로 표시됩니다.",
  ].join("\n")
}

export function personaCliUsage(invocationName: string, locale: HumanOutputLocale = "en"): string {
  return locale === "ko" ? koreanUsage(invocationName) : englishUsage(invocationName)
}
