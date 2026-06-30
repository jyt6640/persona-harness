import type { MultiAgentRole } from "../config/harness-config.js"
import type { ClosureTicket } from "./workflow-closure.js"

export const RELAY_ROLE_ARTIFACT_KIND: Readonly<Record<MultiAgentRole, string>> = {
  "test-writer": "test/verification artifact",
  jaeki: "implementation artifact",
  roach: "review artifact",
}

export function relayUsage(invocationName: string): string {
  return [
    `Usage: ${invocationName} workflow relay <status|next|validate> --json`,
    "",
    "Prints the read-only multi-agent relay preview state.",
    "Use validate --json to inspect role artifact readiness without writing artifacts.",
    "",
    "Scope:",
    "- requires multiAgent.enabled: true in .persona/harness.jsonc",
    "- does not dispatch native subtasks",
    "- does not auto-fill reports or auto-archive tickets",
    "- finish/check/archive remain the workflow gates",
  ].join("\n")
}

export function relayPromptBlock(promptLines: readonly string[]): string {
  return promptLines.join("\n")
}

export function relayPromptLinesFor(
  role: MultiAgentRole,
  ticket: ClosureTicket,
  artifactPath: string,
): readonly string[] {
  const common = [
    "PH closure/workflow state is the orchestrator/gate; OpenCode subagents are workers.",
    `Current ticket: ${ticket.id} - ${ticket.title}`,
    "Scoped inputs are paths only; read only what is needed from those files.",
  ]
  if (role === "test-writer") {
    return [
      ...common,
      "Role: test-writer.",
      "Read canonical PH test guidance first: .persona/rules/backend/spring-test.md section 'PH Multi-Agent Relay' and the current ticket/scenario contract rule.",
      "Detailed reference, if available in this package: packages/shared-skills/skills/programming/references/java/testing.md section 'Persona Harness relay contract'.",
      "Write the expected failing test, verification test, or verification plan for this ticket.",
      "Do not implement production code.",
      "Do not weaken, delete, or rewrite existing tests to pass without preserving behavior.",
      `Record the role artifact at ${artifactPath}.`,
      "Then rerun `npx ph workflow relay next --json`.",
    ]
  }
  if (role === "jaeki") {
    return [
      ...common,
      "Role: jaeki.",
      "Implement or refactor only this scoped ticket; avoid broad redesign.",
      "Use the test-writer artifact if present and keep workflow reports/evidence honest.",
      `Record the role artifact at ${artifactPath}.`,
      "Then rerun `npx ph workflow relay next --json`.",
    ]
  }
  return [
    ...common,
    "Role: roach.",
    "Review/QA the scoped ticket and pressure implementation/review reports.",
    "Do not implement features unless explicitly reassigned.",
    `Record the role artifact at ${artifactPath}.`,
    "Then rerun `npx ph workflow relay next --json`.",
  ]
}
