# shared-skills — Cross-Harness SKILL.md Bundle (Skills)

**Generated:** 2026-06-19

## OVERVIEW

Hand-authored, cross-harness skill bundle shared between the OpenCode and Codex editions, pruned for Persona Harness. Pure data — no logic, no transform inside the package. The only code is `index.mjs`, which exports `sharedSkillsRootPath()` returning the absolute path to `skills/`. Package: `@oh-my-opencode/shared-skills` (`files`: `index.mjs`, `index.d.ts`, `skills`).

## SKILLS (14 under `skills/<name>/`)

Active auto-routed skills:

- `programming`
- `frontend`

Inactive vendored skills:

- `debugging`
- `visual-qa`
- `ast-grep`
- `git-master`
- `refactor`
- `review-work`
- `start-work`
- `ulw-plan`
- `ultraresearch`
- `init-deep`
- `remove-ai-slops`
- `lsp-setup`

Removed Persona Harness exclusions:

- `lcx-report-bug`
- `lcx-contribute-bug-fix`
- `lcx-doctor`

Per-skill layout: `SKILL.md` (YAML frontmatter `name:` + single-line `description:` with triggers) + optional `references/` (the real content; SKILL.md is a router/index) + optional `scripts/` + optional `fixtures/` for regression samples + optional `agents/openai.yaml` (3 skills carry the Codex agent role declaration).

## PIPELINE

```
skills/ (source)
  ├─ build:shared-skills-assets (root) → cp -R skills dist/skills          # literal copy, no transform
  ├─ skills-loader-core → loadSkillsFromDir(sharedSkillsRootPath(), scope:"shared")   # OpenCode runtime
  └─ omo-codex/plugin/scripts/sync-skills.mjs → plugin/skills/             # copy + adaptSkillForCodex()
        (inserts Codex Harness Tool Compatibility sections; overlays start-work/review-work;
         filters out *.test.* ) → ships to ~/.codex/.../skills/
```

## CONSUMERS

- `skills-loader-core` (`workspace:*`) — default `skillsRootPath` for builtin/shared skill loading.
- `omo-opencode/src/cli/install-ast-grep-sg.ts` — finds the ast-grep skill dir for binary install.
- `omo-codex/plugin` (`file:` dep) — `sync-skills.mjs` is the only transformer.

## NOTES

- **No generator builds the skills** — they are authored by hand; the build step is a plain `cp -R`.
- **Test files (`*.test.ts/.mjs`) are excluded** when Codex copies skills.
- **`lcx-` skills are intentionally removed** from Persona Harness because they route LazyCodex/Codex maintenance workflows, not this project's backend/frontend/infra harness behavior.
- **Inactive vendored skills stay off automatic routing** until the Persona-specific adapter explicitly promotes one.
- **Packaging is pinned** by `omo-opencode/src/shared-skills-package.test.ts` (workspace inclusion + `files` entries + every skill parses).
- Parent: [`packages/AGENTS.md`](../AGENTS.md).
