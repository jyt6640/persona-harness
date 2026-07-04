import type { MultiAgentRole } from "../config/harness-config.js"
import type { ClosureTicket } from "./workflow-closure.js"
import type { WorkflowRelayPayload } from "./workflow-relay-model.js"

export const RELAY_ROLE_ARTIFACT_KIND: Readonly<Record<MultiAgentRole, string>> = {
  "test-writer": "test/verification artifact",
  implementer: "implementation artifact",
  reviewer: "review artifact",
}

export function relayUsage(invocationName: string): string {
  return [
    `Usage: ${invocationName} workflow relay <status|next|validate> --json`,
    "",
    "Prints the read-only Role Checklist Relay state.",
    "Use validate --json to inspect role artifact readiness without writing artifacts.",
    "",
    "Scope:",
    "- requires multiAgent.enabled: true in .persona/harness.jsonc; multiAgent is the compatibility config name",
    "- main-session checklist rail for test-writer, implementer, and reviewer role lenses",
    "- may ask a host subagent/task tool to take a role when the host exposes that capability",
    "- does not guarantee or enforce host subagent invocation",
    "- does not auto-fill reports or auto-archive tickets",
    "- finish/check/archive remain the workflow gates",
  ].join("\n")
}

export function relayPromptBlock(promptLines: readonly string[]): string {
  return promptLines.join("\n")
}

function formatRole(role: MultiAgentRole | null): string {
  return role ?? "none"
}

function roleAuthoringHints(role: MultiAgentRole | null): readonly string[] {
  if (role === "test-writer") {
    return [
      "Include failing/verification test evidence or a precise verification plan.",
      "Read canonical PH test guidance first: .persona/rules/backend/spring-test.md section 'PH Multi-Agent Relay' (legacy section name for the Role Checklist Relay contract).",
    ]
  }
  if (role === "implementer") {
    return [
      "Include implementation summary and evidence pointers.",
      "Use the test-writer artifact if present; do not broaden the ticket.",
    ]
  }
  if (role === "reviewer") {
    return [
      "Include review/report/check result pointers.",
      "Review reports and remaining PH closure blockers; do not implement features unless reassigned.",
    ]
  }
  return ["Run the gate command shown above and continue through PH closure/check/archive/finish gates."]
}

function roleSubagentInvocationLines(role: MultiAgentRole): readonly string[] {
  return [
    `When the host exposes subagent/task invocation, invoke the \`${role}\` subagent via the task tool for this role stage.`,
    "If host subagent invocation is unavailable or not taken, complete this role checklist in the main session.",
    "Record whether subagent invocation was used or unavailable in the role artifact.",
  ]
}

export function relayValidateText(payload: WorkflowRelayPayload): string {
  const ticket = payload.currentTicket === null ? "none" : `${payload.currentTicket.id} - ${payload.currentTicket.title}`
  const firstBlocker = payload.blockers[0] ?? null
  const lines = [
    "Persona Harness Role Checklist Relay validation",
    "Mode: read-only checklist rail; no guaranteed host subagent invocation, no artifact writes.",
    `Current ticket: ${ticket}`,
    `Current role: ${formatRole(payload.currentRole)}`,
    `Next role: ${formatRole(payload.nextRole)}`,
    "Role artifacts:",
    ...payload.roleArtifacts.map((artifact) =>
      artifact.reason === null
        ? `- ${artifact.role}: ${artifact.readiness} - ${artifact.path}`
        : `- ${artifact.role}: ${artifact.readiness} - ${artifact.path} (${artifact.reason})`,
    ),
    `First blocker: ${firstBlocker === null ? "none" : `${firstBlocker.id} - ${firstBlocker.reason}`}`,
    `Required artifact: ${payload.requiredArtifact ?? "none"}`,
    `Gate command: ${payload.gateCommand}`,
    "Authoring hints:",
    ...roleAuthoringHints(payload.currentRole).map((hint) => `- ${hint}`),
    "PH closure/check/archive/finish gates remain authoritative.",
    "Host subagent/task invocation is optional and host-dependent; when unavailable, complete the current role checklist in the main session and record that limitation.",
  ]
  return `${lines.join("\n")}\n`
}

export function relayPromptLinesFor(
  role: MultiAgentRole,
  ticket: ClosureTicket,
  artifactPath: string,
): readonly string[] {
  const common = [
    "PH Role Checklist Relay is a main-session role checklist rail; host subagents are optional workers when available.",
    `Current ticket: ${ticket.id} - ${ticket.title}`,
    "Scoped inputs are paths only; read only what is needed from those files.",
  ]
  if (role === "test-writer") {
    return [
      ...common,
      "Role: test-writer.",
      ...roleSubagentInvocationLines(role),
      "Read canonical PH test guidance first: .persona/rules/backend/spring-test.md section 'PH Multi-Agent Relay' (legacy section name for the Role Checklist Relay contract) and the current ticket/scenario contract rule.",
      "Detailed reference, if available in this package: packages/shared-skills/skills/programming/references/java/testing.md section 'Persona Harness relay contract'.",
      "Write the expected failing test, verification test, or verification plan for this ticket.",
      "Do not implement production code.",
      "Do not weaken, delete, or rewrite existing tests to pass without preserving behavior.",
      `Record the role artifact at ${artifactPath}.`,
      "Then rerun `npx ph workflow relay next --json`.",
    ]
  }
  if (role === "implementer") {
    return [
      ...common,
      "Role: implementer.",
      ...roleSubagentInvocationLines(role),
      "Implement or refactor only this scoped ticket; avoid broad redesign.",
      "Use the test-writer artifact if present and keep workflow reports/evidence honest.",
      `Record the role artifact at ${artifactPath}.`,
      "Then rerun `npx ph workflow relay next --json`.",
    ]
  }
  return [
    ...common,
    "Role: reviewer.",
    ...roleSubagentInvocationLines(role),
    "Review/QA the scoped ticket and pressure implementation/review reports.",
    "Do not implement features unless explicitly reassigned.",
    `Record the role artifact at ${artifactPath}.`,
    "Then rerun `npx ph workflow relay next --json`.",
  ]
}
