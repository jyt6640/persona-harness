import type { InitResult } from "./init.js"

export function formatInitResult(result: InitResult): string {
  const backupLines = result.backups.length > 0 ? ["", "Backups:", ...result.backups.map((backup) => `- ${backup}`)] : []

  return [
    "Persona Harness initialized.",
    "",
    "Installed:",
    ...result.installed.map((item) => `- ${item}`),
    ...backupLines,
    "",
    "Profile:",
    "- `ph init` starts the backend profile interview when it is run from an interactive terminal.",
    "- The interview writes `.persona/project-profile.jsonc` before planning.",
    "",
    "Fast path:",
    "- If an AI/non-TTY shell needs the default backend workflow, run `npx ph bootstrap backend`.",
    "- If you intentionally want only the default backend profile without the interview, run `npx ph intake --default backend`.",
    "",
    "Next after profile:",
    "1. Run `npx ph policy init` if you want company or personal backend guidance.",
    "2. Run `npx ph plan --auto-accept` for the fastest flow, or `npx ph plan` for manual review.",
    "3. Ask the agent to implement only through `npx ph workflow implement`.",
    "",
    "OpenCode TUI:",
    "- Run `opencode` in this project.",
    "- Ask it to read README.md and `.persona/workflow/plan.md` first.",
    "- Paste `npx ph plan --prompt` if you want the plan-only prompt inside the TUI.",
    "",
    "OpenCode CLI:",
    "- Plan first: `opencode run --dir . --model <model> --dangerously-skip-permissions \"$(npx ph plan --prompt)\"`",
    "- Implement only after the plan is accepted.",
    "",
    "Scope:",
    "- Java/Spring backend Clean Code injection",
    "- Gradle-first backend product code shape guidance",
    "",
    "Not guaranteed:",
    "- generated app product quality",
    "- test quality",
    "- rule enforcement",
    "- frontend/infra/multi-domain productization",
    "",
    "Evidence:",
    "- .persona/evidence/",
    "- .persona/evidence/ was not copied from the template; it is created only when hooks run.",
  ].join("\n")
}

export function formatInitNonInteractiveInterviewMessage(invocationName = "ph"): string {
  return [
    "Backend profile interview requires an interactive terminal.",
    "",
    "User path:",
    `- Run \`npx ${invocationName} init\` directly in your terminal and answer the interview.`,
    "",
    "AI/non-TTY path:",
    `- Run \`npx ${invocationName} bootstrap backend\` to create the default backend profile, policy, accepted plan, and workflow templates.`,
    "",
    "No default profile was created by `ph init`.",
    "",
  ].join("\n")
}
