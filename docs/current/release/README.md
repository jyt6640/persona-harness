# Release Docs

Use this package for repeatable release operations and release note drafting.

Durable versioned summaries now live under `docs/releases/`. For the current
prerelease line, start with
[`docs/releases/v0.6.0-rc.1/README.md`](../../releases/v0.6.0-rc.1/README.md).
The files in this directory remain the release-operation and release-note
sources used by the existing workflow.

## Release Messaging Guardrail

Describe Persona Harness as an AI coding workflow rail + evidence + continuation harness.

Do not describe a release as:

- a Java Clean Code quality guarantee;
- generated app product-quality certification;
- evidence count proving quality improvement;
- AST/linter/build-failure enforcement.

External smoke and A/B or ON/OFF runs may be reported as stack-steering and workflow-closure signals only. Mention limits when relevant: small sample size, `n=1`, non-blind runs, same operator, and model/version/prompt/timeout/continuation dependence.

## 0.3.9-alpha Pre-Eval Stop Gate

Before moving from the `0.3.9-alpha` cleanup lane into `0.4` eval work, HQ must stop and ask the user for a `0.3.9-alpha` publish or release decision.

Do not start `0.4` eval immediately after the following are complete:

- `0.3.9-alpha` pre-eval code-debt cleanup;
- QA eval fixture / kill-gate documentation;
- verified report schema documentation.

Those items make the release decision ready; they do not authorize Docs Release to publish, push, tag, or start release prep without HQ/user approval.

## Current Version-Line Readiness

`0.3.9-alpha.7` shipped the read-only workflow closure planner and produced one
Windows SSH registry implementation-to-finish product usability PASS. That is a
workflow rail product signal, not eval proof, PH superiority proof, generated
app quality certification, or a general reliability guarantee.

Current prerelease package: official `0.6.0-rc.1` is published under npm
dist-tag `next`. Registry verification confirmed
`persona-harness@next=0.6.0-rc.1`, gitHead
`b673633533a314e1a64dd6dcb18c4097c5889a2c`, shasum
`5c8bcd5c1bd4165dd129e39624408672f88091ce`, and dist-tags
`latest=0.5.0`, `next=0.6.0-rc.1`, `alpha=0.3.9-alpha.8`. The local and
remote `v0.6.0-rc.1` tags point at that gitHead after registry verification.
Trusted Publisher run `28653322434` succeeded; Release workflow run
`28653429619` succeeded; the GitHub release exists as a prerelease:
`https://github.com/jyt6640/persona-harness/releases/tag/v0.6.0-rc.1`.

External registry smoke installed `persona-harness@next` as `0.6.0-rc.1` from
the registry only and verified package-runtime surfaces. Archive:
`/Users/yongtae/Desktop/persona-harness-artifacts/archive/2026-06-24-desktop-persona-runs/stage14-rc060-rc1-registry-smoke-20260703T100732Z`.
`RESULT.md` classified PASS.

`0.6.0-rc.1` packages the post-0.5 Stage 1-13 line conservatively: session
classification/subagent injection skip, utterance gates, role naming cleanup,
static relay guidance, continuation prompt/gate unification, report-only
role-boundary observation with heuristic write warnings, ralph-loop default-off
retry-capped blocker continuation, and the canonical `scorecard.1` measurement
scorecard definition. The release message must also preserve the accepted
negative/partial results: Stage 12 did not exercise ralph-loop in the ON pilot,
so ralph-loop remains parked/default-off preview with no default-ON evidence;
Stage 13 observed a static Role Checklist Relay guidance path but no reliable
OpenCode role subagent invocation or orchestration. `--multi-agent-preview` and
`multiAgent` remain compatibility names for that preview surface.

The rc1 registry smoke observed localized READMEs, `CHANGELOG.md`,
`docs/current/release/v0.6.0-rc.1-release-notes.md`, ralph-loop/state runtime,
session registry, hooks, role-boundary heuristic/policy/evidence, continuation
utterance gate, `workflow ralph-loop`, `workflow role-boundary`, bootstrap,
workflow relay, and continuation prompt package entries. `ph --help`,
`ph version`, `ph bootstrap --help`, `workflow ralph-loop --json`,
`workflow role-boundary --json` and human output, default init/bootstrap,
multi-agent preview init/bootstrap/rerun, `workflow relay status --json`,
`workflow relay next --json`, and the smoke driver exited 0. `ph version`
returned `0.6.0-rc.1`; `workflow ralph-loop --json` emitted
`workflow-ralph-loop.3` with default-off/dry-run/no-write and
`maxAttempts=3` / `maxSessionAttempts=9`; `workflow role-boundary --json`
emitted `workflow-role-boundary-report.2` with report-only/heuristic block mode
unavailable/no deterministic enforcement and no file writes. Bootstrap Role
Checklist Relay guidance remained absent by default, present/idempotent with
the compatibility flag `--multi-agent-preview`, and relay status/next JSON used
role order `test-writer`, `implementer`, `reviewer`.

