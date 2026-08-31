import { readFileSync, realpathSync, writeFileSync } from "node:fs"
import { join } from "node:path"

import {
  createInitManifest,
  serializeInitManifest,
  sha256Bytes,
  sha256Text,
} from "../src/cli/init-manifest.js"

export function writeManagedInitFixture(projectDir: string): void {
  const harnessPath = join(projectDir, ".persona", "harness.jsonc")
  const manifest = createInitManifest(
    {
      name: "persona-harness",
      version: "0.10.0-test",
      templateDigest: sha256Text("persona-harness-test-template"),
    },
    {
      realPath: realpathSync(projectDir),
      profileDigest: null,
    },
    [{
      path: ".persona/harness.jsonc",
      owner: "persona-harness",
      marker: "ph-init-owned-v1",
      digest: sha256Bytes(readFileSync(harnessPath)),
    }],
  )
  writeFileSync(join(projectDir, ".persona", ".ph-init-manifest.json"), serializeInitManifest(manifest))
}
