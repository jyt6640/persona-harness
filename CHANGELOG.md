# Changelog

All notable Persona Harness changes are recorded here.

This project uses npm prerelease versions for tester-facing alpha and release-candidate builds. Verify `latest`, `next`, and `alpha` before treating a default install as current. Stable support guarantees are still deferred.

## Unreleased

- Added read-only `ph evidence pminus-status [--json]` as a local
  surface/tool-level P-minus decision-support aggregation. It reads local A/B
  and P-minus evidence, emits schema `evidence-pminus-status.1`, and summarizes
  by `surface.id`: outcome counts, decision-hint counts, latest decision
  hints/evidence file, provider-token telemetry coverage, default-state summary,
  scenario ids, and recommended next action wording. The recommended actions are
  review hints only, including `keep gathering`, `keep opt-in`,
  `downgrade candidate`, `remove-candidate`, `no-claim`, and
  `needs larger A/B`.
  QA and External accepted the local/current tarball package-runtime surface for
  `6d0dd081f5e454ea2f3694558a8cc22c1a107d2d`; registry evidence remains NO-GO
  until a future publish includes that gitHead:
  - archive:
    `/Users/yongtae/Desktop/persona-harness-artifacts/archive/2026-06-24-desktop-persona-runs/pminus-status-tarball-6d0dd08-20260702T025253Z`;
  - tarball shasum: `b9cab81500323a40be452bba99d5cf905d1274cf`;
    sha256:
    `04b569089b3c29ccde5bd18c506f1919edfb3d37b2fe726338507b32a34a87c7`;
  - package entries included `dist/cli/evidence-pminus-status.js`,
    `dist/cli/evidence-pminus-report.js`, `dist/cli/evidence-ab-run.js`,
    `dist/cli/evidence-ab-run-options.js`, and
    `dist/cli/evidence-ab-report.js`;
  - `ph evidence pminus-status --help`, `ph evidence pminus-status --json`,
    and human `ph evidence pminus-status` exited 0;
  - seven packaged `ph evidence ab-run` fixture records exited 0 and wrote
    expected A/B evidence;
  - generated local A/B evidence from packaged `ab-run` was consumed by
    `ab-report`, `pminus-report`, and `pminus-status`;
  - mixed CodeGraph evidence produced defaultState `mixed`, provider telemetry
    `available`, outcomes `improved=1` and `worse=1`, latest hint
    `remove-candidate`, and recommended next action `downgrade candidate`;
  - opt-in LSP no-improvement evidence produced provider telemetry
    `available`, hint `keep-opt-in`, and recommended next action
    `keep opt-in`;
  - unknown/missing telemetry evidence produced provider telemetry `missing`,
    hint `no-claim`, and recommended next action `no-claim`;
  - `pminus-status` wrote no files; `ab-run` wrote only expected
    `.persona/evidence/ab/` evidence; there was no report artifact,
    `.persona/harness.jsonc`, `.persona/workflow`, or
    `.persona/instructions/adopted.json` mutation.
  This remains local/current tarball package-runtime evidence for read-only
  decision support only, not registry evidence, token-saving/provider-token
  saving, product-efficacy/navigation-benefit, app-quality/full-TDD/test
  sufficiency, CodeGraph/LSP default/effectiveness, broad reliability, closure
  guarantee, Codex support, code-nav replacement, or automatic
  downgrade/removal evidence. QA recommends the next work move to actual
  measurement/evidence execution rather than additional CLI surface expansion.
- Accepted an actual P-minus A/B evidence probe archive as evidence/probe
  acceptance only, not product source, package, release, or effectiveness
  evidence. The run used the existing `ph evidence ab-run` path to create
  exactly six PH-generated `persona-ab-measurement.1` records for a controlled
  TDD completion-integrity fixture, then captured `ab-report`, `pminus-report`,
  and `pminus-status` outputs:
  - archive:
    `/Users/yongtae/Desktop/persona-harness-artifacts/archive/2026-06-24-desktop-persona-runs/pminus-tdd-completion-integrity-20260702-115936`;
  - required files were present: `RESULT.md`, `ab-report.json/.txt`,
    `pminus-report.json/.txt`, `pminus-status.json/.txt`, and raw `ab-run`
    stdout/stderr;
  - JSON schemas parsed as `evidence-ab-report.1`,
    `evidence-pminus-report.1`, and `evidence-pminus-status.1`; each scanned
    six files with zero unreadable;
  - all six records were under
    `workspace/.persona/evidence/ab/tdd-completion-integrity/`, had
    `source="ph evidence ab-run"`, and their raw stdout recorded
    `A/B evidence written`;
  - OFF condition records were 3/3 `finishStatus=pass`,
    `blockedInvalidCompletion=false`, outcome `invalid-completion-permitted`;
  - ON condition records were 3/3 `finishStatus=blocked`,
    `blockedInvalidCompletion=true`, outcome `invalid-completion-blocked`;
  - provider-token telemetry was honestly absent/null, and downstream reports
    marked provider telemetry `missing`;
  - `pminus-report` compared `off -> on` for scenario
    `tdd-completion-integrity`, outcome `improved`, decision hint `keep`,
    reason `ON condition blocked invalid completion while OFF did not.`;
  - `pminus-status` reported surface `tdd`, default state `opt-in`, outcomes
    `improved=1`, latest hint `keep`, provider telemetry `missing`, and
    recommended next action `keep gathering`;
  - disposable workspace writes were limited to expected
    `.persona/evidence/ab/tdd-completion-integrity/*.json` files, with no
    `.persona/harness.jsonc`, `.persona/workflow`,
    `.persona/instructions/adopted.json`, or `.persona/evidence/tdd` side
    effects; repo worktree stayed clean/aligned at
    `e182ee5dc39da51c0caa4ac43a6b2260f72d8b16`.
  This proves the existing A/B evidence path can produce a non-empty P-minus
  decision/status for the controlled fixture. It did not generate TDD red/green
  evidence, was not a real Java/Spring red-to-green cycle, and is not evidence
  of token saving/provider-token saving, product efficacy/navigation benefit,
  app-quality/full-TDD/test-sufficiency, broad reliability, closure guarantee,
  automatic downgrade/removal, or any release action.
- Accepted two follow-up evidence/probe archives against repo/source metadata
  `4634d9a27d746db945a89d440c48f36beff99815` and package version
  `0.4.1-rc.2`; registry/dist-tags remained `latest=0.4.0`,
  `next=0.4.1-rc.2`, `alpha=0.3.9-alpha.8`, with no publish/tag/latest action:
  - P0 Java/Spring TDD red-to-green archive:
    `/Users/yongtae/Desktop/persona-harness-artifacts/archive/2026-06-24-desktop-persona-runs/p0-java-spring-tdd-red-green-20260702-122018`;
    PASS for this disposable Java/Gradle/JUnit fixture only, using strict
    `enforce.executeVerification=true` and `enforce.tdd=true`;
  - PH-generated red evidence path
    `.persona/evidence/tdd/req-1/red-2026-07-02T03-15-12-542Z.json` had schema
    `tdd-workflow.1`, status `red`, ticket `req-1`,
    `generatedBy=persona-harness`, `execution=ph-direct-gradle-junit`,
    command `./gradlew test`, exitCode `1`, and JUnit ref/snapshot/digest;
  - PH-generated green evidence path
    `.persona/evidence/tdd/req-1/green-2026-07-02T03-18-47-329Z.json` used the
    same ticket and testId
    `com.example.todo.TodoLogicTest#createsTodoThroughService()`, command
    `./gradlew test`, exitCode `0`, and JUnit ref/snapshot/digest;
  - JUnit snapshots supported the transition: red XML had one failure for
    expected `todo-created` versus `todo`, while green XML had zero
    failures/errors;
  - final statuses were `workflowTestRed=0`, `workflowCheckGreenRerun=0`,
    `workflowTddFinal=0`, `workflowArchiveFinal=0`, and
    `workflowFinishFinal=0`; final stdout included `State: passed`, archive
    moved `req-1` to history, and finish passed;
  - adversarial green-only/no-red fixture was accepted as blocked:
    `workflow test` exited 1 with already-green refusal, `workflow tdd` state
    was `red-missing`, and finish exited 1 with
    `tdd-red-evidence-missing` among expected fixture blockers;
  - P0 limitations: forged/stale/wrong-ticket adversarial cases were not run in
    this archive, and an intermediate green capture/archive/finish attempt had
    failure/UP-TO-DATE nuance before the accepted final rerun evidence;
  - Agent-session A/B pilot archive:
    `/Users/yongtae/Desktop/persona-harness-artifacts/archive/2026-06-24-desktop-persona-runs/agent-session-ab-pilot-20260702-122327`;
    PARTIAL underpowered negative pilot evidence only, using actual OpenCode
    Java calculator bugfix sessions with paired `n=2`, counterbalanced order
    `pair1 off->on` and `pair2 on->off`, isolated HOME/XDG dirs, and final
    `./gradlew test` exit 0 as success criterion;
  - OFF and ON both succeeded 2/2. Mean provider-token total was OFF 57,870
    versus ON 109,769; mean elapsed was OFF 30,585ms versus ON 59,890ms; mean
    read chars were OFF 1,356.5 versus ON 18,355; mean tool calls were OFF 7
    versus ON 10;
  - paired deltas were worse for PH ON in both pairs: token total +25,946 and
    +77,852; elapsed +21,089ms and +37,521ms; read chars +14,377 and +19,620;
    tool calls +3 and +3;
  - four `persona-ab-measurement.1` records under
    `report-workspace/.persona/evidence/ab/agent-session-java-calculator-fix/`
    populated providerTokens, readChars, and toolCalls; `ab-report.json`,
    `pminus-report.json`, and `pminus-status.json` parsed as
    `evidence-ab-report.1`, `evidence-pminus-report.1`, and
    `evidence-pminus-status.1`, each scanning four files with zero unreadable;
  - `pminus-report` outcome was `worse`, decision hint `remove-candidate`,
    reason `Candidate condition has higher measured provider-token total in
    this scenario.`; `pminus-status` reported surface `ph-runtime-injection`,
    outcome `worse=1`, provider telemetry `available`, and recommended next
    action `remove-candidate`;
  - statistical limitation: `n=2` is too small for significance, with no
    confidence interval/significance claim.
  These are evidence/probe records only, not product source, package, release,
  app-quality, full-TDD/test-sufficiency, broad reliability, closure guarantee,
  token-saving/provider-token saving, product-efficacy/navigation-benefit,
  CodeGraph/LSP default/effectiveness, Codex/code-nav replacement, automatic
  downgrade/removal, or release-action evidence. The Agent A/B negative result
  is valid P-minus input, not an automatic removal action.
- Accepted a local-current acceptance run plus a 10-pair OpenCode PH OFF/ON A/B
  evidence archive as scoped evidence/probe records against source
  `1563a25ca5bbddcaf3d63e7f5e7e73d61b9b718d` and package version
  `0.4.1-rc.2`; registry remained unchanged at `latest=0.4.0`,
  `next=0.4.1-rc.2`, `alpha=0.3.9-alpha.8`, with no product source, package,
  publish, tag, or latest action:
  - archive:
    `/Users/yongtae/Desktop/persona-harness-artifacts/archive/2026-06-24-desktop-persona-runs/local-current-acceptance-ab-20260702-20260702-153213`;
  - local-current tarball `package/persona-harness-0.4.1-rc.2.tgz` had npm
    shasum/sha1 `d8a5f85b5b7ce98c73fef547b99a941509bba518`, sha256
    `406f86348b9eac20c612030400a1065f9765a8d3322f04462b4e9f535076f00c`,
    entryCount `522`, and integrity
    `sha512-CuiodvOwtLyRdOcLB1S9r/fp9BkhFl5QoOl0TPjx+tpVlXQA8a59n6OadDMgdc4A01WU2EGRWrNV3HvioVfsvA==`;
  - `acceptance-summary.json` parsed as schema
    `persona-acceptance-checklist.1`, with PASS 49, N.A 5, FAIL 0;
  - accepted N.A items were B8 full B loop not separately run, F2/F3 runtime
    injection/system-prompt internals not deterministically observable from
    package-surface logs, F4 hook-error isolation not forced in package
    acceptance, and I3 compaction opt-in not triggered/forced;
  - verification commands exited 0 for typecheck, full npm test, build,
    `smoke:product-mvp`, `check:docs`, `check:injection-value`, npm pack
    dry-run, and git diff check; archived final git status was clean/aligned;
  - A/B summary schema `persona-agent-session-ab.1` covered 10 paired tasks and
    20 OpenCode app-generation sessions, with concurrency cap 2,
    pair-internal sequential execution, and counterbalanced order 5 OFF->ON and
    5 ON->OFF;
  - each pair used the same prompt and README hash, README sha256
    `35dbcd343428d9de73fbfabb9c76c35334755e8996bd48c0441eb8fadac30f1c`;
  - `partial-results.json` had 20 records, 10 `ph-off` and 10 `ph-on`,
    badCount 0, no discarded failures, and all OpenCode and verification exits
    0;
  - 20 `persona-ab-measurement.1` records were written under
    `agent-ab-10/report-workspace/.persona/evidence/ab/opencode-app-generation/`;
    `ab-report.json`, `pminus-report.json`, and `pminus-status.json` parsed as
    `evidence-ab-report.1`, `evidence-pminus-report.1`, and
    `evidence-pminus-status.1`, each scanning 20 files with zero unreadable;
  - success was OFF 10/10 and ON 10/10;
  - means were provider total OFF `119,320.7` versus ON `712,935.8`, elapsed
    OFF `51,261.7ms` versus ON `152,525.5ms`, read chars OFF `1,152.7` versus
    ON `20,650`, tool calls OFF `15.4` versus ON `38.9`, and MCP calls both
    `0`;
  - all 10 provider total, read char, tool call, and elapsed paired deltas were
    positive for PH ON; MCP deltas were zero;
  - independent sign check was two-sided `p≈0.00195` for provider total, read
    chars, tool calls, and elapsed, with elapsed carrying a concurrency/noisy
    timing caveat;
  - narrow accepted interpretation: PH ON increased measured provider-token
    totals, read chars, and tool calls in this OpenCode app-generation fixture
    set. Elapsed also increased in all pairs but remains timing/contention
    noisy;
  - `pminus-report` scenario `opencode-app-generation` had outcome `worse`,
    hint `remove-candidate`, and reason `Candidate condition has higher
    measured provider-token total in this scenario.`; `pminus-status` surface
    `ph-runtime-injection` had outcome `worse=1`, provider telemetry
    `available`, and recommended next action `remove-candidate`;
  - all 20 runs had phase provider-token totals reconciling to run totals.
    Aggregate phase reporting excluded `injection/context`; per-run records had
    zero placeholders, but the aggregate limitation records that OpenCode did
    not expose transformed system prompt/injection-context cost separately and
    that cost remains embedded in classified model steps/unknown buckets.
  This is local-current acceptance and scoped negative A/B measurement evidence
  for this fixture/task set only. It supports P-minus review/decision support
  and does not prove token-saving/provider-token saving, product
  efficacy/navigation benefit, app-quality/full-TDD/test-sufficiency,
  CodeGraph/LSP default/effectiveness, broad reliability, closure guarantee,
  Codex/code-nav replacement, or automatic downgrade/removal.

## [0.4.1-rc.2] - 2026-07-02

- Published `0.4.1-rc.2` under `next` on the corrected `0.4.x` line and
  verified registry gitHead `bcb5f08cc7c0c99ac07ca3e93d04b3b35b7a1f70`,
  registry shasum `ab59b9d7e7689cdff6f997ae956edd2c3d3ab6b1`, and dist-tags
  `latest=0.4.0`, `next=0.4.1-rc.2`, `alpha=0.3.9-alpha.8`. Stable `latest`
  remains `0.4.0`; this release does not move `latest`.
- Created and pushed `v0.4.1-rc.2` only after registry gitHead/shasum
  verification; the local and remote tag point at
  `bcb5f08cc7c0c99ac07ca3e93d04b3b35b7a1f70`. The tag-triggered GitHub Release
  workflow succeeded, including GitHub release creation.
- Added explicit-write `ph evidence ab-run --scenario <id> --condition <id>
  -- <command>` as a local A/B evidence recording surface for P1/P-minus
  measurement runs. It writes scoped `persona-ab-measurement.1` records under
  `.persona/evidence/ab/<safe-scenario>/`, capturing the child command,
  `exitStatus`, `finishStatus`, elapsed time, stdout/stderr character counts,
  optional provider/read/tool/MCP telemetry, and null/unavailable telemetry when
  samples are absent. Child command failures are recordable evidence: the
  recorder can exit 0 after a successful evidence write while preserving the
  child exit status and failed finish status inside the record.
  QA and External accepted the local/current tarball package-runtime surface for
  `b02317cd3d276b4fe547dab57e51fbbdcef968fd` before the rc2 registry smoke:
  - archive:
    `/Users/yongtae/Desktop/persona-harness-artifacts/archive/2026-06-24-desktop-persona-runs/ab-evidence-runner-b02317c-20260702T020151Z`;
  - tarball shasum: `88d9bbc1841f9201c0020598dda9962af770f7c0`;
    sha256:
    `b953dc20a6d413bd4b966240daa60f3a53c1ff512d8a191186b40dc538f9261e`;
  - package entries `dist/cli/evidence-ab-run.js` and
    `dist/cli/evidence-ab-run-options.js` were present;
  - `ph --help` listed `evidence ab-run`, `ph evidence ab-run --help` exited
    0, and missing `--scenario`, `--condition`, or `--` separator exited 1
    with usage;
  - passing and failing child commands both wrote evidence under
    `.persona/evidence/ab/runner-demo/`; the failing child preserved
    `exitStatus=7` and `finishStatus=fail`;
  - generated evidence was consumed by `ab-report` as
    `evidence-ab-report.1` and by `pminus-report` as
    `evidence-pminus-report.1`, where the sample classified as
    `worse/downgrade` with provider telemetry `partial`;
  - mutation boundaries passed with only expected A/B evidence files written,
    no `.persona/harness.jsonc`, no `.persona/workflow` mutation, no
    `.persona/instructions/adopted.json`, and no `ab-report.md` or
    `pminus-report.md` artifact.
  This remains explicit local A/B evidence recording and downstream report
  compatibility only, not registry evidence, effect-size proof, token-saving or
  provider-token saving, product-efficacy/navigation-benefit, app-quality/full
  TDD/test-sufficiency, CodeGraph/LSP default/effectiveness, broad reliability,
  closure guarantee, Codex support, code-nav replacement, or automatic
  downgrade/removal evidence.

- Added read-only `ph evidence pminus-report [--json]` as a local evidence
  decision-support surface for P-minus/P1 A/B evidence. It reads structured
  `persona-ab-measurement.1` evidence and emits schema
  `evidence-pminus-report.1`, classifying scenarios as `improved`,
  `no-improvement`, `worse`, or `inconclusive` with hints such as `keep`,
  `keep-opt-in`, `downgrade`, `remove-candidate`, and `no-claim`.
  Provider-token telemetry is reported as available only when both compared
  sides have samples; missing telemetry remains missing rather than fabricated.
  The command is read-only: it writes no files, creates no report artifact,
  mutates no config or closure state, and does not automatically delete,
  downgrade, or remove surfaces.
  QA and External accepted the local/current tarball package-runtime surface for
  `29b532eea707ab843917a4835d8793a44c2cb82f` before the rc2 registry smoke:
  - archive:
    `/Users/yongtae/Desktop/persona-harness-artifacts/archive/2026-06-24-desktop-persona-runs/pminus-evidence-report-29b532e-20260702T013931Z`;
  - tarball shasum: `13305cf4988c404bf9b097721b78fb0f55b55f3b`;
    sha256:
    `6eca787158295efc140a281eb43956dab34bb4c781140a2b835540298e66c74c`;
  - package entry `dist/cli/evidence-pminus-report.js` was present;
  - `ph --help` and `ph evidence` listed `evidence pminus-report`;
  - `ph evidence pminus-report` and `--json` exited 0, while invalid extra
    args exited 1 with usage;
  - input evidence covered JSON array and JSONL `persona-ab-measurement.1`
    files;
  - observed outcomes/hints were `improved/keep`,
    `no-improvement/keep-opt-in`, `worse/downgrade`,
    `worse/remove-candidate`, and `inconclusive/no-claim`;
  - read-only boundaries passed with unchanged fixture file set, no
    `pminus-report.md` or other report artifact, no `.persona/harness.jsonc`,
    and no `.persona/workflow/closure.json`.
  This remains evidence/reporting/decision-support only, not registry evidence,
  token-saving/provider-token saving, product-efficacy/navigation-benefit,
  app-quality/full-TDD/test-sufficiency, CodeGraph/LSP default/effectiveness,
  broad reliability, closure guarantee, Codex support, or code-nav replacement
  evidence.
- External registry-only smoke installed `persona-harness@next` as
  `0.4.1-rc.2` and verified the registry package/runtime surface:
  - archive:
    `/Users/yongtae/Desktop/persona-harness-artifacts/archive/2026-06-24-desktop-persona-runs/rc041-rc2-registry-package-runtime-20260702T022527Z`;
  - package entries included `dist/cli/evidence-pminus-report.js`,
    `dist/cli/evidence-ab-run.js`, `dist/cli/evidence-ab-run-options.js`, and
    `dist/cli/evidence-ab-report.js`;
  - basic CLI help/version/init/doctor/bootstrap exited 0;
  - `ph evidence ab-run --help` exited 0 and invalid missing separator exited
    1;
  - passing and failing child `ab-run` commands both recorded evidence, and the
    recorder exited 0 when the evidence write succeeded;
  - `ph evidence ab-report --json` and `ph evidence pminus-report --json`
    exited 0 and consumed generated evidence;
  - published `ab-run` generated P-minus scenarios covering `improved/keep`,
    `no-improvement/keep-opt-in`, `worse/downgrade`,
    `worse/remove-candidate`, missing provider telemetry, and single-condition
    `inconclusive/no-claim`;
  - the failing child command recorded child exit 7 with no provider telemetry;
  - the runner scenario classified as `worse/downgrade` with provider telemetry
    `partial`;
  - report commands wrote no artifacts, `ab-run` wrote only expected
    `.persona/evidence/ab/<scenario>/` files, and there was no
    `.persona/harness.jsonc`, `.persona/workflow`, or
    `.persona/instructions/adopted.json` mutation.
  This is registry package/runtime smoke only: no latest move, token-saving or
  provider-token saving, product-efficacy/navigation-benefit,
  app-quality/full-TDD/test-sufficiency, CodeGraph/LSP default/effectiveness,
  broad reliability, closure guarantee, Codex support, code-nav replacement, or
  automatic downgrade/removal claim.

## [0.4.1-rc.1] - 2026-07-02

- Prepared `0.4.1-rc.1` as the next-channel release candidate after official
  `0.4.0`. This release candidate packages post-0.4.0 local/current accepted
  surfaces, including instruction inference/adoption/check preview,
  deterministic Spring bootJar and TDD adversarial hardening, A/B evidence
  reporting, and the CodeGraph default downgrade. It is published under `next`,
  not `latest`; stable `latest` remains `0.4.0` until a future explicit stable
  release decision.
- Corrected a superseded `0.5.0-rc.1` next-channel attempt back to the `0.4.x`
  version line. The `0.5.0-rc.1` package should not be treated as an accepted
  release milestone, QA/External target, or docs evidence record; the channel is
  restored by the verified `0.4.1-rc.1` publish below.
- Published corrected `0.4.1-rc.1` under `next` with Trusted Publisher and
  verified registry gitHead `9d80e9c7f63986a3223901e9fe54550e86b8b425`,
  registry shasum `fbcc0cc5617d616983a48d3d20b51afe74de0b01`, and dist-tags
  `latest=0.4.0`, `next=0.4.1-rc.1`, `alpha=0.3.9-alpha.8`.
- Created and pushed `v0.4.1-rc.1` only after registry gitHead verification;
  the local and remote tag point at
  `9d80e9c7f63986a3223901e9fe54550e86b8b425`. The tag-triggered GitHub Release
  workflow succeeded after adding checkout before `gh release create`.
- External registry-only smoke installed `persona-harness@next` as
  `0.4.1-rc.1`; the superseded wrong-channel `0.5.0-rc.1` package was not used.
  - archive:
    `/Users/yongtae/Desktop/persona-harness-artifacts/archive/2026-06-24-desktop-persona-runs/rc041-rc1-registry-package-runtime-20260702T010930Z`;
  - package entries included instruction infer/adopt/check, evidence
    `ab-report`, workflow TDD status, Spring bootJar and service-state
    conventions, the CodeGraph MCP wrapper, and the LSP MCP wrapper;
  - basic CLI help/version/init/doctor/bootstrap passed;
  - developer MCP/CodeGraph downgrade passed: default remote-only
    `context7`/`grep_app`, `--codegraph-preview` opt-in, `--no-codegraph`
    remote-only, `--no-developer-mcp` none, no `.codegraph` auto-init, and
    corrected CodeGraph metadata/facade;
  - instruction preview infer/adopt/check passed with schemas, conflict/drift
    output, and no harness config or closure mutation;
  - evidence metrics and `ab-report` JSON/human read-only surfaces passed;
  - regression spots passed for service-state, Controller→Repository, Spring
    bootJar, read-only `workflow tdd`, and LSP preview unavailable facade.
  This is registry package/runtime evidence only: no latest move, token-saving,
  provider-token saving, product-efficacy, navigation-benefit, app-quality,
  full TDD/test-sufficiency, default CodeGraph/LSP effectiveness, broad
  reliability, closure guarantee, Codex support, or code-nav replacement claim.

