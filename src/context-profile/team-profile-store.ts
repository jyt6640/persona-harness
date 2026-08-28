import { readNoFollowProjectFile } from "../io/no-follow-file.js"
import {
  parseTeamProfile,
  TeamProfileValidationError,
  type TeamProfile,
  type TeamProfileValidationCode,
} from "./team-profile-model.js"

export { toTeamContextRules } from "./team-profile-model.js"

export const TEAM_PROFILE_PATH = ".persona/team-profile.json" as const
const MAX_TEAM_PROFILE_BYTES = 64 * 1_024

export type TeamProfileDiagnostic = TeamProfileValidationCode | "team-profile-invalid-json" | "team-profile-unsafe-path" | "team-profile-unreadable"

export type TeamProfileLoadResult =
  | { readonly status: "missing"; readonly diagnostics: readonly [] }
  | { readonly status: "invalid"; readonly diagnostics: readonly [TeamProfileDiagnostic] }
  | { readonly status: "available"; readonly diagnostics: readonly []; readonly profile: TeamProfile }

export function loadTeamProfile(projectDir: string): TeamProfileLoadResult {
  const read = readNoFollowProjectFile(projectDir, TEAM_PROFILE_PATH, MAX_TEAM_PROFILE_BYTES)
  if (read.kind === "absent") return { diagnostics: [], status: "missing" }
  if (read.kind === "blocked") return { diagnostics: [read.code === "unsafe" || read.code === "replaced" ? "team-profile-unsafe-path" : "team-profile-unreadable"], status: "invalid" }
  let parsed: unknown
  try {
    parsed = JSON.parse(read.value.bytes.toString("utf8"))
  } catch {
    return { diagnostics: ["team-profile-invalid-json"], status: "invalid" }
  }
  try {
    return { diagnostics: [], profile: parseTeamProfile(parsed), status: "available" }
  } catch (error) {
    const code = error instanceof TeamProfileValidationError ? error.code : "team-profile-invalid-schema"
    return { diagnostics: [code], status: "invalid" }
  }
}
