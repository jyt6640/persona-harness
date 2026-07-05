import type { CliRunResult } from "./bearshell.js"
import {
  workflowReadChunkLines,
  workflowRequiredActionLine,
  workflowRequiredContextLines,
} from "./workflow-context-guidance.js"
import { isStructuredWorkflowRequiredFix, type WorkflowRequiredFix } from "./workflow-required-fix.js"

export type WorkflowGuardKind = "implement" | "final"
export type WorkflowRunnerKind = "implement"
export type WorkflowRunnerAction = "implement" | "start" | "finish"

function requiredFixDetail(fix: WorkflowRequiredFix): string {
  return isStructuredWorkflowRequiredFix(fix) ? fix.detail : fix
}

export function uninitializedHarnessOutput(): CliRunResult {
  return {
    status: 0,
    stdout: [
      "Persona Harness not initialized.",
      "",
      "Implementation is not blocked.",
      "",
      "This project does not have a `.persona/` directory, so Persona Harness workflow gates are inactive.",
      "Continue normal implementation if the user did not opt into Persona Harness.",
      "",
      "To opt in:",
      "- `npx ph init`",
      "- `npx ph bootstrap backend`",
      "- then run `npx ph workflow implement` again",
      "",
      "Scope:",
      "- advisory only",
      "- no generated app product-quality certification",
    ].join("\n") + "\n",
    stderr: "",
  }
}

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
  reasons: readonly WorkflowRequiredFix[],
): CliRunResult {
  return {
    status: 1,
    stdout: "",
    stderr: [
      `Workflow ${action} failed: ${runnerKind}`,
      "",
      "Required fixes:",
      ...reasons.map((reason) => `- ${requiredFixDetail(reason)}`),
      "",
      "This is an AI-facing workflow rail only. It does not certify generated app product quality.",
    ].join("\n") + "\n",
  }
}

export function passedStartOutput(runnerKind: WorkflowRunnerKind, projectDir?: string): CliRunResult {
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
      `2. ${workflowRequiredActionLine(projectDir).replace(/^- /, "")}`,
      "3. Do not read `.persona/rules` directly; use the accepted plan and Persona Harness injection summary.",
      "4. Use PH-owned surfaces first for structure checks: accepted plan, workflow check/closure, ast-grep conventions, and relay handoff.",
      "5. Optional external codegraph/code-nav tools may be used only if actually available; do not present them as PH-owned or token-saving.",
      "6. Implement from the accepted plan.",
      "7. Use `npx ph bearshell` for shell verification.",
      "8. Fill `.persona/workflow/implementation-report.md`.",
      "9. Run `npx ph plan --report-filled implementation`.",
      "10. Fill `.persona/workflow/review-report.md` after review/manual QA.",
      "11. Run `npx ph plan --report-filled review`.",
      "12. Run `npx ph workflow finish implement`.",
      "13. Do not give the final answer until `npx ph workflow finish implement` passes.",
      "",
      "Scope:",
      "- AI-facing workflow rail",
      "- no generated app product-quality certification",
    ].join("\n") + "\n",
    stderr: "",
  }
}

export function passedImplementOutput(projectDir?: string): CliRunResult {
  return {
    status: 0,
    stdout: [
      "Persona Harness Workflow Implement",
      "",
      "Implementation rail status: PASS",
      "",
      "Intent classification: implementation request.",
      "Basis: this AI-facing rail is used when the user asks to implement from README, requirements, or an accepted plan.",
      "Next action:",
      "1. Turn the requirements source into tickets with split/capture/next.",
      "2. Implement only the current ticket.",
      "3. After implementation, pass the report/final gate.",
      "Forbidden: writing production code directly without a ticket.",
      "",
      "Use this as the single rail for short TUI requests like `README.md 보고 구현해줘` or `그냥 구현해줘`.",
      "",
      "Requirement source:",
      "- If README.md or another requirements file exists, split that file with `npx ph workflow split README.md` when it contains multiple Step sections.",
      "- If the user pasted long requirements directly in the TUI prompt and no requirements file exists, save that prompt first: `npx ph workflow capture --stdin`, then run `npx ph workflow split` and `npx ph workflow next`.",
      "- Work from the current workflow ticket when `.persona/workflow/backlog.md` exists.",
      "",
      ...workflowReadChunkLines(projectDir),
      "",
      "Read project profile before implementation:",
      "1. macOS/Linux: `npx ph bearshell --shell 'sed -n \"1,220p\" .persona/project-profile.jsonc'`",
      "2. Windows PowerShell: `npx ph bearshell powershell -NoProfile -Command \"Get-Content .persona/project-profile.jsonc -TotalCount 220\"`",
      "3. Record project profile read method and ranges read in `.persona/workflow/implementation-report.md`.",
      "",
      "Project mode:",
      "- If existing Java/Spring source files already exist, discover their package/layer/naming/repository/DTO/domain style first.",
      "- existing code wins over greenfield guidance: match the current project before introducing the baseline package flow.",
      "- If no source files exist, use the Java/Spring greenfield 0% -> 80% baseline.",
      "",
      "Required context:",
      ...workflowRequiredContextLines(projectDir),
      "",
      "Do not read `.persona/rules` directly; use the accepted plan and Persona Harness injection summary.",
      "Do not read node_modules, .opencode, package vendor files, or .persona/evidence as implementation context.",
      "",
      "Implementation checklist:",
      "1. Implement from the accepted plan.",
      "2. After Java files are generated or changed, discover Java files so Persona Harness can observe generated Java roles.",
      "   - macOS/Linux: `npx ph bearshell --shell 'find src/main/java src/test/java -name \"*.java\" 2>/dev/null | sort'`",
      "   - Windows PowerShell: `npx ph bearshell powershell -NoProfile -Command \"Get-ChildItem -Path src/main/java,src/test/java -Recurse -File -Filter *.java -ErrorAction SilentlyContinue | Sort-Object FullName | Select-Object -ExpandProperty FullName\"`",
      "3. If Persona Harness adds a Java Role Read Follow-up, read those representative Java files before continuing.",
      "4. Prefer Gradle wrapper verification for generated Spring apps: `./gradlew test`, `./gradlew build`, and `./gradlew bootRun`; on Windows use `gradlew.bat`.",
      "5. If Gradle wrapper files are missing, record why and do not treat missing system Gradle as generated app failure.",
      "6. Use `npx ph bearshell` for shell verification.",
      "7. Fill `.persona/workflow/implementation-report.md` with README read method, README ranges read, project profile read method, project profile ranges read, plan read method, plan ranges read, and Java role discovery/read evidence.",
      "8. Run `npx ph plan --report-filled implementation`.",
      "9. Fill `.persona/workflow/review-report.md` after review/manual QA.",
      "10. Run `npx ph plan --report-filled review`.",
      "11. Run `npx ph workflow finish implement`.",
      "12. Do not give the final answer until `npx ph workflow finish implement` passes.",
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
