import { existsSync, mkdirSync, writeFileSync } from "node:fs"
import { join, resolve } from "node:path"
import process from "node:process"

import type { CliRunResult } from "./bearshell.js"

type IntakeOptions = {
  readonly projectDir?: string
}

type ProjectProfileQuestion = {
  readonly id: string
  readonly prompt: string
  readonly choices: readonly string[]
  readonly answer: null
}

type ProjectProfile = {
  readonly schema: "persona.project-profile.v1"
  readonly status: "draft"
  readonly scope: {
    readonly role: "backend"
    readonly mvp: "java-spring-clean-code"
    readonly productized: false
  }
  readonly defaults: {
    readonly language: "java"
    readonly framework: "spring"
    readonly buildTool: "gradle"
    readonly testPolicy: "deferred"
  }
  readonly questions: readonly ProjectProfileQuestion[]
  readonly philosophy: {
    readonly company: null
    readonly personal: null
    readonly project: null
    readonly priority: readonly ["company", "personal", "clean-code-baseline"]
  }
  readonly next: readonly string[]
}

type ParsedIntakeArgs =
  | { readonly kind: "run"; readonly force: boolean }
  | { readonly kind: "help" }
  | { readonly kind: "invalid"; readonly message: string }

const PROFILE_PATH = ".persona/project-profile.jsonc"

function createDefaultBackendProfile(): ProjectProfile {
  return {
    schema: "persona.project-profile.v1",
    status: "draft",
    scope: {
      role: "backend",
      mvp: "java-spring-clean-code",
      productized: false,
    },
    defaults: {
      language: "java",
      framework: "spring",
      buildTool: "gradle",
      testPolicy: "deferred",
    },
    questions: [
      {
        id: "project-context",
        prompt: "개인 프로젝트인지 팀/회사 프로젝트인지 정한다.",
        choices: ["personal", "team", "company"],
        answer: null,
      },
      {
        id: "project-scale",
        prompt: "프로젝트 규모와 생명주기를 정한다.",
        choices: ["small", "medium", "large", "prototype", "long-lived"],
        answer: null,
      },
      {
        id: "storage",
        prompt: "저장소 성격을 정한다.",
        choices: ["in-memory", "file", "database", "external-api", "none"],
        answer: null,
      },
      {
        id: "persistence-technology",
        prompt: "백엔드 persistence 기술을 정한다.",
        choices: ["jdbc-template", "jpa", "mybatis", "custom", "undecided"],
        answer: null,
      },
      {
        id: "migration-style",
        prompt: "DB migration 방식을 정한다.",
        choices: ["none", "schema.sql", "flyway", "liquibase", "undecided"],
        answer: null,
      },
      {
        id: "package-style",
        prompt: "패키지 구조를 정한다.",
        choices: ["domain-first", "layer-first"],
        answer: null,
      },
      {
        id: "dto-strictness",
        prompt: "DTO 분리 강도를 정한다.",
        choices: ["strict", "lightweight", "requirements-driven"],
        answer: null,
      },
      {
        id: "philosophy-overlay",
        prompt: "회사/개인/프로젝트 철학을 추가로 씌울지 정한다.",
        choices: ["none", "company", "personal", "project"],
        answer: null,
      },
    ],
    philosophy: {
      company: null,
      personal: null,
      project: null,
      priority: ["company", "personal", "clean-code-baseline"],
    },
    next: [
      "사용자가 questions[].answer를 채운다.",
      "Agent가 답변을 기준으로 architecture/technology plan을 먼저 제안한다.",
      "사용자가 계획을 확인한 뒤 구현으로 넘어간다.",
    ],
  }
}

export function intakeUsage(invocation = "ph"): string {
  return [
    `Usage: ${invocation} intake [--force]`,
    "",
    "Creates a draft backend project profile for the v0.3.0 intake/philosophy workflow.",
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

  for (const arg of args) {
    if (arg === "--help" || arg === "-h") {
      return { kind: "help" }
    }
    if (arg === "--force") {
      force = true
      continue
    }
    return { kind: "invalid", message: `Unknown option: ${arg}` }
  }

  return { kind: "run", force }
}

export function initializeProjectIntake(options: IntakeOptions = {}, force = false): string {
  const projectDir = resolve(options.projectDir ?? process.cwd())
  const personaDir = join(projectDir, ".persona")
  const profilePath = join(projectDir, PROFILE_PATH)

  if (existsSync(profilePath) && !force) {
    throw new Error(`${PROFILE_PATH} already exists. Re-run with --force to replace the draft.`)
  }

  mkdirSync(personaDir, { recursive: true })
  writeFileSync(profilePath, `${JSON.stringify(createDefaultBackendProfile(), null, 2)}\n`)
  return profilePath
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
        "- Philosophy overlay is optional and not yet injected automatically",
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
