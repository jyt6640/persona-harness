import { existsSync, mkdirSync, writeFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import process from "node:process"

import type { CliRunResult } from "./bearshell.js"
import { INTAKE_QUESTIONS, PROFILE_PATH, createBackendProfile, type IntakeQuestionDefinition } from "./intake-profile.js"

type IntakeOptions = {
  readonly projectDir?: string
}

export type InteractiveIntakeOptions = IntakeOptions & {
  readonly isTty: boolean
  readonly write: (text: string) => void
  readonly readLine: (prompt: string) => Promise<string>
}

type ParsedIntakeArgs =
  | { readonly kind: "run"; readonly force: boolean; readonly interactive: boolean }
  | { readonly kind: "help" }
  | { readonly kind: "invalid"; readonly message: string }

export function intakeUsage(invocation = "ph"): string {
  return [
    `Usage: ${invocation} intake [--force | --interactive]`,
    "",
    "Creates a draft backend project profile for the v0.3.0 intake workflow.",
    "",
    "Output:",
    `- ${PROFILE_PATH}`,
    "",
    "Scope:",
    "- Java/Spring backend Clean Code planning surface",
    "- No rule enforcement",
    "- No frontend/infra productization",
    "- No generated app product-quality certification",
  ].join("\n")
}

function parseIntakeArgs(args: readonly string[]): ParsedIntakeArgs {
  let force = false
  let interactive = false

  for (const arg of args) {
    if (arg === "--help" || arg === "-h") {
      return { kind: "help" }
    }
    if (arg === "--force") {
      force = true
      continue
    }
    if (arg === "--interactive") {
      interactive = true
      continue
    }
    return { kind: "invalid", message: `Unknown option: ${arg}` }
  }

  return { kind: "run", force, interactive }
}

function resolveProfilePath(options: IntakeOptions): string {
  const projectDir = resolve(options.projectDir ?? process.cwd())
  return join(projectDir, PROFILE_PATH)
}

function ensureWritableProfile(options: IntakeOptions, force: boolean): string {
  const profilePath = resolveProfilePath(options)
  if (existsSync(profilePath) && !force) {
    throw new Error(`${PROFILE_PATH} already exists. Re-run with --force to replace the draft.`)
  }
  return profilePath
}

function writeProfile(profilePath: string, answers: ReadonlyMap<string, string>, projectNote: string | null): void {
  mkdirSync(dirname(profilePath), { recursive: true })
  writeFileSync(profilePath, `${JSON.stringify(createBackendProfile(answers, projectNote), null, 2)}\n`)
}

export function initializeProjectIntake(options: IntakeOptions = {}, force = false): string {
  const profilePath = ensureWritableProfile(options, force)

  writeProfile(profilePath, new Map<string, string>(), null)
  return profilePath
}

function introText(): string {
  return [
    "Persona Harness backend project intake",
    "",
    "답변 방식:",
    "- 번호를 입력하면 해당 선택지를 사용합니다.",
    "- Enter, 추천, recommend는 추천값을 사용합니다.",
    "- 미정은 undecided로 저장합니다.",
    "- 완료 전 종료하면 profile을 저장하지 않습니다.",
    "",
  ].join("\n")
}

function shouldSkipMigration(answers: ReadonlyMap<string, string>): boolean {
  return answers.get("storage") === "none" || answers.get("persistence-technology") === "not-needed"
}

function questionText(index: number, question: IntakeQuestionDefinition): string {
  const choices = question.choices.map((choice, choiceIndex) => `${choiceIndex + 1}) ${choice.value} - ${choice.label}`)
  return [`${index}. ${question.prompt}`, ...choices].join("\n") + "\n"
}

function resolveInteractiveAnswer(input: string, question: IntakeQuestionDefinition): string | undefined {
  const normalized = input.trim()
  if (normalized === "" || normalized === "추천" || normalized === "recommend") {
    return question.recommended
  }
  if (normalized === "미정" || normalized === "undecided") {
    return "undecided"
  }
  if (!/^\d+$/.test(normalized)) {
    return undefined
  }

  const choiceIndex = Number.parseInt(normalized, 10) - 1
  const selected = question.choices[choiceIndex]
  if (selected === undefined) {
    return undefined
  }
  return selected.value === "recommend" ? question.recommended : selected.value
}

async function askQuestion(
  io: InteractiveIntakeOptions,
  index: number,
  question: IntakeQuestionDefinition,
): Promise<string> {
  io.write(questionText(index, question))
  while (true) {
    const input = await io.readLine(`선택 [추천: ${question.recommended}]: `)
    const answer = resolveInteractiveAnswer(input, question)
    if (answer !== undefined) {
      io.write("\n")
      return answer
    }
    io.write("다시 입력해 주세요.\n")
  }
}

async function collectInteractiveAnswers(io: InteractiveIntakeOptions): Promise<{
  readonly answers: ReadonlyMap<string, string>
  readonly projectNote: string | null
}> {
  const answers = new Map<string, string>()
  let displayIndex = 1
  for (const question of INTAKE_QUESTIONS) {
    if (question.id === "migration-style" && shouldSkipMigration(answers)) {
      answers.set("migration-style", "not-needed")
      continue
    }
    answers.set(question.id, await askQuestion(io, displayIndex, question))
    displayIndex += 1
  }

  io.write(`${displayIndex}. 추가로 agent가 계획 전에 꼭 알아야 할 프로젝트 조건이 있나요? 없으면 Enter를 누르세요.\n`)
  const noteInput = await io.readLine("입력: ")
  const projectNote = noteInput.trim().length > 0 ? noteInput.trim() : null
  return { answers, projectNote }
}

export async function runInteractiveIntakeCommand(
  args: readonly string[],
  options: InteractiveIntakeOptions,
  invocationName = "ph",
): Promise<CliRunResult> {
  const parsed = parseIntakeArgs(args)
  if (parsed.kind === "help") {
    return { status: 0, stdout: `${intakeUsage(invocationName)}\n`, stderr: "" }
  }
  if (parsed.kind === "invalid") {
    return { status: 1, stdout: "", stderr: `${parsed.message}\n\n${intakeUsage(invocationName)}\n` }
  }
  if (!parsed.interactive) {
    return runIntakeCommand(args, options, invocationName)
  }
  if (!options.isTty) {
    return { status: 1, stdout: "", stderr: "Interactive intake requires a TTY. Use `npx ph intake` to create an editable draft.\n" }
  }

  const profilePath = ensureWritableProfile(options, parsed.force)
  options.write(introText())
  let result: Awaited<ReturnType<typeof collectInteractiveAnswers>>
  try {
    result = await collectInteractiveAnswers(options)
  } catch (error) {
    if (error instanceof Error) {
      return { status: 1, stdout: "", stderr: "Interactive intake aborted. No project profile was written.\n" }
    }
    throw error
  }
  writeProfile(profilePath, result.answers, result.projectNote)
  options.write(
    [
      "",
      "Persona Harness project intake profile created.",
      "",
      `Profile: ${profilePath}`,
      "",
      "Next:",
      "- Run npx ph plan.",
      "- Review .persona/workflow/plan.md before implementation.",
      "- Ask the agent to implement only after the plan is accepted.",
      "",
    ].join("\n"),
  )
  return { status: 0, stdout: "", stderr: "" }
}

export function runIntakeCommand(
  args: readonly string[],
  options: IntakeOptions = {},
  invocationName = "ph",
): CliRunResult {
  const parsed = parseIntakeArgs(args)

  if (parsed.kind === "help") {
    return { status: 0, stdout: `${intakeUsage(invocationName)}\n`, stderr: "" }
  }

  if (parsed.kind === "invalid") {
    return { status: 1, stdout: "", stderr: `${parsed.message}\n\n${intakeUsage(invocationName)}\n` }
  }
  if (parsed.interactive) {
    return {
      status: 1,
      stdout: "",
      stderr: "Interactive intake requires a TTY. Use `npx ph intake` to create an editable draft.\n",
    }
  }

  try {
    const profilePath = initializeProjectIntake(options, parsed.force)
    return {
      status: 0,
      stdout: [
        "Persona Harness project intake draft created.",
        "",
        `Profile: ${profilePath}`,
        "",
        "Next:",
        `- Fill ${PROFILE_PATH} questions[].answer values.`,
        "- Ask the agent to propose an architecture/technology plan before implementation.",
        "",
        "Scope:",
        "- Java/Spring backend Clean Code planning surface",
        "- Philosophy/policy overlays are deferred to a separate future surface",
      ].join("\n") + "\n",
      stderr: "",
    }
  } catch (error) {
    return {
      status: 1,
      stdout: "",
      stderr: `${error instanceof Error ? error.message : String(error)}\n`,
    }
  }
}