- Moved the PH CodeGraph wrapper out of the default backend developer MCP
  bundle. `ph bootstrap backend` now registers the remote `grep_app` and
  `context7` entries by default; `ph bootstrap backend --codegraph-preview`
  explicitly opts into the local PH CodeGraph wrapper. `--no-codegraph` remains
  accepted as compatibility/no-op guard for default remote-only bootstrap. This
  keeps prior CodeGraph package/facade behavior available without claiming
  token savings, navigation benefit, product efficacy, PH-owned CodeGraph, or
  default CodeGraph effectiveness.
  QA and External accepted the local/current package-runtime surface for
  `451e4867a5cbaed9dc50eeafc7b76fdd42593764`, with registry evidence deferred
  until a future publish includes that gitHead:
  - archive:
    `/Users/yongtae/Desktop/persona-harness-artifacts/archive/2026-06-24-desktop-persona-runs/codegraph-default-downgrade-451e486-20260701T170739Z`;
  - tarball shasum: `e60649b2e42a8a69b30e10fb1834a0d83e61985a`;
    sha256:
    `3ecb656f4eb84ceba21448f3f159c8ceb078259771a9e244fbc0e837eea7250f`;
  - default bootstrap produced remote-only `context7` and `grep_app`;
  - `--codegraph-preview` opt-in added the local PH CodeGraph wrapper while
    keeping `context7` and `grep_app`;
  - `--no-codegraph` stayed remote-only, `--no-developer-mcp` registered none,
    existing config was preserved, and no `.codegraph` auto-init occurred;
  - `ph-codegraph-mcp --help` described opt-in use through
    `--codegraph-preview`, not default developer convenience;
  - `capabilities --json` reported
    `registeredWithOpenCodeByDefault=false`, `optInFlag=--codegraph-preview`,
    and `tokenSavingsClaimed=false`;
  - the unavailable facade remained protocol-alive/status-only over framed and
    newline MCP, with no fake `search_text`.
  This remains package/runtime behavior evidence only, not registry evidence,
  token/provider-token saving, product-efficacy/navigation-benefit,
  default-CodeGraph-effectiveness, PH-owned CodeGraph, CodeGraph replacement,
  OMO parity, Codex support, broad reliability, or closure guarantee evidence.

- Added read-only `ph instructions infer backend [--json]`,
  `ph instructions adopt [--json]`, and `ph instructions check [--json]` as the first
  instruction inference preview. It inventories project profile, source tree,
  Gradle shape, Java role files, test naming, DTO/domain separation, and
  README/profile build-tool conflicts into `.persona/instructions/inferred.json`
  and `conflicts.json` with source refs. The adopt surface copies non-conflict
  inferred candidates into `.persona/instructions/adopted.json` for review,
  filtered by confidence, without adding closure blockers. The check surface
  reads `.persona/instructions/adopted.json` only and ignores inferred-only
  candidates. Inferred rules are not adopted policy, closure blockers, company
  compliance guarantees, app-quality guarantees, or broad linter claims.
  QA and External accepted the local/current package-runtime surface for
  `ef18f8f20ff0bffe1de6c65481b4141740888b95`, with registry evidence deferred
  until a future publish includes that gitHead:
  - archive:
    `/Users/yongtae/Desktop/persona-harness-artifacts/archive/2026-06-24-desktop-persona-runs/instructions-infer-adopt-check-ef18f8f-20260701T164452Z`;
  - tarball:
    `/Users/yongtae/Desktop/persona-harness-artifacts/archive/2026-06-24-desktop-persona-runs/instructions-infer-adopt-check-ef18f8f-20260701T164452Z/persona-harness-0.4.0.tgz`;
  - npm shasum: `9a5c115cbe112e3e9974968821bdd47c3d828c92`;
    sha256:
    `af5d1ab225e24ae12a8a9813f98af2809b8484f695b4dc32b12ef84bebd5ea6a`;
  - package entries included `dist/cli/instructions-infer.js`,
    `instructions-adopt.js`, `instructions-check.js`,
    `instructions-engine.js`, and `instructions-model.js`;
  - help surfaces exited 0; invalid `instructions wat` exited 1;
  - `infer backend --json` wrote schemas `instructions-inferred.1` and
    `instructions-conflicts.1`, including
    `conflict.docs-buildtool-maven-vs-profile-gradle`, with no auto-fix;
  - `check --json` before adoption reported schema `instructions-check.1`,
    `adoptedRules=0`, and no findings;
  - `adopt --min-confidence high --json` wrote
    `instructions-adopt-result.1` and `instructions-adopted.1` without adopting
    conflict ids;
  - check after adopted `architecture.controller-service-repository` emitted
    `drift.controller-repository-direct-dependency` with source refs;
  - only `.persona/instructions/inferred.json`, `conflicts.json`, and
    `adopted.json` were created; no harness config, workflow closure, or finish
    blocker state was mutated.
  This remains preview/package-runtime evidence only, not registry evidence,
  company compliance, app-quality, Clean Code superiority, broad linter, closure
  guarantee, token-saving, or product-efficacy evidence.

- Added a precise `spring.bootjar-enabled` conformance blocker for executable
  Java/Spring/Gradle profiles. It blocks only when a Spring Boot application
  (`@SpringBootApplication` plus Spring Boot build signal) disables `bootJar`,
  reports file:line evidence and a fix path through the existing closure guard,
  and leaves comments, string lookalikes, other Gradle tasks, and non-executable
  app profiles alone. This is a narrow deterministic violation gate, not a
  broad AST/linter, product-quality, generated-app certification, broad
  reliability, or closure-success guarantee.

- Hardened TDD rail adversarial coverage for stale red evidence with mismatched
  JUnit snapshot digests and red evidence recorded under a different ticket.
  This is test coverage for the existing PH-run evidence gate, not a new full
  TDD framework, test-sufficiency, or app-quality claim.

- Added read-only `ph evidence ab-report [--json]` for structured local A/B
  evidence. The report groups matched scenarios and conditions, summarizes
  finish pass/fail/blocked counts, blocked-invalid-completion counts, elapsed
  time, provider-token totals, read chars, tool calls, and MCP calls when those
  fields are present, and reports missing telemetry as unavailable. This is
  evidence visibility only, not a token-saving, provider-token, product-efficacy,
  or app-quality claim.
  QA and External accepted the local/current package-runtime surface for
  `451ab5863d131ac60993e0fa7aa62270ec2f9af3`, with registry evidence deferred
  until a future publish includes that gitHead:
  - built-CLI A/B archive:
    `/Users/yongtae/Desktop/persona-harness-artifacts/archive/2026-06-24-desktop-persona-runs/p1-tdd-ab-completion-integrity-451ab5863d13-20260701T155535Z`;
  - TDD OFF green-only completion passed 5/5 with
    `blocked-invalid-completion=0`; TDD ON blocked the same green-only
    completion 5/5 with `blocked-invalid-completion=5`;
  - fresh local/current tarball archive:
    `/Users/yongtae/Desktop/persona-harness-artifacts/archive/2026-06-24-desktop-persona-runs/external-p1-ab-report-tarball-451ab5863d13-20260701T155754Z`;
  - tarball shasum: `89b2efdc09d829bf0c225b6baca0914d704d16b5`;
    sha256:
    `dde9d14de69f6c1fc53aa5bdc574f7f14e1f5ce0a033dfed917c7744596d3893`;
  - package included `dist/cli/evidence-ab-report.js`; help listed
    `evidence ab-report [--json]`; JSON/human output exited 0;
  - tarball smoke scanned 3 evidence files with 1 unreadable file, preserved
    unavailable token/read samples, and reported `a-off` finish pass 2 / blocked
    0 plus `b-on` finish blocked 3 / pass 0;
  - read-only behavior was verified by unchanged evidence file sets and no
    `ab-report.md` or dashboard file output.
  This remains local/current tarball package-runtime evidence only, not registry
  evidence, model/OpenCode/eval proof, token-saving/provider-token saving,
  product-efficacy/navigation-benefit, app-quality/test-sufficiency/full-TDD
  framework, broad reliability, or closure guarantee.

## [0.4.0] - 2026-07-01

- Published official `0.4.0` under `latest` and verified registry gitHead
  `af51e8afa3bdb41e3eb3a2abf003d95bfa7c6055`, registry shasum
  `45e3b49d162eeed6d9bc443b5b44508c1e956ebf`, and dist-tags
  `latest=0.4.0`, `next=0.4.0-rc.10`, `alpha=0.3.9-alpha.8`.
- Created and pushed `v0.4.0` after registry gitHead verification; the tag
  points at `af51e8afa3bdb41e3eb3a2abf003d95bfa7c6055`.
- Updated README/README.ko release status for the stable `0.4.0` package:
  registry `latest=0.4.0` is verified, while `next=0.4.0-rc.10` and
  `alpha=0.3.9-alpha.8` remain on their prior channels.
- External registry-only smoke installed `persona-harness@latest` as `0.4.0`
  and verified the registry package/runtime surface:
  - archive:
    `/Users/yongtae/Desktop/persona-harness-artifacts/archive/2026-06-24-desktop-persona-runs/v040-latest-registry-package-runtime-20260701-221728`;
  - basic CLI clean install/help/init/doctor/bootstrap;
  - default developer MCP bundle package surface;
  - opt-in TDD rail plus read-only `ph workflow tdd`;
  - precise `service.state-ownership` blocker;
  - read-only `ph evidence metrics [--json]`;
  - opt-in LSP MCP wrapper unavailable facade and proxy guard.
- Collected the verified rc-line product surfaces into the `0.4.0` release
  claim boundary:
  - workflow rails, evidence traces, continuation/report lifecycle, and finish
    gates;
  - opt-in TDD rail plus read-only `ph workflow tdd`;
  - precise conformance blockers including Controller→Repository and
    `service.state-ownership`;
  - read-only `ph evidence metrics [--json]`;
  - default developer MCP bundle package surfaces;
  - opt-in LSP MCP wrapper with missing-dependency unavailable facade and proxy
    guard.
- Claim audit for `0.4.0`: no token-saving/provider-token saving,
  app/product quality guarantee, full TDD framework/test sufficiency, LSP
  effectiveness/default/real Java LSP tool-call claim, broad AST/linter product,
  broad reliability/closure guarantee/generated app certification, Codex support,
  or code-nav relabeling/replacement claim.
- The `0.4.0` latest smoke is registry package/runtime surface evidence only:
  no model/OpenCode implementation run, eval result, token-saving,
  provider-token saving, product-efficacy, navigation-benefit, generated-app
  certification, broad reliability, closure guarantee, full TDD/test
  sufficiency, broad AST/linter product, real Java LSP default/effectiveness, or
  Codex/code-nav replacement claim.

## [0.4.0-rc.10] - 2026-07-01

- Prepared `0.4.0-rc.10` as the next-channel prerelease candidate for the P6
  opt-in OpenCode LSP MCP wrapper after published `0.4.0-rc.9`.
- Updated English/Korean README release status for `0.4.0-rc.10`.
- Added the opt-in OpenCode LSP MCP wrapper surface from
  `23465e2b3a6a503b2dc4eff510ebbe0fb96186ad`. External local/current tarball
  package-runtime smoke accepted the behavior as version `0.4.0-rc.9`, not
  registry `@next` behavior:
  - archive:
    `/Users/yongtae/Desktop/persona-harness-artifacts/archive/2026-06-24-desktop-persona-runs/p6-lsp-mcp-local-current-23465e2-20260701-214302`;
  - npm shasum: `cff4ffae5601392efc4e3e2110b33409612f2e42`;
  - sha256: `6472a7b19a826b80612d76aa8a303e9735cd8f33b6bb3c2637c261af5ec876b6`;
  - package entries include `packages/lsp-mcp` manifest, README, bin, core,
    stdio libs, root `ph-lsp-mcp`, and optional `@theupsider/lsp-mcp@1.1.2`
    metadata;
  - default bootstrap does not register `mcp.persona-harness-lsp`; opt-in
    `--lsp-preview --no-developer-mcp` registers only the wrapper and preserves
    existing OpenCode config;
  - missing-dependency facade passed newline and framed MCP with
    protocol-alive `lsp_status` only, unavailable status, clean stderr, and
    `isError:true` for fake `lsp_definition` / unknown tools;
  - proxy guard passed with fake binaries: upstream-only and Java-LSP-only stay
    status-only, while fake upstream plus fake Java LSP exposes upstream
    `lsp_definition`.
  This is package/runtime surface and guard-mechanics evidence only. OpenCode
  connected means the wrapper/facade is protocol-alive, not real Java LSP
  usability. It is not registry evidence, not a real Java LSP tool-call, not
  A/B/default/effectiveness evidence, and not a fake LSP result, code-nav
  relabeling/replacement, Codex support, token-saving, provider-token,
  product-efficacy, navigation-benefit, product-quality, generated-app
  certification, broad reliability, or closure guarantee claim.
- Published `0.4.0-rc.10` under `next` and verified registry gitHead
  `58f9ac255b615f40cdd8046e9a73b772e7ceae36`, registry shasum
  `f00f78e578a4b89390ffb8a91c907bf5033189c7`, and dist-tags
  `next=0.4.0-rc.10`, `latest=0.3.9-alpha.8`, `alpha=0.3.9-alpha.8`.
- Created and pushed `v0.4.0-rc.10` after registry gitHead verification; the
  tag points at `58f9ac255b615f40cdd8046e9a73b772e7ceae36`.
- External registry-only smoke installed `persona-harness@next` as
  `0.4.0-rc.10` and verified the LSP MCP package/runtime surface:
  - archive:
    `/Users/yongtae/Desktop/persona-harness-artifacts/archive/2026-06-24-desktop-persona-runs/rc10-registry-lsp-mcp-20260701-220032`;
  - registry package included `packages/lsp-mcp` manifest, README, bin, core,
    stdio libs, root `ph-lsp-mcp`, and optional `@theupsider/lsp-mcp@1.1.2`
    metadata;
  - default backend bootstrap did not register `mcp.persona-harness-lsp`;
  - opt-in `--lsp-preview --no-developer-mcp` registered the wrapper, preserved
    config, and did not auto-create `.codegraph`;
  - help/capabilities kept opt-in, no-auto-install, no-code-nav-relabeling, and
    no token/product-quality boundaries;
  - missing-dependency facade passed newline/framed MCP with clean stderr,
    initialize/tools-list/tools-call, `lsp_status` only, unavailable status, and
    `isError:true` for fake `lsp_definition` / unknown tools;
  - proxy guard with fake binaries kept upstream-only and Java-LSP-only
    status-only, while fake upstream plus fake Java LSP exposed upstream
    `lsp_definition`;
  - `opencode mcp list --pure` connected, meaning protocol-alive
    wrapper/facade only.
- The rc10 registry smoke is package/runtime surface and guard-mechanics
  evidence only: no real Java LSP tool calls, default LSP registration,
  A/B/effectiveness, token/provider-token savings, product
  efficacy/navigation-benefit, product quality, generated-app certification,
  broad reliability, closure guarantee, Codex support, or code-nav
  relabeling/replacement claim.

## [0.4.0-rc.9] - 2026-07-01

- Prepared `0.4.0-rc.9` as the next-channel prerelease candidate for the
  P1.5/P2/P3/P4 package delivery after published `0.4.0-rc.8`.
- Updated English/Korean README release status for `0.4.0-rc.9`.
- Added `ph workflow tdd` as a read-only TDD Workflow Rail status helper. It
  reports the current ticket's red→green state and next action without writing
  red/green evidence; `ph workflow test`, `workflow check`, archive, and finish
  remain the evidence-writing and blocking surfaces.
- Added the scoped `service.state-ownership` conformance blocker and read-only
  `ph evidence metrics [--json]` aggregate. External local/current tarball
  package-runtime smoke for
  `df6319f5f38372217873964f8aa0713c9570d1e6` accepted the behavior as version
  `0.4.0-rc.8`, not registry `@next` behavior before this rc9 release prep:
  - archive:
    `/Users/yongtae/Desktop/persona-harness-artifacts/archive/2026-06-24-desktop-persona-runs/p3-p4-conformance-metrics-df6319f-20260701-202755`;
  - npm shasum: `8d84bfda2116b9edd1d5d5c5f0880a05315d5020`;
  - sha256: `2cbdcc2b129c6c52a2a83901c0bdd0c8bfdaa1c122be09fcd991bf18b4529aa4`;
  - `service.state-ownership` blocks precise Java/Spring service-architecture
    state fields with file:line evidence and fix guidance; closure next exposes
    `architecture-service-state-ownership` / `fix-service-state-ownership`;
    archive and finish block, while safe comments/strings/local variables do
    not;
  - Controller→Repository blocking remains unchanged, while repository
    interface placement and bootJar candidates are deferred;
  - `ph evidence metrics` reports schema `evidence-metrics.1` in human/json
    modes, read-only over local `.persona/evidence`, with token totals,
    structured tool/MCP calls, read chars when present, finish pass/fail
    command records, and honest unavailable/unreadable evidence reporting.
  This is not a broad AST/linter product, token-saving, provider-token,
  product-efficacy, navigation-benefit, generated-app certification, broad
  reliability, closure guarantee, model/OpenCode/eval, publish, tag, latest, or
  version-move claim.
- Published `0.4.0-rc.9` under `next` and verified registry gitHead
  `fd597970877756f0523fb73ad1e093473e75a97a`, registry shasum
  `7bd42b00d669275b0995d37ec108cbb28b8b66b8`, and dist-tags
  `next=0.4.0-rc.9`, `latest=0.3.9-alpha.8`, `alpha=0.3.9-alpha.8`.
- Created and pushed `v0.4.0-rc.9` after registry gitHead verification; the tag
  points at `fd597970877756f0523fb73ad1e093473e75a97a`.
- External registry-only smoke installed `persona-harness@next` as
  `0.4.0-rc.9` and verified the P1.5/P2/P3/P4 package/runtime surface:
  - archive:
    `/Users/yongtae/Desktop/persona-harness-artifacts/archive/2026-06-24-desktop-persona-runs/rc9-registry-package-runtime-20260701-205115`;
  - `ph workflow tdd` read-only status helper passed disabled, red-missing,
    red-without-green, passed, invalid extra arg, help listing, and no extra TDD
    evidence writes;
  - TDD rail regressions passed for strict-off/no fake evidence, valid PH-run
    red evidence, invalid red rejection, green-only/no-red block, forged
    evidence ignored, and red→green archive/finish PASS;
  - `service.state-ownership` produced check/WARN plus closure blocker/fix step
    and archive/finish block; safe nearby code did not block; Controller→
    Repository regression was still observed;
  - `ph evidence metrics [--json]` reported schema `evidence-metrics.1`,
    token/tool/MCP/read-char/finish/unreadable aggregates, read-only no-write
    behavior, and honest missing evidence handling.
- The rc9 registry smoke is package/runtime surface evidence only: no
  model/OpenCode/eval evidence, no quality, test-sufficiency,
  full-TDD-framework, scaffolding, coverage, mutation, token-saving,
  provider-token, product-efficacy, navigation-benefit, generated-app
  certification, broad reliability, broad AST/linter product, or closure
  guarantee claim.

## [0.4.0-rc.8] - 2026-07-01

- Prepared `0.4.0-rc.8` as the next-channel prerelease candidate for the
  opt-in TDD Workflow Rail. Until registry publish and gitHead verification,
  this is release-prep/local-current evidence only.
- Added the opt-in TDD workflow rail behind `enforce.tdd`. `ph workflow test`
  records red evidence only from PH-run strict Gradle/JUnit verification
  (`enforce.executeVerification=true`), and workflow closure blocks archive or
  finish until the same ticket/test id has red evidence followed by PH-observed
  green evidence.
- `enforce.tdd` is default-off. Without strict execution verification, the TDD
  rail is advisory/unavailable and writes no fake red/green evidence.
- This is a deterministic finish/archive gate, not a full TDD framework:
  Persona Harness does not scaffold tests, prove test sufficiency, run coverage,
  or run mutation testing.
- External local/current tarball package-runtime smoke for
  `b5d98e1286c5a7f0349af8a461efdf2ce84a653e` accepted the TDD rail behavior as
  package version `0.4.0-rc.7`; rc8 packages that accepted behavior for the
  next-channel candidate after release prep:
  - archive:
    `/Users/yongtae/Desktop/persona-harness-artifacts/archive/2026-06-24-desktop-persona-runs/tdd-workflow-rail-b5d98e1-20260701-164350`;
  - tarball:
    `/Users/yongtae/Desktop/persona-harness-artifacts/archive/2026-06-24-desktop-persona-runs/tdd-workflow-rail-b5d98e1-20260701-164350/persona-harness-0.4.0-rc.7.tgz`;
  - npm shasum: `6665daa2fc01d01cbc8095bddadffc7654589572`;
  - sha256: `7262e64d80d713f6d124a37fec0a4fb7762be22ab0f2c6ae32e422d19f961360`;
  - strict-off/advisory wrote no red/green evidence; strict PH-run
    Gradle/JUnit `<failure>` recorded red evidence with
    `execution=ph-direct-gradle-junit`, `generatedBy=persona-harness`, test id,
    JUnit snapshot, and digest;
  - compile/no-JUnit failure and JUnit `<error>` did not write red evidence;
    green-only/no-red blocked with `tdd-red-evidence-missing`; hand-written
    minimal evidence was ignored; red->green for the same ticket/test id passed
    check/archive/finish in an isolated fixture.
  This is not model/OpenCode/eval evidence and does not claim test sufficiency,
  product quality, generated-app certification, a full TDD framework,
  scaffolding, coverage, mutation testing, broad reliability, or closure
  guarantee.
- Published `0.4.0-rc.8` under `next` and verified registry gitHead
  `18a9bb2f4a9706e4115ffff5d9e864934cd9f0bd`, registry shasum
  `fc4de25901d4c678799ea66b8e63293dc5f46a12`, and dist-tags
  `next=0.4.0-rc.8`, `latest=0.3.9-alpha.8`, `alpha=0.3.9-alpha.8`.
- Created and pushed `v0.4.0-rc.8` after registry gitHead verification; the tag
  points at `18a9bb2f4a9706e4115ffff5d9e864934cd9f0bd`.
- External registry-only smoke installed `persona-harness@next` as
  `0.4.0-rc.8` and verified the opt-in TDD Workflow Rail package/runtime
  surface:
  - archive:
    `/Users/yongtae/Desktop/persona-harness-artifacts/archive/2026-06-24-desktop-persona-runs/rc8-registry-tdd-workflow-rail-20260701-193324`;
  - package entries included `dist/cli/workflow-tdd.js` and
    `dist/cli/closure-verification-runner.js`;
  - default generated config omits `enforce.tdd` and the installed runtime
    default remains `tdd:false`;
  - strict-off/advisory with `enforce.tdd=true` and
    `executeVerification=false` exited 0, wrote no red/green evidence, and did
    not add a TDD hard blocker;
  - strict PH-run Gradle/JUnit `<failure>` recorded red evidence with
    `execution=ph-direct-gradle-junit`, `generatedBy=persona-harness`, test id,
    JUnit snapshot, and digest;
  - compile/no-JUnit failure and JUnit `<error>` wrote no red evidence;
  - green-only/no-red and hand-written minimal forged evidence blocked with
    `tdd-red-evidence-missing`;
  - red->green for the same ticket/test id passed `workflow test`,
    `workflow check`, `workflow archive req-1`, and
    `workflow finish implement`.
- The rc8 registry smoke is package/runtime surface evidence only: no
  model/OpenCode/eval evidence, no token-saving claim, no product-quality,
  test-sufficiency, full-TDD-framework, scaffolding, coverage, mutation,
  generated-app certification, broad reliability, or closure guarantee claim.

## [0.4.0-rc.7] - 2026-07-01

- Prepared `0.4.0-rc.7` as the next-channel prerelease candidate for the
  default OpenCode developer MCP bundle.
- This candidate packages the QA/External-accepted `a9dcf04 feat(cli): add
  developer MCP bundle` surface:
  - default `ph bootstrap backend` registers remote `grep_app`, remote
    `context7`, and a local PH CodeGraph wrapper MCP;
  - `--no-developer-mcp`, `--no-codegraph`, `--codegraph-preview`, and config
    preservation passed package-surface smoke;
  - the CodeGraph wrapper is protocol-alive when external CodeGraph is missing,
    exposes status-only unavailable behavior, and does not fake indexed/search
    tools;
  - no fake `git_bash` or `lsp` MCP surfaces are registered;
  - PH does not run `codegraph init` and does not create `.codegraph/`.
- External local/current tarball evidence for `a9dcf04`:
  - tarball:
    `/Users/yongtae/Desktop/persona-harness-artifacts/archive/2026-06-24-desktop-persona-runs/developer-mcp-bundle-a9dcf04-20260701-125655/persona-harness-0.4.0-rc.6.tgz`;
  - npm shasum: `24631c91d8ad4791ab7b8a3ca139312ddd8989eb`;
  - sha256:
    `7adc96fdbd14bf9447f70ff8de7dc3fe0192c8d875516aaabbd454170d12936a`.
- Published `0.4.0-rc.7` under `next` and verified registry gitHead
  `640b8d3833e8de12657cdebf4ff0bc2877878c6d`, registry shasum
  `9d6cb2167fbbf5aa3bdb925b4ec2b6d3652ccd07`, and dist-tags
  `next=0.4.0-rc.7`, `latest=0.3.9-alpha.8`, `alpha=0.3.9-alpha.8`.
- Created and pushed `v0.4.0-rc.7` after registry gitHead verification; the tag
  points at `640b8d3833e8de12657cdebf4ff0bc2877878c6d`.
- External registry-only smoke installed `persona-harness@next` as
  `0.4.0-rc.7` and verified the default developer MCP bundle package/runtime
  surface:
  - archive:
    `/Users/yongtae/Desktop/persona-harness-artifacts/archive/2026-06-24-desktop-persona-runs/rc7-registry-developer-mcp-20260701-134918`;
  - work root: `/tmp/persona-rc7-registry-developer-mcp-20260701-134918`;
  - package entries included `ph-codegraph-mcp`,
    `packages/codegraph-mcp/bin/codegraph-mcp.mjs`,
    `packages/codegraph-mcp/lib/codegraph-core.mjs`, and optional dependency
    metadata for `@colbymchenry/codegraph@1.1.6`;
  - default init/bootstrap registered remote `grep_app`, remote `context7`, and
    the local PH `codegraph` wrapper, with no fake `git_bash`/`lsp` and no
    `.codegraph` auto-init;
  - `--no-developer-mcp`, `--no-codegraph`, and config preservation passed;
  - missing-binary CodeGraph facade passed framed and newline JSON-RPC as a
    protocol-alive status-only unavailable surface with `isError:true` payloads,
    no fake indexed/search tools, and clean stderr;
  - `opencode mcp list --pure` showed `grep_app`, `context7`, and `codegraph`
    connected, which is facade/protocol evidence only.
- No token-saving, provider-token saving, product-efficacy, navigation-benefit,
  PH-owned CodeGraph, CodeGraph replacement, OMO parity/replacement, Codex
  support, generated app certification, broad reliability, or closure guarantee
  claim.

## [0.4.0-rc.6] - 2026-06-30

- Prepared `0.4.0-rc.6` as the next-channel prerelease refresh after registry
  `@next=0.4.0-rc.5` still pointed at gitHead
  `78addeb5dc992973589e7f99635fe8ca277e4ad6` and did not include the post-rc5
  PH code-nav package-surface work.
- The rc6 candidate includes local/current verified package-surface behavior
  for the PH code-nav preview:
  - R-MCP.1b minimal stdio MCP protocol server from
    `abaef744ad9e091215911d3feeac40ba1569ca22`;
  - R-MCP.1c opt-in `.opencode/opencode.json` registration through
    `npx ph bootstrap backend --code-nav-preview` from
    `42348cc1aa0dacde81080741e8ad8531305690c2`;
  - existing plugin, agent, custom MCP, and top-level `.opencode/opencode.json`
    entries are preserved during opt-in registration;
  - default bootstrap does not register `mcp.persona-harness-code-nav`.
