#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import process from "node:process"
import { createInterface } from "node:readline/promises"
import { fileURLToPath } from "node:url"

import { runBootstrapCommand } from "./bootstrap.js"
import { personaCliUsage } from "./cli-usage.js"
import { formatInitNonInteractiveInterviewMessage } from "./init-output.js"
import { runInitCommand } from "./init.js"
import { type CliRunResult, runBearshell } from "./bearshell.js"
import { runHistoryCommand } from "./history.js"
import { runIntakeCommand, runInteractiveIntakeCommand } from "./intake.js"
import { runLanguageCommand } from "./language.js"
import { runPlanCommand } from "./plan-command.js"
import { runPolicyCommand } from "./policy.js"
import { runDoctorCommand } from "./doctor.js"
import { runEvidenceCommand } from "./evidence-summary.js"
import { runFeedbackCommand } from "./feedback.js"
import { PROFILE_PATH } from "./intake-profile.js"
import { runReviewCommand } from "./review.js"
import { runSmokeCommand } from "./smoke.js"
import { runWorkflowCommand } from "./workflow-command.js"

type PersonaCliOptions = {
  readonly cwd?: string
  readonly env?: Readonly<Record<string, string | undefined>>
  readonly invocationName?: string
  readonly packageRoot?: string
  readonly stdin?: string
}

export function runPersonaCli(args: readonly string[], options: PersonaCliOptions = {}): CliRunResult {
  const command = args[0]
  const invocationName = options.invocationName ?? "ph"

  if (command === "init") {
    return runInitCommand({ projectDir: options.cwd, packageRoot: options.packageRoot })
  }

  if (command === "bootstrap") {
    return runBootstrapCommand(args.slice(1), { projectDir: options.cwd, packageRoot: options.packageRoot }, invocationName)
  }

  if (command === "intake") {
    return runIntakeCommand(args.slice(1), { projectDir: options.cwd }, invocationName)
  }

  if (command === "plan") {
    return runPlanCommand(args.slice(1), { projectDir: options.cwd }, invocationName)
  }

  if (command === "policy") {
    return runPolicyCommand(args.slice(1), { projectDir: options.cwd }, invocationName)
  }

  if (command === "history") {
    return runHistoryCommand(args.slice(1), { projectDir: options.cwd }, invocationName)
  }

  if (command === "language") {
    return runLanguageCommand(args.slice(1), invocationName)
  }

  if (command === "bearshell") {
    return runBearshell(args.slice(1), { cwd: options.cwd, env: options.env })
  }

  if (command === "workflow") {
    return runWorkflowCommand(args.slice(1), { projectDir: options.cwd, stdin: options.stdin }, invocationName)
  }

  if (command === "doctor") {
    return runDoctorCommand(args.slice(1), { projectDir: options.cwd, env: options.env })
  }

  if (command === "evidence") {
    return runEvidenceCommand(args.slice(1), { projectDir: options.cwd }, invocationName)
  }

  if (command === "smoke") {
    return runSmokeCommand(args.slice(1), { projectDir: options.cwd })
  }

  if (command === "feedback") {
    return runFeedbackCommand(args.slice(1), { projectDir: options.cwd })
  }

  if (command === "review") {
    return runReviewCommand(args.slice(1), { projectDir: options.cwd }, invocationName)
  }

  if (command === undefined || command === "help" || command === "--help" || command === "-h") {
    return { status: 0, stdout: `${personaCliUsage(invocationName)}\n`, stderr: "" }
  }

  return {
    status: 1,
    stdout: "",
    stderr: `Unknown command: ${command}\n\n${personaCliUsage(invocationName)}\n`,
  }
}

function writeResult(result: CliRunResult): void {
  if (result.stdout.length > 0) {
    process.stdout.write(result.stdout)
  }
  if (result.stderr.length > 0) {
    process.stderr.write(result.stderr)
  }
  process.exitCode = result.status
}

async function runInitEntrypoint(invocationName: string): Promise<void> {
  const initResult = runInitCommand({ projectDir: process.cwd() })
  if (initResult.stdout.length > 0) {
    process.stdout.write(initResult.stdout)
  }
  if (initResult.stderr.length > 0) {
    process.stderr.write(initResult.stderr)
  }
  if (initResult.status !== 0) {
    process.exitCode = initResult.status
    return
  }

  if (existsSync(join(process.cwd(), PROFILE_PATH))) {
    process.stdout.write(`\n${PROFILE_PATH} already exists. Backend interview skipped.\n`)
    process.exitCode = 0
    return
  }

  if (process.stdin.isTTY !== true) {
    process.stderr.write(`\n${formatInitNonInteractiveInterviewMessage(invocationName)}`)
    process.exitCode = 1
    return
  }

  const readline = createInterface({ input: process.stdin, output: process.stdout })
  try {
    const intakeResult = await runInteractiveIntakeCommand(
      ["--interactive"],
      {
        projectDir: process.cwd(),
        isTty: process.stdin.isTTY === true,
        write: (text) => {
          process.stdout.write(text)
        },
        readLine: (prompt) => readline.question(prompt),
      },
      invocationName,
    )
    writeResult(intakeResult)
  } finally {
    readline.close()
  }
}

async function runCliEntrypoint(): Promise<void> {
  const args = process.argv.slice(2)
  const invocationName = process.argv[1]?.endsWith("/persona-harness") ? "persona-harness" : "ph"

  if (args[0] === "init") {
    await runInitEntrypoint(invocationName)
    return
  }

  if (args[0] === "intake" && args.includes("--interactive")) {
    const readline = createInterface({ input: process.stdin, output: process.stdout })
    try {
      const result = await runInteractiveIntakeCommand(
        args.slice(1),
        {
          projectDir: process.cwd(),
          isTty: process.stdin.isTTY === true,
          write: (text) => {
            process.stdout.write(text)
          },
          readLine: (prompt) => readline.question(prompt),
        },
        invocationName,
      )
      writeResult(result)
    } finally {
      readline.close()
    }
    return
  }

  writeResult(
    runPersonaCli(args, {
      cwd: process.cwd(),
      env: process.env,
      invocationName,
      stdin: workflowStdin(args),
    }),
  )
}

function workflowStdin(args: readonly string[]): string | undefined {
  if (args[0] !== "workflow" || (args[1] !== "capture" && args[1] !== "draft") || args[2] !== "--stdin") {
    return undefined
  }
  if (process.stdin.isTTY === true) {
    return undefined
  }
  return readFileSync(0, "utf8")
}

function isCliEntrypoint(): boolean {
  const entrypoint = process.argv[1]
  if (entrypoint === undefined) {
    return false
  }
  const normalized = entrypoint.replace(/\\/g, "/")
  return entrypoint === fileURLToPath(import.meta.url) || normalized.endsWith("/persona-harness") || normalized.endsWith("/ph")
}

if (isCliEntrypoint()) {
  runCliEntrypoint().catch((error: unknown) => {
    if (error instanceof Error) {
      process.stderr.write(`${error.message}\n`)
      process.exitCode = 1
      return
    }
    throw error
  })
}
