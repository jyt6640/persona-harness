import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"

import { deprecatedMultiAgentRoleFor, type MultiAgentRole } from "../config/harness-config.js"
import type { RelayRoleArtifact } from "./workflow-relay-model.js"

const ROLE_RULES: Readonly<
  Record<
    MultiAgentRole,
    {
      readonly forbiddenAny: readonly string[]
      readonly forbiddenReason: string
      readonly requiredAny: readonly string[]
      readonly requiredReason: string
    }
  >
> = {
  "test-writer": {
    forbiddenAny: ["i implemented", "implemented production", "implementation summary", "changed production code"],
    forbiddenReason: "test-writer artifact must not claim product implementation.",
    requiredAny: [
      "failing test",
      "verification test",
      "verification plan",
      "test evidence",
      "./gradlew test",
      "gradlew.bat test",
    ],
    requiredReason: "test-writer artifact must include failing/verification test evidence or a precise verification plan.",
  },
  implementer: {
    forbiddenAny: ["review only", "no implementation"],
    forbiddenReason: "implementer artifact must not be review-only prose.",
    requiredAny: ["implementation summary", "implemented", "changed files", "evidence:", "production code"],
    requiredReason: "implementer artifact must include implementation summary or evidence pointers.",
  },
  reviewer: {
    forbiddenAny: ["implemented final", "implementation summary", "production code only"],
    forbiddenReason: "reviewer artifact must not be implementation-only prose.",
    requiredAny: ["review result", "review:", "qa", "workflow check", "review-report", "check result"],
    requiredReason: "reviewer artifact must include review/report/check result pointers.",
  },
}

export function roleArtifactPath(ticketId: string, role: MultiAgentRole): string {
  return `.persona/workflow/work/${ticketId}/roles/${role}.md`
}

function legacyRoleArtifactPath(ticketId: string, role: MultiAgentRole): string | undefined {
  const legacyRole = deprecatedMultiAgentRoleFor(role)
  return legacyRole === undefined ? undefined : `.persona/workflow/work/${ticketId}/roles/${legacyRole}.md`
}

function roleArtifactCandidatePaths(ticketId: string, role: MultiAgentRole): readonly string[] {
  const primaryPath = roleArtifactPath(ticketId, role)
  const legacyPath = legacyRoleArtifactPath(ticketId, role)
  return legacyPath === undefined ? [primaryPath] : [primaryPath, legacyPath]
}

function normalizeArtifactText(content: string): string {
  return content.toLowerCase().replace(/\s+/g, " ").trim()
}

function includesAny(text: string, needles: readonly string[]): boolean {
  return needles.some((needle) => text.includes(needle))
}

function artifactReadiness(role: MultiAgentRole, content: string): Pick<RelayRoleArtifact, "readiness" | "reason"> {
  const text = normalizeArtifactText(content)
  if (text.length === 0) {
    return { readiness: "incomplete", reason: ROLE_RULES[role].requiredReason }
  }
  const rules = ROLE_RULES[role]
  if (includesAny(text, rules.forbiddenAny)) {
    return { readiness: "incomplete", reason: rules.forbiddenReason }
  }
  if (!includesAny(text, rules.requiredAny)) {
    return { readiness: "incomplete", reason: rules.requiredReason }
  }
  return { readiness: "complete", reason: null }
}

export function readRelayRoleArtifact(projectDir: string, ticketId: string, role: MultiAgentRole): RelayRoleArtifact {
  for (const path of roleArtifactCandidatePaths(ticketId, role)) {
    const absolutePath = join(projectDir, path)
    if (existsSync(absolutePath)) {
      const readiness = artifactReadiness(role, readFileSync(absolutePath, "utf8"))
      return {
        path,
        readiness: readiness.readiness,
        reason: readiness.reason,
        role,
        status: "present",
      }
    }
  }
  return {
    path: roleArtifactPath(ticketId, role),
    readiness: "missing",
    reason: "Role artifact is missing.",
    role,
    status: "missing",
  }
}
