# Clean OpenCode ph bearshell Behavior Smoke

## Goal

Verify that a repo-outside clean Java/Spring project can install Persona Harness from the local package artifact, initialize OpenCode plugin configuration, receive Java/Spring injection, and naturally use the Persona Harness `ph bearshell` command surface for repo/build/test checks.

This is a behavior smoke, not a generated application quality certification.

## Environment

- Date: 2026-06-19
- Persona Harness package: `persona-harness@0.2.1`
- Install modes checked: local path install and tarball install
- OpenCode: `1.17.7`
- Model: `openai/gpt-5.4-mini-fast`
- Java: Temurin `21.0.10`
- Temp root: `/tmp/persona-clean-opencode-ph-bearshell-G6eJA1`

## Local Path Install Smoke

Command shape:

```bash
npm init -y
npm install -D /Users/yongtae/Desktop/persona-harness
npx persona-harness init
npx ph bearshell node -e "console.log('ph-local-ok')"
```

Result: PASS.

Observed:

- `.persona/harness.jsonc` created.
- `.persona/rules/` created.
- `.opencode/opencode.json` created.
- `.persona/evidence/` was not copied during init.
- `npx ph bearshell` resolved and executed.
- Plugin path pointed to `/Users/yongtae/Desktop/persona-harness/dist/index.js`.

## Tarball Install Smoke

Command shape:

```bash
npm pack --pack-destination /tmp/persona-clean-opencode-ph-bearshell-G6eJA1/pack
npm init -y
npm install -D /tmp/persona-clean-opencode-ph-bearshell-G6eJA1/pack/persona-harness-0.2.1.tgz
npx persona-harness init
npx ph bearshell node -e "console.log('ph-tarball-ok')"
```

Result: PASS.

Observed:

- `.persona/harness.jsonc` created.
- `.persona/rules/` created.
- `.opencode/opencode.json` created.
- `.persona/evidence/` was not copied during init.
- `npx ph bearshell` resolved and executed.
- Plugin path pointed to the installed tarball package under `node_modules/persona-harness/dist/index.js`.

## OpenCode Behavior Smoke

Target project:

- Gradle Spring Boot project.
- Existing target file: `src/main/java/com/example/books/presentation/BookController.java`.
- Prompt required reading the target Java file first, then implementing the README requirements.

Command shape:

```bash
opencode run --dir /tmp/persona-clean-opencode-ph-bearshell-G6eJA1/tarball-install \
  --model openai/gpt-5.4-mini-fast \
  --dangerously-skip-permissions \
  "먼저 src/main/java/com/example/books/presentation/BookController.java 파일을 읽고, README.md 요구사항을 확인한 뒤 Gradle 기반 Spring Boot Book catalog 기능을 구현해줘. 구현 후 repository 상태 확인, build/test 확인, 큰 출력 확인이 필요하면 Persona Harness가 안내하는 shell 표면을 사용해줘. 사용자-facing 명령은 ph로 시작해야 하고 omo 명령은 쓰지 마."
```

Result: PASS.

Observed command behavior:

- The model explicitly said it would use `ph bearshell`.
- The model ran `npx ph bearshell --shell 'git status --short'`.
- The model ran `npx ph bearshell --shell 'gradle test'`.
- The model ran `npx ph bearshell --shell 'gradle build'`.
- No `omo sparkshell` command appeared in the OpenCode log or Persona Harness evidence.

Observed injection/evidence:

- `.persona/evidence/phase0` contained `22` metadata-only evidence files.
- Evidence roles included:
  - `controller`: `5`
  - `java-common`: `10`
  - `project-bootstrap`: `2`
  - `gradle-bootstrap`: `5`
- Controller target read produced controller evidence.
- README/build Gradle reads produced bootstrap evidence.

Observed generated shape:

- No `pom.xml` was created.
- Gradle files remained the build surface.
- Domain repository interface was generated at `domain/BookRepository.java`.
- Storage/id sequence state was generated behind `infrastructure/InMemoryBookRepository.java`.
- `BookService` did not own `Map`, `AtomicLong`, `nextId`, or `idCounter` storage state.
- `BookService` used `List` as a return type only.

Observed verification:

- Initial `gradle test` failed because `junit-platform-launcher` was missing.
- The model patched the Gradle dependency.
- `npx ph bearshell --shell 'gradle test'` then passed.
- `npx ph bearshell --shell 'gradle build'` then passed.
- `git status --short` failed because the temp smoke project was not a git repository; this is expected for this smoke.

## Support Classification

This smoke supports `v0.2.1` local/tarball behavior for:

- local path installation,
- tarball installation,
- `persona-harness init`,
- OpenCode plugin path creation,
- Java/Spring target injection evidence,
- `ph bearshell` awareness reaching actual OpenCode model behavior.

It does not support claims about generated application product quality, test sufficiency, rule enforcement, frontend/infra productization, desktop app support, or public npm registry installation.

## Known Gaps

- The reliable installed-project command is `npx ph bearshell`; a bare `ph bearshell` requires the package bin to already be on `PATH`.
- The smoke project was not a git repository, so the model's `git status` check failed even though it used the correct `ph` command surface.
- This is one clean OpenCode behavior smoke, not a statistical benchmark.
- OpenCode model behavior can vary by model, prompt, and permissions mode.
