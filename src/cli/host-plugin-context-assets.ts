import { readNoFollowProjectFile } from "../io/no-follow-file.js"
import type { HostPluginDistributionTarget } from "./host-plugin-distribution.js"

const RUNTIME_PATH = "dist/context-delivery/portable-context-runtime.mjs"
const MATCHER = "^(Read|Edit|Write|MultiEdit|read|read_file|edit|edit_file|write|write_file|patch|apply_patch|applypatch|multiedit|multi_edit|functions\\.apply_patch)$"

export function buildHostPluginContextTargets(root: string): readonly HostPluginDistributionTarget[] {
  const runtime = readNoFollowProjectFile(root, RUNTIME_PATH, 512 * 1024)
  if (runtime.kind !== "ready" || runtime.value.bytes.length === 0) throw new Error("host-plugin-distribution-context-runtime")
  const setup = readNoFollowProjectFile(root, "dist/context-delivery/portable-context-setup.mjs", 512 * 1024)
  if (setup.kind !== "ready" || setup.value.bytes.length === 0) throw new Error("host-plugin-distribution-context-setup")
  return [
    { host: "codex", root: "packages/host-plugins/codex/plugins/persona-harness", variable: "PLUGIN_ROOT" },
    { host: "claude", root: "packages/host-plugins/claude", variable: "CLAUDE_PLUGIN_ROOT" },
  ].flatMap((layout) => [
    { relativePath: `${layout.root}/scripts/context-runtime.mjs`, nextBytes: runtime.value.bytes },
    { relativePath: `${layout.root}/scripts/context-setup.mjs`, nextBytes: setup.value.bytes },
    {
      relativePath: `${layout.root}/hooks/hooks.json`,
      nextBytes: Buffer.from(`${JSON.stringify({
        hooks: { SessionStart: [{ hooks: [{
          type: "command",
          command: `node "\${${layout.variable}}/scripts/context-runtime.mjs" --host ${layout.host}`,
          timeout: 10,
          ...(layout.host === "codex" ? { additionalContextLimit: 0 } : {}),
        }] }], PreToolUse: [{ matcher: MATCHER, hooks: [{
          type: "command",
          command: `node "\${${layout.variable}}/scripts/context-runtime.mjs" --host ${layout.host}`,
          timeout: 10,
          ...(layout.host === "codex" ? { additionalContextLimit: 0 } : {}),
        }] }] },
      }, null, 2)}\n`),
    },
  ])
}
