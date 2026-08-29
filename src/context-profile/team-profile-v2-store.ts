import { stripJsonComments } from "../config/jsonc.js"
import { readNoFollowProjectFile } from "../io/no-follow-file.js"
import {
  parseTeamProfileV2,
  TeamProfileV2ValidationError,
  type TeamProfileV2,
  type TeamProfileV2ValidationCode,
} from "./team-profile-v2-model.js"

export { toTeamContextLayerV2, type TeamContextLayerV2 } from "./team-profile-v2-model.js"

export const TEAM_PROFILE_V2_PATH = ".persona/team-profile.jsonc" as const
const MAX_TEAM_PROFILE_V2_BYTES = 64 * 1_024

export type TeamProfileV2Diagnostic = TeamProfileV2ValidationCode
  | "team-profile-v2-invalid-json"
  | "team-profile-v2-unsafe-path"
  | "team-profile-v2-unreadable"

export type TeamProfileV2LoadResult =
  | { readonly status: "missing"; readonly diagnostics: readonly [] }
  | { readonly status: "invalid"; readonly diagnostics: readonly [TeamProfileV2Diagnostic] }
  | { readonly status: "available"; readonly diagnostics: readonly []; readonly profile: TeamProfileV2 }

export function loadTeamProfileV2(projectDir: string): TeamProfileV2LoadResult {
  const read = readNoFollowProjectFile(projectDir, TEAM_PROFILE_V2_PATH, MAX_TEAM_PROFILE_V2_BYTES)
  if (read.kind === "absent") return { diagnostics: [], status: "missing" }
  if (read.kind === "blocked") {
    return {
      diagnostics: [read.code === "unsafe" || read.code === "replaced" ? "team-profile-v2-unsafe-path" : "team-profile-v2-unreadable"],
      status: "invalid",
    }
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(stripJsonComments(read.value.bytes.toString("utf8")))
  } catch {
    return { diagnostics: ["team-profile-v2-invalid-json"], status: "invalid" }
  }
  try {
    return { diagnostics: [], profile: parseTeamProfileV2(parsed), status: "available" }
  } catch (error) {
    const code = error instanceof TeamProfileV2ValidationError ? error.code : "team-profile-v2-invalid-schema"
    return { diagnostics: [code], status: "invalid" }
  }
}
