import { existsSync, mkdirSync, writeFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import process from "node:process"

import type { CliRunResult } from "./bearshell.js"

type PolicyOptions = {
  readonly projectDir?: string
}

type ParsedPolicyArgs =
  | { readonly kind: "init"; readonly force: boolean }
  | { readonly kind: "help" }
  | { readonly kind: "invalid"; readonly message: string }

type PolicyFile = {
  readonly path: string
  readonly contents: string
}

const POLICY_OVERLAY_PATH = ".persona/policies/overlay.jsonc"
const COMPANY_BACKEND_POLICY_PATH = ".persona/policies/company/backend.md"
const PERSONAL_BACKEND_POLICY_PATH = ".persona/policies/personal/backend.md"

const POLICY_FILES: readonly PolicyFile[] = [
  {
    path: POLICY_OVERLAY_PATH,
    contents: `${JSON.stringify(
      {
        schema: "persona.policy-overlay.v1",
        status: "draft",
        scope: {
          role: "backend",
          mvp: "java-spring-clean-code",
          productized: false,
        },
        enabled: true,
        priority: ["company", "personal", "clean-code-baseline"],
        sources: {
          company: COMPANY_BACKEND_POLICY_PATH,
          personal: PERSONAL_BACKEND_POLICY_PATH,
        },
        limits: {
          maxBulletsPerSource: 5,
        },
      },
      null,
      2,
    )}\n`,
  },
  {
    path: COMPANY_BACKEND_POLICY_PATH,
    contents: [
      "# Backend Company Policy",
      "",
      "<!-- Add company/team backend policy bullets here. -->",
      "",
    ].join("\n"),
  },
  {
    path: PERSONAL_BACKEND_POLICY_PATH,
    contents: [
      "# Backend Personal Philosophy",
      "",
      "<!-- Add personal backend philosophy bullets here. -->",
      "",
    ].join("\n"),
  },
] as const

function parsePolicyArgs(args: readonly string[]): ParsedPolicyArgs {
  if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
    return { kind: "help" }
  }

  const command = args[0]
  if (command !== "init") {
    return { kind: "invalid", message: `Unknown policy command: ${command}` }
  }

  let force = false
  for (const arg of args.slice(1)) {
    if (arg === "--help" || arg === "-h") {
      return { kind: "help" }
    }
    if (arg === "--force") {
      force = true
      continue
    }
    return { kind: "invalid", message: `Unknown option: ${arg}` }
  }

  return { kind: "init", force }
}

export function policyUsage(invocation = "ph"): string {
  return [
    `Usage: ${invocation} policy <command> [args...]`,
    "",
    "Commands:",
    "  init [--force]  Create backend-only company/personal policy overlay files.",
    "",
    "Output:",
    `- ${POLICY_OVERLAY_PATH}`,
    `- ${COMPANY_BACKEND_POLICY_PATH}`,
    `- ${PERSONAL_BACKEND_POLICY_PATH}`,
    "",
    "Scope:",
    "- Java/Spring backend planning context",
    "- No rule enforcement",
    "- No frontend/infra/global policy loading",
  ].join("\n")
}

function writePolicyFiles(projectDir: string, force: boolean): readonly string[] {
  const existing = POLICY_FILES.filter((file) => existsSync(join(projectDir, file.path))).map((file) => file.path)
  if (existing.length > 0 && !force) {
    throw new Error(`${existing.join(", ")} already exists. Re-run with --force to replace policy overlay files.`)
  }

  for (const file of POLICY_FILES) {
    const targetPath = join(projectDir, file.path)
    mkdirSync(dirname(targetPath), { recursive: true })
    writeFileSync(targetPath, file.contents)
  }

  return POLICY_FILES.map((file) => file.path)
}

export function runPolicyCommand(
  args: readonly string[],
  options: PolicyOptions = {},
  invocationName = "ph",
): CliRunResult {
  const parsed = parsePolicyArgs(args)

  if (parsed.kind === "help") {
    return { status: 0, stdout: `${policyUsage(invocationName)}\n`, stderr: "" }
  }

  if (parsed.kind === "invalid") {
    return { status: 1, stdout: "", stderr: `${parsed.message}\n\n${policyUsage(invocationName)}\n` }
  }

  try {
    const projectDir = resolve(options.projectDir ?? process.cwd())
    const written = writePolicyFiles(projectDir, parsed.force)
    return {
      status: 0,
      stdout: [
        "Persona Harness policy overlay initialized.",
        "",
        "Installed:",
        ...written.map((path) => `- ${path}`),
        "",
        "Next:",
        "- Fill company/personal backend policy bullets.",
        "- Run npx ph plan before implementation.",
        "",
        "Scope:",
        "- backend-only planning/injection context",
        "- diagnostics-only fallback",
        "- no enforcement gate",
        "",
      ].join("\n"),
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