- Evidence is current/local tarball package-surface only until a post-publish
  registry check verifies `persona-harness@0.4.0-rc.6` gitHead:
  - R-MCP.1b tarball shasum
    `c050ad0c799dfd9ecabe34b303cff12806a401fb`;
  - R-MCP.1c tarball shasum
    `052e9bf6e3c501fa3bd7c431d965d59149058757`.
- R-MCP.2 development-navigation probe remains PARTIAL: one actual OpenCode
  development run observed fewer broad tool/read outputs with the PH code-nav
  prompt, but no token/time reduction was proven. OpenCode real-run A/B remains
  a separate post-refresh measurement, not an rc6 release blocker.
- Boundaries remain narrow: no default registration, no registry claim before
  publish verification, no model/OpenCode/eval/native dispatch evidence, no
  provider-token/token-saving/product-efficacy claim, no codegraph replacement,
  no OMO parity, no PH superiority, no generated app certification, no broad
  reliability, and no closure guarantee. Publish rc6 with `next`; do not move
  `latest`.
- Post-publish registry facts and External registry package-surface smoke:
  - `persona-harness@0.4.0-rc.6` exists with gitHead
    `30ded278ab5726e4f910d94b62d131647963807b`;
  - registry shasum: `ab3e2074d739add4bca547ceb9a2961b409e6250`;
  - dist-tags: `next=0.4.0-rc.6`, `latest=0.3.9-alpha.8`,
    `alpha=0.3.9-alpha.8`;
  - External registry-only smoke installed `persona-harness@next` as
    `persona-harness@0.4.0-rc.6`;
  - archive:
    `/Users/yongtae/Desktop/persona-harness-artifacts/archive/2026-06-24-desktop-persona-runs/rc6-registry-code-nav-package-surface-20260630-230144`;
  - default init/bootstrap exited 0 and did not add
    `mcp.persona-harness-code-nav`;
  - strict bootstrap printed/wrote `executeVerification=true`,
    `systemConstitution=true`, `writeDeny=false`, and `idleContinuation=false`
    without generated-app certification or closure guarantee wording;
  - opt-in `bootstrap backend --code-nav-preview` exited 0, preserved existing
    plugin/agent/custom MCP/top-level entries, and added
    `mcp.persona-harness-code-nav` with `type=local`, `enabled=true`, and a node
    command to the installed code-nav MCP server;
  - `--help`, `capabilities --json`, and `search --json` fixture/missing-root
    paths worked; capabilities reported `mcpProtocolServer=true`,
    `registeredWithOpenCode=false`, and `tokenSavingsClaimed=false`;
  - generated command protocol smoke passed no-model framed JSON-RPC
    `initialize`, `tools/list`, and `tools/call` for `status`, `search_text`,
    and `ast_grep_availability`; limited PATH reported ast-grep unavailable
    without crash or fake pass;
  - workflow check remained WARN/actionable and `workflow finish implement`
    still exited 1 for missing verification evidence/template reports; no
    finish/check weakening.
- Post-rc6 local/current tarball OpenCode MCP transport compatibility smoke:
  - source HEAD: `38f4e8b1100bd6812212d4d5dfbebbef4d2b10eb`
    (`38f4e8b fix(cli): support OpenCode MCP newline transport`);
  - source was a fresh local/current tarball only, not registry `@next`;
  - tarball:
    `/Users/yongtae/Desktop/persona-harness-artifacts/archive/2026-06-24-desktop-persona-runs/rmcp-newline-transport-38f4e8b-20260630-235636/persona-harness-0.4.0-rc.6.tgz`;
  - npm shasum: `ade4b761d87d01c76a0e42b03d73d6bae3c1be15`;
  - sha256: `f74cf365b69b37b89f4a0cd0039dcea67b596682d7074bff31ec671686b80357`;
  - direct Content-Length framed JSON-RPC returned Content-Length framed
    responses, and direct newline-delimited JSON-RPC returned newline responses
    with no Content-Length;
  - opt-in `bootstrap --code-nav-preview` registered
    `mcp.persona-harness-code-nav`, default init/bootstrap did not register it,
    and existing plugin/agent/custom MCP/top-level entries were preserved;
  - `opencode mcp list --pure` exited 0 and showed
    `persona-harness-code-nav` connected;
  - this records an OpenCode local MCP newline transport/adoption compatibility
    fix only, not token-saving, product-efficacy, navigation-benefit, model,
    eval, native dispatch, or registry `@next` evidence.
- Post-rc6 parser/guidance measurement hygiene:
  - `f93d52d` added namespaced code-nav MCP tool detection and guidance for
    OpenCode tool names such as `persona-harness-code-nav_status` and
    `persona-harness-code-nav_search_text`;
  - `e52f73f3c3cdb36866d74aecb39757cdf520d0ee` separates actual JSON tool-name
    field calls from prose/free-text mentions;
  - QA verified R-MCP.3 raw logs as `codeNavToolCallCount=2`, with exact calls
    `persona-harness-code-nav_status=1` and
    `persona-harness-code-nav_search_text=1`, while exact prose mentions are
    counted separately as `codeNavToolMentionCount=2`;
  - a prose-only stdin fixture reports call count 0 and mention count 1;
  - External package smoke was not needed because this is repo-only metrics
    parser/test behavior;
  - this is parser accuracy and measurement hygiene only, not natural-adoption,
    efficacy, token-saving, provider-token saving, navigation-benefit, or
    product-efficacy evidence.
- Post-rc6 R1 token telemetry measurement infrastructure smoke:
  - source HEAD: `163a85e0433f6d713afa3f619b3cc6b2d2bcf100`
    (`163a85e fix(runtime): record token telemetry evidence`);
  - source was a fresh local/current tarball only, not registry `@next`;
  - tarball:
    `/Users/yongtae/Desktop/persona-harness-artifacts/archive/2026-06-24-desktop-persona-runs/r1-token-telemetry-163a85e-20260701-030900/persona-harness-0.4.0-rc.6.tgz`;
  - npm shasum: `1172d79ca49958dacb66fd06725ea8a4ede4062c`;
  - sha256: `3008ad6de5f2bfe1f3279095a5704a4ebe20472e5fcf7ef6a83f2b3eac03bf39`;
  - installed package runtime wrote
    `.persona/evidence/token-usage/session-with-unsafe-key.json` from
    `message.updated` assistant events, with the unsafe session filename
    sanitized and the original session key preserved in the payload;
  - latest-per-message dedupe and aggregate totals were observed:
    input 15, output 13, reasoning 2, cacheRead 31, cacheWrite 4, total 65;
  - known `modelLimit=100` produced ratio 0.46, while unknown modelLimit
    recorded null ratio with an explicit reason;
  - `telemetry.tokenUsage=false` opt-out wrote no evidence;
  - this is measurement infrastructure only, not token-saving,
    provider-token-saving, product-efficacy, compaction-effectiveness, R2
    compaction, R3 hashline, code-nav, or dispatch evidence.
- Post-rc6 R2 compaction trigger mechanics smoke:
  - source HEAD: `a0116785e7e013154c4e4c8a75b4d87515fce828`
    (`a011678 fix(runtime): add measured compaction gate`);
  - source was a fresh local/current tarball only, not registry `@next`;
  - tarball:
    `/Users/yongtae/Desktop/persona-harness-artifacts/archive/2026-06-24-desktop-persona-runs/r2-token-compaction-a011678-20260701-032810/persona-harness-0.4.0-rc.6.tgz`;
  - npm shasum: `5465781a54c809ea09d4c42c8eb4d032fd0a44b7`;
  - sha256: `2cdd812a82d9a46efb2446808162cec4fe3a54c470e75f77c99120e370a594d9`;
  - package included `dist/runtime/token-compaction.js`, its `.d.ts`,
    `token-telemetry.js`, hooks, and config surfaces;
  - default/off fixture wrote token usage ratio 0.8, made zero summarize calls,
    and wrote no compaction evidence;
  - opt-in trigger fixture with `enforce.compaction.enabled=true`,
    threshold 0.78, and known ratio 0.8 called fake
    `client.session.summarize` exactly once with `{ path:{id},
    query:{directory}, body:{providerID, modelID} }` and no `auto:true`;
  - `token-compaction.1` evidence recorded status `triggered`,
    beforeMeasurement ratio 0.8, and afterMeasurement measured false with a
    no-token-saving-claim reason;
  - skip cases covered ratio-unavailable, below-threshold,
    summarize-client-unavailable, and cooldown-active;
  - this is default-off, measurement-gated trigger mechanics and evidence shape
    only, not real compaction effectiveness, token-saving, provider-token
    saving, product-efficacy, R3 hashline, code-nav, dispatch, or codegraph/OMO
    evidence.
- Post-rc6 external OpenCode CodeGraph preview smoke:
  - source HEAD: `6e69ca3e78b8664384c83221297f336d4c7f9c8c`
    (`6e69ca3 feat(cli): add external codegraph preview`);
  - source was a fresh local/current tarball only, not registry `@next`;
  - tarball:
    `/Users/yongtae/Desktop/persona-harness-artifacts/archive/2026-06-24-desktop-persona-runs/codegraph-preview-6e69ca3-20260701-120832/persona-harness-0.4.0-rc.6.tgz`;
  - npm shasum: `37d27b36797edb243cf1cf4674219c4672140ca0`;
  - sha256: `b3d5d44baea8e95f39a882ceb3cc117bf6bae7678982f89539431b2783b1f8a2`;
  - default bootstrap created no `mcp.codegraph` entry and no `.codegraph`
    directory;
  - missing-binary `--codegraph-preview` skipped/no-opped with guidance and
    still created no `mcp.codegraph` entry or `.codegraph` directory;
  - present fake-binary `--codegraph-preview` registered OpenCode
    `mcp.codegraph` with command `["codegraph","serve","--mcp"]`, preserved
    existing config, and still did not create `.codegraph`;
  - this is external optional OpenCode CodeGraph MCP config/guidance only, not
    real CodeGraph MCP connected evidence, not Codex support, not PH-owned
    codegraph, not OMO parity/replacement, and not token-saving or
    product-efficacy evidence.
- R-CG.2 external CodeGraph real-MCP measurement:
  - target HEAD for the measurement was local/current
    `b7adc7cc481baca07e6626ae6f91848b0dce3ef3`; registry `@next` was not used;
  - evidence files were `.persona/evidence/codegraph-real-mcp-smoke-20260701T033048Z.json`
    and `.persona/evidence/codegraph-dev-ab-20260701T033048Z.json`, with raw
    logs under `.persona/evidence/codegraph-rcg2-raw-20260701T033048Z/`;
  - Stage 1 used temp-installed `@colbymchenry/codegraph@1.1.6`, explicit
    `codegraph init`, and observed real OpenCode MCP tool event
    `codegraph_codegraph_explore` / canonical `codegraph_explore` once;
  - freshness caveat: Stage 1 reported `pendingChanges.added=1`, so no
    clean-fresh claim;
  - Stage 2 A/B fixed the Controller-to-Repository violation in both OFF and ON
    via `TodoService`, and `observe` passed;
  - A OFF: CodeGraph calls 0, elapsed 52,746ms, tool uses 7, reads 3, read chars
    11,080, provider total/input/output/reasoning/cacheRead
    68,648 / 36,430 / 1,007 / 491 / 30,720;
  - B ON: CodeGraph calls 1, elapsed 70,826ms, tool uses 22, reads 11, read
    chars 34,180, provider total/input/output/reasoning/cacheRead
    309,411 / 79,903 / 3,272 / 1,468 / 224,768;
  - ON-OFF delta was +18,080ms, +15 tool uses, +8 reads, +23,100 read chars,
    +240,763 provider total, and +194,048 cacheRead;
  - interpretation: real external CodeGraph MCP tool-call adoption is proven,
    but this bounded A/B was worse with CodeGraph ON; effectiveness is
    deferred/no-keep, with no token-saving, provider-token, product-efficacy, or
    navigation-benefit claim.
- Post-rc6 default developer MCP bundle smoke:
  - source HEAD: `a9dcf044ff423fc4b94e549d365febe0844ab960`
    (`a9dcf04 feat(cli): add developer MCP bundle`);
  - source was a fresh local/current tarball only, not registry `@next`;
  - tarball:
    `/Users/yongtae/Desktop/persona-harness-artifacts/archive/2026-06-24-desktop-persona-runs/developer-mcp-bundle-a9dcf04-20260701-125655/persona-harness-0.4.0-rc.6.tgz`;
  - npm shasum: `24631c91d8ad4791ab7b8a3ca139312ddd8989eb`;
  - sha256: `7adc96fdbd14bf9447f70ff8de7dc3fe0192c8d875516aaabbd454170d12936a`;
  - package includes `packages/codegraph-mcp/bin/codegraph-mcp.mjs`,
    `packages/codegraph-mcp/lib/codegraph-core.mjs`, root bin
    `ph-codegraph-mcp`, and optional dependency metadata for
    `@colbymchenry/codegraph@1.1.6`;
  - default init/bootstrap registers remote `grep_app`, remote `context7`, and
    local PH `codegraph` wrapper, with no fake `git_bash` or `lsp` surfaces and
    no `.codegraph` auto-init;
  - `--no-developer-mcp`, `--no-codegraph`, `--codegraph-preview`, and config
    preservation passed;
  - missing-binary CodeGraph unavailable facade passed framed and newline MCP:
    protocol alive, `tools/list` status-only, `tools/call status` and unknown
    tool returned `isError:true` unavailable payloads, no fake indexed/search
    tools, and clean stderr;
  - `opencode mcp list --pure` showed `grep_app`, `context7`, and `codegraph`
    connected, where CodeGraph connected means protocol-alive wrapper/facade,
    not usable indexing or effectiveness;
  - this is local/current package-runtime surface evidence only, not registry
    `@next` behavior, token-saving, provider-token saving, product-efficacy,
    navigation-benefit, PH-owned CodeGraph, OMO parity/replacement, Codex
    support, generated app certification, broad reliability, or closure
    guarantee evidence.

## [0.4.0-rc.5] - 2026-06-30

- Prepared `0.4.0-rc.5` as the next-channel prerelease candidate for the
  no-model multi-agent relay preview surface after registry `@next=0.4.0-rc.4`
  still pointed at gitHead `c3e4c2bc2178e6edc72581a8d34aedd406be922b` and did
  not include the relay R1-R5 work through
  `24f85001605b7c121f11a2933a3ebfd0453434a7`.
- The rc5 package candidate includes the coherent no-model relay preview set:
  - opt-in relay agent map generation for `test-writer`, `jaeki`, and `roach`;
  - relay coordinator status/next JSON with current role, completion state,
    scoped inputs, prompt block, and required artifact;
  - deterministic role artifact gates for missing, incomplete, and
    role-boundary-violating artifacts;
  - read-only `workflow relay validate --json`;
  - compact human text mode for `workflow relay validate`.
- Evidence remains package-surface/no-model only:
  - R1 current-tarball smoke on HEAD
    `12562195719745ed371320d04590c68037ab0b05`;
  - R2 current-tarball smoke on HEAD
    `4788135b01447f7cbfde3198abfcd45640893ce6`;
  - R3b current-tarball smoke on HEAD
    `7d9329449063888092f9a9a1a0141f94728c5e0e`;
  - R4 current-tarball smoke on HEAD
    `ebc57dd2ae72c947255f472145291d424f5d2337`;
  - R5 current-tarball smoke on HEAD
    `24f85001605b7c121f11a2933a3ebfd0453434a7`.
- Post-publish smoke verified registry `persona-harness@next`, version, gitHead,
  shasum, dist-tags, strict/default config surface, relay validate human text,
  `validate --json` compatibility, no-write roles-dir/hash behavior, unchanged
  archive/finish blockers, and no dispatch/model/eval/certification claims.
- Post-publish registry facts and External registry package-surface smoke:
  - `persona-harness@0.4.0-rc.5` exists with gitHead
    `78addeb5dc992973589e7f99635fe8ca277e4ad6`;
  - registry shasum: `e101c31646d2ba080481b19b9231fd30d9ac9674`;
  - dist-tags: `next=0.4.0-rc.5`, `latest=0.3.9-alpha.8`,
    `alpha=0.3.9-alpha.8`;
  - External registry-only smoke installed `persona-harness@next` as
    `persona-harness@0.4.0-rc.5`;
  - archive:
    `/Users/yongtae/Desktop/persona-harness-artifacts/archive/2026-06-24-desktop-persona-runs/rc5-registry-package-surface-20260630-171529`;
  - default bootstrap config remained `executeVerification=false`,
    `systemConstitution=true`, `writeDeny=false`, and `idleContinuation=false`;
  - strict bootstrap config printed/wrote `executeVerification=true`,
    `systemConstitution=true`, `writeDeny=false`, and `idleContinuation=false`
    without generated-app certification or closure guarantee wording;
  - `ph workflow relay validate` human text worked in missing, incomplete, and
    complete states with ticket/role/readiness/blocker/reason/artifact/gate
    command/hints plus read-only/no native dispatch/no artifact writes/gates
    authoritative boundaries;
  - `ph workflow relay validate --json` remained compatible with
    `action=validate`, readiness/reason/incomplete roles, complete-state
    `blockers=[]`, complete `roleCompletionState`, and closure-next gate command;
  - validation preserved no-write behavior: missing validate did not create the
    roles directory, and incomplete/complete artifact hashes were unchanged;
  - check/archive/finish strictness remained: check WARN/actionable, archive
    exited 1, and finish exited 1 with template reports and pending ticket; no
    report auto-fill, ticket auto-archive, or finish/check/archive weakening.
- Boundaries remain narrow: no native subtask dispatch, no model/OpenCode/eval
  run proof, no PH superiority, no generated app certification, no broad
  architecture correctness, no general reliability, no closure guarantee, no
  token-savings guarantee, no OMO parity, and no autonomous completion claim.
- Local post-rc5 commits through `28efb8e docs: record injection cleanup and
  code-nav preview` have a QA-verified codegraph-OFF CLI output proxy
  measurement in `.persona/evidence/token-baseline.json`:
  - injection guidance is split into Tier0 source-of-truth boundaries, Tier1
    implement/continue workflow rail, and Tier3 finish/review/archive
    verification;
  - plan prompts and workflow output now say to use PH-owned surfaces first:
    accepted plan, injection summary, workflow check/closure, ast-grep
    conventions, relay handoff, and bearshell;
  - external codegraph/code-nav tools are described as optional and only when
    actually installed, not PH-owned and not token-saving;
  - label: `post-r1-cleanup-plus-rmcp1a-local`; included commits: `5b8d2ef`,
    `5fd5a14`, and `28efb8e`;
  - R0 baseline: 26,572 bytes / 25,274 chars / 2,912 whitespaceTokens / 6,319
    chars/4 proxy;
  - latest same-method measurement: 26,619 bytes / 25,323 chars / 2,910
    whitespaceTokens / 6,331 chars/4 proxy;
  - delta: +47 bytes / +49 chars / -2 whitespaceTokens / +12 chars/4 proxy;
  - no measured reduction in this same-method codegraph-OFF CLI output proxy
    scenario; whitespace token proxy decreased by 2, but chars/4 proxy
    increased by 12, and neither is provider-token accounting;
  - therefore there is no token-saving or product-efficacy claim, no PH-owned
    MCP registration claim, and R2 cache design is not justified by this
    measurement alone;
  - registry `@next` remains the rc5 release package until a later publish
    verifies a new gitHead.
- External current/local tarball package-surface smoke on HEAD
  `5fd5a1456ef007d37b37fc5fb22b9849f12485ef` passed the R-MCP.1a code-nav CLI
  preview surface:
  - source was a fresh local/current tarball, not registry `@next` and not
    origin-only;
  - package/version: `persona-harness@0.4.0-rc.5`;
  - tarball:
    `/Users/yongtae/Desktop/persona-harness-artifacts/archive/2026-06-24-desktop-persona-runs/rmcp1a-code-nav-package-surface-20260630-180844/persona-harness-0.4.0-rc.5.tgz`;
  - npm shasum: `758babb2f6a7a2c45331e02026b541c28937d60e`;
  - sha256: `59a097989fc21bbf4ff75acf19c754be6468a6a2b28f8c146213ff5e7adb4e4b`;
  - archive:
    `/Users/yongtae/Desktop/persona-harness-artifacts/archive/2026-06-24-desktop-persona-runs/rmcp1a-code-nav-package-surface-20260630-180844`;
  - tarball contains exactly `package/packages/lsp-tools-mcp/README.md`,
    `package/packages/lsp-tools-mcp/bin/code-nav-mcp.mjs`, and
    `package/packages/lsp-tools-mcp/package.json` for the preview package;
  - `code-nav-mcp.mjs --help` exits 0 with non-empty preview usage and boundary
    text: opt-in package surface only, no OpenCode registration by default, no
    codegraph/indexer, no token-saving claim, unavailable tools reported
    honestly;
  - `capabilities --json` exits 0 with `ast-grep.availability`,
    `filesystem.text-search`, `mcpProtocolServer=false`,
    `registeredWithOpenCode=false`, and `tokenSavingsClaimed=false`;
  - with `PATH` limited to the Node directory, ast-grep availability is reported
    unavailable with a limitation, without crash or fake pass;
  - `search --json TaskController fixture/src/main/java` returns bounded
    filesystem matches, and missing root returns unavailable with empty matches;
  - no `.opencode` directory or MCP registration is created.
- External current/local tarball package-surface smoke on HEAD
  `abaef744ad9e091215911d3feeac40ba1569ca22` passed the R-MCP.1b minimal stdio
  MCP protocol surface:
  - source was a fresh local/current tarball, not registry `@next`;
  - package/version: `persona-harness@0.4.0-rc.5`;
  - tarball:
    `/Users/yongtae/Desktop/persona-harness-artifacts/archive/2026-06-24-desktop-persona-runs/rmcp1b-code-nav-mcp-protocol-20260630-220253/persona-harness-0.4.0-rc.5.tgz`;
  - npm shasum: `c050ad0c799dfd9ecabe34b303cff12806a401fb`;
  - sha256: `4432a0e17da2c81db7e7fcbf99313d2dab2537f919f6a0d7daafd7d40d31e77a`;
  - archive:
    `/Users/yongtae/Desktop/persona-harness-artifacts/archive/2026-06-24-desktop-persona-runs/rmcp1b-code-nav-mcp-protocol-20260630-220253`;
  - package entries include `README.md`, `bin/code-nav-mcp.mjs`,
    `lib/code-nav-core.mjs`, `lib/code-nav-mcp.mjs`, and `package.json` under
    `package/packages/lsp-tools-mcp`;
  - help shows `ph-code-nav-mcp mcp`, minimal stdio MCP protocol server, no
    OpenCode registration by default, no codegraph/indexer, and no token-saving
    claim;
  - `capabilities --json` reports `mcpProtocolServer=true`,
    `registeredWithOpenCode=false`, `tokenSavingsClaimed=false`,
    `ast-grep.availability`, and `filesystem.text-search`;
  - CLI search compatibility remained: fixture search returns matches, missing
    query exits 1 with usage, and missing root returns `status=unavailable` with
    `matches=[]`;
  - framed stdio MCP covered `initialize`, `notifications/initialized`,
    `tools/list`, and `tools/call` for `status`, `search_text`, and
    `ast_grep_availability`; `tools/list` contained exactly
    `ast_grep_availability`, `search_text`, and `status`;
  - normal PATH found ast-grep via `/opt/homebrew/bin/sg`; limited PATH reported
    `ast_grep_availability` unavailable with no crash or fake pass;
  - no `.opencode` directory or registration was created, and there was no
    OpenCode/model/eval/native dispatch run.
- Code-nav boundaries: these are current/local tarball previews only, not
  registry `@next` behavior until a later publish verifies gitHead. R-MCP.1b is
  minimal stdio MCP protocol evidence, not OpenCode registration evidence;
  R-MCP.1c opt-in registration evidence is recorded below. This is not
  token-savings evidence, provider-token accounting, product-efficacy evidence,
  codegraph replacement proof, OMO parity, PH superiority, generated app
  certification, broad reliability, or a closure guarantee.
- External current/local tarball package-surface smoke on HEAD
  `42348cc1aa0dacde81080741e8ad8531305690c2` passed the R-MCP.1c opt-in
  OpenCode config registration surface:
  - source was a fresh local/current tarball, not registry `@next`;
  - package/version: `persona-harness@0.4.0-rc.5`;
  - tarball:
    `/Users/yongtae/Desktop/persona-harness-artifacts/archive/2026-06-24-desktop-persona-runs/rmcp1c-code-nav-opencode-registration-20260630-222627/persona-harness-0.4.0-rc.5.tgz`;
  - npm shasum: `052e9bf6e3c501fa3bd7c431d965d59149058757`;
  - sha256: `2cb078c3ca5a72dc357d4c78e1b7f91b318b0c7bb4d8e29403215250f0012162`;
  - archive:
    `/Users/yongtae/Desktop/persona-harness-artifacts/archive/2026-06-24-desktop-persona-runs/rmcp1c-code-nav-opencode-registration-20260630-222627`;
  - default clean install plus init/bootstrap exits 0 and does not add
    `.opencode/opencode.json` `mcp.persona-harness-code-nav`;
  - `npx ph bootstrap backend --code-nav-preview` exits 0, labels the feature
    as Code-nav MCP preview, opt-in only, no codegraph/indexer, and no
    token-saving claim;
  - existing `.opencode/opencode.json` plugin, agent, custom MCP, and top-level
    theme entries are preserved;
  - generated `mcp.persona-harness-code-nav` has `type=local`, `enabled=true`,
    and command `["node", <installed package path to packages/lsp-tools-mcp/bin/code-nav-mcp.mjs>, "mcp"]`;
  - the generated target file exists, and the generated command passed no-model
    framed JSON-RPC `initialize`, `tools/list`, and `tools/call` for `status`,
    `search_text`, and `ast_grep_availability`;
  - `tools/list` contained exactly `ast_grep_availability`, `search_text`, and
    `status`; `status` reported `mcpProtocolServer=true`,
    `registeredWithOpenCode=false`, and `tokenSavingsClaimed=false`;
  - fixture search returned bounded matches, missing root returned unavailable,
    and limited PATH reported ast-grep unavailable with no crash or fake pass;
  - there was no model/OpenCode/eval/native dispatch evidence.
