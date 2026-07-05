# Rail-Entry Measurement Status

Last updated: 2026-07-03

This status note is an append-only interpretation correction for the Stage 3
rail-entry A/B archive. It does not modify the historical archive, product
behavior, evidence schemas, defaults, or release channels.

## Stage 3 Archive

Archive:
`/Users/yongtae/Desktop/persona-harness-artifacts/archive/2026-06-24-desktop-persona-runs/stage3-rail-entry-ab-15-20260703T025514Z`

Relevant archive file:
`measurement-plan.json`

The Stage 3 measurement plan defined:

- PH OFF: no local PH install, no workspace OpenCode plugin, and
  `NPM_CONFIG_OFFLINE=true` for agent commands.
- PH ON: local-current PH tarball installed, `ph bootstrap backend
  --runtime-injection-preview --no-developer-mcp --no-codegraph --force`, and
  `runtimeInjection=true` asserted.

## Corrected Interpretation

Stage 3 measured `PH stack present vs PH absent` rail entry. A clearer short
label is `stack-vs-nothing rail entry`.

Stage 3 did not measure the preregistered H1 question:
`runtimeInjection ON vs OFF with all other PH stack setup equal`.

Therefore, Stage 3 must not be cited as banner-only effect evidence or as proof
that `runtimeInjection` itself caused the rail-entry delta. The archive remains
useful as scoped rail-entry evidence for a stack-present condition, but it is
not a runtimeInjection/banner-only default-changing measurement.

Runtime injection remains default OFF because the default-changing H1
measurement is still absent. This is not a claim that Stage 3 proved a positive
or negative banner-only/runtimeInjection effect.

## Current Decision Boundaries

- No token-saving or provider-token-saving claim.
- No product-efficacy or navigation-benefit claim.
- No app-quality, full-TDD, or test-sufficiency claim.
- No broad reliability or closure guarantee claim.
- No autonomous-loop, generated-app certification, automatic completion,
  downgrade, removal, or enforcement claim.
- No product behavior, evidence schema, default, version, publish, tag, latest,
  or dist-tag movement is made by this correction.

## Stage 9 Banner-Only H1 Measurement

Archive:
`/Users/yongtae/Desktop/persona-harness-artifacts/archive/2026-06-24-desktop-persona-runs/stage9-banner-only-rail-entry-ab-10-20260703T053234Z`

Relevant archive files:
`KILL_CRITERIA.md`, `measurement-plan.json`, `runs.json`, `summary.json`,
`RESULT.md`, and raw per-run OpenCode JSONL/stderr logs under `raw/`.

Stage 9 measured the H1 that Stage 3 did not measure:
with PH installed and bootstrap artifacts present in both conditions, does
`runtimeInjection ON` increase rail entry compared with `runtimeInjection OFF`?

Condition definitions:

- OFF: local-current tarball installed, `ph bootstrap backend
  --no-developer-mcp --no-codegraph --force` exited 0, and
  `runtimeInjection=false` was asserted.
- ON: same as OFF plus `--runtime-injection-preview`, and
  `runtimeInjection=true` was asserted.

Validity checks passed:

- 10/10 paired rows accepted.
- invalid run count: 0.
- OFF and ON setup assertions passed for all pairs.
- README SHA-256, TASK SHA-256, and fixture start commit matched inside every
  pair.
- All archive JSON/JSONL files parsed.

Rail-entry result:

- OFF rail entry: 10/10.
- ON rail entry: 10/10.
- Paired delta: 0 percentage points.
- Paired sign test: improved 0, worsened 0, tied 10; one-sided p = 1.

H1 judgment: not supported for this fixture. The preregistered positive
criterion, `ON - OFF >= +30pp` and one-sided sign test `p < 0.05`, was not met.

Runtime-injection decision state: `runtimeInjection` remains default OFF. This
is not a claim that runtime injection is broadly useless; it means the
banner-only H1 did not show a rail-entry increase in this controlled fixture.
The OFF condition already entered PH rails in 10/10 sessions with the PH stack
installed and bootstrap artifacts present, so follow-up hypotheses should
inspect where AGENTS/profile/bootstrap context is sufficient without runtime
banner injection.

Telemetry was captured as a snapshot only:

- elapsed mean: OFF 21648.3 ms, ON 21888.8 ms.
- provider total token mean: OFF 48467.5, ON 54504.4.

These telemetry values are not token-saving, product-efficacy, or navigation
benefit evidence.

## Stage 7-9 Summary