Current stable package: official `0.5.0` is published under npm dist-tag
`latest`. Registry verification confirmed `persona-harness@latest=0.5.0`,
gitHead `c0f1085a5182cdd17411bd043173aabc9a76b30e`, shasum
`3a7c43e4807e7cc8bd1b6c697746d6334ee56b09`. Current dist-tags are
`latest=0.5.0`, `next=0.6.0-rc.1`, `alpha=0.3.9-alpha.8`. The local and remote
`v0.5.0` tags point at the `0.5.0` gitHead. Trusted Publisher run
`28611027369` succeeded; Release workflow run `28611144533` succeeded; the
GitHub release exists as a non-prerelease:
`https://github.com/jyt6640/persona-harness/releases/tag/v0.5.0`.

`0.5.0` keeps the gate-first runtime injection downgrade: runtime injection,
system constitution injection, workflow prompt rail injection, and continuation
text are default-off; `--runtime-injection-preview` is explicit opt-in;
`--strict` intentionally opts into runtime guidance plus direct verification.
It also packages the README logo asset at `img/Persona-Harness-Logo.png`.

External stable registry smoke installed `persona-harness@latest` as `0.5.0`
and verified package-runtime surfaces. Archive:
`/Users/yongtae/Desktop/persona-harness-artifacts/archive/2026-06-24-desktop-persona-runs/v050-stable-registry-smoke-20260702T180404Z`.
The smoke classified PASS in `RESULT.md`; `summary-final.json` parsed and
confirmed command exits/surfaces. It observed localized READMEs, the logo,
`docs/current/release/v0.5.0-release-notes.md`, P-minus paired/status dist
files, instruction infer/adopt/check dist files, and CodeGraph/LSP wrappers.
Basic CLI/bootstrap passed. Default bootstrap wrote
`features.runtimeInjection=false`, `enforce.systemConstitution=false`, and
`enforce.executeVerification=false`; default developer MCPs were only
`grep_app`/`context7`; CodeGraph and LSP remained opt-in; no `.codegraph`
auto-init occurred.

The stable registry smoke also verified `--runtime-injection-preview`,
`--strict`, CodeGraph/LSP opt-in unavailable facades, P-minus paired consistency
lowering aggregate-lower/paired-inconsistent evidence to `keep-gathering`,
instruction infer/adopt/check drift detection after adoption, read-only
report/status/metrics surfaces, `workflow tdd` exit 0, and incomplete strict
`workflow finish implement` exit 1.

`0.5.0` also includes the P-minus aggregate-vs-paired interpretation cleanup:
aggregate-lower provider-token evidence with weak paired consistency remains
descriptive local evidence and lowers the decision hint to `keep-gathering`
rather than a token-saving claim.

Historical next-channel package: `0.5.0-rc.2` previously lived under npm
dist-tag `next`. It packaged the gate-first runtime injection downgrade and was
the final release candidate before stable prep; current `next` is
`0.6.0-rc.1`.

`0.5.0-rc.1` already exists in npm and the remote `v0.5.0-rc.1` tag points at
the prior wrong-channel commit `dcc34e071d167923b8cf40be095b303ba649d3ca`.
Because npm package versions are immutable, the corrected gate-first release
target advances to `0.5.0-rc.2`.

Post-publish registry verification for `0.5.0-rc.2` confirmed gitHead
`64696dce6daf5e4501609648f3ceb9acb830db87`, shasum
`a09d6e84f368befddfc7193308ac4912568c4557`, and dist-tags
`latest=0.4.0`, `next=0.5.0-rc.2`, `alpha=0.3.9-alpha.8`. The
`v0.5.0-rc.2` tag was created only after registry gitHead/shasum verification
and points at the same gitHead locally and remotely. The tag-triggered GitHub
Release workflow succeeded, including GitHub release creation, and the GitHub
release is marked prerelease.

Fresh registry smoke installed `persona-harness@next` as `0.5.0-rc.2` and
verified the packaged logo, rc2 release notes, default gate-first bootstrap
config, and explicit runtime-injection preview opt-in config. Archive:
`/Users/yongtae/Desktop/persona-harness-artifacts/archive/2026-06-24-desktop-persona-runs/rc050-rc2-registry-smoke-20260702T090723Z`.

The `0.5.0-rc.2` prep is justified by the accepted 10-pair local-current
OpenCode A/B result: PH OFF and PH ON both succeeded 10/10, but PH ON increased
measured provider-token totals, read chars, tool calls, and elapsed time in all
10 pairs for that fixture set. The release message is gate-first and
default-off; it is not a token-saving, provider-token saving, product-efficacy,
navigation-benefit, app-quality, broad reliability, or closure-guarantee claim.

Registry `next` briefly moved to a superseded `0.5.0-rc.1` build; that is
treated as a wrong-channel/version incident, not an accepted release record.

Post-publish registry verification for `0.4.1-rc.2` confirmed gitHead
`bcb5f08cc7c0c99ac07ca3e93d04b3b35b7a1f70`, shasum
`ab59b9d7e7689cdff6f997ae956edd2c3d3ab6b1`, and dist-tags
`latest=0.4.0`, `next=0.4.1-rc.2`, `alpha=0.3.9-alpha.8`. The
`v0.4.1-rc.2` tag was created only after registry gitHead/shasum verification
and points at the same gitHead locally and remotely. The tag-triggered GitHub
Release workflow succeeded, including GitHub release creation.

External registry-only smoke installed `persona-harness@next` as
`0.4.1-rc.2` and verified basic CLI help/version/init/doctor/bootstrap, the
explicit-write `ab-run` recorder, read-only `ab-report` and `pminus-report`
consumption of generated evidence, all expected P-minus outcome/hint
categories, and no mutation outside explicit `.persona/evidence/ab/<scenario>/`
files. Archive:
`/Users/yongtae/Desktop/persona-harness-artifacts/archive/2026-06-24-desktop-persona-runs/rc041-rc2-registry-package-runtime-20260702T022527Z`.