- R-MCP.1c boundaries: this is opt-in registration package-surface evidence
  only, not default registration and not registry `@next` behavior until a later
  publish verifies gitHead. It registers the minimal PH code-nav MCP server in
  config, not OMO/external codegraph, codegraph replacement, LSP daemon,
  provider-token accounting, token-saving/product-efficacy evidence, OMO parity,
  PH superiority, generated app certification, broad reliability, or a closure
  guarantee.
- R-MCP.2 development-navigation probe is QA-verified PARTIAL evidence only:
  - evidence: `.persona/evidence/development-navigation-probe.json`; raw root:
    `.persona/evidence/development-navigation-probe-2026-06-30T121859218Z`;
  - HEAD/model/surface: `20a4ff9`, `openai/gpt-5.4-mini-fast`,
    `opencode run --pure`;
  - codegraph/OMO OFF was verified with `codegraphOff=true`,
    `opencodePure=true`, `PH_R0_CODEGRAPH_OFF=1`, OMO sparkshell disabled,
    CODEGRAPH variables cleared, and raw fixture dirs without `.codegraph` or
    `.opencode`;
  - A/B used the same tiny Java/Spring Controller->Repository violation fixture,
    model, and timeout; B differed by explicit PH code-nav CLI preview command
    only;
  - outcome was equal: both runs exited 0, fixed the violation to route
    `TodoController -> TodoService -> TodoRepository`, and `observe` passed for
    `controller.repository-dependency` and `controller.service-dependency`;
  - narrow navigation-shape signal: B-A tool use -7, read calls -3, unique read
    paths -3, read output chars -1509, tool output chars -8975, OpenCode stdout
    bytes -8218;
  - no token/time reduction was proven: elapsed +20675ms, input tokens +7008,
    output tokens +79, cache-read tokens +13824;
  - this is a single-run development-navigation probe, not provider billing, not
    token-saving/product-efficacy evidence, not PH-owned full MCP, not
    `.opencode` registration, and not codegraph replacement.

## [0.4.0-rc.4] - 2026-06-30

- Prepared `0.4.0-rc.4` as the next-channel prerelease refresh after registry
  `@next=0.4.0-rc.3` still pointed at gitHead
  `cf1204ef77dd6479af2ca65099e4bae9ffedbda0`, which does not include the
  later runtime hook guard levers, strict bootstrap clarity, release
  tag/publish split, or write-deny boundary clarification.
- The rc4 package candidate includes:
  - `3b3754d fix(runtime): add PH hook guard levers`;
  - `d53083c fix(cli): clarify strict bootstrap mode`;
  - `bd9d0a8 ci: decouple tag pushes from npm publish`;
  - `a72ed31 docs(runtime): clarify write deny boundary`;
  - `9318a65 docs: record a72ed31 runtime hook smoke`.
- External current/local tarball package-surface re-smoke on HEAD
  `a72ed31d9f644d054a5614a293c75e4367b7157d` passed the runtime hook guard
  surface:
  - tarball version: `0.4.0-rc.3` before this release-prep bump;
  - tarball shasum: `542d3234d8590f28e516d428afb93f336cd88a81`;
  - sha256: `52c5beff1f3b01a229f61a0f64814d14ddd5c16008bc4f1ba666b040392d1dea`;
  - archive:
    `/Users/yongtae/Desktop/persona-harness-artifacts/archive/2026-06-24-desktop-persona-runs/runtime-hooks-a72ed31-package-surface-20260630-guard`;
  - system constitution injects exactly once and can be disabled with
    `enforce.systemConstitution=false`;
  - write-deny is explicitly documented as a no-op in this runtime because the
    current OpenCode SDK does not expose proposed write content to
    `permission.ask`; enforcement remains closure-time, not write-time;
  - idle continuation remains default-off and opt-in bounded;
  - `bootstrap backend --strict` writes/prints
    `executeVerification=true`, `systemConstitution=true`, `writeDeny=false`,
    and `idleContinuation=false`;
  - `ph observe --json` still emits `controller.repository-dependency`.
- Release workflow now separates tag verification from npm publishing:
  - tag pushes verify and create GitHub release notes only;
  - npm publish is explicit `workflow_dispatch` or local publish only;
  - `next` is the rc dist-tag; do not move `latest`.
- Post-publish registry facts:
  - `persona-harness@0.4.0-rc.4` exists with gitHead
    `c3e4c2bc2178e6edc72581a8d34aedd406be922b`;
  - registry shasum: `7cecf41e5baf6ebf383ea82fd352ab0d8a686b23`;
  - dist-tags: `next=0.4.0-rc.4`, `latest=0.3.9-alpha.8`,
    `alpha=0.3.9-alpha.8`;
  - local `HEAD`, `origin/main`, local tag `v0.4.0-rc.4`, and origin tag
    `v0.4.0-rc.4` all point to
    `c3e4c2bc2178e6edc72581a8d34aedd406be922b`.
- External current/local tarball package-surface smoke on HEAD
  `12562195719745ed371320d04590c68037ab0b05` passed the R1 relay preview
  surface:
  - source was a fresh local/current tarball, not registry `@next`;
  - registry `persona-harness@next` remains `0.4.0-rc.4` at gitHead
    `c3e4c2bc2178e6edc72581a8d34aedd406be922b`, so it does not include the R1
    relay preview commits until a later publish verifies a new gitHead;
  - package/version: `persona-harness@0.4.0-rc.4`;
  - included commits `3c0d675`, `2b452af`, `d46f698`, and `1256219`;
  - tarball:
    `/Users/yongtae/Desktop/persona-harness-artifacts/archive/2026-06-24-desktop-persona-runs/r1-relay-preview-1256219-package-surface-20260630-131649/persona-harness-0.4.0-rc.4.tgz`;
  - npm shasum: `97ca79d47158b7e560f47c6255e01b382d63ba1d`;
  - sha256: `70df6c1abedc08c50ad61ba9bca5523eb0f751140cd30734146485df371f590d`;
  - archive:
    `/Users/yongtae/Desktop/persona-harness-artifacts/archive/2026-06-24-desktop-persona-runs/r1-relay-preview-1256219-package-surface-20260630-131649`;
  - default/off fixture kept `multiAgent.enabled=false`, surfaced relay blocker
    `multi-agent-disabled`, and did not generate the three-role agent map or
    depend on `.opencode/agent`;
  - preview bootstrap preserved existing `.opencode/opencode.json` plugin and
    agent fields, then added top-level `agent` entries for exactly
    `test-writer`, `jaeki`, and `roach` with `mode: subagent`;
  - `test-writer` references `.persona/rules/backend/spring-test.md` section
    `PH Multi-Agent Relay` and
    `packages/shared-skills/skills/programming/references/java/testing.md`
    section `Persona Harness relay contract`;
  - `workflow relay status/next --json` exposes the preview relay state and role
    progression from `test-writer` to `jaeki` to `roach` to closure next via
    role artifact files.
- External current/local tarball package-surface smoke on HEAD
  `4788135b01447f7cbfde3198abfcd45640893ce6` passed the R2 relay coordinator
  state surface:
  - source was a fresh local/current tarball, not registry `@next`;
  - registry `persona-harness@next` remains `0.4.0-rc.4` at gitHead
    `c3e4c2bc2178e6edc72581a8d34aedd406be922b`, so it does not include the R2
    relay coordinator commit until a later publish verifies a new gitHead;
  - package/version: `persona-harness@0.4.0-rc.4`;
  - tarball:
    `/Users/yongtae/Desktop/persona-harness-artifacts/archive/2026-06-24-desktop-persona-runs/r2-relay-coordinator-4788135-package-surface-20260630-133442/persona-harness-0.4.0-rc.4.tgz`;
  - npm shasum: `826097d9ba5445a20d68b091f218af4e7fd208f6`;
  - sha256: `c4be3eebda709de186ac269b35f6727ec85c825a5f26740e059a7d28520723f9`;
  - archive:
    `/Users/yongtae/Desktop/persona-harness-artifacts/archive/2026-06-24-desktop-persona-runs/r2-relay-coordinator-4788135-package-surface-20260630-133442`;
  - default/off fixture kept `multiAgent.enabled=false`, surfaced relay blocker
    `multi-agent-disabled`, reported `currentRole=null`,
    `requiredOutputArtifact=null`, and `roleCompletionState.overall=disabled`,
    and generated no relay agent entries or `.opencode/agent` dependency;
  - preview bootstrap preserved `.opencode/opencode.json` plugin and custom agent
    fields, then exposed `test-writer`, `jaeki`, and `roach` as subagents;
  - `workflow relay status/next --json` now includes `currentRole`,
    `roleCompletionState`, `scopedInputFiles`, `promptBlock`, and
    `requiredOutputArtifact` while keeping the R1 fields;
  - role progression remains read-only and artifact-gated from `test-writer` to
    `jaeki` to `roach` to closure next, with canonical Java guidance references
    preserved in `promptBlock`/`promptLines`;
  - finish still exits nonzero in template report/evidence/pending-ticket state.
- External current/local tarball package-surface smoke on HEAD
  `7d9329449063888092f9a9a1a0141f94728c5e0e` passed the R3b deterministic
  relay artifact gate surface:
  - source was a fresh local/current tarball, not registry `@next` and not
    origin-only;
  - package/version: `persona-harness@0.4.0-rc.4`;
  - tarball:
    `/Users/yongtae/Desktop/persona-harness-artifacts/archive/2026-06-24-desktop-persona-runs/r3b-relay-artifact-gates-7d93294-package-surface-20260630-162610/persona-harness-0.4.0-rc.4.tgz`;
  - npm shasum: `642a9d95fdff0892e089f3d449a193854e9e236c`;
  - sha256: `5a39ecca7bfc05aa9f624cd87b8fd958bb36830401f1d7514acbb012fd399a4d`;
  - archive:
    `/Users/yongtae/Desktop/persona-harness-artifacts/archive/2026-06-24-desktop-persona-runs/r3b-relay-artifact-gates-7d93294-package-surface-20260630-162610`;
  - disabled/default kept relay `enabled=false`, blocker `multi-agent-disabled`,
    and no unintended relay agent behavior;
  - missing artifacts report `role-test-artifact-missing`, `readiness=missing`,
    and reason `Role artifact is missing.`;
  - incomplete/template-like or role-boundary-violating artifacts block with
    `role-test-artifact-incomplete`, `role-implementation-artifact-incomplete`,
    or `role-review-artifact-incomplete`;
  - valid artifacts progress read-only and artifact-gated through
    `test-writer` -> `jaeki` -> `roach` -> `npx ph workflow closure next --json`;
  - complete state reports `currentRole=null`, `nextRole=null`,
    `roleCompletionState.overall=complete`, `incompleteRoles=[]`, and
    `requiredOutputArtifact=null`;
  - JSON includes `roleArtifacts[].readiness`, `roleArtifacts[].reason`, and
    `roleCompletionState.incompleteRoles`; canonical Java guidance references
    remain in the `test-writer` handoff/agent prompt;
  - workflow archive and finish still block in incomplete
    verification/report/evidence/pending-ticket state, with no report auto-fill,
    ticket auto-archive, or finish/archive gate weakening.
- External current/local tarball package-surface smoke on HEAD
  `ebc57dd2ae72c947255f472145291d424f5d2337` passed the R4 relay validator
  surface:
  - source was a fresh local/current tarball, not registry `@next` and not
    origin-only;
  - package/version: `persona-harness@0.4.0-rc.4`;
  - tarball:
    `/Users/yongtae/Desktop/persona-harness-artifacts/archive/2026-06-24-desktop-persona-runs/r4-relay-validate-ebc57dd-package-surface-20260630-163930/persona-harness-0.4.0-rc.4.tgz`;
  - npm shasum: `c02cfd8a666db066dac57b7a3d6cc2b5059ba230`;
  - sha256: `8bd2d4f21ab28fe03992675b8349934cc13efe4ab8abddcb880fb4f1d1e3cf89`;
  - archive:
    `/Users/yongtae/Desktop/persona-harness-artifacts/archive/2026-06-24-desktop-persona-runs/r4-relay-validate-ebc57dd-package-surface-20260630-163930`;
  - `npx ph workflow relay validate --json` returns `action: validate` in
    disabled, missing, incomplete, and valid fixture states;
  - missing-artifact validation does not create the roles directory or change the
    work ticket file list;
  - incomplete/template artifacts report `role-test-artifact-incomplete`,
    `readiness=incomplete`, and
    `roleCompletionState.incompleteRoles=[test-writer]` without changing artifact
    hashes;
  - valid artifacts report no role blockers, gate command
    `npx ph workflow closure next --json`, complete role state, empty
    `incompleteRoles`, and `requiredOutputArtifact=null` while preserving all role
    artifact hashes;
  - workflow archive and finish still block in incomplete
    verification/report/evidence/pending-ticket state, with no report auto-fill,
    ticket auto-archive, or finish/archive gate weakening.
- External current/local tarball package-surface smoke on HEAD
  `24f85001605b7c121f11a2933a3ebfd0453434a7` passed the R5 relay validate text
  surface:
  - source was a fresh local/current tarball, not registry `@next` and not
    origin-only;
  - package/version: `persona-harness@0.4.0-rc.4`;
  - tarball:
    `/Users/yongtae/Desktop/persona-harness-artifacts/archive/2026-06-24-desktop-persona-runs/r5-relay-validate-text-24f8500-package-surface-20260630-165522/persona-harness-0.4.0-rc.4.tgz`;
  - npm shasum: `022dd98f49e8d018800309213af6ea062be1af23`;
  - sha256: `40b3ff2d0f2715754a4f58191d8a8a3083b55053bc4ecd22bc2c0509a9175496`;
  - archive:
    `/Users/yongtae/Desktop/persona-harness-artifacts/archive/2026-06-24-desktop-persona-runs/r5-relay-validate-text-24f8500-package-surface-20260630-165522`;
  - `ph workflow relay validate` human text works in missing, incomplete, and
    complete role-artifact states;
  - missing text includes current ticket, current/next role, readiness, first
    blocker `role-test-artifact-missing`, required artifact, gate command,
    authoring hints, and read-only/no native dispatch/no artifact writes/PH
    closure gate boundary;
  - incomplete text prints `role-test-artifact-incomplete` and reason;
  - complete text prints all role artifacts complete, first blocker none,
    required artifact none, and gate command
    `npx ph workflow closure next --json`;
  - `validate --json` remains compatible with `action: validate`, blockers,
    readiness, reason, `incompleteRoles`, and closure-next gate command for
    complete artifacts;
  - no-write evidence remained intact: missing human validate did not create
    roles files, and incomplete/complete artifact hashes were unchanged;
  - workflow archive and finish still block when closure blockers remain, with no
    report auto-fill, ticket auto-archive, or finish/archive gate weakening.
- Boundaries remain narrow: current/local tarball package-surface evidence only
  plus post-publish registry metadata; no eval/A-B proof, PH superiority,
  registry `@next` behavior for R1/R2/R3b/R4/R5, model/OpenCode run proof, native
  subtask dispatch, token-savings guarantee, OMO parity, autonomous completion
  claim, generated app certification, broad architecture correctness, general
  reliability, or closure guarantee is claimed.

## [0.4.0-rc.3] - 2026-06-30

- Added a conservative PH hook-lever slice for the current OpenCode plugin
  surface:
  - `experimental.chat.system.transform` now injects an idempotent PH system
    constitution with turn-local intent reset, context-completion gate, and
    finish guard wording; this is still prose and may be ignored, while
    finish/archive gates remain authoritative;
  - `enforce.systemConstitution` defaults on, while `enforce.idleContinuation`
    and `enforce.writeDeny` default off in `.persona/harness.jsonc`;
  - opt-in idle continuation can send a bounded follow-up prompt on
    `session.idle` when closure blockers remain, but it is a nudge, not
    orchestration or a hard stop;
  - hard write-content deny remains SDK-impossible in the current hook surface
    because `permission.ask` does not expose proposed file content/path enough
    to evaluate writes safely.
- External current/local tarball package-surface re-smoke on HEAD
  `a72ed31d9f644d054a5614a293c75e4367b7157d` passed the runtime hook guard
  surface after the write-deny boundary clarification:
  - source was a fresh current local tarball, not registry `@next`;
  - tarball version: `0.4.0-rc.3`;
  - included commits `3b3754d`, `d53083c`, and `bd9d0a8`;
  - tarball shasum: `542d3234d8590f28e516d428afb93f336cd88a81`;
  - sha256: `52c5beff1f3b01a229f61a0f64814d14ddd5c16008bc4f1ba666b040392d1dea`;
  - archive:
    `/Users/yongtae/Desktop/persona-harness-artifacts/archive/2026-06-24-desktop-persona-runs/runtime-hooks-a72ed31-package-surface-20260630-guard`;
  - system constitution injected exactly once and can be disabled with
    `enforce.systemConstitution=false`;
  - installed package root export import path worked for the system constitution;
  - constitution wording says system prompt prose may be ignored and
    finish/archive gates remain authoritative;
  - updated write-deny boundary was observed: `Write-deny is a no-op in this
    runtime`; OpenCode `permission.ask` lacks proposed write content, so PH
    cannot block writes mid-flight by content and enforcement is closure-time,
    not write-time;
  - idle continuation is default-off and opt-in; with repeated same blocker it
    emits one bounded `session.promptAsync` nudge, and no-blocker state emits
    none;
  - `bootstrap backend --strict` writes/prints
    `executeVerification=true`, `systemConstitution=true`, `writeDeny=false`,
    and `idleContinuation=false`, with no product-quality or closure guarantee
    wording;
  - `ph observe --json` still emitted `controller.repository-dependency`.
- This runtime hook evidence remains package-surface evidence only. Write guard
  remains non-blocking warning / SDK-impossible; no hard write-deny/rewrite,
  model/OpenCode/eval proof, generated app certification, broad architecture
  correctness, general reliability, or closure guarantee is claimed.
- Prepared `0.4.0-rc.3` as the next-channel prerelease refresh for GUARD Phase
  0-3 after published `@next` remained behind the current BYO ast-grep and
  observe-alignment fixes:
  - includes strict backend bootstrap from `c499169`;
  - includes registry blocker iteration from `b7b5c45`;
  - includes BYO `.persona/conventions/*.yml` ast-grep preview from `a9bf926`;
  - includes `1c304e4 fix(cli): emit ast-grep observe findings`.
- External current-tarball package-surface re-smoke on HEAD
  `1c304e412093dd0621d911ce379ef3f66ea7f224` passed BYO ast-grep observe
  alignment:
  - `ph observe --json` emits `controller.persistence-import` with
    `source=ast-grep`, `checkKind=ast-grep`, file/line evidence, evidence
    message, and `fixPath`;
  - workflow check/closure/continue align on
    `architecture-controller-persistence-import`, step
    `fix-controller-persistence-import`, and the Service/DTO fix path;
  - finish/archive block for level `block`; `warn` and `report` stay
    non-hard-blocking; compliant fixtures have no BYO blocker and finish 0;
  - missing `sg`/`ast-grep` skips with a warning instead of crashing or faking a
    hard blocker;
  - existing Controller -> Repository blocker regression remained PASS.
- Boundaries remain narrow: BYO ast-grep is preview/simple YAML metadata, not a
  broad YAML ecosystem or broad architecture correctness claim. Hard
  write-content deny remains SDK-impossible in the current hook surface; the
  write guard is warning-only and closure-time enforcement remains
  authoritative. Evidence is QA plus current-tarball package-surface smoke, not
  eval/A-B proof, PH superiority, generated app quality certification, broad
  architecture correctness, general reliability, or a closure guarantee.
- This is release prep only. Expected publish tag is `next`; do not move
  `latest`.

## [0.4.0-rc.2] - 2026-06-30

- Current HEAD after release prep adds
  `b7b5c45 fix(cli): iterate registry convention blockers` and
  `a9bf926 fix(cli): support ast-grep conventions`; QA was PARTIAL only because
  docs still had stale BYO wording, while behavior/tests passed:
  - architecture convention closure blockers now flow through registry/config
    metadata instead of a single hard-coded Controller rule path;
  - registry metadata carries `blockAllowed`, `highPrecision`, `blockerId`,
    `stepId`, and `fixPath`, plus lookup helpers;
  - `controller.repository-dependency` remains the first/default block-capable
    convention;
  - `report|warn|block` levels are honored: `block` creates closure, archive,
    and finish blockers, while `warn` and `report` do not hard-block;
  - unsafe or low-precision rules must not become hard blockers;
  - `workflow check`, `workflow closure`, `workflow continue`,
    `workflow finish`, and the archive guard consume structured registry blocker
    metadata;
  - BYO `.persona/conventions/*.yml` ast-grep authoring is now available as a
    skip-if-missing preview: absent `sg`/`ast-grep` warns instead of faking a
    pass, and block-capable rules still require high precision plus a fix path.
    Current registry size is 2 conventions, including 1 ast-grep convention:
    `controller.persistence-import`.
  - `1c304e4 fix(cli): emit ast-grep observe findings` resolved the previous
    BYO observe gap in current-tarball package-surface smoke: `ph observe --json`
    now emits `controller.persistence-import` with ast-grep source metadata,
    file/line evidence, and `fixPath`; check/closure/continue/finish/archive
    stay aligned on `architecture-controller-persistence-import` and
    `fix-controller-persistence-import`.
  - hard write-content deny remains SDK-impossible in the current OpenCode hook
    surface because `permission.ask` does not expose proposed file content;
    closure-time enforcement remains authoritative.
- Next-channel prerelease prep for the current GUARD Phase 0-3 commits after
  published `0.4.0-rc.1`:
  - expected publish tag is `next`; do not move `latest`;
  - packages current HEAD guard/enforcement-loop work, including opt-in direct
    verification, convention levels, warning-only write guard fallback, and the
    convention registry;
  - evidence is QA plus current-tarball package-surface smoke, not published
    registry `@next` evidence until `0.4.0-rc.2` is actually published;
  - this is scoped product enforcement behavior, not eval/A-B proof, PH
    superiority, generated app quality certification, broad architecture
    correctness, general reliability, or a closure guarantee.

- `002359c fix(cli): reject lossy Windows stdin mojibake` adds a
  corruption-prevention guard for Windows stdin flows:
  - the rc1 Windows implementation trial was blocked before the model because
    an ASCII-safe script used `Get-Content -Raw | npx ph workflow draft --stdin`;
  - Windows PowerShell 5.x can read UTF-8 no-BOM files as ANSI/CP949 first,
    producing already-lossy text such as `媛꾨떒??????API 留뚮뱾?`;
  - once `?` replacement appears, Persona Harness cannot reconstruct the
    original Korean text;
  - `workflow draft --stdin` and `workflow capture --stdin` now reject lossy
    mojibake input nonzero instead of writing corrupted requirements;
  - Windows users should pipe with an explicit encoding, for example
    `Get-Content -LiteralPath <path> -Raw -Encoding UTF8 | npx ph workflow draft --stdin`,
    and use the same `-Encoding UTF8` pattern for `workflow capture --stdin`;
  - this does not repair already corrupted artifacts and is not eval/A-B
    evidence, PH superiority proof, generated app quality certification, or a
    general reliability/closure guarantee.
- Current-head `002359c` Windows SSH focused continuation remains
  PARTIAL/BLOCKED:
  - archive:
    `/Users/yongtae/Desktop/persona-harness-artifacts/archive/2026-06-24-desktop-persona-runs/current-head-002359c-ssh-focused-continuation-20260629-200215`;
  - the existing Windows D workspace was reachable over SSH and the previous
    Korean/stdin issue was no longer the blocker;
  - timeout alone was not the root cause: wrapper props were absent, but custom
    `gradlew.bat` could run;
  - the initial Gradle failure was missing
    `org.junit.platform:junit-platform-launcher`; repair continuation added
    `testRuntimeOnly 'org.junit.platform:junit-platform-launcher'`;
  - after repair, `npx ph bearshell powershell -NoProfile -Command ".\\gradlew.bat test"`
    passed and build passed;
  - backend-shape was generated with major shape checks mostly PASS, while DTO
    boundary and Verification report WARN remain;
  - product source scan did not observe fake `gradle-shim`, Java `HttpServer`,
    CommonJS, or Express bypasses;
  - OpenCode closure continuation hung during the build bearshell step, reports
    stayed template, `req-1` stayed pending, and final
    `workflow finish implement` exited 1;
  - this is product usability validation only: Windows can reach repair
    build/test PASS, but closure/report/archive/finish follow-through remains a
    blocker. Stable `0.4.0` remains deferred, and future Windows validation
    should prefer a less script-heavy TUI/operator flow because the current
    automation/PowerShell/SSH route may overfit validation mechanics.
- Less-script-heavy Windows operator route is also BLOCKED before model until
  the guide/current CLI surface is corrected and reverified:
  - archive:
    `/Users/yongtae/Desktop/persona-harness-artifacts/archive/2026-06-24-desktop-persona-runs/less-script-heavy-windows-operator-exec-20260629-203000`;
  - a fresh D workspace installed current tarball `0.4.0-rc.1`; init, doctor,
    and bootstrap passed;
  - Korean preservation failed even with the guide command
    `Get-Content -LiteralPath idea-utf8.txt -Raw -Encoding UTF8 | npx ph workflow draft --stdin`;
    requirements `Original idea` became `??? ? ? API ???`;
  - the guide expected `workflow approve requirements`, `workflow split`, and
    `workflow next`, but the installed current CLI reported unknown command for
    those in the run;
  - no OpenCode/model implementation executed;
  - final no-model finish exited 1 with expected blockers;
  - do not reuse this guide/operator route as stable evidence until command
    names and Windows encoding behavior are corrected and reverified.
- `e688d39 fix(cli): guard lossy Windows stdin and pack stale dist` addresses
  the two current-head/fresh-tarball blockers exposed by that run:
  - pure question-mark lossy input such as `??? ? ? API ???` can no longer be
    stored as requirements; `workflow draft --stdin` and
    `workflow capture --stdin` reject unrecoverable replacement input before
    writing requirements;
  - the existing `媛...???` mojibake guard remains, and normal Korean UTF-8
    stdin remains preserved;
  - local tarballs used by smoke could contain stale `dist`, which explained the
    guide/current CLI mismatch where `workflow approve requirements`,
    `workflow split`, and `workflow next` appeared missing;
  - `prepack: npm run build` now prevents stale `dist` in `npm pack`;
  - this does not reconstruct already-lost `?` text or repair existing broken
    artifacts retroactively, and it is a current HEAD/future package fix rather
    than proof that published `0.4.0-rc.1 @next` already contains it.
