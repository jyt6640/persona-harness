import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"

import { isRecord, stripJsonComments } from "./jsonc.js"

const PROFILE_PATH = ".persona/project-profile.jsonc"
const SUPPORTED_SCHEMA = "persona.project-profile.v1"
const SUPPORTED_ROLE = "backend"
const SUPPORTED_MVP = "java-spring-clean-code"
const DEFAULT_HUMAN_OUTPUT_LOCALE = "en"
const DEFAULT_BACKEND_PROFILE_NOTE = "Default backend profile created by Persona Harness."

const SUMMARY_ORDER = [
  "user-language",
  "project-context",
  "project-goal",
  "project-scale",
  "application-type",
  "storage",
  "persistence-technology",
  "migration-style",
  "package-style",
  "architecture-style",
  "boundary-strictness",
] as const

export type BackendProjectProfileState = {
  readonly status: "missing" | "invalid" | "draft" | "incomplete" | "ready"
  readonly missingAnswers: readonly string[]
  readonly message: string
}

export type HumanOutputLocale = "en" | "ko"

type ProfileQuestion = {
  readonly id: string
  readonly answer: string | null
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

function readProjectNote(value: unknown): string | undefined {
  if (!isRecord(value) || !isRecord(value.notes) || typeof value.notes.project !== "string") {
    return undefined
  }

  const note = value.notes.project.trim()
  return note.length > 0 ? note : undefined
}

function formatSummaryLines(answers: ReadonlyMap<string, string>, projectNote?: string): readonly string[] {
  const answerLines = SUMMARY_ORDER.flatMap((id) => {
    const answer = answers.get(id)
    return answer === undefined ? [] : [`- ${id}: ${answer}`]
  })
  const noteLines = projectNote === undefined ? [] : [`- notes.project: ${projectNote}`]

  return [
    "Project profile summary:",
    ...(answerLines.length > 0 || noteLines.length > 0 ? [...answerLines, ...noteLines] : ["- No answered fields"]),
    "",
    "Project profile usage principles:",
    "- Use this summary as architecture/technology planning context before implementation.",
    "- The user's README, requirements, and explicit instructions take precedence.",
    "- This summary is not rule enforcement or a product-quality guarantee.",
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

  return formatSummaryLines(answeredQuestionMap(readQuestions(parsed.questions)), readProjectNote(parsed))
}

export function readHumanOutputLocale(projectDir: string): HumanOutputLocale {
  const profilePath = join(projectDir, PROFILE_PATH)
  if (!existsSync(profilePath)) {
    return DEFAULT_HUMAN_OUTPUT_LOCALE
  }

  try {
    const parsed: unknown = JSON.parse(stripJsonComments(readFileSync(profilePath, "utf8")))
    if (!isSupportedBackendProfile(parsed)) {
      return DEFAULT_HUMAN_OUTPUT_LOCALE
    }
    if (readProjectNote(parsed) === DEFAULT_BACKEND_PROFILE_NOTE) {
      return DEFAULT_HUMAN_OUTPUT_LOCALE
    }
    return answeredQuestionMap(readQuestions(parsed.questions)).get("user-language") === "ko"
      ? "ko"
      : DEFAULT_HUMAN_OUTPUT_LOCALE
  } catch {
    return DEFAULT_HUMAN_OUTPUT_LOCALE
  }
}

export function readBackendProjectProfileState(projectDir: string): BackendProjectProfileState {
  const profilePath = join(projectDir, PROFILE_PATH)
  if (!existsSync(profilePath)) {
    return {
      status: "missing",
      missingAnswers: [...SUMMARY_ORDER],
      message: `${PROFILE_PATH} is missing. Run npx ph intake --default backend or npx ph intake --interactive.`,
    }
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(stripJsonComments(readFileSync(profilePath, "utf8")))
  } catch (error) {
    if (error instanceof SyntaxError) {
      return {
        status: "invalid",
        missingAnswers: [...SUMMARY_ORDER],
        message: `${PROFILE_PATH} is malformed. Fix it or run npx ph intake --default backend --force.`,
      }
    }
    throw error
  }

  if (!isSupportedBackendProfile(parsed)) {
    return {
      status: "invalid",
      missingAnswers: [...SUMMARY_ORDER],
      message: `${PROFILE_PATH} is not a supported backend Java/Spring profile.`,
    }
  }

  const profileStatus = typeof parsed.status === "string" ? parsed.status : "draft"
  if (profileStatus === "draft") {
    return {
      status: "draft",
      missingAnswers: [...SUMMARY_ORDER],
      message: `${PROFILE_PATH} is still draft. Run npx ph intake --default backend --force or npx ph intake --interactive --force before planning.`,
    }
  }

  const answers = answeredQuestionMap(readQuestions(parsed.questions))
  const missingAnswers = SUMMARY_ORDER.filter((id) => !answers.has(id))
  if (missingAnswers.length > 0) {
    return {
      status: "incomplete",
      missingAnswers,
      message: `${PROFILE_PATH} is missing required answers: ${missingAnswers.join(", ")}.`,
    }
  }

  return {
    status: "ready",
    missingAnswers: [],
    message: `${PROFILE_PATH} is ready.`,
  }
}