Post-publish registry verification for `0.4.1-rc.1` confirmed gitHead
`9d80e9c7f63986a3223901e9fe54550e86b8b425`, shasum
`fbcc0cc5617d616983a48d3d20b51afe74de0b01`, and dist-tags
`latest=0.4.0`, `next=0.4.1-rc.1`, `alpha=0.3.9-alpha.8`. The
`v0.4.1-rc.1` tag was created only after registry gitHead verification and
points at the same gitHead locally and remotely. The tag-triggered GitHub
Release workflow succeeded after the checkout fix.

External registry-only smoke installed `persona-harness@next` as
`0.4.1-rc.1` and did not use the superseded `0.5.0-rc.1` package. It verified
basic CLI help/version/init/doctor/bootstrap, instruction infer/adopt/check,
read-only evidence metrics and `ab-report`, the default remote-only developer
MCP bundle with `--codegraph-preview` opt-in, service-state,
Controller→Repository, Spring bootJar, read-only `workflow tdd`, and LSP preview
unavailable facade surfaces. Archive:
`/Users/yongtae/Desktop/persona-harness-artifacts/archive/2026-06-24-desktop-persona-runs/rc041-rc1-registry-package-runtime-20260702T010930Z`.

The `0.4.1-rc.1` smoke is registry package/runtime evidence only. It does not
move `latest`, prove token saving/provider-token saving, product
efficacy/navigation benefit, app quality, full TDD/test sufficiency, default
CodeGraph/LSP effectiveness, broad reliability, closure guarantee, Codex
support, or code-nav replacement.

`0.4.1-rc.2` inherits those claim boundaries and adds no automatic
downgrade/removal behavior. The A/B recorder and P-minus report are evidence
generation/reporting surfaces only; they do not prove token saving,
provider-token saving, product efficacy, navigation benefit, app quality, full
TDD/test sufficiency, CodeGraph/LSP effectiveness, broad reliability, closure
guarantee, Codex support, or code-nav replacement.

Current stable package: official `0.4.0` remains published under `latest`.
Registry `latest` points at gitHead
`af51e8afa3bdb41e3eb3a2abf003d95bfa7c6055` with shasum
`45e3b49d162eeed6d9bc443b5b44508c1e956ebf`; `alpha` remains
`0.3.9-alpha.8`. The `v0.4.0` tag points at the same gitHead after registry
verification.

`0.4.0` packages the verified workflow rail/product surfaces:

- workflow rails, evidence traces, continuation/report lifecycle, and finish
  gates;
- opt-in TDD rail plus read-only `ph workflow tdd`;
- precise conformance blockers including Controller→Repository and
  `service.state-ownership`;
- read-only `ph evidence metrics [--json]`;
- default developer MCP bundle package surfaces;
- opt-in LSP MCP wrapper with missing-dependency unavailable facade and proxy
  guard.

External latest registry smoke installed `persona-harness@latest` as `0.4.0`
and verified the registry package/runtime surface: basic CLI clean
install/help/init/doctor/bootstrap, default developer MCP bundle, opt-in TDD
rail plus read-only `ph workflow tdd`, precise `service.state-ownership`,
read-only `ph evidence metrics [--json]`, and opt-in LSP MCP wrapper unavailable
facade/proxy guard. Archive:
`/Users/yongtae/Desktop/persona-harness-artifacts/archive/2026-06-24-desktop-persona-runs/v040-latest-registry-package-runtime-20260701-221728`.

The official release still does not claim token saving/provider-token saving,
app/product quality, full TDD framework/test sufficiency, LSP effectiveness or
real Java LSP tool-call evidence, broad AST/linter behavior, broad reliability,
closure guarantee, generated app certification, Codex support, or code-nav
relabeling/replacement.

Previously, `0.4.0-rc.10` was published under `next` for the P6 opt-in OpenCode
LSP MCP wrapper package/runtime surface.

`0.4.0-rc.10` packages the P6 LSP MCP wrapper after rc9:

- opt-in `ph bootstrap backend --lsp-preview`;
- root bin `ph-lsp-mcp` and package `packages/lsp-mcp`;
- missing dependency unavailable facade exposing `lsp_status` only;
- proxy guard requiring both an upstream LSP MCP and Java LSP before proxying
  symbol/definition/reference-style calls.

This rc10 prep has no real Java LSP tool-call observation, no default LSP
registration, no A/B or effectiveness claim, no fake symbol/definition/reference
results, and no Codex support claim.

Post-publish registry verification confirmed shasum
`f00f78e578a4b89390ffb8a91c907bf5033189c7`; `v0.4.0-rc.10` points at the same
gitHead after registry verification. External registry-only smoke installed
`persona-harness@next` as `0.4.0-rc.10` and verified the registry package
entries/root `ph-lsp-mcp`, default no-LSP bootstrap, opt-in
`--lsp-preview --no-developer-mcp` registration with config preservation,
missing-dependency unavailable facade, and proxy guard with fake binaries.
Archive:
`/Users/yongtae/Desktop/persona-harness-artifacts/archive/2026-06-24-desktop-persona-runs/rc10-registry-lsp-mcp-20260701-220032`.
This is registry package/runtime surface and guard-mechanics evidence only:
OpenCode connected means protocol-alive wrapper/facade, not real Java LSP
capability, default LSP behavior, A/B effectiveness, token saving, product
quality, code-nav replacement, Codex support, broad reliability, or closure
guarantee.