- Current-head `e688d39` Windows operator retry moved the blocker but did not
  reach implementation-to-finish PASS:
  - archive:
    `/Users/yongtae/Desktop/persona-harness-artifacts/archive/2026-06-24-desktop-persona-runs/current-head-e688d39-windows-operator-retry-20260629-204500`;
  - fresh current HEAD tarball with `e688d39` installed on a Windows D-drive
    workspace;
  - packaging/stale `dist` issue was resolved and the current command surface
    was available;
  - lossy `??? ? ? API ???` stdin was rejected without writing requirements;
  - Korean `간단한 할 일 API 만들래` was preserved when PowerShell encoding
    variables were set to UTF-8;
  - no-token `workflow draft` / approve / split / next / continue / check /
    closure status / closure next preflight passed;
  - implementation-to-finish blocked before app output: OpenCode started and
    read workflow/profile/planner context, but README was absent and a malformed
    duplicated `.persona/policies` path hit `external_directory` auto-reject;
  - no `src` or Gradle files were generated; reports stayed template, ticket
    stayed pending, and final `workflow finish implement` exited 1;
  - interpretation: preflight PASS, implementation-to-finish NOT PASS. The
    blocker moved from Windows input/packaging/command surface to OpenCode
    implementation entry/context path. Stable `0.4.0` remains deferred.
- `a307ac0 fix(cli): guide README-absent workflow entry` reduces that
  README-absent entry/context ambiguity:
  - trigger: the `e688d39` Windows operator retry reached preflight PASS, then
    OpenCode stopped before app output with README absent and a malformed
    duplicated `.persona/policies` path;
  - CLI investigation did not find the duplicated absolute path in CLI/operator
    prompt output, so it is likely model/operator generated;
  - CLI-owned gap: README-absent workspaces still had rail guidance that could
    over-emphasize README or `.persona/policies` directory reading;
  - `workflow implement`, `workflow continue`, and `plan --implement` now
    explicitly handle README absence and guide agents to repo-relative
    source-of-truth files: `.persona/project-profile.jsonc`,
    `.persona/policies/overlay.jsonc`, `.persona/workflow/plan.md`, and the
    current ticket / requirements source;
  - README-present behavior keeps README chunk guidance;
  - this does not guarantee model follow-through, weaken finish gates, auto-fill
    reports, or auto-archive tickets.
- Current-head `a307ac0` Windows operator retry improved preflight but remained
  PARTIAL/NOT PASS for implementation-to-finish:
  - result:
    `/Users/yongtae/Desktop/persona-harness-artifacts/archive/2026-06-24-desktop-persona-runs/current-head-a307ac0-windows-operator-retry-20260629-212905/RESULT.md`;
  - fresh tarball preflight passed: stale `dist` was fixed, approve/split/next
    command surface was available, lossy `???` stdin was rejected, Korean was
    preserved, no-token workflow/closure preflight passed, README-absent
    guidance was observed, and the malformed duplicated `.persona/policies`
    path did not recur;
  - implementation-to-finish did not pass: OpenCode read
    `.persona/policies/overlay.jsonc`, but no app output was generated and
    `src` / Gradle files were absent;
  - the model still filled reports/report-filled and archived `step-1`;
  - final `workflow finish implement` exited 1 on `STACK_MISMATCH` plus pending
    `step-2`, `step-3`, and `step-4`;
  - interpretation: previous Windows input/packaging/README-absent path
    blockers improved or resolved, while the new blocker is report/archive
    integrity before final finish. The finish gate correctly blocked, but
    report-filled/archive steps may be too permissive before real
    implementation/evidence. Stable `0.4.0` remains deferred.
- `8660ef3 fix(cli): guard ticket archive on closure blockers` addresses the
  archive side of that integrity blocker:
  - decision: `plan --report-filled` remains a report marker, not a product
    quality gate;
  - `workflow archive <ticket>` now reads closure state and refuses to move work
    to history when non-ticket closure blockers remain;
  - archive-blocking non-ticket blockers include `verification-unknown`,
    `evidence-missing`, `report-coverage-missing`, and stack / verification /
    report blockers;
  - pending-ticket and history-repair blockers are not treated as archive
    blockers;
  - when reports are marked filled but no app/evidence/verification exists,
    archive exits 1 and leaves backlog/work ticket pending;
  - this does not auto-fill reports, auto-archive tickets, or weaken the finish
    gate.
- Current-head `8660ef3` Windows operator retry then classified as
  INTEGRITY-PASS/PARTIAL:
  - archive:
    `/Users/yongtae/Desktop/persona-harness-artifacts/archive/2026-06-24-desktop-persona-runs/current-head-8660ef3-windows-operator-retry-20260629-221043/RESULT.md`;
  - fresh tarball preflight passed: prepack/build, approve/split/next/archive
    command surface, lossy `???` rejection, Korean UTF-8 preservation,
    README-absent guidance, and no-token workflow/closure preflight;
  - no-app/no-evidence `npx ph workflow archive step-1` exited 1 with
    `verification-unknown`, `implementation-report-missing`, and
    `review-report-missing`, and `workflow next` kept `step-1` current;
  - after OpenCode generated a minimal Java/Spring/Gradle skeleton and evidence
    made verification passed, `step-1` moved to history;
  - final `workflow finish implement` still exited 1 because `step-2`,
    `step-3`, and `step-4` remained pending, with backend-shape WARNs remaining.
    Interpretation: integrity guard verified; single ticket archived after
    evidence; finish blocked correctly due pending tickets. Stable `0.4.0`
    remains deferred.
- `0784135 fix(cli): block controller repository closure` records the first
  scoped hard convention blocker in the workflow closure loop:
  - existing observer signal `controller.repository-dependency` is promoted to
    hard blocker `architecture-controller-repository-direct-dependency`;
  - scope is intentionally narrow: ready Java/Spring service-layer profile
    styles only, and only when typed evidence names the Controller, Repository,
    source file, and direct dependency;
  - `workflow check`, `workflow closure next --json`, `workflow continue`,
    `workflow finish implement`, and `workflow archive <ticket>` now surface or
    block the violation consistently;
  - action wording tells the agent to route the Controller through a Service
    layer instead of depending directly on a Repository;
  - compliant Controller -> Service -> Repository paths have no architecture
    blocker;
  - other backend-shape WARNs remain report-only. This is not broad
    architecture correctness enforcement, does not add `closure run`, custom
    conventions, report auto-fill, auto-archive, or finish gate weakening.
- GUARD Phase 0-3 landed and passed QA/package-surface smoke on current HEAD
  `7fda771f74008f42082c3a85377262c8fc7ccf5f`, not the published
  `0.4.0-rc.1 @next` package:
  - included commits: `c2819ac fix(cli): add opt-in direct verification gate`,
    `ffeafa9 fix(cli): support convention blocker levels`,
    `2f561a0 fix(runtime): warn on write-time convention violations`, and
    `7fda771 refactor(cli): add convention registry`;
  - QA reported focused 134 tests PASS, full `npm test` 70 files / 486 tests
    PASS, plus typecheck, build, product smoke, and built CLI smoke PASS;
  - package-surface smoke used a fresh current HEAD tarball
    `persona-harness-0.4.0-rc.1.tgz` with shasum
    `b703953aab409f1cd7ac578c5af76b3d3e42cf90` and sha256
    `2155ac28c48367c85d2a4163ba56ecea5dd1842b1d0e0935313c665ab9d55b7c`;
  - archive:
    `/Users/yongtae/Desktop/persona-harness-artifacts/archive/2026-06-24-desktop-persona-runs/current-head-7fda771-guard-package-surface-smoke-20260630-001558`;
  - Phase 0 PASS: opt-in `.persona/harness.jsonc`
    `enforce.executeVerification: true` makes PH-run direct `gradlew test` /
    JUnit evidence authoritative for supported Java/Spring/Gradle verification;
    fake agent-written passed evidence does not pass, PH-run success passes, and
    JUnit failure blocks. Disabled mode keeps the existing structured bearshell
    evidence flow;
  - Phase 1 PASS: convention levels `report|warn|block` are supported.
    `controller.repository-dependency` at block level produces
    `architecture-controller-repository-direct-dependency`; warn/report levels
    do not hard-block, and compliant Controller -> Service -> Repository has no
    architecture blocker;
  - Phase 2 PASS/PARTIAL by design: write-time hook output supports
    warning-only fallback for convention violations because hard deny/rewrite is
    not supported by the current plugin hook result type. Do not call this
    write-time enforcement;
  - Phase 3 PASS: the convention registry centralizes id/default level/blocker
    id/fix path for observe, check, closure, continue, finish, archive, and
    write-warning surfaces. Current HEAD through `1c304e4` adds BYO
    `.persona/conventions/*.yml` ast-grep convention preview support; the
    registry has 2 conventions, including 1 ast-grep convention
    (`controller.persistence-import`). Missing `sg`/`ast-grep` skips with a
    warning instead of faking a pass. External targeted current-tarball smoke
    passed BYO observe/check/closure/continue/finish/archive alignment, including
    `ph observe --json` emission of `controller.persistence-import` ast-grep
    findings;
  - this is current-tarball package-surface evidence only; registry `@next` may
    remain stale until a later package publish;
  - this is scoped product enforcement behavior, not eval/A-B proof, PH
    superiority, generated app quality certification, broad architecture
    correctness, general reliability, or a closure guarantee.

## [0.4.0-rc.1] - 2026-06-29

- Workflow closure rail product milestone candidate:
  - fresh RC prep from current alpha8 state, not the stale parked `5edb535`
    draft;
  - packages closure rail convergence from `e8bb779 fix(cli): converge workflow
    closure rail`;
  - active `workflow continue` uses the closure rail as its single source;
  - `workflow finish implement` blocker/reason rendering uses closure
    payload/state via `workflowClosureFinishReasons`;
  - `workflow closure status --json` remains a state snapshot, while
    `workflow closure next --json` includes `nextStep`;
  - retired old string layers: `workflow-post-build-closure.ts`,
    `workflow-continue-followups.ts`, and `workflow-finish-reasons.ts`;
  - no `closure run`, report auto-fill, ticket auto-archive, workflow
    auto-finish, or finish gate weakening is included.
- Product usability evidence:
  - based on alpha8 registry no-token closure rail smoke PASS;
  - based on one alpha8 registry implementation-to-finish product usability
    success path PASS;
  - final `workflow finish implement` passed under closure-state routing;
  - terminal closure state had `currentTicket: null`, no pending tickets, filled
    reports, verification passed, and empty blockers;
  - this is one product usability success-path smoke only, not eval/A-B
    evidence, PH superiority proof, generated app quality certification,
    closure guarantee, or a general reliability guarantee.
- Release/tag boundary:
  - recommended npm publish dist-tag is `next`;
  - do not move `latest`; `latest` is currently observed at `0.3.9-alpha.8`;
  - eval remains stopped and `docs/current/injection-value-status.json` remains
    `injection-effect-not-proven`.
- Post-publish verification:
  - `persona-harness@0.4.0-rc.1` exists with gitHead
    `981b7b75d035ad16ee5e2b7f8bec5482d19f2873` and shasum
    `c987701b4ed55324e1a555f4e31545e4d0cb3757`;
  - dist-tags are `next=0.4.0-rc.1`, `alpha=0.3.9-alpha.8`,
    `latest=0.3.9-alpha.8`;
  - local/origin tag `v0.4.0-rc.1` points at
    `981b7b75d035ad16ee5e2b7f8bec5482d19f2873`;
  - no republish, latest move, eval/model/OpenCode run, PH superiority proof,
    generated app certification, or general reliability guarantee is claimed.
- `@next` real-user smoke:
  - registry `next` installed `persona-harness@0.4.0-rc.1`;
  - Stage 1 no-token closure rail smoke passed in a stable local workspace;
  - Stage 2 local implementation-to-finish proxy trial passed with OpenCode
    stdin plus `openai/gpt-5.4-mini-fast`, Java/Spring/Gradle Todo API,
    Gradle test/build PASS, filled reports, `req-1` archived, terminal
    `workflow closure next`, and final `workflow finish implement` exit 0;
  - `closure run` remains deferred because the local trial finished with the
    planner / continue / finish surfaces only;
  - Windows SSH remote validation was BLOCKED by SCP/SSH hang before product
    behavior, so it is not a Windows product PASS or FAIL;
  - Windows local operator direct PowerShell route passed for rc1 `@next`
    no-model closure/product surface:
    - source note:
      `/Users/yongtae/Desktop/persona-harness-artifacts/archive/2026-06-24-desktop-persona-runs/rc1-windows-validation-path-20260629-173647/user-local-operator-pass-20260629/RESULT.md`;
    - workspace `D:\persona-harness-smoke-rc1-next-local-20260629-174728`;
    - registry `persona-harness@next` installed `0.4.0-rc.1`;
    - init/default backend, doctor, bootstrap, and Runtime readiness passed;
    - Korean `TODO 웹 서비스 만들래` was preserved across
      requirements/backlog/task-card/continue/closure JSON;
    - finish blocked as expected in no-model state with `FINISH_EXIT=1` and
      blockers `verification-unknown`, `implementation-report-missing`,
      `review-report-missing`, `evidence-missing`, `pending-ticket`;
    - reports stayed `Status: template`, ticket stayed pending, and no
      auto-fill, auto-archive, or gate weakening occurred;
  - proxy feedback from existing artifacts marked the workflow rail helpful:
    `closure status` -> `closure next` -> `workflow finish` helped return to
    terminal/complete state without guessing, with decisive cues
    `currentTicket: null`, `pendingTickets: []`, `finish: passed`, and
    `nextStep: terminal`;
  - commands-too-many was not triggered, closure confusing was tolerable, and
    closure run requested was not triggered;
  - report consistency/noise remains a soak watch item because
    `verification passed` plus report-only WARN/backend-shape split can confuse
    users;
  - rc.1 should soak under `@next`; stable `0.4.0` waits for real external user
    feedback, any desired Windows implementation-to-finish/model route, and
    avoidance of SSH/SCP remote validation instability;
  - no eval/A-B, PH superiority proof, generated app quality certification,
    closure guarantee, general reliability guarantee, or latest move is claimed.

## [0.3.9-alpha.8] - 2026-06-29

- Workflow closure rail convergence:
  - includes `e8bb779 fix(cli): converge workflow closure rail`;
  - active `workflow continue` now uses the closure rail as its single source,
    without old follow-up dual-rendering;
  - `workflow finish implement` blocker/reason rendering now uses closure
    payload/state via `workflowClosureFinishReasons`;
  - retired old string layers: `workflow-continue-followups.ts` and
    `workflow-finish-reasons.ts`; `workflow-post-build-closure.ts` was already
    retired;
  - no finish gate weakening, no report auto-fill, no ticket auto-archive, and
    no `closure run` executor were added.
- Workflow closure planner wiring follow-up:
  - includes `a8eb03d fix(cli): wire closure planner into workflow continue`;
  - active `workflow continue` now consumes closure planner payload/`nextStep`
    through `workflow-closure-rail.ts`;
  - `workflow closure status --json` remains the state snapshot, while
    `workflow closure next --json` includes `nextStep`;
  - retired the old post-build closure string layer
    `workflow-post-build-closure.ts`;
  - `workflow-finish-reasons.ts` remains gate-specific final authority wording
    and `workflow-status.ts` remains report-only summary/next to avoid circular
    dependency;
  - no finish gate weakening, no report auto-fill, no ticket auto-archive, and
    no `closure run` executor were added.
- Release boundary:
  - prior release prep commit `5edb535 chore(release): prepare 0.4.0-rc.1` is
    stale/parked because code changed after it;
  - do not publish, tag, push, or move `latest` from that prep;
  - alpha8 is a narrow alpha release vehicle, not immediate RC publish.
- Verification boundary:
  - QA verified the convergence with no-token product smoke and read-only
    closure rail smoke;
  - current-tarball implementation-to-finish trial was BLOCKED by remote
    SSH/SCP/PowerShell instability, not classified as Persona Harness PASS or
    FAIL;
  - observed preflight included local tarball install/init/doctor/bootstrap,
    no-token closure preflight, OpenCode sanity, `workflow continue` closure
    planner next step, closure status/next blocker ordering, and correct
    pre-implementation `workflow finish implement` blocking;
  - no eval/A-B, PH superiority proof, generated app quality certification, or
    `latest` move is claimed.
- Post-publish registry smoke:
  - `persona-harness@0.3.9-alpha.8` exists with gitHead
    `3bb90aa50c8d1231189a5ca00665e8d5bfccade9` and shasum
    `cd26989425223b5145f190c2dfbfa5ad84e57cf9`;
  - dist-tags are `alpha=0.3.9-alpha.8`, `latest=0.3.9-alpha.8`;
  - local/origin tag `v0.3.9-alpha.8` points at
    `3bb90aa50c8d1231189a5ca00665e8d5bfccade9`;
  - registry no-token closure rail smoke passed: install, Korean idea-first
    preservation, shared closure blocker order across `workflow continue`,
    `workflow closure status --json`, `workflow closure next --json`, and
    `workflow finish implement`;
  - first step/blocker was `verify-app` / `verification-unknown`;
  - blocked finish remained strict/nonzero, reports stayed template, `req-1`
    stayed pending, and no evidence directory/history archive was created;
  - no auto-fill, auto-archive, gate weakening, model/OpenCode implementation,
    eval/A-B, PH superiority proof, or generated app certification is claimed.
  - `latest` is now observed at `0.3.9-alpha.8`, but this is not eval proof,
    generated-app quality certification, or a general reliability guarantee.
- Implementation-to-finish success path smoke:
  - registry `persona-harness@alpha` installed `0.3.9-alpha.8`;
  - final `workflow finish implement` passed under closure-state routing;
  - terminal closure state had `currentTicket: null`, no pending tickets, filled
    reports, verification passed, and empty blockers;
  - this is one product usability smoke only, not eval/A-B evidence, PH
    superiority proof, generated app quality certification, or a general
    reliability guarantee.

## [0.3.9-alpha.7] - 2026-06-29

- Workflow closure planner release:
  - includes `5df7dc1 feat(cli): add workflow closure planner`;
  - includes `b3f24c7 fix(cli): stabilize workflow closure JSON schema`;
  - includes `d5e5150 docs: record workflow closure planner contract`;
  - adds read-only `workflow closure status --json` and
    `workflow closure next --json`;
  - moves the B response from more prose/checklist patching toward a
    state-readable closure planner that exposes workflow state and the first
    actionable blocker;
  - stabilizes JSON state keys, including `currentTicket: null` when no current
    ticket exists;
  - keeps blocker ordering deterministic and verification evidence-backed, so
    command names alone do not become PASS evidence;
  - `workflow finish implement` remains the final authority;
  - the planner does not add `closure run`, write reports, archive tickets,
    finish workflows, weaken gates, or claim retroactive success for the alpha6
    single finish trial;
  - design contract:
    `docs/current/workflow-closure-state-machine-design.md`.
- QA/release-prep boundary:
  - QA re-verification passed for closure JSON smoke, product MVP smoke,
    focused closure tests, and typecheck before release prep;
  - this release is product workflow closure planner surface only, not eval
    proof, PH superiority proof, generated app quality certification,
    AST/linter enforcement, or OpenCode/model outcome evidence.
- Post-publish registry facts:
  - `persona-harness@0.3.9-alpha.7` exists with gitHead `56f38eb2f37d217267cb51ee347538a18114625f` and shasum `85af4864892a938310c0f1f87ead7bca8cf7a9cb`;
  - dist-tags are `alpha=0.3.9-alpha.7`, `latest=0.3.9-alpha.3`;
  - local/origin tag `v0.3.9-alpha.7` points at `56f38eb2f37d217267cb51ee347538a18114625f`;
  - `latest` was not moved;
  - no registry smoke, eval/model/OpenCode run, PH superiority proof, or generated app quality certification is claimed by this post-publish verification.
- Alpha7 implementation-to-finish product usability smoke:
  - External Smoke completed one Windows SSH registry trial from `persona-harness@alpha` / `persona-harness@0.3.9-alpha.7` in `D:\persona-harness-smoke-alpha7-finish-20260629-131050-retryutf`;
  - OpenCode invocation lesson: positional prompt plus unqualified `gpt-5.4-mini-fast` failed with `EUNKNOWN: unknown error, read`; stdin prompt plus provider-qualified `openai/gpt-5.4-mini-fast` returned OK, and fallback `openai/gpt-5.4-mini` also returned OK. Treat this as a local invocation/wrapper route issue, not a Persona Harness product issue or proven provider outage;
  - Korean idea-first input was preserved, the no-token rail completed draft/approve/split/next/continue/check, and the closure planner surfaced stable JSON plus first actionable blockers;
  - OpenCode used the PH rail, generated a Spring Boot/Gradle backend, filled implementation/review reports, ran report-filled commands, archived `req-1`, handled the Java role read coverage blocker, and `workflow finish implement` passed;
  - `gradlew.bat test`, `bootJar`, and `build` reached `BUILD SUCCESSFUL` after generated test import repairs; runtime smoke observed create/update/delete success plus 404/400 responses;
  - final `workflow check` WARN had no pending tickets; remaining WARNs were report-only/non-blocking, including backend-shape verification evidence readability;
  - this is one product usability trial only, not eval/A-B evidence, PH superiority proof, generated app quality certification, or a general reliability claim.

## [0.3.9-alpha.6] - 2026-06-28

- Product workflow closure UX release:
  - includes `d9dcd0a fix(cli): guide post-build workflow closure`;
  - includes `fde990c docs: record post-build closure guidance`;
  - packages the post-build closure checklist after the alpha5 Windows SSH real-use trial exposed closure friction.
- Post-build closure checklist:
  - `workflow continue` and `workflow check` now surface a compact checklist when app generation appears to have happened but reports are still templates and a ticket remains pending;
  - the checklist says not to generate a new app, then fill implementation/review reports, mark report-filled, review/archive the current requirement candidate, and run `workflow finish implement`;
  - the finish gate is not weakened and no enforcement, eval-core, fixture, policy, or scorer behavior is added.
- Boundary:
  - this is a product workflow surface release, not eval proof, PH superiority proof, generated app quality certification, AST/linter enforcement, or an OpenCode/model quality claim;
  - if reports/evidence are still templates, the CLI does not claim build/test/runtime success as confirmed;
  - model follow-through risk remains; the post-publish registry smoke below confirms the no-token product workflow surface, not full implementation closure.
- Post-publish registry facts:
  - `persona-harness@0.3.9-alpha.6` exists with gitHead `7b090bd26068a24d2fd7da5b9b7da680847c3a04` and shasum `e5c8c8efa17eac8e51f49e8f65e4daa579d72468`;
  - dist-tags are `alpha=0.3.9-alpha.6`, `latest=0.3.9-alpha.3`;
  - `latest` was not moved;
  - alpha6 Windows D-drive registry smoke passed from `npm install -D persona-harness@alpha` in `D:\persona-harness-smoke-alpha6-registry-20260628-220759`;
  - no-token init/default backend, doctor, bootstrap, draft/approve/split/next/continue/check passed;
  - Korean `TODO 웹 서비스 만들래` was preserved in `workflow next` title and `workflow continue` task-card context;
  - `workflow continue` showed task-card context, next command/action, archive candidate, no-completion guidance, and the post-build closure checklist;
  - `workflow check` also showed the closure path in pending/template state, with expected WARN because reports/evidence were still missing and completion remained blocked;
  - this closes the alpha6 product workflow surface cycle, but remains product surface smoke only, not eval/model/OpenCode/A-B evidence, PH superiority proof, or generated app quality certification.
- Alpha6 single implementation-to-finish proxy trial:
  - Windows D-drive registry trial installed `persona-harness@0.3.9-alpha.6` and passed install/init/doctor/bootstrap/idea-first/continue;
  - one bounded OpenCode run (`gpt-5.4-mini-fast`) read README/profile/plan/task, generated a Java/Spring/Gradle todo API with Gradle wrapper, and reached `gradlew.bat test` / `gradlew.bat build` BUILD SUCCESSFUL;
  - runtime/bootRun was attempted, but the model did not return to workflow closure;
  - implementation/review reports stayed `Status: template`, `req-1` stayed pending, and `workflow finish implement` correctly blocked on filled reports plus pending requirement;
  - backend-shape was mostly PASS with a verification-report WARN because reports lacked test/build/bootRun output;
  - classification: closure structure/follow-through remains the problem, not install, encoding, stack steering, or a finish-gate bug;
  - decision: A-lite closure wording/checklist patches are not sufficient; move to B, where the workflow rail needs state-machine design. Next CLI work should be a design draft, not another wording patch.

## [0.3.9-alpha.5] - 2026-06-28

- Product workflow rail release:
  - includes `6d29d91 fix(cli): surface ticket context in workflow continue`;
  - includes `8d3605b test(cli): add product MVP smoke`;
  - includes `e562f17 fix(cli): make first-run help side-effect free`;
  - includes `dd1e68f fix(cli): decode Windows Korean stdin`;
  - includes docs through `1f97743 docs: record Windows Korean stdin fix`.
- Windows Korean stdin fix:
  - `workflow draft --stdin` and `workflow capture --stdin` now decode raw stdin buffers as UTF-8 first, then Windows Korean candidates when replacement characters appear;
  - this targets Windows cmd/PowerShell/SSH CP949/EUC-KR pipe input mojibake;
  - it does not repair already broken artifacts.
- Product surface boundary:
  - no-token product MVP and idea-first smoke paths are product workflow surface evidence only;
  - this release is not eval evidence, PH superiority proof, generated app quality certification, AST/linter enforcement, or an OpenCode/model outcome claim.
- Publish/smoke boundary:
  - registry package smoke is still required after publish;
  - `latest` is not intentionally moved by this manual release prep unless separately approved.
- Post-publish registry facts:
  - `persona-harness@0.3.9-alpha.5` exists with gitHead `07d36eb3a74c68b880b812dcd755cf6a2c464637` and shasum `74ae2103be553d3e107a7e8167aadabe89a29e91`;
  - dist-tags are `alpha=0.3.9-alpha.5`, `latest=0.3.9-alpha.3`;
  - local/origin tag `v0.3.9-alpha.5` points at `07d36eb3a74c68b880b812dcd755cf6a2c464637`;
  - alpha5 Windows SSH registry re-smoke passed from `npm install -D persona-harness@alpha` in a Windows remote clean temp path;
  - Korean `TODO 웹 서비스 만들래` was preserved without mojibake in `workflow next` title and `workflow continue` task-card context;
  - no-token init/default backend, doctor, bootstrap, draft/approve/split/next/continue/check passed, with expected `workflow check` WARN for pending/template state;
  - `workflow continue` showed task-card context, next command/action, archive candidate, and no-completion guidance;
  - `init --help`, `smoke --help`, and `feedback --help` exited 0 without creating `.persona`, `.opencode`, `AGENTS.md`, workflow/smoke/feedback reports;
  - `npx ph --version` remains unsupported and exited 1, not a blocker because package version was confirmed by npm metadata;
  - this is final product surface smoke only, not eval/model/OpenCode/A-B evidence, PH superiority proof, or generated app quality certification.
