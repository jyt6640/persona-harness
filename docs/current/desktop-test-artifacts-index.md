# Desktop Test Artifacts Index

This document is the single maintained index for Persona Harness test artifacts collected under `/Users/yongtae/Desktop/persona-harness-artifacts`.

It does not approve deletion by itself. Use it to understand what each artifact was for, whether it still matters, and what should happen before any future cleanup.

Snapshot date: 2026-06-21

## Policy

- Keep future clean-run and smoke-test artifacts recorded here.
- Do not create another root-level Desktop test folder for Persona Harness runs; put future artifacts under `/Users/yongtae/Desktop/persona-harness-artifacts`.
- Mark delete candidates here first; delete only after a separate explicit cleanup decision.
- Keep generated code, `.persona/evidence`, and OpenCode config as local evidence, not as Git-tracked project content.

## Primary Artifacts

| Path | Kind | Observed contents | Current value | Status |
| --- | --- | --- | --- | --- |
| `/Users/yongtae/Desktop/persona-harness-artifacts/smoke/persona-opencode-demo` | OpenCode/plugin smoke | `package.json`, `.persona`, `.opencode`; no Java app; no evidence files | Useful for checking whether local install/init created the plugin surface | Keep as smoke reference |
| `/Users/yongtae/Desktop/persona-harness-artifacts/smoke/persona-v030-alpha1-published-fresh-install` | v0.3.0-alpha.1 published install smoke | npm-installed `persona-harness@alpha`, `.persona`, `.opencode`; stale implementation-first `ph init` output observed | Negative fresh-install evidence in `docs/evidence-reviews/v0.3.0-alpha2-fresh-install-smoke.md`; use to explain why alpha.2 is needed | Keep until alpha.2 publish validation |
| `/Users/yongtae/Desktop/persona-harness-artifacts/smoke/persona-v030-alpha2-tarball-fresh-install` | v0.3.0-alpha.2 tarball install smoke | tarball-installed `0.3.0-alpha.2`, `.persona`, `.opencode`, workflow plan, README bootstrap evidence | Positive external tester workflow smoke in `docs/evidence-reviews/v0.3.0-alpha2-fresh-install-smoke.md` | Keep as alpha.2 candidate evidence |
| `/Users/yongtae/Desktop/persona-harness-artifacts/generated-apps/persona-real-demo` | Early real generated app | Gradle Spring app, `.persona`, `.opencode`, 4 evidence files, 33 Java main files | Included in `docs/evidence-reviews/generated-demo-quality-synthesis.md` as historical baseline | Keep until cleanup decision |
| `/Users/yongtae/Desktop/persona-harness-artifacts/generated-apps/persona-real-demo-2` | Repeated generated app | Gradle Spring app, `.persona`, `.opencode`, 13 evidence files, 48 Java main files | Included in `docs/evidence-reviews/generated-demo-quality-synthesis.md` as repository-boundary warning sample | Keep until cleanup decision |
| `/Users/yongtae/Desktop/persona-harness-artifacts/generated-apps/persona-real-demo-3` | Repeated generated app | Gradle Spring app, `.persona`, `.opencode`, 21 evidence files, 52 Java main files | Included in `docs/evidence-reviews/generated-demo-quality-synthesis.md` as improved repository-boundary sample | Keep until cleanup decision |
| `/Users/yongtae/Desktop/persona-harness-artifacts/generated-apps/persona-real-demo-4` | Repeated generated app | Gradle Spring app, `.persona`, `.opencode`, 47 evidence files, 18 Java main files | Included in `docs/evidence-reviews/generated-demo-quality-synthesis.md` as small library app sample | Keep until cleanup decision |
| `/Users/yongtae/Desktop/persona-harness-artifacts/generated-apps/persona-real-demo-5` | Repeated generated app | Gradle Spring app, `.persona`, `.opencode`, 48 evidence files, 19 Java main files | Included in `docs/evidence-reviews/generated-demo-quality-synthesis.md` as stronger class-based domain sample | Keep until cleanup decision |
| `/Users/yongtae/Desktop/persona-harness-artifacts/generated-apps/persona-v021-quality-check` | v0.2.1 clean project quality check | Gradle Spring app, `.persona`, `.opencode`, 143 evidence files, 36 Java main files | Included in `docs/evidence-reviews/generated-demo-quality-synthesis.md` and existing v0.2.1 quality review | Keep |
| `/Users/yongtae/Desktop/persona-harness-artifacts/generated-apps/persona-v021-quality-check-course` | v0.2.1 course-style quality check | Gradle Spring app, `.persona`, `.opencode`, 31 evidence files, 37 Java main files | Included in `docs/evidence-reviews/generated-demo-quality-synthesis.md` as strongest domain behavior sample | Keep |
| `/Users/yongtae/Desktop/persona-harness-artifacts/generated-apps/persona-v030-domain-behavior-check` | v0.3.0-alpha.1 domain behavior clean generation | Gradle Spring app, `.persona`, `.opencode`, 4 evidence files, 36 Java main files | Positive domain behavior review in `docs/evidence-reviews/v0.3.0-domain-behavior-clean-generation-review.md` | Keep |
| `/Users/yongtae/Desktop/persona-harness-artifacts/generated-apps/persona-v030-bearshell-guidance-check` | v0.3.0-alpha.1 bearshell guidance clean generation | Gradle Spring app, `.persona`, `.opencode`, 15 evidence files, 37 Java main files | Positive command-surface review in `docs/evidence-reviews/v0.3.0-bearshell-guidance-clean-generation-review.md`; Gradle/test/build/bootRun used `npx ph bearshell` | Keep |

## Design And Backup Artifacts

| Path | Kind | Observed contents | Current value | Status |
| --- | --- | --- | --- | --- |
| `/Users/yongtae/Desktop/persona-harness-artifacts/notes/harness-v1.0.md` | Early design note | Single 36 KB Markdown file | Historical design input; should be summarized before deletion | Keep until summarized |
| `/Users/yongtae/Desktop/persona-harness-artifacts/backups/persona-harness-omo-git-backup-20260617164945` | Backup | 51 MB folder; no `.persona`, `.opencode`, or Java app markers | Backup from the OMO/git transition period; not an active test artifact | Review before cleanup |

## Reference Repositories

These are adjacent references, not Persona Harness test artifacts:

| Path | Reason |
| --- | --- |
| `/Users/yongtae/Desktop/persona-harness` | Main working repository |
| `/Users/yongtae/Desktop/oh-my-openagent-dev` | OMO reference repository |
| `/Users/yongtae/Desktop/blackBear` | Separate project/reference area |
| `/Users/yongtae/Desktop/blackBear-local-agent-orchestration` | Separate project/reference area |

## Maintenance Checklist

When a new test artifact is created:

1. Add the absolute path to the relevant table.
2. Record the run purpose, package/install mode, model, and whether `.persona/evidence` was produced.
3. Record whether the artifact is a quality baseline, smoke check, failed run, or cleanup candidate.
4. If the artifact produces a written review, link that review from the row.
5. Do not delete the artifact until this document says why it is safe to delete and the cleanup has been explicitly approved.

## Cleanup Candidates

No artifact is approved for deletion yet.

Recommended next cleanup loop:

1. Decide which generated apps remain as golden/local regression references after `docs/evidence-reviews/generated-demo-quality-synthesis.md`.
2. Summarize `harness-v1.0.md` if it still contains useful design decisions.
3. Delete only explicitly approved throwaway runs.