Previously, `0.4.0-rc.9` packaged the P1.5/P2/P3/P4 workflow rail delivery
after rc8:

- read-only `ph workflow tdd` status helper;
- scoped `service.state-ownership` Java/Spring service-architecture blocker;
- read-only `ph evidence metrics [--json]`.

Post-publish registry verification confirmed shasum
`7bd42b00d669275b0995d37ec108cbb28b8b66b8`; `v0.4.0-rc.9` points at the same
gitHead after registry verification. External registry-only smoke installed
`persona-harness@next` as `0.4.0-rc.9` and verified read-only `workflow tdd`,
TDD rail regressions, precise `service.state-ownership`, and read-only
`evidence metrics` behavior. Archive:
`/Users/yongtae/Desktop/persona-harness-artifacts/archive/2026-06-24-desktop-persona-runs/rc9-registry-package-runtime-20260701-205115`.
This is registry package/runtime surface evidence only: it does not move
`latest`, certify generated app quality, provide a full TDD framework, add a
broad AST/linter product, prove token saving/product efficacy, or claim
model/OpenCode/eval evidence.

`0.4.0-rc.8` packages `b5d98e1286c5a7f0349af8a461efdf2ce84a653e`
(`feat(cli): add tdd workflow rail`) plus the release-prep docs. Post-publish
registry verification confirmed shasum
`fc4de25901d4c678799ea66b8e63293dc5f46a12`; `v0.4.0-rc.8` points at the same
gitHead after registry verification.

Post-rc5 local/origin docs and preview work may include later commits such as
R1 injection/prose cleanup, the code-nav CLI/package preview, and token proxy
measurement notes. Treat those as local/current HEAD or fresh local-tarball
evidence only unless a later registry publish verifies the same gitHead. Ignored
`.persona/evidence` measurement data may be cited as measurement evidence, but
it is not part of the npm package surface.

Rc6 packages and registry-smokes the verified code-nav package-surface sequence:
minimal stdio MCP protocol server plus opt-in `.opencode/opencode.json`
registration through `npx ph bootstrap backend --code-nav-preview`. Default
bootstrap still has no code-nav registration. This is registry package-surface
and protocol-surface evidence only: not model/OpenCode/eval or native-dispatch
evidence, not token-saving/product-efficacy evidence, and not codegraph
replacement.

Post-rc6 local/current tarball smoke at
`38f4e8b1100bd6812212d4d5dfbebbef4d2b10eb` verified an OpenCode local MCP
newline transport compatibility fix: direct framed JSON-RPC and
newline-delimited JSON-RPC both worked, and `opencode mcp list --pure` connected
to `persona-harness-code-nav` from the opt-in generated config. This is local
tarball compatibility evidence only until a later registry publish verifies the
same gitHead; it is not a token-saving or product-efficacy claim.

Post-rc6 parser/guidance hardening at `f93d52d` and
`e52f73f3c3cdb36866d74aecb39757cdf520d0ee` is repo-only measurement hygiene:
code-nav metrics now distinguish actual JSON tool-name field calls from
prose/free-text mentions of namespaced OpenCode MCP tools. It improves
measurement accuracy and discoverability language; it is not natural-adoption,
token-saving, navigation-benefit, or product-efficacy evidence.

Post-rc6 R1 token telemetry at
`163a85e0433f6d713afa3f619b3cc6b2d2bcf100` is local/current tarball
measurement infrastructure only: installed runtime writes
`.persona/evidence/token-usage/<safe-session-key>.json` from `message.updated`
assistant events, with latest-per-message dedupe, session aggregate, known
model-limit ratio, unknown-limit reason, and `telemetry.tokenUsage=false`
opt-out. It is not registry `@next` behavior until a later publish verifies that
gitHead, and it is not token-saving, provider-token-saving, product-efficacy, or
compaction-effectiveness evidence.

Post-rc6 R2 compaction trigger at
`a0116785e7e013154c4e4c8a75b4d87515fce828` is local/current tarball trigger
mechanics only: `enforce.compaction` is default-off, evaluates measured R1 token
ratio, calls `session.summarize` only when opt-in threshold/cooldown data permit,
and writes `token-compaction.1` evidence with `afterMeasurement.measured=false`.
It is not registry `@next` behavior until a later publish verifies that gitHead,
and it is not compaction-effectiveness, token-saving, provider-token-saving, or
product-efficacy evidence.

Post-rc6 external OpenCode CodeGraph preview at
`6e69ca3e78b8664384c83221297f336d4c7f9c8c` is local/current tarball
config-surface evidence only: default bootstrap does not register CodeGraph,
missing-binary `--codegraph-preview` skips with guidance, and present-binary
`--codegraph-preview` registers OpenCode `mcp.codegraph` with
`["codegraph","serve","--mcp"]` without creating `.codegraph`. It is external,
optional, OpenCode-only, and not registry `@next` behavior until a later publish
verifies that gitHead. It is not PH-owned codegraph, OMO parity/replacement,
Codex support, real CodeGraph MCP connection evidence, or token-saving evidence.