- Alpha5 SSH implementation trial:
  - Windows SSH registry real-use trial was partially successful: no-token idea-first rail was helpful, Korean was preserved, and `workflow continue` kept task-card context/next action/no-completion guidance;
  - OpenCode/model generated a Java/Spring/Gradle/H2/Flyway/JDBC app, with `gradlew.bat test` PASS, `gradlew.bat build` PASS, runtime smoke PASS for `/todos` POST/GET/400 checks, and backend-shape mostly PASS;
  - closure still failed because implementation/review reports remained templates, `req-1` remained pending, and `workflow finish implement` exited 1 correctly blocking completion;
  - judgment: product value signal exists, but closure friction remains and the helpful/unclear boundary is still active;
  - future Windows SSH smoke should prefer `D:\persona-harness-smoke-*` paths and minimal raw-retention rollups by default;
  - this is not eval/model superiority, PH superiority proof, generated app quality certification, or a finish-gate bug.
- Post-build closure UX follow-up:
  - `d9dcd0a fix(cli): guide post-build workflow closure` makes `workflow continue` and `workflow check` show a post-build closure checklist when reports remain templates and a ticket remains pending after successful app generation;
  - the checklist says not to generate a new app, fill implementation/review reports, mark report-filled, review/archive the current requirement candidate, then run `workflow finish implement`;
  - this is not finish-gate weakening, enforcement, eval-core/fixture/policy/scorer work, or published alpha5 behavior until the next alpha publish/re-smoke;
  - if reports/evidence are templates, the CLI still does not claim build/test/runtime success as confirmed, and model follow-through can still fail.

- Honest eval closure:
  - eval treadmill stopped and `docs/current/injection-value-status.json` keeps `decision: injection-effect-not-proven`;
  - aggregate signal preserved in `experiments/eval-signal/aggregate.json` with original-only results, and experiments disk usage was reduced from `4.0GB` to `132MB`;
  - workflow continuation UX fix `19ae341 fix(cli): surface final verification continuation` was added, but fresh finish-rate eval was not rerun, so finish-rate improvement remains unverified;
  - no new release notes file, no PH superiority claim, no eval PASS claim, and no generated app quality certification.
- Product workflow rail surface:
  - `8d3605b test(cli): add product MVP smoke` adds `npm run smoke:product-mvp` for built-CLI no-token product surface smoke across init/doctor/observe/workflow pass/blocked/next-ticket paths;
  - `6d29d91 fix(cli): surface ticket context in workflow continue` shows pending/current ticket task-card context in the `workflow continue` ticket block;
  - no-token idea-first External Smoke passed from `TODO 웹 서비스 만들래` through `workflow draft --stdin`, approve, split, next, continue, and check, with expected pending WARNs and no OpenCode/model/eval run;
  - these are product surface and workflow UX signals only, not eval evidence, PH superiority proof, finish-gate weakening, or generated app quality certification.
- Tester handoff:
  - refreshed the minimal external tester guide around alpha install, `ph init --default backend`, `ph doctor`, idea-first draft/approve/split/next/continue/check, expected pending WARNs, and feedback format;
  - local proxy and SSH remote smoke on local tarballs were helpful for the no-token idea-first path, including `workflow continue` preserving pending `req-1` task-card context, next command/action, archive candidate, and no-completion guidance;
  - registry-alpha remote commands passed, but that attempt is excluded from the helpful judgment because `workflow continue` lacked task-card context and Windows Korean input mojibake was observed;
  - the smoke source was a local working-tree tarball at `b4e3424` while repo HEAD later moved to `e562f17`, so this is not current released/registry package proof;
  - `dd1e68f fix(cli): decode Windows Korean stdin` fixes the code-level mojibake cause for `workflow draft --stdin` and `workflow capture --stdin` by decoding raw stdin buffers as UTF-8 first, then Windows Korean candidates when replacement characters appear;
  - the registry smoke gate remains open: published-package smoke is still needed after `dd1e68f`; wrapper/copy-block friction remains deferred until an actual tester gets stuck;
  - the guide keeps `alpha`/`latest` dist-tag caveats and explicitly forbids generated-app quality, eval, superiority, or enforcement claims.

## [0.3.9-alpha.4] - 2026-06-28

### Changed

- Bumped the prerelease version to `0.3.9-alpha.4` as a tooling/scorer/purity-guard release.
- Added eval workspace isolation and baseline purity guards:
  - `1aa55e6 fix(eval): isolate onoff workspaces`;
  - default eval output root moves outside the repo temp area;
  - preflight detects ambient `AGENTS.md`, `CLAUDE.md`, `.persona`, and `.opencode` influence;
  - baseline post-run purity guard detects PH artifact contamination;
  - contaminated baseline results decide INCONCLUSIVE instead of becoming clean ON/OFF evidence.
- Added generated-toolchain-aware eval scoring:
  - `eafd0bf fix(eval): score generated toolchains`;
  - generated projects are scored according to detected Gradle, Maven, Python, or Unknown toolchain instead of forcing every output through Gradle metrics.
- Stamped the toolchain-aware policy/scorer state:
  - `3aeaa1b fix(eval): stamp toolchain-aware policy`;
  - fresh/replay results record `toolchain` and `fixtureStackToolchain`;
  - external outcome and stack/toolchain mismatch are reported separately;
  - old `external-primary-v0.4.1` or unstamped results are not reinterpreted as alpha4 outcome evidence and are INCONCLUSIVE under the new policy if evaluated there.
- Covered stack/toolchain aggregate separation:
  - `51f1622 test(eval): cover toolchain aggregate separation`;
  - `stackToolchainMatchRate` is diagnostic only, not a hard gate or product proof.
- Confirmed fixture stack/toolchain metadata:
  - `0a05e6d fix(eval): align fixture toolchain types`;
  - `backend-api-no-stack` and `ambiguous-idea-first` are free-stack fixtures;
  - `multi-step-backend` and `multi-step-backend-small` are `java-spring-gradle-pinned`;
  - full `multi-step-backend` remains stress/continuation, while `multi-step-backend-small` remains the reduced paired fixture.
- Added backlog mismatch repair for archived tickets:
  - `212046f fix(cli): repair archived ticket backlog mismatch`;
  - the CLI diagnoses history-only pending tickets and allows explicit `workflow archive <ticket>` repair;
  - finish gate remains strict.
- Retained the previously recorded scope-continuation and reduced-fixture work:
  - `1e7a97c docs(skills): guide oversized backlog continuation`;
  - `5bcd4dd fix(cli): clarify ticket scope continuation`;
  - `e6e5f5e feat(eval): add reduced multi-step fixture`.

### Verification Notes

- This release does not include a fresh actual eval outcome after the final toolchain-aware scorer/marker changes.
- The SIGINT/interrupted run after scorer work produced no `results.json` and is not outcome evidence.
- It does not claim PH ON passed under the new toolchain-aware policy.
- It does not claim the v0.4 matrix improved or passed.
- It does not reinterpret old v0.4.1/unstamped results.
- It does not certify generated app product quality.
- `stackToolchainMatchRate` is diagnostic only.

### Release Prep Verification

- `npm test`: passed, 64 files / 428 tests.
- `npm run typecheck`: passed.
- `npm run build`: passed.
- `npm run check:docs`: passed.
- `npm pack --dry-run`: passed for `persona-harness@0.3.9-alpha.4`.
  - filename: `persona-harness-0.3.9-alpha.4.tgz`;
  - package size: `368.6 kB`;
  - unpacked size: `1.5 MB`;
  - shasum: `0df5a3e2fc54ccc6d00dc0ab75e3d82b8854f315`;
  - total files: `359`.
- `git diff --check`: passed.

### Published Registry Surface Smoke

- `persona-harness@0.3.9-alpha.4` exists on npm registry.
- Registry facts:
  - version `0.3.9-alpha.4`;
  - gitHead `8080699a1029e2740d055cf70af8c4dbc9508813`;
  - dist.shasum `ccd638553e52fe70a194578653ac1bb84b1eec1a`;
  - dist-tags `alpha=0.3.9-alpha.4`, `latest=0.3.9-alpha.3`.
- Git facts:
  - HEAD `8080699a1029e2740d055cf70af8c4dbc9508813`;
  - local tag `v0.3.9-alpha.4` points at HEAD;
  - origin tag `refs/tags/v0.3.9-alpha.4` points at the same HEAD.
- Publish note:
  - `npm publish --tag alpha` returned EOTP text, but immediate registry verification showed alpha4 exists and `alpha` points to it;
  - registry state is the source of truth;
  - do not republish the same immutable version;
  - `latest` was not moved and remains `0.3.9-alpha.3`.
- Registry install smoke:
  - clean temp project `/private/tmp/persona-alpha4-smoke-oCXdPe`;
  - `npm install -D persona-harness@alpha` installed `persona-harness@0.3.9-alpha.4`;
  - `npx ph init --default backend`: PASS;
  - `npx ph doctor`: PASS with Runtime readiness observed;
  - `npx ph observe --json` on a tiny Java service fixture: PASS with finding schema keys present.
- Boundary:
  - this is install/package surface smoke only;
  - no actual eval rerun was performed;
  - no generated app/product quality certification is made;
  - `latest=0.3.9-alpha.3` is recorded as observed state, not as a failure.

### Post-Release Eval Outcome Evidence

- QA ran the first post-alpha4 clean eval with published `persona-harness@0.3.9-alpha.4`.
- Only fixture `backend-api-no-stack` ran; remaining fixtures stopped after a valid FAIL.
- Source and markers:
  - PH install `npm install -D persona-harness@0.3.9-alpha.4`;
  - policy `external-primary-toolchain-v0.4.2`;
  - scorer `generated-toolchain-v1`;
  - output root outside the repo.
- Results:
  - original `/var/folders/z8/4909cvgx53n79fj88q94nd200000gn/T/persona-harness-eval-runs/2026-06-28T034057112Z/results.json`;
  - replay `/var/folders/z8/4909cvgx53n79fj88q94nd200000gn/T/persona-harness-eval-runs/2026-06-28T044041297Z/results.json`;
  - original/replay decide: FAIL;
  - baseline purity: PASS;
  - PH ON instrumentation: valid.
- Aggregate matched original/replay:
  - plain build/test/runtime/stack/failures `100%/100%/0%/0%/4`;
  - claude `100%/100%/0%/0%/4`;
  - agents `100%/100%/0%/0%/4`;
  - ph-on `100%/100%/50%/50%/6`, workflow `0%`.
- PH ON run notes:
  - r1 Java/Gradle build/test/runtime PASS, but workflow finish FAIL with provider-limit/workflow-dead-end labels;
  - r2 provider limit, incomplete/unknown output, runtime FAIL, workflow FAIL.
- Boundary:
  - this is valid eval outcome evidence for one fixture under the alpha4 scorer;
  - it is not generated app quality certification;
  - it is not a full v0.4 matrix result;
  - it does not support a broad PH superiority claim;
  - it blocks continuing remaining fixtures until workflow/provider cause is triaged;
  - alpha4 tooling/scorer release claims remain separate from this post-release eval evidence.
- Provider/tool completion semantics were separated:
  - `80943d2 fix(eval): separate provider completion outcomes`;
  - fresh results add `completionSemanticsVersion: provider-tool-completion-v1`;
  - generated app external metrics are separated from operational feasibility metrics;
  - run-level `providerToolCompletion` is recorded;
  - aggregate fields include `completionWithinBudgetRate`, `providerLimitRate`, `finishWithinBudgetRate`, and `operationalFailureModeTotal`;
  - provider incomplete + unknown workspace is runtime NOT RUN, not fake runtime FAIL;
  - marker-less old/post-alpha4 results are INCONCLUSIVE under the new semantics and existing verdicts are not retroactively changed;
  - Research accepted the denominator separation approach with no methodology blocker;
  - QA reported focused/full tests, typecheck, and build PASS.
- Provider/tool completion boundary:
  - no actual eval rerun happened after `80943d2`;
  - no new eval outcome claim is made;
  - provider-limited/TIMED_OUT is an operational failure, not generated app quality failure;
  - scorable-only external metrics must be shown with operational rates;
  - provider failures are not automatically treated as infra noise or INCONCLUSIVE;
  - no generated app quality certification is made.
- Provider/tool completion v1 fresh rerun:
  - fixture `backend-api-no-stack`;
  - original `/var/folders/z8/4909cvgx53n79fj88q94nd200000gn/T/persona-harness-eval-runs/2026-06-28T053933590Z/results.json`;
  - replay `/var/folders/z8/4909cvgx53n79fj88q94nd200000gn/T/persona-harness-eval-runs/2026-06-28T063940663Z/results.json`;
  - policy/scorer/semantics `external-primary-toolchain-v0.4.2` / `generated-toolchain-v1` / `provider-tool-completion-v1`;
  - replay parser fix `0276062 fix(eval): preserve replay provider completion`;
  - original/replay decide: FAIL;
  - subtype: operational-blocked / provider-tool-completion failure, not generated app quality failure;
  - PH ON app external outcome build/test/runtime `100%`, external failures `0`;
  - PH ON operational outcome completion `0%`, providerLimit `100%`, finishWithinBudget `0%`, operational failures `3`;
  - PH ON r1 app build/test/runtime PASS, then provider timeout and workflow incomplete;
  - PH ON r2 app build/test/runtime/workflow PASS, but provider timeout remained operationally incomplete;
  - baselines: plain/claude completed provider work but runtime failed, agents mixed;
  - no PH ON PASS claim, no matrix-ready claim, no generated app quality certification;
  - next work is workflow finalization cost reduction, finalization-only continuation policy, or timeout budget policy, then same fixture rerun.
- CLI finalization triage:
  - `63dc661 fix(cli): ignore recovered verification notes`;
  - no fresh eval rerun;
  - r1 bottleneck: app build/test/runtime PASS, tickets/reports filled, role coverage OK, but missing `npx ph bearshell` final verification evidence in filled reports;
  - CLI false positive fixed: text like "initial failure later recovered" no longer counts as a current compile/test failure;
  - built CLI r1 smoke now reports verification failure `no failed verification recorded`;
  - r2 provider TIMED_OUT but workflow PASS;
  - finish gate false negative ruled out and finish gate not weakened;
  - next work is a QA/runner finalization-only continuation pass, counted separately from single-turn completion.

### Additional Eval History Since Alpha3

- Added a local eval environment guard so repo-side eval pilot environment files stay untracked.
- Updated the repo-side eval runner command for the current OpenCode run surface:
  - `7d23167` tried `opencode run --model {model} --file {promptFile} {message}`;
  - default runner execution avoids unsupported `--prompt-file`, `--temperature`, `--top-p`, and `--seed` flags;
  - the previous actual eval pilot produced real results/capture but failed on the old runner command surface, so it is recorded as a runner/environment failure rather than PH product evidence;
  - `7d23167` was pushed to origin/main as `7d231677c4440f6ebad99c3d21b9b9b412885940`;
  - post-fix preflight passed and dry-run selected 4 runs;
  - the post-fix QA actual eval rerun also produced real results/capture but failed all conditions because OpenCode treated the positional message after `--file` as a file path: `Error: File not found: README.md 보고 구현해줘`;
  - original results path: `/Users/yongtae/Desktop/persona-harness/experiments/eval-runs/2026-06-27T061107129Z/results.json`;
  - replay results path: `/Users/yongtae/Desktop/persona-harness/experiments/eval-runs/2026-06-27T061307346Z/results.json`;
  - this remains a runner/OpenCode invocation failure, not PH product evidence or generated app quality evidence.
- Patched the eval runner after an OpenCode invocation probe:
  - `--file prompt.txt --command "README.md 보고 구현해줘"` failed with OpenCode UnknownError;
  - `opencode run --model <model> "$(cat prompt.txt)"` succeeded in a harmless temp probe;
  - `505b656 fix(eval): pass opencode prompt as positional text` changed the runner to `opencode run --model {model} {prompt}` and was pushed to origin/main as `505b656ec18efb0f9c8ecfb2af9c1c1ae516ea52`.
- Recorded the real generated-app eval pilot on HEAD `505b656`:
  - dry-run passed and selected 4 runs;
  - original results: `/Users/yongtae/Desktop/persona-harness/experiments/eval-runs/2026-06-27T063154174Z/results.json`;
  - original raw/capture root: `/Users/yongtae/Desktop/persona-harness/experiments/eval-runs/2026-06-27T063154174Z/raw/`;
  - replay results: `/Users/yongtae/Desktop/persona-harness/experiments/eval-runs/2026-06-27T070237569Z/results.json`;
  - pins used model `openai/gpt-5.4-mini-fast`, model version `openai-oauth-2026-06-27-gpt-5.4-mini-fast`, timeout `900000`, and PH install `npm install -D persona-harness@0.3.9-alpha.3`.
- Before the replay runtime-smoke fix, the eval decision gate failed:
  - plain/claude/agents generated Maven/Spring projects and failed Gradle compile/test metrics;
  - PH ON generated a Gradle/Spring project with wrapper and PH artifacts, with compile PASS and Gradle test PASS;
  - original decide failed because runtimeSmokeRate was missing and PH ON stack alignment improvement over plain was below 20 percentage points;
  - replay decide also failed because runtimeSmokeRate was missing and stack alignment improvement stayed below threshold;
  - this was real eval pilot evidence, but it was not yet a gate PASS, proof PH beats baselines, or generated app product quality certification.
- Fixed replay runtime-smoke determinism:
  - `8f203d7 fix(eval): preserve runtime smoke on replay` was pushed to origin/main as `8f203d7fa90e767c0de591f6c1284a833b3c531a`;
  - replay now reads captured `raw/runtime-smoke.log` `status:`, mapping `status: 0` to PASS, non-zero/null to FAIL, and missing status/log to NOT RUN/null;
  - QA verification passed focused eval tests, typecheck, full `npm test`, and build.
- Replayed the existing runtime-smoke actual capture:
  - existing actual capture root: `/Users/yongtae/Desktop/persona-harness/experiments/eval-runs/2026-06-27T072141547Z`;
  - new replay result: `/Users/yongtae/Desktop/persona-harness/experiments/eval-runs/2026-06-27T080127352Z/results.json`;
  - replay runtime rates: agents=`1`, claude=`0`, ph-on=`1`, plain=`0`;
  - `node scripts/eval/decide.mjs experiments/eval-runs/2026-06-27T080127352Z/results.json` returned `Verdict: PASS` and `PH ON met coded v0.4 threshold checks for supplied results`.
- The replay-fixed pilot is a replay-reproducible `n=1` PASS under the coded decide gate for the supplied results:
  - it is not a full v0.4 matrix result;
  - it is not generated app product quality certification;
  - original PH ON generated Gradle/Spring and reached build/test/runtime/workflow finish PASS;
  - OFF baselines generated Maven/Spring and failed Gradle compile/test, with agents runtime/stack strong but build/test failing;
  - replay still does not preserve provider timeout/providerFailed or original PH ON workflow finish outcome exactly, which remains optional future QA scope.
- Preserved replay provider/workflow outcomes and added bounded eval runner concurrency:
  - `0ff6ca6 fix(eval): preserve replay provider workflow outcomes`;
  - `afcae34 feat(eval): add bounded runner concurrency`;
  - origin/main now points to `afcae34ef696f76c7c7ab55e27b0f3d20a8421df`;
  - QA verification passed focused eval tests (15), typecheck, full `npm test` (64 files / 401 tests), and build.
- Recorded a real 2-rep backend-api-no-stack pilot with capture enabled and concurrency 2:
  - original results: `/Users/yongtae/Desktop/persona-harness/experiments/eval-runs/2026-06-27T082514617Z/results.json`;
  - replay results: `/Users/yongtae/Desktop/persona-harness/experiments/eval-runs/2026-06-27T085815683Z/results.json`;
  - original decide verdict: FAIL because PH ON runtimeSmokeRate regressed below plain and PH ON failure-mode reduction was `-75%`, below the 20% threshold;
  - replay decide verdict: FAIL because PH ON runtimeSmokeRate regressed below claude and PH ON failure-mode reduction was `-75%`, below the 20% threshold;
  - verdict is stable FAIL, and the follow-up tie-break cleanup below makes the runtimeSmokeRate regression reason deterministic.
- Recorded final runner cleanup after the 2-rep FAIL:
  - `cde0833 fix(eval): stabilize decide baseline tie-break` leaves verdict logic unchanged and keeps original/replay 2-rep decide as FAIL;
  - runtimeSmokeRate regression reason now deterministically compares against `claude` in both original and replay;
  - `dfab6fc fix(eval): clean runtime smoke process groups` adds scoped POSIX process group cleanup only for the runtime-smoke command;
  - broad process killing was not added;
  - Windows descendant cleanup remains a future follow-up only if a Windows pilot shows orphaning;
  - origin/main now points to `dfab6fcf7be4e278ccc417acdc9bd8389a6f7835`.
- 2-rep aggregate results:
  - plain: runs `2`, build `0%`, test `0%`, runtime `100%`, stack `75%`, workflow `0%`, failures `4`;
  - claude: runs `2`, build `0%`, test `0%`, runtime `50%`, stack `37.5%`, workflow `0%`, failures `6`;
  - agents: runs `2`, build `0%`, test `0%`, runtime `0%`, stack `0%`, workflow `0%`, failures `8`;
  - ph-on: runs `2`, build `50%`, test `50%`, runtime `0%`, stack `100%`, workflow `0%`, failures `7`.
- Interpretation boundary for the 2-rep pilot:
  - the earlier replay-fixed `n=1` PASS remains recorded as a real pilot signal;
  - the `n=2` follow-up is not a durable PASS and overrides expansion readiness;
  - do not expand to the full v0.4 matrix from this evidence;
  - PH ON improved stack alignment in this pilot but regressed runtime and failure-mode outcomes versus OFF baselines;
  - no generated app product quality certification or fake metrics are claimed.
- Recorded QA root-cause classification and serial `n=2` rerun after `dde9bcc fix(eval): clean timed-out opencode process groups`:
  - inspected capture root: `/Users/yongtae/Desktop/persona-harness/experiments/eval-runs/2026-06-27T082514617Z`;
  - old PH ON r1 failed build/test/runtime because generated Java had a compile error: `OrderService.java` referenced missing `CustomerNotFoundException`; workflow finish failed because implementation/review reports remained templates; OpenCode exited status `0` with no provider timeout;
  - old PH ON r2 passed build/test, but runtime smoke likely failed due contamination from a timed-out OpenCode process leaving bootRun/H2 lock, `Database may be already in use: .../order-intake.mv.db`; workflow finish failed because reports were templates and `req-1` through `req-6` were pending; OpenCode status was null/SIGTERM after `900000ms`;
  - `dde9bcc` adds scoped process-group cleanup only for timed-out OpenCode/provider commands, with no broad process killing;
  - verification passed focused tests, `npm run typecheck`, `npm test` (64 files / 404 tests), and `npm run build`.
- Serial rerun used the same fixture/conditions/runs with `--concurrency 1` and capture enabled:
  - original results: `/Users/yongtae/Desktop/persona-harness/experiments/eval-runs/2026-06-27T104740351Z/results.json`;
  - replay results: `/Users/yongtae/Desktop/persona-harness/experiments/eval-runs/2026-06-27T114723409Z/results.json`;
  - original and replay decide both FAIL because PH ON stack alignment improvement over plain is below 20 percentage points.
- Serial `n=2` aggregate matched in original and replay:
  - plain: build `0%`, test `0%`, runtime `100%`, stack `75%`, failures `4`;
  - claude: build `0%`, test `0%`, runtime `50%`, stack `37.5%`, failures `6`;
  - agents: build `0%`, test `0%`, runtime `50%`, stack `37.5%`, failures `6`;
  - ph-on: build `100%`, test `100%`, runtime `100%`, stack `75%`, workflow `100%`, failures `0`;
  - PH ON r1/r2 runtime logs both observed a Tomcat startup marker;
  - no matching orphan opencode/persona-runtime-smoke/gradle bootRun/workspace process remained.
- Serial `n=2` interpretation boundary:
  - external outcomes are green for PH ON versus OFF in this rerun;
  - coded decide gate remains FAIL because plain baseline already has stackAlignmentRate `75%`, so PH ON does not clear the +20pp stack-improvement threshold;
  - record this as external outcome green, coded gate stack-threshold fail;
  - this is not full v0.4 matrix evidence, broad PH value proof, generated app product quality certification, or a reason to move v0.5 AST forward.
- Added fixture scope metadata and recorded the intermediate expansion results:
  - `b361a80 feat(eval): classify fixture scope metadata` adds `scopeClass` and `singleTurnEligible` metadata to fresh eval results;
  - full `multi-step-backend` is classified as `stress-continuation` and `singleTurnEligible: false`;
  - `multi-step-backend-small` is classified as `reduced-single-turn`, is eligible, and is paired with the full multi-step fixture;
  - `backend-api-no-stack` and `ambiguous-idea-first` are single-turn eligible.
- Recorded the official reduced multi-step external-primary pilot:
  - fixture `multi-step-backend-small`, original results `/Users/yongtae/Desktop/persona-harness/experiments/eval-runs/2026-06-27T153507167Z/results.json`;
  - replay results `/Users/yongtae/Desktop/persona-harness/experiments/eval-runs/2026-06-27T233834010Z/results.json`;
  - original had no `replayOf`, gitCommit `e6e5f5e6359674c9e475aa68bfe20ad8cc61c173`, policy `external-primary-v0.4.1`, and 4 conditions x 2 runs;
  - original/replay decide both PASS;
  - aggregate matched original/replay: plain build/test/runtime/stack/failures `0%/0%/100%/50%/4`, claude `0%/0%/100%/75%/4`, agents `0%/0%/100%/75%/4`, ph-on `100%/100%/100%/88%/0` with workflow `100%`;
  - PH ON instrumentation was valid, reports were filled, workflow finish PASSed, and baselines were PH-free.
- Reduced multi-step interpretation boundary:
  - the full `multi-step-backend` result remains external-primary FAIL with PH ON workflow `0%`;
  - the reduced `multi-step-backend-small` result is a Tier 1 external-primary PASS for the reduced fixture only;
  - this is strong scope-size sensitivity evidence, not a full v0.4 matrix PASS, broad PH value proof, or generated app quality certification;
  - Tier 2 stack differentiation remains diagnostic/not assessed due fallback/low-confidence output.
