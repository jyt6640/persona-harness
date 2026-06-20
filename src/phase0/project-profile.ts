import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"

const PROFILE_PATH = ".persona/project-profile.jsonc"
const SUPPORTED_SCHEMA = "persona.project-profile.v1"
const SUPPORTED_ROLE = "backend"
const SUPPORTED_MVP = "java-spring-clean-code"

const SUMMARY_ORDER = [
  "project-context",
  "project-scale",
  "storage",
  "persistence-technology",
  "migration-style",
  "package-style",
  "dto-strictness",
  "philosophy-overlay",
] as const

type ProfileQuestion = {
  readonly id: string
  readonly answer: string | null
}

function stripJsonComments(input: string): string {
  let output = ""
  let index = 0
  let inString = false
  let escaped = false

  while (index < input.length) {
    const current = input[index]
    const next = input[index + 1]

    if (inString) {
      output += current
      if (escaped) {
        escaped = false
      } else if (current === "\\") {
        escaped = true
      } else if (current === "\"") {
        inString = false
      }
      index += 1
      continue
    }

    if (current === "\"") {
      inString = true
      output += current
      index += 1
      continue
    }

    if (current === "/" && next === "/") {
      while (index < input.length && input[index] !== "\n") {
        index += 1
      }
      continue
    }

    if (current === "/" && next === "*") {
      index += 2
      while (index < input.length && !(input[index] === "*" && input[index + 1] === "/")) {
        index += 1
      }
      index += 2
      continue
    }

    output += current
    index += 1
  }

  return output
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function readQuestion(value: unknown): ProfileQuestion | undefined {
  if (!isRecord(value) || typeof value.id !== "string") {
    return undefined
  }
  if (typeof value.answer === "string" && value.answer.trim() !== "") {
    return { id: value.id, answer: value.answer.trim() }
  }
  if (value.answer === null) {
    return { id: value.id, answer: null }
  }
  return undefined
}

function readQuestions(value: unknown): readonly ProfileQuestion[] {
  if (!Array.isArray(value)) {
    return []
  }
  return value.flatMap((item) => {
    const question = readQuestion(item)
    return question === undefined ? [] : [question]
  })
}

function isSupportedBackendProfile(value: unknown): value is Record<string, unknown> {
  if (!isRecord(value) || value.schema !== SUPPORTED_SCHEMA || !isRecord(value.scope)) {
    return false
  }
  return value.scope.role === SUPPORTED_ROLE && value.scope.mvp === SUPPORTED_MVP
}

function answeredQuestionMap(questions: readonly ProfileQuestion[]): ReadonlyMap<string, string> {
  const answers = new Map<string, string>()
  for (const question of questions) {
    if (question.answer !== null) {
      answers.set(question.id, question.answer)
    }
  }
  return answers
}

function formatSummaryLines(answers: ReadonlyMap<string, string>): readonly string[] {
  const answerLines = SUMMARY_ORDER.flatMap((id) => {
    const answer = answers.get(id)
    return answer === undefined ? [] : [`- ${id}: ${answer}`]
  })

  return [
    "프로젝트 프로필 요약:",
    ...(answerLines.length > 0 ? answerLines : ["- 응답된 항목 없음"]),
    "",
    "프로필 사용 원칙:",
    "- 이 요약은 구현 전 architecture/technology plan 참고용이다.",
    "- 사용자의 README/요구사항과 명시 지시가 우선한다.",
    "- 이 요약은 rule enforcement나 product-quality 보증이 아니다.",
  ]
}

export function loadBackendProjectProfileSummary(projectDir: string): readonly string[] {
  const profilePath = join(projectDir, PROFILE_PATH)
  if (!existsSync(profilePath)) {
    return []
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(stripJsonComments(readFileSync(profilePath, "utf8")))
  } catch (error) {
    if (error instanceof SyntaxError) {
      return []
    }
    throw error
  }

  if (!isSupportedBackendProfile(parsed)) {
    return []
  }

  return formatSummaryLines(answeredQuestionMap(readQuestions(parsed.questions)))
}