R-CG.2 later proved a real external OpenCode CodeGraph MCP tool call
(`codegraph_codegraph_explore`, canonical `codegraph_explore`) with
`@colbymchenry/codegraph@1.1.6` and explicit `codegraph init`, but the bounded
Java/Spring A/B was worse with CodeGraph ON: ON used 1 CodeGraph call, 70,826ms,
11 reads, 34,180 read chars, and provider total/cacheRead 309,411 / 224,768
versus OFF 0 calls, 52,746ms, 3 reads, 11,080 read chars, and
68,648 / 30,720. This is an exact-scenario PARTIAL/defer measurement, not a
token-saving, provider-token, product-efficacy, navigation-benefit, PH-owned
codegraph, OMO parity/replacement, Codex support, or auto-init claim.

Post-rc6 default developer MCP bundle at
`a9dcf044ff423fc4b94e549d365febe0844ab960` is local/current tarball
package-runtime surface evidence only, not registry `@next` behavior until a
later publish verifies that gitHead. Default init/bootstrap registers remote
`grep_app`, remote `context7`, and a local PH `codegraph` wrapper, with no fake
`git_bash`/`lsp` OpenCode MCP surfaces and no `.codegraph` auto-init.
`--no-developer-mcp`, `--no-codegraph`, `--codegraph-preview`, and config
preservation passed. The missing-binary CodeGraph wrapper stays protocol-alive
as an unavailable facade: `tools/list` is status-only, `tools/call status` and
unknown tools return `isError:true` unavailable payloads, no fake indexed/search
tools are exposed, and stderr is clean. `opencode mcp list --pure` showing
CodeGraph connected means the wrapper/facade connected, not usable indexing or
effectiveness. This is not token-saving, provider-token, product-efficacy,
navigation-benefit, PH-owned CodeGraph, OMO parity/replacement, Codex support,
generated app certification, broad reliability, or closure guarantee evidence.

`0.4.0-rc.7` packages that default developer MCP bundle for the next channel.
Post-publish registry verification confirmed gitHead
`640b8d3833e8de12657cdebf4ff0bc2877878c6d`, shasum
`9d6cb2167fbbf5aa3bdb925b4ec2b6d3652ccd07`, and dist-tags
`next=0.4.0-rc.7`, `latest=0.3.9-alpha.8`, `alpha=0.3.9-alpha.8`.
Registry-only package-surface smoke installed `persona-harness@next` as
`0.4.0-rc.7` and passed for default developer MCP bundle package/runtime
surface: package entries/bin metadata, default `grep_app`/`context7`/PH
`codegraph` wrapper registration, `--no-developer-mcp`, `--no-codegraph`,
config preservation, no `.codegraph` auto-init, and the missing-binary
CodeGraph unavailable facade. `opencode mcp list --pure` showing `codegraph`
connected is protocol-alive facade evidence only, not usable indexing or
effectiveness.

Post-rc7 TDD Workflow Rail at
`b5d98e1286c5a7f0349af8a461efdf2ce84a653e` is opt-in package-runtime behavior:
`enforce.tdd` is default-off; `ph workflow test` records red evidence only from
PH-run strict Gradle/JUnit testcase failures; compile/no-JUnit failure and JUnit
`<error>` do not count as red; and archive/finish can hard-block until the same
ticket/test id has red evidence followed by PH-observed green evidence. Fresh
local/current tarball smoke passed for strict-off advisory, valid red,
invalid-red rejection, hand-written minimal evidence rejection, and red-to-green
archive/finish.

`0.4.0-rc.8` publishes that TDD Workflow Rail under `next`. External
registry-only smoke installed `persona-harness@next` as `0.4.0-rc.8` from
registry gitHead `18a9bb2f4a9706e4115ffff5d9e864934cd9f0bd` and verified:
package entries `dist/cli/workflow-tdd.js` and
`dist/cli/closure-verification-runner.js`, default `tdd:false`, strict-off
advisory with no fake evidence, valid PH-run Gradle/JUnit red evidence,
invalid-red rejection for compile/no-JUnit failure and JUnit `<error>`,
green-only/no-red and hand-written forged evidence blocking with
`tdd-red-evidence-missing`, and red-to-green check/archive/finish PASS for the
same ticket/test id. Archive:
`/Users/yongtae/Desktop/persona-harness-artifacts/archive/2026-06-24-desktop-persona-runs/rc8-registry-tdd-workflow-rail-20260701-193324`.
This is registry package/runtime surface evidence only, not model/OpenCode/eval
evidence, and not test-sufficiency, product-quality, full TDD framework,
scaffolding, coverage, mutation-testing, generated-app certification, broad
reliability, or closure-guarantee evidence.

`docs/evidence-reviews/` is a documentation taxonomy area for observations and
review records. It is not a published `evidence-review` package, not a dist-tag,
and not a separate release channel.

Previous published package line `0.4.0-rc.4` covered the GUARD
Phase 0-3/runtime hook refresh before `next` moved to rc5. It was a
next-channel prerelease vehicle for scoped product enforcement behavior,
including BYO ast-grep observe alignment and runtime hook guard levers, not
stable `0.4.0`.

Old `0.4.0-rc.1` prep commit `5edb535` remains stale historical context and must
not be reused. The fresh RC prep must be based on current HEAD/docs.