- Recorded the `ambiguous-idea-first` intermediate pilot:
  - fixture `ambiguous-idea-first`, single-turn eligible;
  - shape `plain`/`claude`/`agents`/`ph-on` x 2, concurrency 1, capture, runtime smoke, policy `external-primary-v0.4.1`;
  - original results `/Users/yongtae/Desktop/persona-harness/experiments/eval-runs/2026-06-27T235103424Z/results.json`;
  - replay results `/Users/yongtae/Desktop/persona-harness/experiments/eval-runs/2026-06-28T010248114Z/results.json`;
  - original/replay decide both FAIL with reason `ambiguous-idea-first: Tier 1 workflow finish did not complete for every PH ON run`;
  - aggregate matched original/replay: plain build/test/runtime/workflow/stack/failures `0%/0%/100%/N/A/100%/4`, claude `50%/50%/50%/N/A/50%/4`, agents `0%/0%/50%/N/A/50%/6`, ph-on `100%/100%/100%/50%/100%/2`;
  - PH ON r1 passed build/test/runtime/stack but workflow failed with filled reports, pending tickets, OpenCode timeout `900000ms`, and provider-limit/workflow-dead-end labels;
  - PH ON r2 passed build/test/runtime/workflow/stack with failures `0`;
  - PH ON instrumentation was valid and baselines were PH-free.
- Ambiguous pilot interpretation boundary:
  - `backend-api-no-stack` PASS and `multi-step-backend-small` PASS remain valid one-fixture/reduced-fixture signals;
  - `ambiguous-idea-first` FAIL means the v0.4 single-turn matrix is not ready;
  - the failure is workflow closure/follow-through variance, not build/test/runtime failure;
  - Skills lane found no missing prompt surface, made no guidance change, and produced no commit; focused tests passed;
  - remaining investigation is CLI/QA runner continuation/final-finish mechanics rather than more prompt text;
  - full v0.4 matrix remains blocked pending CLI/Skills root-cause or rerun policy;
  - no old result is retroactively rewritten.

## [0.3.9-alpha.3] - 2026-06-27

### Changed

- Bumped the prerelease version to `0.3.9-alpha.3` because registry `persona-harness@0.3.9-alpha.2` points to `gitHead` `ecc65560af26df78656f6135237f44cdbf9c2607`, while current HEAD includes the verification-focused changes through `a5204db`.
- Marked injection value as not proven:
  - `docs/current/injection-value-status.json` now uses `decision: injection-effect-not-proven`;
  - legacy self-rated counts are retained only as audit data, not measured evidence;
  - `npm run check:injection-value` passes against the not-measured evidence state.
- Added `ph observe <path>` as a report-only Java observer CLI surface:
  - observer findings are normalized with `ruleId`, `result`, `evidence`, `confidence`, `source`, and `limitations`;
  - observer code is now reachable from the shipped CLI instead of only from scripts/tests.
- Hardened observer measurement code:
  - replaced naive Java parameter comma splitting with a tokenizer that respects nested generics and other Java syntax boundaries;
  - consolidated `isRecord` into a single shared definition;
  - removed product analyzer `roomescape` / `/reservations` domain literals from `src`;
  - added adversarial Java observer/tokenizer coverage.
- Added live runtime observer trace evidence:
  - Java write/edit hook paths can record `observer-report-only` evidence;
  - evidence is best-effort and non-blocking;
  - no enforcement or generated app quality certification is added.
- Added ON/OFF eval measurement infrastructure:
  - `run-onoff-eval.mjs` supports dry-run, preflight, capture, replay, reproducibility pins, JUnit XML / Gradle artifact based scoring, and observer-based stack alignment;
  - `decide.mjs` computes an objective gate from results JSON;
  - `blind-grade.mjs` creates anonymized review packages and aggregates reviewer disagreement.
- Restored a tracked minimal Java `example/` fixture used by observe tests.

### Verification

- Current-head score-uplift smoke passed on local tarball HEAD `a5204db`:
  - clean install, `ph init`, `ph bootstrap backend`, and `ph doctor` passed;
  - `ph observe --json example/` passed and emitted report-only schema findings;
  - runtime hook observer evidence was created without throwing or blocking;
  - eval runner help/dry-run/preflight/replay guard surfaces passed;
  - `decide.mjs` and `blind-grade.mjs` surfaces executed.
- Actual OpenCode ON/OFF eval was not run because `OPENCODE_MODEL`, model version, and provider keys were not pinned. No fake `results.json` was generated.
- This release does not certify generated app product quality, does not add AST/linter/enforcement, and keeps observer/backend-shape report-only.
- Post-publish registry install smoke passed for `persona-harness@0.3.9-alpha.3`:
  - registry facts: `alpha=0.3.9-alpha.3`, `latest=0.3.9-alpha.3`, gitHead `d96941f6e212bd89f62cd0d7b12853a845cc1c86`, shasum `fcd8b7da9f0568510a73f9d25a1c083a8343e6b9`;
  - registry-only install from `persona-harness@alpha` installed `0.3.9-alpha.3`;
  - CLI surfaces passed for init/bootstrap/doctor/plan/workflow/review backend-shape and `observe --json` fixture;
  - fresh/template `workflow finish implement` blocked as expected on missing reports/evidence;
  - generated-app OpenCode run was not executed, and no product-quality certification is made;
  - installed package did not contain `node_modules/persona-harness/scripts/eval/*`, so package-level eval runner help/dry-run/preflight were not executed. This is recorded as a package-surface boundary, not a fake eval success.
- Latest-tag install smoke also passed after dist-tag synchronization:
  - clean `npm install -D persona-harness` installed `0.3.9-alpha.3`;
  - `ph init`, `ph doctor`, and `ph observe --json` surfaces passed;
  - this remains install/surface coverage only, not an OpenCode generated-app run or product-quality certification.

## [0.3.9-alpha.2] - 2026-06-27

### Changed

- Bumped the prerelease version to `0.3.9-alpha.2` because registry `persona-harness@0.3.9-alpha.1` is stale relative to current HEAD.
- Reinforced workflow closure guidance after build/test success so agents are reminded to fill reports, check status, archive completed requirements, and run the final gate before claiming completion.
- Refined backend-shape smoke findings for current HEAD:
  - `application/port/out/*Repository.java` can be recognized as repository port evidence;
  - Verification report wording is intended to distinguish test/build evidence from bootRun evidence, though the current-head re-smoke still found a false-success wording risk.
- Added Gradle dependency self-check guidance to reduce dot-version recurrence in generated `build.gradle` files.
- Returned runtime QA guidance to workflow closure so agents are expected to come back from build/test/bootRun or manual QA attempts to report fill, archive, and finish.
- Hardened backend-shape Verification reporting so template-only command mentions produce WARN instead of false PASS.
- Kept v0.5 AST/linter/enforcement work behind the existing decision gate. `dfeb88c docs(eval): plan v0.5 qa decision cadence` exists locally but is not an ancestor of this release-prep HEAD, so this package does not claim that commit's files as package contents.

### External Smoke

- Current-head local tarball closure re-smoke at `23877e2` was partially successful. This was not a registry `0.3.9-alpha.1` smoke.
- Confirmed:
  - `ph init`, `ph bootstrap backend`, and `ph doctor` passed;
  - OpenCode reached workflow rail / split / next / `req-1`;
  - Java/Spring/Gradle generation, Gradle wrapper creation, `profileSummaryInjected`, and Java role evidence were observed;
  - backend-shape `application/port/out` fixture produced Domain repository port / adapter / DTO PASS;
  - fake Gradle shim, Java `HttpServer`, and CommonJS workarounds were not observed in generated source.
- Blocked:
  - `gradlew.bat test` and `gradlew.bat build` failed with dependency `:.` interpretation errors such as `spring-boot-starter-*:.` and `flyway-core:.`;
  - OpenCode hung after wrapper generation;
  - implementation/review reports remained templates;
  - `req-1` remained pending;
  - `workflow finish implement` exited 1 on template reports + pending `req-1` and showed "Do not claim overall completion" guidance.
- Remaining risk:
  - backend-shape Verification report wording still said `gradle test/build success evidence observed; bootRun evidence not observed` despite test/build failure or missing success evidence.
- Release prep for alpha2 should stay on hold until the dependency recurrence and Verification report wording blockers are fixed and re-smoked, unless HQ explicitly accepts the risk.
- This current-head smoke does not certify generated app product quality, does not make backend-shape an enforcement gate, and does not add AST/linter/enforcement.
- Second current-head local tarball closure re-smoke at `691f874` was partially successful. This was not a registry `0.3.9-alpha.1` smoke.
- Improvements confirmed:
  - Java/Spring/Gradle generation;
  - valid dependency notation;
  - `gradlew.bat test` and `gradlew.bat build` PASS;
  - `profileSummaryInjected` and Java role evidence;
  - backend-shape main PASS;
  - `application/port/out` repository port fixture PASS.
- Still blocked:
  - OpenCode stopped at the bootRun/manual QA PowerShell step;
  - implementation/review reports remained templates;
  - `plan --report-filled` markers were not observed;
  - `req-1` remained pending;
  - `workflow finish implement` exited 1 on missing reports + pending requirement.
- The blocker appears shifted from Gradle dependency notation to closure/report/final-gate follow-through after build/test/manual QA.
- Verification report false-success wording is still a residual risk rather than a proven failed fix because the dot-dependency fixture did not contain actual Gradle failure evidence.
- Release prep for alpha2 remains held unless HQ explicitly accepts partial closure risk.
- Third current-head local tarball closure re-smoke at `ee292ea` passed workflow closure. This was not a registry `0.3.9-alpha.1` smoke; registry alpha/latest still pointed to `gitHead` `bc7eadd...`.
- Source facts:
  - local `npm pack` tarball, package `0.3.9-alpha.1`;
  - tarball shasum `e03ce076cee801e0db91b01670c2efbdb2ca1db4`;
  - tarball sha256 `afb76178626a7d23657ddd78c2c77a5fe3df2528b3225005adff738edbd8ea1d`;
  - included follow-ups `32b557b`, `691f874`, and `bd2f8a1`.
- Workflow closure confirmed:
  - OpenCode returned from build/test/bootRun attempt to workflow closure;
  - implementation/review reports were filled;
  - `plan --report-filled implementation` and `plan --report-filled review` were observed;
  - `req-1` was archived;
  - `workflow finish implement` passed.
- Generated stack and verification observed:
  - Java/Spring/Gradle + wrapper generated;
  - no dot dependency recurrence such as `spring-boot-starter-*:.` or `flyway-core:.`;
  - `gradlew.bat test/build` and post-check `--no-daemon` test/build passed;
  - bootRun startup logs, Tomcat, and Flyway startup were observed before a 30s bearshell timeout;
  - `profileSummaryInjected` and Java role read coverage were observed;
  - fake Gradle shim, Java `HttpServer`, and CommonJS workarounds were not observed.
- backend-shape main was mostly PASS, and fixture coverage confirmed `application/port/out/TaskRepository`, adapter, and DTO PASS. Verification report avoided false PASS for template-only command mentions by leaving `gradle test/build/bootRun mentioned without success/failure output` as a WARN.
- Smoke perspective: alpha2 release prep candidate.
- Residual risks: generated app product quality is not certified, backend-shape remains report-only, AST/linter/enforcement is still absent, separate manual curl QA was not performed, and the backend-shape Verification WARN remains conservative because reports lacked raw success/failure output even though post-check test/build passed.
- Post-publish registry surface smoke passed for `persona-harness@0.3.9-alpha.2`.
  - Source: Windows clean project registry-only `npm install -D persona-harness@alpha`.
  - Registry facts: installed `persona-harness@0.3.9-alpha.2`; dist-tags `alpha=0.3.9-alpha.2`, `latest=0.3.9-alpha.1`; gitHead `ecc65560af26df78656f6135237f44cdbf9c2607`; shasum `cdd6a238da82a06b59f0c9ee75f7eea2bbec1440`.
  - `ph init`, `ph bootstrap backend`, and `ph doctor` passed; doctor Runtime readiness passed with OpenCode present and package version `0.3.9-alpha.2`.
  - `workflow implement` / `plan --prompt` surfaces showed Windows-safe bearshell read/search guidance and finish/report-filled guidance.
  - Fresh/template `workflow check` WARN and `workflow finish implement` exit 1 for missing implementation/review reports + evidence were expected.
  - `bearshell` README search/read commands passed.
  - Copied backend rules contained Gradle wrapper/dependency self-check guidance, including no blank/dot versions for `spring-boot-starter-*` / `flyway-core` and build.gradle self-check guidance.
  - backend-shape fixture confirmed `application/port/out` repository port PASS, adapter/DTO PASS, and template-only verification mentions as Verification WARN rather than false PASS.
  - No blocker was found for registry alpha2 install/init/bootstrap/doctor/workflow/bearshell/backend-shape surfaces.
  - `latest=0.3.9-alpha.1` is recorded as observed dist-tag state, not a smoke failure.
  - Optional OpenCode generated-app closure smoke was not run; this is not generated app product quality certification, backend-shape remains report-only, and AST/linter/enforcement remains absent.

### Verification

- Release-prep verification for `0.3.9-alpha.2` was rerun on 2026-06-27.
- `npm test`: passed. Scope diagnostics and docs taxonomy diagnostics passed; 58 files / 367 tests passed.
- `npm run typecheck`: passed.
- `npm run build`: passed.
- `npm run check:docs`: passed.
- `npm pack --dry-run`: passed for `persona-harness@0.3.9-alpha.2`.
  - Filename: `persona-harness-0.3.9-alpha.2.tgz`
  - Package contents: 345 files
  - Shasum: `9fc8fdcb92e3a2824112b51b2fce5f6c73269b1a`
- `git diff --check`: passed.

## [0.3.9-alpha.1] - 2026-06-25

### Changed

- Bumped the prerelease version to `0.3.9-alpha.1` because `persona-harness@0.3.9-alpha.0` already exists on the npm registry and cannot be overwritten with the refreshed current HEAD contents.
- Carried forward the `0.3.9-alpha.0` release-prep refresh contents:
  - release checklist docs stale guard for version/doc alignment, smoke interpretation boundaries, registry `gitHead` / current `HEAD` mismatch recording, and develop commit/no-commit reporting;
  - v0.4 evaluation methodology, fixture files, evaluation plan, and runbook with fixture order, baseline setup, metadata capture, archive naming, metrics, blind package preparation, second reviewer handoff, and kill-gate calculation timing;
  - v0.4 runbook release-reference guard;
  - verified report manual backfill plan with artifact selection, rule ID evidence sources, PASS/WARN/FAIL/UNKNOWN criteria, confidence/source handling, false-positive review, and v0.5 parser spike decision criteria;
  - Gradle skills guidance wording tightening that preserves fake-shim ban, wrapper-first verification, and Spring Boot dependency-management semantics;
  - runtime structured warning output as `[Persona Harness Runtime Warning] kind=... scope=...`;
  - CLI report coverage helper refactor into `workflow-report-coverage.ts` with unchanged workflow semantics.
- Recorded that external develop retrospectives and templates are repo-outside operating artifacts only and are not package contents.

### Registry Note

- `persona-harness@0.3.9-alpha.0` is a stale registry artifact for the refreshed release docs: npm reports its `gitHead` as `4338cc51b40eb9ba3b3853e9df394373fc2b0269`, while the refreshed alpha.0 release-prep/tag commit was `b31b557`.
- Because npm package versions are immutable, `0.3.9-alpha.1` is the next prerelease intended to carry the refreshed current HEAD state.

### External Smoke

- No new External Smoke was run for this release prep.
- Pre-alpha9 and focused smoke remain surface/guidance verified:
  - parser hardening local/Windows adversarial fixture succeeded;
  - clean tarball install, `init`, `bootstrap`, and `doctor` succeeded;
  - report coverage guidance surfaced through `check`, `continue`, and `finish`;
  - Spring Boot dependency-management guidance surfaced through README/build.gradle injection.
- Post-publish registry install/surface smoke passed for `persona-harness@0.3.9-alpha.1`:
  - registry dist-tags were `latest=0.3.9-alpha.1` and `alpha=0.3.9-alpha.1`;
  - registry `gitHead` was `bc7eaddc678b6268be1194d7e659123f895e6fd5`;
  - registry shasum was `c901e24a0c6da82658ebf6800f038223d0e93de4`;
  - Windows clean install from registry `persona-harness@alpha`, `ph doctor`, `ph init`, `ph bootstrap backend`, workflow/bearshell guidance, and backend-shape report surfaces were OK;
  - `workflow check` WARNs were limited to template reports and missing evidence;
  - `review backend-shape` WARNs were expected because the smoke did not generate a Java app, while fake shim absence passed;
  - `workflow finish implement` exited 1 as expected and named the required filled reports and evidence file.
- HQ local checks before that smoke did not find a `v0.3.9-alpha.1` tag locally or on origin.
- Post-publish full continuation smoke was partially successful for `persona-harness@0.3.9-alpha.1`:
  - OpenCode generated a Java/Spring/Gradle app with `build.gradle`, `settings.gradle`, `gradlew.bat`, `src/main/java`, `src/test/java`, and presentation/application/domain/infrastructure/DTO/test structure;
  - `gradlew.bat test` passed and post-check `gradlew.bat build` passed;
  - evidence was present, `profileSummaryInjected: true` was observed, and Java representative file evidence was observed;
  - fake shim, Java `HttpServer`, and CommonJS source scans were clean;
  - OpenCode did not fill reports or reach the final gate after generation/build repair and was stopped after a long no-output state;
  - `workflow finish implement` exited 1 with exact reasons that `implementation-report.md` and `review-report.md` must be filled;
  - reports remained `Status: template`, req archive/split was not observed, and `workflow check` stayed WARN;
  - `review backend-shape` was mostly PASS, with a Domain repository port WARN because repository ports were under `application/port/out`;
  - backend-shape Verification report wording incorrectly implied bootRun evidence, while this smoke observed test/build only.
- This prep does not directly certify that a full OpenCode continuation applies dependency guidance, fills reports by itself, and reaches `finish` PASS.
- This release does not certify generated app product quality and does not add AST/linter/enforcement.

### Verification

- `npm test` passed: scope/docs diagnostics PASS, 57 files, 361 tests.
- `npm run typecheck` passed.
- `npm run build` passed.
- `npm run check:docs` passed.
- `npm pack --dry-run` passed for `persona-harness@0.3.9-alpha.1` with 341 files.
- `git diff --check` passed.

## [0.3.9-alpha.0] - 2026-06-25

### Changed

- Hardened backend-shape Java field parsing so naive `private` line text scans create fewer false WARNs from comments, text blocks, strings, lambdas, and nested generic mentions while still preserving WARNs for real multiline Service fields such as `Map`, `AtomicLong`, and `nextId`.
- Added adversarial fixture coverage for the Java field parser hardening.
- Strengthened Spring Boot Gradle dependency-management guidance around Boot plugin-managed dependencies, `io.spring.dependency-management`, starter dependencies, Flyway, wrapper-backed verification, and recovery after dependency resolution failures.
- Added report coverage continuation hardening so reports marked `Status: filled` but left blank or template-like produce report coverage WARNs with next actions in `check`, `continue`, and `finish`.
- Added the 0.3.9-alpha pre-eval stop gate: before `0.4` eval, HQ must stop for a `0.3.9-alpha` publish or release decision.
- Refined AST verified report schema research with candidate fields such as `ruleId`, `result`, `targetFile`, `evidence`, `limitations`, `confidence`, and `source`, plus stable rule ID candidates.
- Preregistered the v0.4 eval fixture matrix, including README fixture candidates, plain/AGENTS/CLAUDE/cursorrules/PH baseline conditions, baseline kill-gate, thresholds, primary/secondary metrics, and blind/second-reviewer rubric.
- Added a release checklist docs stale guard covering package/lockfile, CHANGELOG, release note, develop record alignment, smoke interpretation boundaries, registry `gitHead` / current `HEAD` mismatches, and develop commit/no-commit reporting.
- Added and restored v0.4 evaluation docs, including the evaluation methodology, fixture files, evaluation plan, and runbook with fixture order, baseline condition setup, metadata capture, archive naming, metrics, blind package preparation, second reviewer handoff, and kill-gate calculation timing.
- Guarded release references to the v0.4 runbook so release prep may mention it only when the runbook exists in the target HEAD being prepared.
- Added the verified report manual backfill plan, including artifact selection, rule ID evidence sources, PASS/WARN/FAIL/UNKNOWN criteria, confidence/source handling, false-positive review, and v0.5 parser spike decision criteria.
- Tightened Gradle guidance wording while preserving the fake-shim ban, wrapper-first verification, and Spring Boot dependency-management semantics.
- Structured runtime warnings as `[Persona Harness Runtime Warning] kind=... scope=...` while keeping host hooks alive and evidence writes best-effort.
- Split workflow report coverage finding logic into `workflow-report-coverage.ts` with unchanged workflow semantics and structured summary assertions.
- External develop retrospective artifacts and templates were prepared outside this repository and remain operating context only, not package content.

### External Smoke

- Pre-alpha9 5-run smoke was partially successful:
  - parser hardening local/Windows adversarial fixture succeeded;
  - clean tarball install, `init`, `bootstrap`, and `doctor` succeeded;
  - PH ON bounded OpenCode run confirmed workflow rail/profile/evidence/pending block behavior but stopped before implementation files were generated;
  - PH OFF baseline used the same README but drifted to a CommonJS/in-memory Node HTTP server.
- Focused re-smoke succeeded:
  - report coverage guidance surfaced through `check`, `continue`, and `finish`;
  - Spring Boot dependency-management guidance surfaced through README/build.gradle injection;
  - `init`, `bootstrap`, and `doctor` passed.
- Focused smoke is surface verified only. It did not directly verify that a full OpenCode continuation applies dependency guidance, fills reports by itself, and reaches `finish` PASS.
- This release does not certify generated app product quality and does not add AST/linter/enforcement.
- Registry `alpha`/`latest` before this release prep pointed to `0.3.8-alpha.5` with gitHead `d99df54`, so current commits were verified with local tarballs.

### Verification

- `npm test` passed: scope/docs diagnostics PASS, 57 files, 361 tests.
- `npm run typecheck` passed.
- `npm run build` passed.
- `npm run check:docs` passed.
- `npm pack --dry-run` passed for `persona-harness@0.3.9-alpha.0` with 340 files.
- `git diff --check` passed.

## [0.3.8-alpha.5] - 2026-06-25

### Changed

- Repositioned Persona Harness release-facing docs as an AI coding workflow rail, evidence, and continuation harness rather than a Java Clean Code quality guarantee.
- Clarified that evidence records read/injection/workflow traces, not generated-code quality proof.
- Added a runtime hook/evidence boundary so evidence write failures are best-effort and do not reject the host hook.
- Guarded injection context loading failures, including malformed filesystem states such as `.persona/project-profile.jsonc` being a directory, so they do not kill the host hook.
- Strengthened Gradle wrapper guidance so agents are expected to create and use real wrapper outputs instead of relying on unavailable system Gradle or fake shims.
- Added failed verification continuation guidance so compile/test/build failures remain continuation work instead of being smoothed over as completion.
- Reduced backend-shape false positives for domain/DTO naming, entity-name mentions inside DTO messages, and verification evidence visibility.

### External Smoke

- Long continuation smoke passed for workflow rail closure using a local `0.3.8-alpha.4` tarball at HEAD `d0eb111`.
- The smoke used a Windows clean ON project and the same `Inventory Lending API` README.
- Initial run timed out at 600 seconds after README/profile read, workflow implement/split/next, and Java/Spring/Gradle generation.
- Continuation 1 timed out at 900 seconds after reports fill, Gradle wrapper creation, and `test`/`build`/`bootRun` execution, with some stale verification wording still present.
- Continuation 2 exited 0 after reports were updated, `req-1` was archived, and `workflow finish implement` passed.
- Final state:
  - `implementation-report.md`: filled;
  - `review-report.md`: filled;
  - `req-1`: archived;
  - `workflow finish implement`: PASS exit 0;
  - `workflow check`: WARN only, with reports filled, no verification failure, stack alignment OK, no pending tickets, and Java role read coverage present.
- Gradle wrapper files were generated, and `gradlew.bat test` / `gradlew.bat build` were BUILD SUCCESSFUL. `bootRun` started the server and then timed out while running.
- Backend-shape PASS evidence included Spring Boot app, Gradle runtime, Gradle only, Maven absent, fake shim absent, package/layer boundaries, Controller/Service/Repository/DTO/Domain boundary, domain repository port, infrastructure repository adapter, service storage/id sequence ownership, domain behavior, DTO boundary, and bootJar.
- Remaining backend-shape WARN candidates were Entity direct exposure and Verification report.
- Fake `gradle-shim.js`, Java `HttpServer`, and Express/CommonJS workarounds were not observed.
- This smoke is workflow rail closure evidence, not generated app product quality certification. AST/linter/enforcement gates are still not part of this release.
- Runtime hook/evidence boundary coverage was added after release prep so host stability is improved when evidence or context loading fails. Normal injection/evidence behavior is expected to stay unchanged.

### Verification

- `npm test` passed: scope/docs diagnostics PASS, 56 files, 355 tests.
- `npm run typecheck` passed.
- `npm run build` passed.
- `npm pack --dry-run` passed for `persona-harness@0.3.8-alpha.5` with 336 files.
- `npm run check:docs` passed.

## [0.3.8-alpha.4] - 2026-06-25

### Changed

- Clarified pending review continuation guidance so template review reports and pending `req-*` tickets keep agents on the continuation path instead of allowing premature completion claims.
- Updated Java/Spring verification guidance to prefer a real Gradle wrapper first, then system Gradle only when appropriate, without suggesting fake Gradle shim workarounds.
- Reduced backend-shape false positives for repository ports, repository adapters, and flat DTO names such as `TaskRepository`, `JdbcTaskRepository implements TaskRepository`, `CreateTaskRequest`, and `TaskResponse`.
- Normalized backend-shape path handling so Windows path separators do not hide generated Java evidence.

### External Smoke

- Windows backend-shape fixture-v2 recheck succeeded from a local current `npm pack` install at HEAD `31fb91a` with package version `0.3.8-alpha.3`.
- `npx ph review backend-shape` exited 0 and generated a backend-shape report.
- The report passed:
  - Domain repository port evidence with `TaskRepository.java`;
  - Infrastructure repository adapter evidence with `JdbcTaskRepository.java`;
  - DTO boundary evidence with `CreateTaskRequest.java` and `TaskResponse.java`.
- The previous Windows path separator false positive was not reproduced.
- Remaining WARN items were limited to the narrow fixture shape: missing application/controller/service examples and missing Gradle runtime. Those are outside this recheck's success criteria.
- This release is still workflow/check/report guidance hardening. It does not certify generated app product quality, and full OpenCode end-to-end implementation quality remains a separate smoke target.

### Verification

- `npm test` passed: scope/docs diagnostics PASS, 55 files, 342 tests.
- `npm run typecheck` passed.
- `npm run build` passed.
- `npm pack --dry-run` passed for `persona-harness@0.3.8-alpha.4` with 329 files.
- `npm run check:docs` passed.