- Stage 7 corrected Stage 3 interpretation: Stage 3 was
  `stack-vs-nothing rail entry`, not banner-only/runtimeInjection H1 evidence.
- Stage 8 separated ralph-loop per-blocker and per-session budgets and added
  conservative utterance session classification for ralph-loop/idle
  continuation. This did not change defaults.
- Stage 9 measured the corrected banner-only H1. Result: H1 not supported for
  this fixture; `runtimeInjection` remains default OFF.
- Stage 10 adds role-boundary scope honesty and report-only heuristic
  production-source write observation; see the note below.

## Stage 10 Role-Boundary Note

Stage 10 keeps `ph workflow role-boundary [--json]` report-only. The role
artifact scan remains artifact-scan only; production-source writes are not
observed by the artifact scan itself.

When `multiAgent.enabled=true` and relay preview has a current role, runtime
write/edit target paths can be aggregated as heuristic report-only findings
under `.persona/evidence/role-boundary/`. These findings use time-window
attribution only; the write may originate from the main session or an unrelated
subagent. They do not block writes, auto-fix files, mutate workflow state, or
create closure blockers.

Wrong-actor attribution remains a blind spot. A heuristic finding may originate
from the main session, the current role checklist pass, or an unrelated
subagent/session. It must not be treated as deterministic role enforcement,
blocked-write evidence, closure-blocker evidence, or proof of a wrong actor.

Block/enforcement mode remains unavailable without stable per-session role
identity. This is not deterministic per-session role enforcement and not a
success, reliability, closure, product-efficacy, app-quality, full-TDD, token
saving, generated-app certification, automatic completion, downgrade, or
removal claim.

## Runtime Injection Park Decision

Runtime injection is parked. The basis is the Stage 9 banner-only H1 result
and the observed static setup path: with PH installed and bootstrap artifacts
present in both conditions, the banner-only H1 was not supported, while static
AGENTS/profile/bootstrap artifacts alone produced rail entry 10/10 for the
measured fixture.

Parked does not mean removed. `ph bootstrap backend --runtime-injection-preview`
remains available as an explicit preview, but additional runtime-injection
investment is paused.

Runtime-injection work may resume only under a designed and approved
long-session post-compaction rail-retention ON/OFF measurement. Until then,
runtimeInjection remains default OFF and must not be cited as token-saving,
product-efficacy, navigation-benefit, app-quality, full-TDD, broad reliability,
closure-guarantee, generated-app certification, or automatic completion
evidence.

## HARDEN-1 H1-0 Rail-Entry Regression Gate

Archive:
`/Users/yongtae/Desktop/persona-harness-artifacts/archive/2026-06-24-desktop-persona-runs/harden-h1-0-stable-preflight-20260704T140126Z`

Scenario: Stage 20 failed-finish `Summary:` header wording.

Status: PARTIAL. The reusable Stage 16-f rail-entry prompt regression gate was
initialized for the Stage 20 finish summary header change, but the available
gate implementation is an operator-run `init`/`check` surface. It does not run
real OpenCode n=5 paired rows by itself.

Observed gate check:

- `measurement-plan.json`, `KILL_CRITERIA.md`, and `summary.json` were created.
- `node scripts/rail-entry-prompt-regression-gate.mjs check --archive <archive>`
  exited non-zero because `finalAcceptedValidPairs` was `0`, below the required
  minimum `5`.
- No real paired OpenCode rows were executed in H1-0.
- No rail-entry non-inferiority claim is made for the Stage 20 finish summary
  header.

Decision: Stage 20 is not marked rail-entry non-inferior by H1-0. Before stable
release GO relies on this gate, an operator or runner must execute the n>=5
paired rows or explicitly accept the PARTIAL preflight caveat. This record does
not modify Stage 3 or Stage 9 evidence and does not change runtimeInjection
defaults.

## HARDEN-1 H1-6a Precheck

Archive:
`/Users/yongtae/Desktop/persona-harness-artifacts/archive/2026-06-24-desktop-persona-runs/harden-h1-6a-precheck-blocked-20260704T162141Z`

Scenario: repeated `workflow finish/check` output compression prerequisite.

Status: PARTIAL / blocked before implementation. The H1-6a prerequisite
requires a real n>=5 paired rail-entry regression check and a small paired
repeated finish/check behavior check before compression is applied.

Observed repository state:

- `opencode` is installed locally.
- The packaged Stage 16-f rail-entry prompt regression gate remains an
  operator-run `init`/`check` surface. It prepares and validates a plan and
  summary, but it explicitly does not run OpenCode sessions.