Alpha8 packages the code-level convergence after QA no-token convergence PASS.
The first current-tarball implementation-to-finish trial was blocked by remote
SSH/SCP/PowerShell instability, not classified as Persona Harness PASS or FAIL.
The later registry alpha8 implementation-to-finish product usability trial
passed once under closure-state routing.

Channel policy: `@alpha` is the current tester/product smoke channel. `latest`
is now observed at `0.3.9-alpha.8`, but that should not be read as eval proof,
generated-app quality certification, or a general reliability guarantee.
Publish this RC with `next`, not `latest`. Future `latest` moves still need an
explicit release/dist-tag task because default install can imply a stronger
stability or value-proof claim than this evidence supports.

RC soak policy: rc5 is published under `next` only; `latest` remains
`0.3.9-alpha.8` unless HQ explicitly approves a stable/default-channel move.
The local `@next` implementation-to-finish proxy trial passed, but Windows SSH
remote validation was blocked by SCP/SSH instability before product behavior.
Windows local operator direct PowerShell no-model closure surface validation now
passes for rc1 `@next`, including Korean preservation and strict blocked finish
state. Stable `0.4.0` still requires real external user feedback/soak and any
desired Windows implementation-to-finish/model route; SSH/SCP remote validation
remains unsuitable because of instability/mojibake risk. Proxy feedback from the
existing trial marked the workflow rail helpful, did not request `closure run`,
and left report consistency/noise as a soak watch item.

Post-rc1 current HEAD adds `002359c fix(cli): reject lossy Windows stdin
mojibake`. The rc1 Windows implementation trial showed that PowerShell 5.x
`Get-Content -Raw` can corrupt UTF-8 no-BOM Korean before Persona Harness sees
stdin; once `?` replacement exists, the CLI cannot recover the original text.
Use `Get-Content -LiteralPath <path> -Raw -Encoding UTF8 | npx ph workflow draft --stdin`
or the same form for `workflow capture --stdin`. This guard is not in the
published rc1 registry package unless a future package includes it, and it is a
corruption-prevention fix only, not eval proof or generated app certification.

Current-head `002359c` Windows SSH focused continuation is PARTIAL/BLOCKED, not
an implementation-to-finish PASS. The existing D-drive workspace was reachable
and Korean/stdin was no longer the blocker. After repairing a missing
`junit-platform-launcher` test runtime dependency, bearshell `gradlew.bat test`
and build passed, and source scan did not show fake Gradle shim, Java
`HttpServer`, CommonJS, or Express bypasses. However OpenCode hung during a
build bearshell closure step, reports stayed template, `req-1` stayed pending,
and final `workflow finish implement` exited 1. Stable `0.4.0` remains deferred;
future Windows validation should use a less script-heavy TUI/operator route
because the current automation/PowerShell/SSH path may overfit validation
mechanics.

That less-script-heavy Windows operator route is not validated yet. A fresh
D-drive current-tarball run installed `0.4.0-rc.1` and passed
init/doctor/bootstrap, but blocked before model: Korean preservation failed even
with the guide's `Get-Content ... -Encoding UTF8` pipe, the resulting
requirements `Original idea` became `??? ? ? API ???`, and the guide's
`workflow approve requirements` / `workflow split` / `workflow next` commands
did not match the installed CLI surface in that run. Stable `0.4.0` remains
deferred until the guide/current CLI surface and Windows validation route are
corrected and reverified.

Current HEAD `e688d39 fix(cli): guard lossy Windows stdin and pack stale dist`
addresses the two blockers from that run without changing the release boundary:
`workflow draft/capture --stdin` now rejects unrecoverable question-mark input
such as `??? ? ? API ???` before writing requirements, while normal Korean UTF-8
stdin and the existing `媛...???` mojibake guard remain intact. It also adds
`prepack: npm run build` so local `npm pack` tarballs do not carry stale `dist`,
which can make current guide commands appear missing. This is a current
HEAD/future package fix; published `0.4.0-rc.1 @next` may not include it until a
new release, and it does not repair already corrupted artifacts.

The `e688d39` Windows operator retry then confirmed preflight progress but still
blocked before app output. A fresh current HEAD tarball on Windows D-drive had
the current command surface, rejected lossy `??? ? ? API ???` stdin without
writing requirements, preserved Korean `간단한 할 일 API 만들래` with UTF-8
PowerShell encoding variables, and passed the no-token workflow draft/approve/
split/next/continue/check/closure status/next path. OpenCode started and read
workflow/profile/planner context, but README was absent and a malformed
duplicated `.persona/policies` path hit `external_directory` auto-reject; no
`src` or Gradle files were generated, reports stayed template, ticket stayed
pending, and final `workflow finish implement` exited 1. This is preflight PASS
and implementation-to-finish NOT PASS; stable `0.4.0` remains deferred.

Current HEAD `a307ac0 fix(cli): guide README-absent workflow entry` addresses
the CLI-owned part of that blocker. The duplicated `.persona/policies` absolute
path was not found in CLI/operator prompt output and appears likely
model/operator generated, but README-absent workspaces still needed clearer
rail guidance. `workflow implement`, `workflow continue`, and
`plan --implement` now route agents to repo-relative source-of-truth files:
`.persona/project-profile.jsonc`, `.persona/policies/overlay.jsonc`,
`.persona/workflow/plan.md`, and the current ticket / requirements source.
README-present projects keep README chunk guidance. This reduces entry/context
ambiguity only; it is not model follow-through proof or a closure guarantee.

