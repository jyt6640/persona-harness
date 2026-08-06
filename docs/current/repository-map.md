# Repository Map

Where things live and why, derived from the actual import graph rather than
from intent. `src/cli` holds 218 files in one flat directory; the naming
convention already encodes the structure, and this document makes it readable
without moving anything.

Regenerate the figures before relying on them — they move with every release.

## Areas

| area | files | lines | role |
| --- | ---: | ---: | --- |
| `src/` | 297 | 51,906 | the product |
| `tests/` | 306 | 61,463 | vitest suites, 1:1.2 against source |
| `packages/` | 356 | 62,043 | optional MCP servers and shared skills |
| `scripts/` | 170 | 26,447 | release, verification, and acceptance tooling |
| `docs/` | 401 | 62,390 | current, archive, releases, evidence reviews |
| `.github/` | 35 | 3,442 | 11 workflows plus custom actions |

`.persona/` is excluded above: it is the harness's own dogfooding workspace, and
most of it is generated evidence rather than authored source.

## Entry points

| entry | target |
| --- | --- |
| `ph`, `persona-harness` (bin) | `dist/cli/index.js` |
| `main` / `exports` | `dist/index.js` — the OpenCode plugin |
| `ph-codegraph-mcp` (bin) | `packages/codegraph-mcp/bin/codegraph-mcp.mjs` |
| `ph-lsp-mcp` (bin) | `packages/lsp-mcp/bin/lsp-mcp.mjs` |

Two separate surfaces share one package: the **CLI** (`src/cli` → `dist/cli`) and
the **plugin** (`src/runtime` → `dist/index.js`). They meet only through
`src/config` and the evidence store.

## `src/` layout

| directory | files | lines | what it is |
| --- | ---: | ---: | --- |
| `cli/` | 218 | 37,336 | every `ph` subcommand and the machinery behind it |
| `runtime/` | 46 | 6,584 | the OpenCode plugin: hooks, injection, evidence writers |
| `io/` | 8 | 3,803 | bounded, no-follow filesystem primitives |
| `observer/` | 9 | 1,750 | text-based Java role observers |
| `config/` | 6 | 1,223 | harness config, conventions registry, project profile |
| `rules/` | 8 | 1,195 | rule pack loading, frontmatter, delivery |

The Java detection engine is `observer/` + `rules/` + `.persona/conventions/`
(AST rules) — 2,945 lines, roughly 6% of `src/`.

## `src/cli` clusters

One flat directory, but the filenames group cleanly. Sorted by size:

| cluster | files | lines |
| --- | ---: | ---: |
| `workflow-*` (core) | 23 | 4,519 |
| `evidence-*` | 12 | 3,113 |
| `project-finish-attestation-*` | 17 | 2,050 |
| `workflow-semantic-tdd-*` | 11 | 1,689 |
| `go-*` | 11 | 1,441 |
| `init-*` | 8 | 1,427 |
| `ci-reverification-*` | 8 | 1,427 |
| Java verification (`junit-*`, `cooperative-*`) | 5 | 1,363 |
| `*-verification` (fresh, closure, source-identity) | 5 | 1,362 |
| `doctor-*` | 8 | 1,359 |
| `authority-*` | 10 | 1,326 |
| `bootstrap-*` | 6 | 1,295 |
| `workflow-finish-attestation-*` | 9 | 1,239 |
| `workflow-verification-*` | 6 | 1,224 |
| `workflow-ticket*` | 4 | 1,219 |
| `staged-package-*` | 10 | 1,161 |
| `plan*` | 5 | 1,080 |
| `workflow-closure-*` | 4 | 1,010 |
| conventions (`convention-*`, `ast-grep-*`, `spring-*`) | 7 | 953 |
| shape (`backend-shape-*`, `stack-alignment-*`) | 4 | 836 |
| exec (`bearshell*`, `bounded-*`) | 4 | 758 |
| `workflow-relay-*` | 4 | 672 |
| `workflow-loop*` | 3 | 653 |
| `attach-*` | 6 | 594 |
| `intake*` | 2 | 580 |
| `java-role-*` | 1 | 309 |
| unclustered | 25 | 2,895 |

Two clusters dominate: workflow (about 11,000 lines across core, closure,
tickets, loop, relay, semantic-TDD, verification) and authority/release (about
7,000 across the two attestation families, staged packages, and
CI re-verification).

## How the clusters depend on each other

Strongest cross-cluster edges, counted from real imports:

| from | to | imports |
| --- | --- | ---: |
| `workflow-semantic-tdd` | `workflow-verification` | 15 |
| `workflow` (core) | `workflow-closure` | 14 |
| `plan` | `workflow` (core) | 12 |
| unclustered | exec | 11 |
| `workflow-closure` | `workflow` (core) | 11 |
| `project-finish-attestation` | `workflow-finish-attestation` | 10 |
| `workflow-semantic-tdd` | `*-verification` | 9 |

`workflow` (core) and `workflow-closure` import each other, which is the one
genuinely circular pair. Everything else flows one way.

The most-imported single modules across all of `src` are
`config/harness-config.ts` (56), `cli/bearshell.ts` (48), and `config/jsonc.ts`
(39) — the three real hubs.

## Why the directory is still flat

Moving these files is a mechanical change with a wide blast radius:

- 683 relative imports inside `src/cli`
- 129 test files importing `src/cli/...` directly
- `bin` points at `dist/cli/index.js`, so the built layout is part of the
  package contract
- `package.json` `files` and `package-files-policy.test.ts` assert packaged
  paths

That is roughly 800 mechanical edits in one diff, unreviewable in practice, with
the package entry point at risk if any of it is wrong. The clusters above are
the plan for doing it later; this document is the map for working in it now.

## Related

- `docs/current/external-environment-verification.md` — verifying the packaged
  surface on another machine
- `docs/current/docs-inventory.md` — what every document under `docs/` is for