- No repo runner was found that executes the required real n>=5 paired
  rail-entry rows or the repeated finish/check behavior comparison.

Decision: H1-6a repeated-output compression is not implemented in this pass.
H1-6b structured summary derivation is not started because the requested H1-6
sequence requires H1-6a prerequisite success before implementation continues.
Stable GO remains blocked by the H1-0 real n>=5 rail-entry regression caveat
unless HQ explicitly waives it.

## HARDEN-1 H1-6a Real Precheck

Archive:
`/Users/yongtae/Desktop/persona-harness-artifacts/archive/2026-06-24-desktop-persona-runs/harden-h1-6a-real-precheck-20260705T005240Z`

Scenario: unblock the repeated `workflow finish/check` output compression
precheck with real rows instead of the Stage 16-f summary-only validator.

Status: FAIL for H1-6a compression readiness. The archive-local runner used the
current local package source at commit `c81e1d9961fb02951f634945b5885edffca46245`
and package version `0.6.0-rc.3`. It produced real OpenCode JSON event logs for
n=5 paired rail-entry rows and n=5 paired repeated finish/check behavior rows.

Rail-entry result:

- Valid paired rows: `5/5`; invalid runs: `0`.
- Current/control rail entry: `3/5`.
- Candidate-current Stage 20 Summary-header rail entry: `1/5`.
- Delta: `-40pp`.
- Non-inferiority criterion: not met.

Repeated finish/check result:

- Valid paired rows: `5/5`; invalid rows: `0`.
- Repeated `workflow finish implement` status and blocker counts stayed stable.
- Repeated `workflow check` status and blocker counts stayed stable.
- No-worse criterion: met for the repeated finish/check comparison only.

Decision: H1-6a repeated-output compression remains NO-GO because the required
rail-entry non-inferiority precheck failed. H1-6b structured summary derivation
was still unstarted at the time of this H1-6a decision, but later proceeded as
structured summary derivation without compression. Stable GO remains blocked by
the rail-entry caveat unless HQ explicitly waives it or a future passing real
precheck supersedes this record.

Boundary: this is precheck evidence only. It does not implement output
compression, alter Stage 20 evidence, change defaults or schemas, move version
or dist-tags, or support token-saving, product-efficacy, app-quality, broad
reliability, closure-guarantee, autonomous-completion, deterministic
enforcement, or reliable subagent-orchestration claims.

## HARDEN-1 H1-6b Structured Summary Follow-up

Status: ACCEPTED for structured finish summary derivation only. H1-6b derives
failed `workflow finish implement` human summaries from structured closure
blocker/required-fix objects rather than reparsing rendered
`Closure blocker:` text.

Accepted scope:

- preserves the Stage 20 human summary shape;
- preserves H1-1 unmapped-blocker escalation wording;
- preserves H1-4 `convention-toolchain-missing` mapped install/configuration
  guidance;
- keeps H1-6a repeated-output compression NO-GO and unimplemented.

Boundary: H1-6b changes summary derivation only. It does not change
JSON/machine output, schemas, exit codes, defaults, gate semantics, OpenCode
hook signatures, `.persona/evidence` schemas, version, publish, tag, or
dist-tags. It does not support product-efficacy, token/provider-token saving,
app-quality, broad reliability, closure-guarantee, autonomous-completion,
deterministic-enforcement, production-ready delegation, generated-app
certification, automatic completion/downgrade/removal, or CodeGraph/LSP
claims.

## Stable Cycle S-0 Correction

Status: append-only correction for stable-decision wording.

The earlier H1-6a record must not be read as saying compression NO-GO itself
blocks stable. The HARDEN-1 compression spec allowed a worse candidate to be
rolled back or recorded. H1-6a repeated-output compression remains NO-GO and
unimplemented, but that rollback/record outcome is not by itself the stable
blocker.

The unresolved stable-decision issue is narrower: the `Summary:` header shipped
in rc3/rc4 has only one real-session rail-entry evidence set so far, the H1-6a
real precheck (`n=5`, candidate `1/5` vs current/control `3/5`), and that
evidence points in the inferior direction. S-2 must regate whether the shipped
Summary header is harmful or noisy. Stable `0.6.0` should be re-evaluated
after that S-2 result.

No product/runtime behavior, defaults, schemas, evidence schemas, version,
publish, tag, latest, next, alpha, hook signature, exit-code, or JSON schema
field moves in this S-0 correction.

