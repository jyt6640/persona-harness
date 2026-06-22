import type { CliRunResult } from "./bearshell.js"

export type WorkflowGuardKind = "implement" | "final"
export type WorkflowRunnerKind = "implement"
export type WorkflowRunnerAction = "implement" | "start" | "finish"

export function failedGuardOutput(guardKind: WorkflowGuardKind, reasons: readonly string[]): CliRunResult {
  return {
    status: 1,
    stdout: "",
    stderr: [
      `Workflow guard failed: ${guardKind}`,
      "",
      "Required fixes:",
      ...reasons.map((reason) => `- ${reason}`),
      "",
      "This is a workflow-state gate only. It does not certify generated app product quality.",
    ].join("\n") + "\n",
  }
}

export function failedRunnerOutput(
  action: WorkflowRunnerAction,
  runnerKind: WorkflowRunnerKind,
  reasons: readonly string[],
): CliRunResult {
  return {
    status: 1,
    stdout: "",
    stderr: [
      `Workflow ${action} failed: ${runnerKind}`,
      "",
      "Required fixes:",
      ...reasons.map((reason) => `- ${reason}`),
      "",
      "This is an AI-facing workflow rail only. It does not certify generated app product quality.",
    ].join("\n") + "\n",
  }
}

export function passedStartOutput(runnerKind: WorkflowRunnerKind): CliRunResult {
  return {
    status: 0,
    stdout: [
      `Persona Harness Workflow Start: ${runnerKind}`,
      "",
      "Start status: PASS",
      "",
      "Short TUI request detected:",
      "- If the user said `README.md 보고 구현해줘`, `플랜 보고 구현해줘`, or another short implementation request, treat this output as the required workflow rail.",
      "",
      "Run this implementation rail now:",
      "1. `npx ph plan --implement`",
      "2. Read `README.md`, `.persona/project-profile.jsonc`, `.persona/policies`, and `.persona/workflow/plan.md`.",
      "3. Do not read `.persona/rules` directly; use the accepted plan and Persona Harness injection summary.",
      "4. Use codegraph MCP before raw file reads for code structure analysis when available.",
      "5. Implement from the accepted plan.",
      "6. Use `npx ph bearshell` for shell verification.",
      "7. Fill `.persona/workflow/implementation-report.md`.",
      "8. Run `npx ph plan --report-filled implementation`.",
      "9. Fill `.persona/workflow/review-report.md` after review/manual QA.",
      "10. Run `npx ph plan --report-filled review`.",
      "11. Run `npx ph workflow finish implement`.",
      "12. Do not give the final answer until `npx ph workflow finish implement` passes.",
      "",
      "Scope:",
      "- AI-facing workflow rail",
      "- no generated app product-quality certification",
    ].join("\n") + "\n",
    stderr: "",
  }
}

export function passedImplementOutput(): CliRunResult {
  return {
    status: 0,
    stdout: [
      "Persona Harness Workflow Implement",
      "",
      "Implementation rail status: PASS",
      "",
      "Use this as the single rail for short TUI requests like `README.md 보고 구현해줘` or `그냥 구현해줘`.",
      "",
      "Read README completely through bearshell chunks:",
      "1. `npx ph bearshell --shell 'wc -l README.md'`",
      "2. `npx ph bearshell --shell 'sed -n \"1,220p\" README.md'`",
      "3. If README.md has more than 220 lines, continue with `npx ph bearshell --shell 'sed -n \"221,440p\" README.md'`.",
      "4. Continue 220-line ranges until the README line count is covered.",
      "5. Record README ranges read in `.persona/workflow/implementation-report.md`.",
      "",
      "Required context:",
      "- README.md",
      "- .persona/project-profile.jsonc",
      "- .persona/policies",
      "- .persona/workflow/plan.md",
      "",
      "Do not read `.persona/rules` directly; use the accepted plan and Persona Harness injection summary.",
      "Do not read node_modules, .opencode, package vendor files, or .persona/evidence as implementation context.",
      "",
      "Implementation checklist:",
      "1. Implement from the accepted plan.",
      "2. Use `npx ph bearshell` for shell verification.",
      "3. Fill `.persona/workflow/implementation-report.md` with README read method, README ranges read, plan read method, and plan ranges read.",
      "4. Run `npx ph plan --report-filled implementation`.",
      "5. Fill `.persona/workflow/review-report.md` after review/manual QA.",
      "6. Run `npx ph plan --report-filled review`.",
      "7. Run `npx ph workflow finish implement`.",
      "8. Do not give the final answer until `npx ph workflow finish implement` passes.",
      "",
      "Scope:",
      "- AI-facing workflow rail",
      "- workflow evidence gate, not generated app product-quality certification",
    ].join("\n") + "\n",
    stderr: "",
  }
}

export function passedFinishOutput(runnerKind: WorkflowRunnerKind): CliRunResult {
  return {
    status: 0,
    stdout: [
      `Persona Harness Workflow Finish: ${runnerKind}`,
      "",
      "Finish status: PASS",
      "Workflow evidence is complete; final answer may be reported.",
      "",
      "Next:",
      "- `npx ph history --id <run-id>` when this workflow should be archived.",
      "",
      "Scope:",
      "- AI-facing workflow rail",
      "- no generated app product-quality certification",
    ].join("\n") + "\n",
    stderr: "",
  }
}

export function passedGuardOutput(guardKind: WorkflowGuardKind): CliRunResult {
  const nextLine =
    guardKind === "implement"
      ? "Implementation may start. Run `npx ph workflow implement`, then implement from the accepted plan."
      : "Workflow evidence is complete; final answer may be reported."
  return {
    status: 0,
    stdout: [
      `Persona Harness Workflow Guard: ${guardKind}`,
      "",
      "Guard status: PASS",
      nextLine,
      "",
      "Scope:",
      "- AI-facing workflow discipline gate",
      "- no generated app product-quality certification",
    ].join("\n") + "\n",
    stderr: "",
  }
}
