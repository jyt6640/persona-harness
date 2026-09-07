import process from "node:process"
import { fileURLToPath } from "node:url"
import { runContextInitCommand } from "../cli/context-init.js"
import { runContextPreviewCommand } from "../cli/context-preview.js"
import { runContextScopeCommand } from "../cli/context-scope-command.js"
import { runContextTaskCommand } from "../cli/context-task-command.js"
import { runPhilosophyCommand } from "../cli/philosophy-command.js"

async function main(): Promise<void> {
  const [group, command, ...args] = process.argv.slice(2)
  if (command === undefined && (group === undefined || group === "--help" || group === "-h" || group === "help")) {
    process.stdout.write([
      "Persona Harness local plugin setup",
      "Invoke this script with:",
      "  context init --enable",
      "  context preview <relative-target> --json",
      "  context scope [bind|unbind --project <key>]",
      "  context task --session <handle> [resume|end --task <key>]",
      "  context task --session <handle> preview <relative-target> --json",
      "  philosophy status",
      "  philosophy propose --stdin",
      "  philosophy --help (all existing philosophy commands)",
      `Decision format: ${fileURLToPath(new URL("../skills/philosophy-refinement/references/persistence.md", import.meta.url))}`,
      "Setup and persistence require explicit consent. Help changes no files.",
      "",
    ].join("\n"))
    return
  }
  let stdin: string | undefined
  if (args.includes("--stdin")) {
    const chunks: Buffer[] = []
    let size = 0
    for await (const chunk of process.stdin) {
      const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
      size += bytes.length
      if (size > 1_048_576) throw new Error("setup-input-limit")
      chunks.push(bytes)
    }
    stdin = new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks))
  }
  const projectDir = process.cwd()
  const result = group === "context" && command === "init" ? runContextInitCommand(args, projectDir)
    : group === "context" && command === "preview" ? runContextPreviewCommand(args, projectDir)
      : group === "context" && command === "scope" ? runContextScopeCommand(args, projectDir)
      : group === "context" && command === "task" ? runContextTaskCommand(args, projectDir)
      : group === "philosophy" ? runPhilosophyCommand(command === undefined ? [] : [command, ...args], { projectDir, stdin })
        : { status: 1, stdout: "", stderr: "setup-command-invalid\n" }
  process.stdout.write(result.stdout)
  process.stderr.write(result.stderr)
  process.exitCode = result.status
}

try {
  await main()
} catch {
  process.stderr.write("setup-unavailable\n")
  process.exitCode = 1
}