The `a307ac0` Windows operator retry confirmed that previous input/packaging
and README-absent path blockers improved: fresh tarball preflight had the
current command surface, rejected lossy `???` stdin, preserved Korean, passed
no-token workflow/closure preflight, observed README-absent guidance, and did
not repeat the duplicated `.persona/policies` path. It still did not reach
implementation-to-finish PASS. OpenCode read `.persona/policies/overlay.jsonc`
but generated no app output or `src` / Gradle files; the model filled reports,
ran report-filled, and archived `step-1` anyway. Final
`workflow finish implement` exited 1 on `STACK_MISMATCH` plus pending
`step-2/3/4`. The finish gate correctly blocked, but report-filled/archive
integrity before real implementation/evidence is now the next blocker. Stable
`0.4.0` remains deferred.

Current HEAD `8660ef3 fix(cli): guard ticket archive on closure blockers`
addresses the archive side of that blocker without turning report markers into
quality gates. `plan --report-filled` remains a report marker. `workflow archive
<ticket>` now reads closure state and exits 1 instead of moving work to history
when non-ticket blockers remain, including `verification-unknown`,
`evidence-missing`, `report-coverage-missing`, and stack / verification / report
blockers. Pending-ticket and history-repair blockers are not treated as archive
blockers. Reports marked filled without app/evidence/verification now leave the
backlog/work ticket pending.

The `8660ef3` Windows operator retry then verified that integrity guard in a
fresh tarball smoke:
`/Users/yongtae/Desktop/persona-harness-artifacts/archive/2026-06-24-desktop-persona-runs/current-head-8660ef3-windows-operator-retry-20260629-221043/RESULT.md`.
Preflight passed; no-app/no-evidence `workflow archive step-1` exited 1 with
`verification-unknown`, `implementation-report-missing`, and
`review-report-missing`; and `workflow next` kept `step-1` current. After
OpenCode generated a minimal Java/Spring/Gradle skeleton and evidence made
verification passed, `step-1` moved to history. Final finish remained blocked
because `step-2`, `step-3`, and `step-4` were still pending, so this is
INTEGRITY-PASS/PARTIAL rather than stable readiness.

Current HEAD `0784135 fix(cli): block controller repository closure` adds the
first scoped hard convention blocker. The existing observer signal
`controller.repository-dependency` is promoted to workflow closure blocker
`architecture-controller-repository-direct-dependency` for ready Java/Spring
service-layer profiles when typed evidence can name the Controller, Repository,
source file, and direct dependency. The violation is surfaced/blocked through
`workflow check`, `workflow closure next --json`, `workflow continue`, `workflow
finish implement`, and `workflow archive <ticket>`, with remediation to route
the Controller through a Service layer. Compliant Controller -> Service ->
Repository paths do not produce the architecture blocker. Other backend-shape
WARNs remain report-only; this is not broad architecture correctness
enforcement.

Current HEAD `1c304e412093dd0621d911ce379ef3f66ea7f224` has GUARD Phase 0-3
plus BYO ast-grep observe alignment package-surface smoke PASS on fresh current
tarballs, not published registry `@next` evidence until rc3 is published and
verified. The original GUARD Phase 0-3 package-surface archive is
`/Users/yongtae/Desktop/persona-harness-artifacts/archive/2026-06-24-desktop-persona-runs/current-head-7fda771-guard-package-surface-smoke-20260630-001558`;
tarball shasum `b703953aab409f1cd7ac578c5af76b3d3e42cf90`, sha256
`2155ac28c48367c85d2a4163ba56ecea5dd1842b1d0e0935313c665ab9d55b7c`. QA
reported focused 134 tests PASS, full `npm test` 70 files / 486 tests PASS,
typecheck/build/product smoke/built CLI smoke PASS. Phase 0 is opt-in direct
verification via `.persona/harness.jsonc` `enforce.executeVerification: true`
for the supported Java/Spring/Gradle slice; PH-run direct `gradlew test`/JUnit
evidence is authoritative and fake agent-written passed evidence is not. Phase 1
adds `report|warn|block`; only block level hard-blocks. Phase 2 is warning-only
write guard fallback because hard deny/rewrite is unsupported by the current hook
result type. Phase 3 centralizes convention id/default level/blocker/fix path in
the registry. `a9bf926` adds BYO `.persona/conventions/*.yml` ast-grep preview;
`1c304e4` aligns `ph observe --json` with check/closure/continue for
`controller.persistence-import`. The observe-alignment archive is
`/Users/yongtae/Desktop/persona-harness-artifacts/archive/2026-06-24-desktop-persona-runs/current-head-1c304e4-ast-grep-observe-resmoke-20260630-100023`;
tarball shasum `5f1047f47fb07fda7dce3d8b9cc58f7557a46dec`, sha256
`e25571678cd53db525f2af8796f0270c707127bb5355feb0b32640eced0dc566`.

