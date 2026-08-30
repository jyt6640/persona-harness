# Bootstrap Intake And Workflow History

Use this when `npx ph bootstrap backend` or `npx ph attach --repair --yes`
stops during workspace intake, or when implementation/review reports exist but
the workflow history does not explain whether Finish can proceed.

Run the read-only diagnostic first:

```bash
npx ph workflow diagnose
```

It never runs bootstrap, repair, history archive, Finish, or a verification
command. It does not expose project paths, manifest contents, report contents,
or archive names.

## Decision Tree

| `Workspace intake`     | Meaning                                                                        | Safe next step                                                                                                                                  |
| ---------------------- | ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `clean-uninitialized`  | No `.persona` workspace state is present.                                     | Run the one displayed command: `npx ph bootstrap backend`.                                                                                      |
| `owned-ready`          | The manifest, profile binding, and owned files still match.                    | Read the active-plan/report fields below; do not infer Finish authority from this result.                                                       |
| `foreign-stale-unsafe` | A managed file diverged, an owned boundary is incomplete, or a path is unsafe. | Stop. Do not retry repair, overwrite files, follow symlinks, or create a new history archive. Preserve the state and decide its owner manually. |
| `invalid`              | The ownership manifest is malformed or fails its bounded schema check.         | Stop. Do not retry repair or rewrite the manifest. Preserve it for a deliberate recovery decision.                                              |
| `absent`               | The requested workspace is no longer a usable directory.                       | Run the command from the intended project directory.                                                                                            |

`attach --repair --yes` is only for a recognized weak installation. When its
staging bootstrap stops, it now points to this diagnostic instead of telling
you to repeat the same repair command. The failed repair does not overwrite the
original project state.

A pre-existing `.persona` directory without a valid ownership manifest is not
treated as clean. It is `foreign-stale-unsafe`, even when it looks incomplete
rather than malicious, because automatically bootstrapping over it could turn
an ownership conflict into a harder-to-recover workspace.

## Workflow Artifacts And Finish

`Active plan`, `Implementation report`, and `Review report` describe the live
workflow files. `Workflow history archives: present` only means that at least
one retained archive exists. It is **diagnostic-only**: it cannot restore a
missing active plan, create reports, or grant Finish authority.

`Source-read prerequisite: blocked` means the current runtime could not reserve
the source-read boundary that Finish needs. It is a current prerequisite check,
not evidence that a prior Finish command reached any particular verifier. Do
not use the diagnostic as a substitute for `workflow finish implement` or as a
reason to claim completion.

## What This Does Not Do

- It does not delete stale generated files or rewrite ownership metadata.
- It does not repair a foreign absolute path, migrate history, or infer a
  replacement workspace.
- It does not read an external authority receipt, access credentials, or change
  Finish/replay semantics.

That restraint is deliberate: when intake ownership is unclear, the safe action
is to classify and preserve the state rather than make the workspace look ready.