## [0.3.8-alpha.3] - 2026-06-25

### Added

- Added Windows-aware doctor command detection so `ph doctor` can report OpenCode runtime readiness more reliably on Windows.
- Added stack-alignment checks for generated backend projects and made `ph workflow finish implement` block on stack mismatch.
- Added Java role read coverage gating so implementation finish can require generated Controller, Service, Repository, DTO, Domain, and related Java files to have been read.
- Added backend-shape review reporting to summarize generated backend structure evidence.
- Added Windows-safe and vendor-safe bearshell/read/search guidance for workflow prompts.

### Changed

- Clarified `ph init` as the minimal harness/OpenCode integration step and `ph bootstrap backend` as the backend-ready bootstrap path.
- Strengthened Java guidance to forbid fake Gradle shims and HTTP-server/CommonJS style workarounds for Java/Spring backend targets.
- Bounded Windows search guidance to README/project files instead of unsafe recursive vendor scans.

### External Smoke

- Windows P0/P1 smoke was partially successful:
  - doctor and runtime readiness passed;
  - init/bootstrap output matched generated artifacts;
  - `profileSummaryInjected` was confirmed;
  - backend-shape report generation was observed;
  - fake Gradle shim, `HttpServer`, and CommonJS workarounds were not observed.
- OpenCode full finish still timed out/continued with pending work, so full implementation completion and generated product quality are not certified.
- Windows vendor-safe bearshell search smoke succeeded for README-only `Select-String -Path README.md -Pattern TODO` guidance, output, and command execution; unsafe recursive/vendor search guidance was not observed.

### Verification

- `npm test` passed: scope/docs diagnostics PASS, 55 files, 337 tests.
- `npm run typecheck` passed.
- `npm run build` passed.
- `npm pack --dry-run` passed for `persona-harness@0.3.8-alpha.3` with 328 files.
- `npm run check:docs` passed.

## [0.3.8-alpha.2] - 2026-06-24

### Added

- Added `profileSummaryInjected` runtime evidence so README/project-bootstrap injection records whether the backend profile summary reached the same model-input block.
- Added pending workflow ticket completion guidance to `workflow check`, `workflow continue`, and `workflow finish implement` output so agents are explicitly told not to claim overall completion while pending tickets remain.

### Changed

- Clarified bootstrap injection evidence documentation to distinguish backend profile summary injection from AGENTS-only signals.
- Strengthened pending-ticket CLI copy without changing workflow enforcement semantics.

### External Smoke

- External Smoke was partially successful.
- `profileSummaryInjected` marker evidence was observed in README-read phase0 evidence.
- Pending workflow guidance was observed for `workflow check`, `workflow continue`, and `workflow finish implement`.
- Follow-up policy path smoke did not reproduce the previous `.persona/policies` permission auto-reject, so that issue can be removed as a publish blocker.
- OpenCode full implementation quality is still not certified, and direct `.persona/rules/backend/...` reads remain a follow-up risk.

### Verification

- `npm test` passed: scope/docs diagnostics PASS, 51 files, 327 tests.
- `npm run typecheck` passed.
- `npm run build` passed.
- `npm pack --dry-run` passed for `persona-harness@0.3.8-alpha.2` with 309 files.

## [0.3.8-alpha.1] - 2026-06-24

### Added

- Added prompt-only requirements workflow transition coverage:
  - capture;
  - draft;
  - approve;
  - split;
  - next;
  - finish blocking while tickets remain pending.
- Added parser-level workflow report status coverage for `workflow check` and `workflow finish implement`.
- Added direct `RailComplianceTracker` unit coverage for report-only rail mismatch evidence.
- Added `createPhase0Hooks` intent-workflow hook-boundary coverage for requirements, programming, debug, review, refactor, and git rails.
- Added clean tarball workflow smoke evidence for `ph bootstrap backend`, `ph workflow split`, `workflow next`, `workflow continue`, `workflow finish implement`, `workflow check`, and `ph doctor`.

### Changed

- Strengthened release confidence for v0.3.8 by covering workflow transitions at integration, parser, runtime tracker, and hook-boundary layers.
- Kept generated Java/Spring app code quality as injection guidance plus report-only review, not an enforcement gate.

### Verification

- `npm test` passed: 51 files, 326 tests.
- `npm run typecheck` passed.
- `npm run build` passed.
- Clean tarball install smoke passed for Persona workflow command surfaces.

## [0.3.8-alpha.0] - 2026-06-24

### Added

- Added v0.3.8 workflow reliability guidance for pending workflow tickets:
  - `ph workflow finish implement` now reports pending ticket id, title, path, next command, and archive command;
  - technical-constraints tickets can be surfaced as review/archive candidates when existing workflow signals already pass;
  - `ph workflow continue` now includes pending ticket context before the generic resume prompt.

### Changed

- Strengthened profile-not-ready workflow UX so `.persona` projects without a ready backend profile point to `npx ph intake --interactive` or `npx ph bootstrap backend`.
- Strengthened runtime implementation guidance so AI runs must read `.persona/project-profile.jsonc`, avoid stack drift, and continue pending tickets instead of claiming completion.

### Verification

- `npm test` passed: 47 files, 308 tests.
- `npm run typecheck` passed.
- `npm run build` passed.
- `npm pack --dry-run` passed.

## [0.3.7-alpha.1] - 2026-06-24

### Added

- Added workflow profile read coverage reporting for backend profile runs.
- Added implementation-report and review-report prompts for `.persona/project-profile.jsonc` read method/range evidence.

### Changed

- `ph workflow finish implement` now blocks when a ready backend profile exists but project-profile read coverage is missing.
- AI-facing implementation guidance now tells agents to read `.persona/project-profile.jsonc` before implementation and record that coverage.

### Fixed

- Made `ph doctor` surface OpenCode runtime readiness explicitly, including a clear WARN when the OpenCode CLI is missing.
- Made workflow report status parsing accept checklist and bold Markdown forms such as `- **Status:** filled`.
- Added Java/Spring/Gradle stack-alignment diagnostics for backend profiles so Node/CommonJS or non-Gradle output is reported as `STACK_MISMATCH`.
- Made `ph workflow finish implement` block on `STACK_MISMATCH` while keeping `ph workflow check` report-only.

## [0.3.7-alpha.0] - 2026-06-24

### Added

- Added `detectTopLevelIntent` runtime routing for requirements/debug/review/refactor/git/programming intent priority.
- Added Persona Debug Workflow block injection for debug primary intent.
- Added Persona Review Workflow block injection for review primary intent.
- Added Persona Refactor Workflow block injection for refactor primary intent.
- Added Persona Git Workflow block injection for git primary intent.
- Added Persona Programming Workflow block injection for direct code creation/edit primary intent.
- Added `phase0.intent.1` evidence records for injected workflow rails.
- Added report-only `phase0.rail-compliance.1` evidence for selected-rail versus observed-tool behavior mismatches.
- Added report-only `phase0.continuation.1` evidence and text-completion continuation guidance for unfinished workflow backlog/report state.
- Added `ph workflow roles` and `.persona/workflow/roles.md` as a non-autonomous role-boundary artifact for blackbear/Charles/jaeki/roach.
- Added unit coverage for top-level intent priority and mixed-intent sequencing.
- Added next rail prompt drafts for review/refactor/git workflow blocks.

### Changed

- Workflow rail text now loads from PH-owned `packages/shared-skills/skills/workflow/**/SKILL.md` runtime blocks instead of hardcoded runtime strings.
- Requirements workflow injection now goes through the top-level router, so README-related bug reports do not get misrouted into requirements implementation workflow.
- README-related debug requests now receive a debug workflow block instead of no workflow guidance.
- Review requests now receive a findings-first review workflow block that tells the AI not to modify code unless the user explicitly asks for fixes.
- Refactor requests now receive a behavior-preserving refactor workflow block that tells the AI to establish baseline behavior, avoid feature changes, keep changes small, and rerun the same verification.
- Git-only requests now receive a repository-safe git workflow block before commit/push/tag/history operations.
- Direct programming requests now receive a scoped programming workflow block unless a stronger requirements/debug/review/refactor/git rail applies.
- Workflow rail injection now records the original user prompt, primary intent, secondary intents, reason, and injected rail marker in local evidence.
- Rail compliance checks remain diagnostics-only; they do not block builds, tests, OpenCode runs, or generated app output.
- Continuation checks remain diagnostics-only; they append next-ticket guidance when workflow artifacts record remaining scope, but do not continue or certify implementation.
- Role boundaries are now a workflow artifact, not autonomous multi-agent execution.

## [0.3.6-alpha.1] - 2026-06-23

### Added

- Added a PH-style intent preamble for requirements workflow routing:
  - `의도 감지`;
  - `근거`;
  - `다음 행동`.
- Added top-level intent router design documentation for:
  - requirements;
  - debug;
  - review;
  - refactor;
  - git;
  - programming.

### Changed

- Clarified that short AI/TUI requests should first be classified into a primary workflow rail before defaulting to direct implementation.
- Updated the progress board to track `v0.3.x` AI-facing workflow routing as the active direction.

### Verification

- `npm run check:docs` passed.
- `npm test` passed: 37 files, 261 tests.

## [0.3.6-alpha.0] - 2026-06-23

### Added

- Added requirements drafting workflow before implementation:
  - `ph workflow draft --stdin` creates `.persona/workflow/requirements/backlog.md`, `questions.md`, and `assumptions.md` from a vague product idea;
  - `ph workflow approve requirements` marks the draft accepted before ticket splitting;
  - vague product ideas such as `TODO 웹 서비스 만들래` route to `requirement-drafting` and stop for user review;
  - approval phrases such as `진행하자` route to `requirement-approval` only when a draft backlog exists.

### Verification

- `npm test -- tests/persona-harness-workflow-ticket.test.ts tests/phase0-hooks.test.ts` passed.
- `npm run typecheck`, `npm run build`, `npm test`, `npm run report:rules`, `npm run check:scope:strict`, `npm run check:injection-value`, and `npm pack --dry-run` passed.
- dist CLI smoke confirmed `draft -> approve -> split -> next`.
- dist runtime transform smoke confirmed draft/approval intent routing.

## [0.3.5-alpha.0] - 2026-06-23

### Changed

- Split the `ph init` setup path by terminal mode:
  - interactive terminal: install harness files and start the backend profile interview;
  - AI/non-TTY shell: install harness files, stop before profile creation, and direct the agent to `npx ph bootstrap backend`.
- Updated injection guidance so agents do not attempt interactive prompts from non-TTY shells.
- Updated README/workflow docs to explain the human interview path and the AI bootstrap path separately.

### Fixed

- Prevented `ph init` in non-TTY contexts from falling through to the generic interactive-intake TTY error.
- Kept `ph init` from silently creating a default project profile when the intended profile interview cannot run.

### Verification

- `npm test -- tests/persona-harness-init.test.ts tests/phase0-hooks.test.ts tests/persona-harness-interactive-intake.test.ts` passed.
- `npm test` passed: 36 files, 240 tests.
- `npm run typecheck` passed.
- `npm run build`, `npm run report:rules`, `npm run check:scope:strict`, `npm run check:injection-value`, and `npm pack --dry-run` passed.
- non-TTY `ph init`, TTY `ph init`, and `ph bootstrap backend` smoke checks passed.

## [0.3.4-alpha.0] - 2026-06-23

### Added

- Strengthened continuation workflow for long README implementations.
- Added explicit continuation fields to the implementation report template:
  - completed requirements;
  - incomplete requirements;
  - last completed requirement/file;
  - remaining README/plan range;
  - remaining implementation scope;
  - interruption reason;
  - next command/action;
  - next prompt hint.
- Added `ph plan --next` behavior that prefers `npx ph workflow continue` when a filled implementation report still records remaining scope.
- Added plan unchecked checklist output to the continuation prompt so agents can resume from the accepted plan and previous report evidence.

### Changed

- Refactored workflow report template generation into `src/cli/workflow-templates.ts` to keep the plan CLI smaller and easier to review.

### Verification

- Long README smoke created a 260-line README and simulated an interrupted first pass that completed Step 1-40 and left Step 41-260.
- Observed `ph plan --next` recommend `npx ph workflow continue` with continuation evidence.
- Observed `ph workflow continue` print remaining README range, incomplete requirements, interruption reason, next action, next prompt hint, and unchecked plan items.
- `npm test`, `npm run typecheck`, `npm run build`, and `npm pack --dry-run` passed before publish.

### Known Gaps

- Continuation workflow is still an AI-facing rail. It does not automatically execute OpenCode or certify generated app quality.
- It depends on the agent filling continuation evidence honestly when a run stops early.
- Full TDD workflow remains future scope.

## [0.3.3-alpha.0] - 2026-06-23

### Added

- Added Existing Project Adaptation Mode to `ph plan`, with automatic `greenfield` versus `existing-code` project mode output.
- Added existing Java source discovery for package root and layer/style hints so brownfield projects can prefer their current package, naming, repository, DTO, and domain flow.
- Added plan/prompt/workflow guidance that existing code wins over greenfield guidance.
- Added README read coverage fallback from `.persona/evidence` when filled workflow reports omit explicit README ranges.
- Added existing Spring-style role discovery coverage for Controller, Service, Repository, DTO, Domain, Exception, and Test files.

### Changed

- Changed Java Role Read Follow-up to ask for representative role files instead of every discovered Java file, while still recording full role-discovery evidence.
- Relaxed workflow finish classification when raw-shell checklist text remains but final verification was rerun through `npx ph bearshell`.

### Verification

- Existing Spring-style smoke used a current local tarball install, `npx ph init`, accepted plan workflow, and OpenCode `openai/gpt-5.4-mini-fast` with the short prompt `README.md 보고 구현해줘`.
- Observed `Mode: existing-code`, package root `com.acme.todo`, layer hints `domain, dto, repository, service, web`.
- Generated code stayed in the existing `web/service/repository/dto/domain` package flow rather than forcing `presentation/application/domain/infrastructure`.
- Java role discovery evidence covered Controller, Service, Repository, DTO, Domain, and Test files.
- `gradle test`, `gradle build`, and HTTP smoke passed through the generated project.

### Known Gaps

- OpenCode may still inspect package metadata such as `node_modules/persona-harness/package.json` before settling into the workflow rail.
- Agents may still perform an initial raw shell probe before rerunning final verification through `npx ph bearshell`.
- Long README continuation remains the next product gap; full TDD workflow is still future scope.

## [0.3.2-alpha.3] - 2026-06-23

### Added

- Added `ph bootstrap backend` as an AI-facing fast path that fills missing backend profile, policy, accepted plan, and workflow report templates.
- Added conditional workflow behavior for non-harness projects: when `.persona/` is absent, `ph workflow implement` now returns an advisory PASS and does not block normal implementation.
- Added stricter initialized-harness behavior: when `.persona/` exists but profile/plan/report artifacts are missing, `ph workflow implement` now directs the agent to `npx ph bootstrap backend`.
- Added `ph workflow continue` as an AI-facing alias for the accepted-plan continuation prompt used after interrupted or long README implementations.
- Added clean short-request review evidence for the current alpha.3 candidate.

### Changed

- Strengthened Gradle wrapper guidance in Java/Spring implementation rails so generated apps prefer `./gradlew`/`gradlew.bat` verification and do not treat missing system Gradle as application failure.
- Clarified raw shell environment probe warnings as non-blocking notes when final verification was rerun through `npx ph bearshell`.
- Updated injection guidance so Persona Harness workflow gates apply only after a project has opted in with `.persona/`.

### Known Gaps

- OpenCode may still read `.persona/rules` directly before settling into the workflow rail.
- Workflow finish can still be satisfied by report text, so future hardening should reduce report-only self-attestation risk.
- This release still does not certify generated application product quality.

## [0.3.2-alpha.2] - 2026-06-22

### Added

- Added a profile-required implementation gate: `ph plan` and `ph workflow implement` now stop when `.persona/project-profile.jsonc` is missing, draft, invalid, or incomplete.
- Added `ph intake --default backend` for a ready backend profile without an interactive terminal.
- Added default backend profile creation during `ph init`, so a clean install can move straight to `ph plan --auto-accept` unless the user wants to customize intake answers.
- Added `ph plan --auto-accept` as a faster planning path for users who do not want a separate manual accept step during alpha smoke tests.
- Added Java role-discovery guidance to `ph workflow implement` so generated Java files can be surfaced through `npx ph bearshell --shell 'find ...*.java...'` and picked up by existing role-discovery evidence.

### Changed

- Updated fast-path guidance so implementation starts through `npx ph workflow implement` only after the profile and accepted workflow plan exist.
- Updated the implementation report template with Java role discovery/read evidence fields.

### Known Gaps

- Java role discovery depends on the agent following the `ph workflow implement` rail after generating files; file creation alone is not treated as proof that every generated Java file was read.

## [0.3.2-alpha.1] - 2026-06-22

### Fixed

- Fixed README read coverage parsing so `ph workflow check` and `ph workflow finish implement` accept ranges recorded under a `## README ranges read` heading, not only the older `- README ranges read:` field shape.

### Notes

- `0.3.2-alpha.0` was published, but fresh install smoke found this parser gap before external tester handoff.
- This hotfix keeps the same Java/Spring backend MVP scope and only patches the workflow evidence parser.

## [0.3.2-alpha.0] - 2026-06-22

### Added

- Added `ph workflow implement` as the single AI-facing implementation rail for short TUI requests such as `README.md 보고 구현해줘`.
- Added README chunk-read guidance to the implementation rail, using `npx ph bearshell --shell 'wc -l README.md'` and 220-line `sed -n` ranges.
- Added README read coverage workflow diagnostics so filled implementation reports must record `README ranges read` when `README.md` exists.
- Added `src/cli/workflow-output.ts` to keep workflow command orchestration separate from long AI-facing rail output.

### Changed

- Updated injection, plan prompts, next/resume output, and README guidance to prefer `npx ph workflow implement` over the older two-step `workflow start implement` plus `plan --implement` path.
- Kept `ph workflow start implement` and `ph plan --implement` available as lower-level compatibility surfaces.
- Kept direct `.persona/rules` reads as non-blocking workflow notes, while raw final verification remains blocking.

### Fixed

- `ph workflow finish implement` now fails when `README.md` exists but README range coverage is empty, preventing agents from reporting completion after only a partial README read.

### Known Gaps

- The read coverage gate verifies recorded ranges, not semantic understanding of the README.
- This release still does not certify generated application product quality.
- Full TDD workflow, frontend, infra, desktop, and AST/linter enforcement remain future tracks.

## [0.3.1-alpha.2] - 2026-06-22

### Added

- Strengthened `ph doctor` with rules-surface counts and a stale Roomescape step fixture scan across public `.persona/rules`.
- Strengthened `ph smoke` so the smoke report includes local install/OpenCode/plugin/rules-surface diagnostics in addition to workflow status.
- Strengthened AI-facing workflow output for short TUI requests such as `README.md 보고 구현해줘`, making `npx ph workflow start implement`, `npx ph bearshell`, report filling, and `npx ph workflow finish implement` more explicit.
- Added an npm package ignore file so `dist/` remains included in release tarballs even though it is ignored by git.

## [0.3.1-alpha.1] - 2026-06-22

### Fixed

- Removed old Roomescape step contract fixture rules from the public `ph init` rule copy and npm package surface. The internal `backend/step1-api-contract.md` and `backend/step2-3-api-contract.md` files remain available for Phase 0 regression fixtures, but clean external projects no longer receive stale `/reservations` or `/times` guidance.

### Added

- Added v0.3.1 external tester guide and feedback template for the published `persona-harness@alpha` smoke path.

## [0.3.1-alpha.0] - 2026-06-22

### Added

- Added `ph workflow check`, `ph doctor`, `ph smoke`, `ph feedback`, `ph evidence summary`, and `ph review backend-shape` as report-only local commands for external tester diagnostics, workflow evidence discipline, evidence summary, and backend shape observation.
- Added `ph workflow guard implement` and `ph workflow guard final` as AI-facing strict workflow gates for implementation start and final answer readiness.
- Added npm dist-tag reporting to `ph doctor` so local installs can see current `alpha` and `latest` registry versions when the registry is reachable.
- Added workflow command-discipline diagnostics so filled workflow reports can surface raw shell usage or missing `npx ph bearshell` evidence as report-only WARNs.
- Added backend-shape review coverage for `*Store.java implements *Repository` adapters and verification evidence split across implementation/review reports.
- Added AI-facing codegraph-first guidance for code structure analysis and change-impact review, with targeted file reads as fallback when codegraph is unavailable.

### Changed

- Clarified that `ph` commands are primarily an AI-facing workflow surface: users can ask the TUI in plain language, while the agent should run `npx ph workflow guard implement`, `npx ph plan --implement`, `npx ph bearshell`, report-fill commands, and `npx ph workflow guard final`.
- Tightened `ph plan --prompt` and `ph plan --implement` so short implementation requests route through strict workflow guards, accepted plan status, implementation report filling, review report filling, and manual QA evidence.
- Narrowed workflow command-discipline classification so raw final verification stays blocking, but an initial raw smoke that was rerun through `npx ph bearshell` can finish.
- Reduced model-facing injection noise by removing full shared-skill reference paths while preserving metadata evidence.
- Extended `ph history` archive summaries with evidence-summary content when available.

### Known Gaps

- Command-discipline diagnostics are report-only WARNs, not enforcement gates.
- `ph bearshell` is still timeout/output bounded only; it is not a sandbox.
- This alpha still does not certify generated application product quality.
- Full TDD workflow, frontend, infra, desktop, and AST/linter enforcement remain future tracks.

## [0.3.0-alpha.3] - 2026-06-22

### Added

- Added `ph plan --implement` as a plan-aware implementation gate that blocks short implementation requests until `.persona/workflow/plan.md` is accepted and workflow report templates exist.
- Added injected guidance for short implementation intents such as `플랜 보고 구현해줘` to route through `npx ph plan --implement` before coding.
- Added TUI read-limit guidance so long README/plan files are read through `ph bearshell` line ranges and interrupted runs record remaining scope in the implementation report.
- Added `ph help`, `ph language`, and a `user-language` intake question for multilingual tester setup.
- Added Read Coverage evidence fields to implementation reports so agents record read method/ranges instead of checkbox-only claims.
- Added `0.3.0-alpha.3` candidate notes and GitHub Actions release automation docs.
- Added `ph plan --next` to print the next workflow action from plan/report status.
- Added `ph plan --resume` to print a continuation prompt from accepted plan and implementation report evidence.
- Added package-flow guidance that steers Java/Spring generated packages toward `presentation/application/domain/infrastructure`.
- Added `bootJar` guidance/reporting so executable Spring Boot apps do not treat `:bootJar SKIPPED` as a valid build pass.
- Added alpha.3 demo packaging decision notes and release notes.

### Changed

- External tester guidance now starts with a minimal published-alpha command path and explicitly separates success evidence from setup-only evidence.
- Release automation now checks tag/package version alignment and runs an npm publish dry-run before real publish.
- Release readiness now allows alpha.3 demo packaging checks to proceed after fresh ON package-flow and `bootJar` evidence.

### Known Gaps

- `ph plan --resume` creates a continuation prompt but does not automatically resume OpenCode by itself.
- Alpha.3 is still workflow/tooling evidence, not generated application product-quality certification.

## [0.3.0-alpha.2] - 2026-06-21

### Changed

- Promoted the P0 plan-first CLI, diagnostics, scope, and bearshell hardening line to the next alpha candidate because the published `0.3.0-alpha.1` package still printed the old implementation-first `ph init` guidance.
- Updated release automation so prerelease publishes also move the npm `latest` dist-tag to the same current alpha/beta version, avoiding stale default installs.
- Published `persona-harness@0.3.0-alpha.2` to npm and synchronized both `alpha` and `latest` dist-tags to this version for the alpha pilot.
- Documented the full OpenCode prerequisite flow before Persona Harness setup.
- Added OpenCode provider/model connection steps using `opencode auth login`, `opencode auth list`, `/connect`, and `/models`.
- Clarified that Persona Harness planning files can be created without OpenCode, but plugin injection and evidence capture require OpenCode.
- Updated external tester docs to use the published `persona-harness@alpha` install path.
- Added GitHub Actions release automation for verify, npm publish on version tags, and generated GitHub release notes.
- Tightened workflow prompts and report templates to prefer `npx ph bearshell` for repo inspection, Gradle verification, and smoke commands.
- Clarified that clean project agents should call Persona Harness through `npx ph ...`, not a globally installed `ph`.
- Clarified Java backend bootstrap guidance so domain static factories close creation through private constructors.
- Changed `ph init` next steps to the plan-first flow: intake, policy, plan, accept or revise, then implementation.
- Narrowed default `enabledDomains` to the Java backend MVP surface: `backend` and `programming`.
- Added diagnostics-only reporting for malformed `.persona/harness.jsonc` instead of silently hiding the fallback.
- Added a default `ph bearshell` command timeout with `PH_BEARSHELL_TIMEOUT_MS` override, while keeping the command helper explicitly non-sandboxed.

## [0.3.0-alpha.1] - 2026-06-21

### Changed

- Published the first tester-facing alpha line after `0.3.0-alpha.0`.
- Added OpenCode prerequisite and provider/model setup documentation.
- Prepared release automation and external tester guidance, but the published package still had stale `ph init` implementation-first output.

## [0.3.0-alpha.0] - 2026-06-21

### Added

- Java/Spring backend alpha package posture for external tester installation.
- `ph init`, `ph intake`, `ph policy`, `ph plan`, `ph history`, and `ph bearshell` as the current CLI workflow surface.
- Backend project profile, policy overlay, planning artifact, report lifecycle, and workflow history docs.
- Apache-2.0 license file and alpha publish readiness record.
- User-facing README plus language-specific README files for Korean, Japanese, and Simplified Chinese.

### Changed

- Root README is now user-facing, while previous detailed usage notes moved to `docs/current/persona-harness-detailed-usage.md`.
- npm package contents are trimmed to the Java backend MVP surface.
- The alpha package includes only the Java programming shared-skill reference subset, not the full vendored shared-skills tree.

### Removed From Package

- Inactive OMO reference skills such as `ast-grep`, `frontend`, `debugging`, and `review-work`.
- Java no-excuse fixture files from the public alpha tarball.
- Repo maintenance scripts that are not required by installed package users.

### Known Gaps

- The current alpha line still needs external tester feedback before stable support guarantees.
- Generated app product quality is not certified.
- Rule compliance is not enforced by AST, linter, or build failure gates.
- Frontend, infra, desktop, and full TDD workflows remain future tracks.

## Links

- Release checklist: [docs/current/release/release-checklist.md](docs/current/release/release-checklist.md)
- Release notes template: [docs/current/release/release-notes-template.md](docs/current/release/release-notes-template.md)