## Stable Cycle S-1 Gate Fixture Stabilization

Archive:
`/Users/yongtae/Desktop/persona-harness-artifacts/archive/2026-06-24-desktop-persona-runs/stable-s1-gate-fixture-20260705T024930Z`

Status: PASS for control-fixture stabilization. This is not an S-2 candidate
comparison and does not resolve the shipped Summary-header question by itself.

Comparison finding:

- Stage 9 used `persona-harness@0.5.0`, OpenCode default model, a prompt-type
  (b) fixture asking the model to read `README.md`/`TASK.md`, perform the first
  setup/workflow action the repository asks for, and stop. OFF/control rail
  entry was `10/10`; all observed OFF rails were real shell commands such as
  `npx ph workflow implement` within the first 10 tool calls.
- H1-6a used `persona-harness@0.6.0-rc.3`, OpenCode `1.17.7`, and a different
  finish-output recovery fixture. The prompt asked the model to read
  `FINISH_OUTPUT.md` and recover from failed finish output. Control rail entry
  was recorded as `3/5`, but one counted row matched a rail command inside a
  write payload rather than an executable shell command. The control baseline
  drop was therefore driven by fixture/task drift plus an over-broad parser,
  not by evidence that the Stage 9 stack condition itself became unstable.
- The H1-6a recovery fixture encouraged report-file editing and `.persona`
  inspection before running `workflow implement`; it is not the stable control
  fixture for wording regression.

Versioned fixture:

- fixture id: `gate-fixture.2`;
- package/source for S-1 pilot: local-current `persona-harness@0.6.0-rc.4` at
  commit `ae630d513a4ed56f3445166474af22666910aec4`, tarball shasum
  `d4053e6df5d71db92e1a9f8709464a09fa30a712`;
- OpenCode: `/opt/homebrew/bin/opencode`, version `1.17.7`;
- prompt type: `b-no-explicit-rail`;
- prompt: read `README.md` and `TASK.md`, perform only the first
  setup/workflow action believed required, then stop;
- bootstrap: `ph bootstrap backend --no-developer-mcp --no-codegraph --force`;
- runtime injection assertion: `false`;
- parser: first 10 tool calls, executable `bash`/`shell`/`terminal` tool inputs
  only. File-write payloads and prose are not rail-entry evidence.

S-1 control-only pilot:

- rows: `10/10` valid real OpenCode rows;
- invalid rows: `0`;
- control rail-entry: `10/10`;
- accepted threshold: `>= 9/10`;
- JSON/JSONL parse sweep: PASS.

S-2 readiness decision: S-2 may use `gate-fixture.2` for the Summary-header
candidate comparison, with the same parser and preregistered archive contract.
S-2 still must run the candidate comparison before any stable decision relies
on this gate.

Boundary: S-1 is fixture stabilization only. It does not compare the shipped
Summary header, change defaults or schemas, move version or dist-tags, prepare
stable, or support product-efficacy, token/provider-token saving, app-quality,
broad reliability, closure-guarantee, autonomous-completion, deterministic
enforcement, generated-app certification, automatic completion, or reliable
delegation claims.

## Stable Cycle S-2 Summary-Header Regate

Archive:
`/Users/yongtae/Desktop/persona-harness-artifacts/archive/2026-06-24-desktop-persona-runs/stable-s2-summary-header-regate-20260705T031209Z`

Status: FAIL for Summary-header non-inferiority. S-2 recommends turning the
shipped failed-finish `Summary:` header off or reverting it in S-3 before
stable. This is stable decision input only; S-2 does not implement the revert
or prepare stable.

Preregistered design:

- fixture id: `gate-fixture.2`;
- source/package: local-current `persona-harness@0.6.0-rc.4` at commit
  `fdc26234f9b8448a03960a91a764ddfcae920be1`, tarball shasum
  `6a5673fc5454efe9cadb7058ff82ec67fe351d19`;
- OpenCode: `/opt/homebrew/bin/opencode`, version `1.17.7`;
- rows: `10` paired/counterbalanced real OpenCode pairs;
- prompt type: `b-no-explicit-rail`;
- prompt: read `README.md` and `TASK.md`, perform only the first
  setup/workflow action believed required, then stop;
- bootstrap: `ph bootstrap backend --no-developer-mcp --no-codegraph --force`;
- runtime injection assertion: `false`;
- parser: first 10 tool calls, executable `bash`/`shell`/`terminal` tool inputs
  only. File-write payloads and prose are not rail-entry evidence.

