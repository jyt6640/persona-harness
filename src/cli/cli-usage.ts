import type { CliHelpLocale } from "./help-locale.js"

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
    "  authority                    Inspect or enroll bounded external consumer authority.",
    "",
    "Examples:",
    `  ${invocationName} version`,
    `  ${invocationName} --version`,
    `  ${invocationName} init`,
    `  ${invocationName} attach --yes`,
    `  ${invocationName} go "Add a task creation endpoint."`,
    `  printf "Add task creation." | ${invocationName} go --stdin`,
    `  ${invocationName} doctor`,
    `  ${invocationName} authority status`,
  ].join("\n")
}

function koreanUsage(invocationName: string): string {
  return [
    `사용법: ${invocationName} <명령> [인자...]`,
    "",
    "공개 명령:",
    "  version                      패키지된 Persona Harness 버전을 출력합니다.",
    "  init                         Persona Harness 설정과 OpenCode 플러그인 설정을 설치합니다.",
    "  attach [--yes]               기존 Java/Spring/Gradle 프로젝트를 workflow에 연결합니다.",
    "  go <goal> | --stdin           구체적인 목표를 현재 ticket과 구현 rail로 연결하는 단일 진입점입니다.",
    "  doctor                       로컬 OpenCode 및 Persona Harness 설치 상태를 진단합니다.",
    "  authority                    제한된 외부 consumer authority 상태를 확인하거나 등록합니다.",
    "",
    "도움말 언어 선택: --lang en 또는 --lang ko",
    "",
    "예시:",
    `  ${invocationName} version`,
    `  ${invocationName} --version`,
    `  ${invocationName} init`,
    `  ${invocationName} attach --yes`,
    `  ${invocationName} go "작업 생성 endpoint를 추가해줘."`,
    `  printf "작업 생성 endpoint를 추가해줘." | ${invocationName} go --stdin`,
    `  ${invocationName} doctor`,
    `  ${invocationName} authority status`,
  ].join("\n")
}

export function personaCliUsage(invocationName: string, locale: CliHelpLocale = "en"): string {
  return locale === "ko" ? koreanUsage(invocationName) : englishUsage(invocationName)
}