- [Release checklist](release-checklist.md)
- [Release notes template](release-notes-template.md)
- [GitHub Actions release automation](github-actions-release-automation.md)
- [v0.3.0-alpha.3 candidate](v0.3.0-alpha.3-candidate.md)
- [v0.3.0-alpha.3 demo packaging decision](v0.3.0-alpha.3-demo-packaging-decision.md)
- [v0.3.0-alpha.3 release notes](v0.3.0-alpha.3-release-notes.md)
- [v0.3.1-alpha.0 release notes](v0.3.1-alpha.0-release-notes.md)
- [v0.3.2-alpha.0 release notes](v0.3.2-alpha.0-release-notes.md)
- [v0.3.2-alpha.1 release notes](v0.3.2-alpha.1-release-notes.md)
- [v0.3.2-alpha.2 release notes](v0.3.2-alpha.2-release-notes.md)
- [v0.3.6-alpha.0 release notes](v0.3.6-alpha.0-release-notes.md)
- [v0.3.6-alpha.1 release notes](v0.3.6-alpha.1-release-notes.md)
- [v0.3.7-alpha.1 release notes](v0.3.7-alpha.1-release-notes.md)
- [v0.3.8-alpha.0 release notes](v0.3.8-alpha.0-release-notes.md)
- [v0.3.8-alpha.1 release notes](v0.3.8-alpha.1-release-notes.md)
- [v0.3.8-alpha.2 release notes](v0.3.8-alpha.2-release-notes.md)
- [v0.3.8-alpha.3 release notes](v0.3.8-alpha.3-release-notes.md)
- [v0.3.8-alpha.4 release notes](v0.3.8-alpha.4-release-notes.md)
- [v0.3.8-alpha.5 release notes](v0.3.8-alpha.5-release-notes.md)
- [v0.3.9-alpha.0 release notes](v0.3.9-alpha.0-release-notes.md)
- [v0.3.9-alpha.1 release notes](v0.3.9-alpha.1-release-notes.md)
- [v0.3.9-alpha.2 release notes](v0.3.9-alpha.2-release-notes.md)
- [v0.3.9-alpha.3 release notes](v0.3.9-alpha.3-release-notes.md)
- [v0.3.9-alpha.4 release notes](v0.3.9-alpha.4-release-notes.md)
- [v0.3.9-alpha.5 release notes](v0.3.9-alpha.5-release-notes.md)
- [v0.3.9-alpha.6 release notes](v0.3.9-alpha.6-release-notes.md)
- [v0.3.9-alpha.7 release notes](v0.3.9-alpha.7-release-notes.md)
- [v0.3.9-alpha.8 release notes](v0.3.9-alpha.8-release-notes.md)
- [v0.4.0-rc.1 release notes](v0.4.0-rc.1-release-notes.md)
- [v0.4.0-rc.2 release notes](v0.4.0-rc.2-release-notes.md)
- [v0.4.0-rc.3 release notes](v0.4.0-rc.3-release-notes.md)
- [v0.4.0-rc.4 release notes](v0.4.0-rc.4-release-notes.md)
- [v0.4.0-rc.5 release notes](v0.4.0-rc.5-release-notes.md)
- [v0.4.0-rc.6 release notes](v0.4.0-rc.6-release-notes.md)
- [v0.4.0-rc.7 release notes](v0.4.0-rc.7-release-notes.md)
- [v0.4.0-rc.8 release notes](v0.4.0-rc.8-release-notes.md)
- [v0.4.0-rc.9 release notes](v0.4.0-rc.9-release-notes.md)
- [v0.4.0-rc.10 release notes](v0.4.0-rc.10-release-notes.md)
- [v0.4.0 release notes](v0.4.0-release-notes.md)
- [v0.4.1-rc.1 release notes](v0.4.1-rc.1-release-notes.md)
- [v0.4.1-rc.2 release notes](v0.4.1-rc.2-release-notes.md)
- [v0.5.0-rc.1 release notes](v0.5.0-rc.1-release-notes.md)
- [v0.5.0-rc.2 release notes](v0.5.0-rc.2-release-notes.md)
- [v0.5.0 release notes](v0.5.0-release-notes.md)
- [v0.6.0-rc.1 release notes](v0.6.0-rc.1-release-notes.md)
- [v0.3.6 workflow ticket backlog](../v0.3.6-workflow-ticket-backlog.md)
- [v0.3.6 requirements draft workflow](../v0.3.6-requirements-draft-workflow.md)

Release verification and GitHub release-note automation live in
`.github/workflows/release.yml`. Npm publishing lives in
`.github/workflows/publish.yml`; see
[`npm-trusted-publishing-runbook.md`](npm-trusted-publishing-runbook.md).

- Push `vX.Y.Z*` tags to verify the package and create GitHub release notes only.
- Publish npm packages from `.github/workflows/publish.yml` after QA release GO
  with an explicit dist-tag (`next` or `latest`).
- Release-candidate packages use npm dist-tag `next`; stable packages use
  `latest`.
- The publish workflow verifies docs, injection-value, typecheck, tests, build,
  product smoke, and package dry-run before npm publish.
- The publish workflow uses npm Trusted Publishing/OIDC; no `NPM_TOKEN` secret
  is required for the trusted path.
- The workflow checks that the pushed tag matches `package.json` version.
- The tag workflow generates the GitHub Release body from
  `docs/current/release/v<version>-release-notes.md`.
- The publish workflow verifies registry gitHead, dist.shasum, and dist-tag
  state after publish.
- Create/push the matching git tag only after registry verification succeeds.
- Tag pushes do not run real `npm publish`.
- GitHub release notes are generated from repository release notes for tag
  releases.
