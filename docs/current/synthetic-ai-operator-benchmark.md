# Synthetic AI Operator Benchmark

## Purpose

This is a repeatable model-run benchmark for workflow reliability and
failure-mode discovery. It is not a study of people.

Each benchmark has ten `synthetic-ai` cases: five `plain` and five `ph-on`.
The execution model receives a frozen public problem set. A local answer key
keeps condition assignment and expected stack shape outside both the execution
workspace and the judge input.

## Claim Boundary

The only allowed conclusion is a bounded synthetic reliability observation for
the recorded model, version, task, platform, and run set.

Never describe a synthetic result as:

- human feedback, a user review, or a testimonial;
- independent human review or contest participant evidence;
- evidence that closes [#317](https://github.com/jyt6640/persona-harness/issues/317);
- a product-quality, adoption, or release claim.

`sealed` means excluded from the execution and judge inputs. It does not mean
encrypted storage. Keep the benchmark root private enough for its answer key.

## Prepare

Use a frozen fixture, model identifier, model-version label, and platform
label. The dry run writes nothing and exposes no condition mapping or answer
key contents.

```bash
node scripts/eval/synthetic-ai-benchmark.mjs \
  --fixture multi-step-backend-small \
  --model openai/gpt-5.3-codex-spark \
  --model-version <pinned-version-label> \
  --platform darwin-arm64 \
  --dry-run
```

Prepare the durable handoff outside the repository and outside every generated
workspace:

```bash
node scripts/eval/synthetic-ai-benchmark.mjs \
  --fixture multi-step-backend-small \
  --model <model-id> \
  --model-version <pinned-version-label> \
  --platform <platform-label> \
  --output <benchmark-root>
```

The output has four distinct inputs:

```text
public/problem-set.json        execution-model input
sealed/answer-key.json         local comparison only
sealed/execution-plan.json     local executor input; never model or judge input
judge/rubric.json              bounded evaluator input
```

## Execute

Run the existing ON/OFF evaluator against the same frozen fixture. Five
repetitions for each of `plain` and `ph-on` produce the ten synthetic cases.
Use a deliberately bounded concurrency appropriate for the local Java/Gradle
capacity; separate workspaces are required for every run.

```bash
node scripts/eval/run-onoff-eval.mjs \
  --run-plan <benchmark-root>/sealed/execution-plan.json \
  --concurrency 2 \
  --model <model-id> \
  --model-version <pinned-version-label> \
  --ph-install-command "<frozen-package-install-command>" \
  --capture \
  --output-root <run-root>
```

The model receives the task, one public synthetic operator instruction, and
the condition-specific local workspace. It must never receive
`sealed/answer-key.json`, `sealed/execution-plan.json`, or a condition mapping
intended for blind comparison.

## Judge Package

After the run finishes, create an anonymized package from the local results:

```bash
node scripts/eval/synthetic-ai-benchmark.mjs \
  --fixture multi-step-backend-small \
  --model <model-id> \
  --model-version <pinned-version-label> \
  --platform <platform-label> \
  --output <benchmark-root> \
  --results <run-root>/results.json
```

`judge/judge-package.json` contains the task, a bounded rubric, anonymous case
ids, and normalized observed metrics. It omits the condition id, answer key,
and any human-evidence claim. An AI judge may assess that package only as a
synthetic evaluator. Malformed judge output, missing provenance, condition-key
leakage, or any human-feedback wording makes the result invalid rather than
favorable.

## Platform Note

Windows is a separate platform-reliability signal. It must record the same
fixture, package, model, version label, and archive layout, but it does not
create participant evidence or change the meaning of this benchmark.
