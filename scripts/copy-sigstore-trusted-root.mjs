import { copyFileSync, mkdirSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const source = resolve(root, "src/assets/github-sigstore-trusted-root.jsonl")
const destination = resolve(root, "dist/assets/github-sigstore-trusted-root.jsonl")

mkdirSync(dirname(destination), { recursive: true })
copyFileSync(source, destination)
