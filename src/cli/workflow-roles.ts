import { existsSync, mkdirSync, writeFileSync } from "node:fs"
import { join, resolve } from "node:path"
import process from "node:process"

import type { CliRunResult } from "./bearshell.js"

export const ROLE_BOUNDARY_PATH = ".persona/workflow/roles.md"

export function createWorkflowRoleBoundaryTemplate(): string {
  return [
    "# Persona Workflow Role Boundaries",
    "",
    "Status: active-boundary",
    "",
    "Current implementation: role boundary artifact only.",
    "No autonomous role-agent execution is implemented here.",
    "",
    "## Role Map",
    "",
    "| Role | Owns | Reads | Writes | Must Not Do |",
    "| --- | --- | --- | --- | --- |",
    "| `blackbear` | planning and requirement decomposition | README, prompt requirements, project profile, policies | `.persona/workflow/plan.md`, requirements draft/backlog | production code edits |",
    "| `Charles` | execution coordination and state handoff | accepted plan, backlog, reports, evidence summaries | workflow status/next-step notes | direct feature implementation |",
    "| `implementer` | implementation | accepted plan, current ticket, existing code | production code, tests, `.persona/workflow/implementation-report.md` | final review approval |",
    "| `reviewer` | review and QA pressure | requirements, profile, plan, implementation report, generated code | `.persona/workflow/review-report.md` | feature implementation unless explicitly reassigned |",
    "",
    "## Rail Mapping",
    "",
    "- requirements rail -> `blackbear` first, then `Charles` for ticket state.",
    "- programming rail -> `implementer` after plan/ticket readiness.",
    "- debug rail -> `implementer` only after reproduction and hypotheses are recorded.",
    "- review rail -> `reviewer`; code edits are out of scope unless the user asks for fixes.",
    "- refactor rail -> `implementer` with `reviewer` review pressure after behavior is preserved.",
    "- git rail -> `Charles` coordination before status/diff/commit/push/tag operations.",
    "",
    "## Runtime Boundary",
    "",
    "- This file is a workflow contract for a single AI agent.",
    "- It does not spawn subagents.",
    "- It does not certify generated app quality.",
    "- It does not create build/test failure gates.",
    "- Hook evidence may report mismatches, but remains report-only unless a later scope decision changes that.",
    "",
  ].join("\n")
}

export function runWorkflowRolesCommand(options: { readonly projectDir?: string } = {}): CliRunResult {
  const projectDir = resolve(options.projectDir ?? process.cwd())
  if (!existsSync(join(projectDir, ".persona"))) {
    return {
      status: 1,
      stdout: "",
      stderr: [
        "Persona Harness is not initialized for workflow roles.",
        "",
        "Run `npx ph init` first.",
      ].join("\n") + "\n",
    }
  }

  const workflowDir = join(projectDir, ".persona", "workflow")
  mkdirSync(workflowDir, { recursive: true })
  const content = createWorkflowRoleBoundaryTemplate()
  writeFileSync(join(projectDir, ROLE_BOUNDARY_PATH), content)

  return {
    status: 0,
    stdout: `${content}Role boundary artifact: ${ROLE_BOUNDARY_PATH}\n`,
    stderr: "",
  }
}
