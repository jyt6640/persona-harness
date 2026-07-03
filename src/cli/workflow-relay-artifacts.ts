import { existsSync, readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"

import { deprecatedMultiAgentRoleFor, type MultiAgentRole } from "../config/harness-config.js"
import type { RelayRoleArtifact } from "./workflow-relay-model.js"

export type RelayRoleBoundaryFinding = {
  readonly id: "role-artifact-missing-required-evidence" | "role-boundary-forbidden-claim" | "unknown-role-artifact-path"
  readonly message: string
  readonly path: string
  readonly role: MultiAgentRole | "unknown"
  readonly severity: "info" | "warning"
}

export type RelayRoleArtifactFile = {
  readonly compatibility: "current" | "legacy" | "unknown"
  readonly path: string
  readonly role: MultiAgentRole | "unknown"
}

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

function roleForArtifactFileName(fileName: string, roles: readonly MultiAgentRole[]): MultiAgentRole | "unknown" {
  const roleName = fileName.endsWith(".md") ? fileName.slice(0, -3) : fileName
  for (const role of roles) {
    if (roleName === role || roleName === deprecatedMultiAgentRoleFor(role)) {
      return role
    }
  }
  return "unknown"
}

export function relayRoleArtifactFiles(
  projectDir: string,
  ticketId: string,
  roles: readonly MultiAgentRole[],
): readonly RelayRoleArtifactFile[] {
  const rolesDir = join(projectDir, ".persona", "workflow", "work", ticketId, "roles")
  if (!existsSync(rolesDir)) {
    return []
  }
  return readdirSync(rolesDir)
    .filter((fileName) => fileName.endsWith(".md"))
    .sort()
    .map((fileName) => {
      const role = roleForArtifactFileName(fileName, roles)
      const path = `.persona/workflow/work/${ticketId}/roles/${fileName}`
      if (role === "unknown") {
        return { compatibility: "unknown", path, role }
      }
      return {
        compatibility: path === roleArtifactPath(ticketId, role) ? "current" : "legacy",
        path,
        role,
      }
    })
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

export function relayRoleArtifactBoundaryFindings(
  role: MultiAgentRole,
  path: string,
  content: string,
): readonly RelayRoleBoundaryFinding[] {
  const text = normalizeArtifactText(content)
  const rules = ROLE_RULES[role]
  if (text.length === 0) {
    return [
      {
        id: "role-artifact-missing-required-evidence",
        message: rules.requiredReason,
        path,
        role,
        severity: "info",
      },
    ]
  }
  if (includesAny(text, rules.forbiddenAny)) {
    return [
      {
        id: "role-boundary-forbidden-claim",
        message: rules.forbiddenReason,
        path,
        role,
        severity: "warning",
      },
    ]
  }
  if (!includesAny(text, rules.requiredAny)) {
    return [
      {
        id: "role-artifact-missing-required-evidence",
        message: rules.requiredReason,
        path,
        role,
        severity: "info",
      },
    ]
  }
  return []
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