Condition variants:

- control/current used the same gate fixture without the failed-finish
  `Summary:` header in the embedded `TASK.md` reference output;
- candidate-current used the shipped failed-finish `Summary:` header before the
  same `Required fixes:` details;
- `README.md`, bootstrap shape, package source, parser, prompt, and fixture
  skeleton were matched inside each pair. `TASK.md` and start commit hashes
  differ by design because the header variant is the isolated condition.

Result:

- valid pairs: `10/10`;
- invalid runs: `0`;
- control/current rail-entry: `10/10`;
- candidate Summary-header rail-entry: `9/10`;
- paired counts: both `9`, control-only `1`, candidate-only `0`, neither `0`;
- candidate-control delta: `-10pp`;
- preregistered non-inferiority criterion: not met.

S-2 decision: the shipped Summary header remains a stable blocker. S-3 should
remove or disable that human-output header before stable unless HQ explicitly
chooses a different mitigation and regates it.

Boundary: S-2 is Summary-header rail-entry regression evidence only. It does
not change product/runtime behavior, defaults, schemas, evidence schemas,
version, publish, tag, latest, next, alpha, hook signatures, exit codes, or
JSON schema fields, and it does not support product-efficacy,
token/provider-token saving, app-quality, broad reliability, closure-guarantee,
autonomous-completion, deterministic enforcement, generated-app certification,
automatic completion, or reliable delegation claims.

## Stable Cycle S-3 Summary-Header OFF/Revert

Status: implemented product blocker resolution before stable decision. S-3
turns off the failed-finish human `Summary:` header that S-2 found
non-inferior=false.

Basis:

- accepted S-2 result: control/current rail-entry `10/10`;
- accepted S-2 result: candidate Summary-header rail-entry `9/10`;
- paired delta: `-10pp`;
- preregistered non-inferiority criterion: false;
- accepted S-2 decision input: `FAIL_RECOMMEND_HEADER_OFF_FOR_S3`.

S-3 behavior:

- failed `ph workflow finish implement` human stderr no longer emits the
  `Summary:` header before `Required fixes:`;
- detailed `Required fixes:` blocker diagnostics remain visible;
- `workflow closure next --json` remains the supported machine-readable
  next-step path and is not replaced by human-output parsing;
- H1-1 unmapped blocker behavior, H1-4
  `convention-toolchain-missing` behavior, H1-2 mechanical finish reachability,
  H1-3 blocker order/depth contract, and H1-5 persistence safety surfaces remain
  in the verification set.

Stable decision input: with the Summary header turned off, local-current smoke
and publish-readiness QA should decide whether stable `0.6.0` can proceed or
whether another prerelease is needed because of an observed behavior regression.
S-3 itself does not prepare, publish, tag, or move a stable release.

Boundary: S-3 is measurement-driven removal of a shipped UX affordance. It is
not product-efficacy, token/provider-token saving, app-quality, broad
reliability, closure-guarantee, autonomous-completion, deterministic
enforcement, generated-app certification, automatic completion, or reliable
delegation evidence.

## LEAN-1 L-2 Rail Body Cache Regate

Archive:
`/Users/yongtae/Desktop/persona-harness-artifacts/archive/2026-06-24-desktop-persona-runs/lean-l2-rail-body-cache-regate-20260705T162603Z`

Scenario: session-local duplicate rail body suppression for
`ph workflow implement`, `ph workflow check`, and `ph workflow continue`.

Decision: PASS/adopt. The accepted run used `gate-fixture.2` with n=10
paired/counterbalanced real OpenCode rows, invalid `0`, and executable
`bash`/`shell`/`terminal` tool inputs only for first-10-tool-call rail-entry
scoring.

Result:

- control rail-entry: `9/10`;
- candidate rail-entry: `10/10`;
- paired counts: both `9`, candidate-only `1`, control-only `0`, neither `0`;
- candidate-control delta: `+10pp`;
- preregistered non-inferiority criterion: met.

Output-size snapshot was recorded separately: one-call delta `0` stdout bytes,
three-call delta `-5224`, and loop-like session delta `-15164`. These are
output-size observations only and must not be cited as token-saving,
provider-token-saving, product-efficacy, app-quality, broad reliability, or
closure-guarantee evidence.

Boundary: L-2 did not change workflow gates, defaults, evidence schemas, JSON
schemas, runtime injection state, release channels, or any product efficacy or
token-saving claim.
