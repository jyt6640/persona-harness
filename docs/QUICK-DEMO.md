# Quick Demo

Goal: in a few minutes, watch Persona Harness **block an unverified completion
claim** — and understand why that block is the product working.

## What this demo proves / does not prove

**Proves:**

- PH can initialize a local workflow rail.
- PH can create backend workflow artifacts.
- PH can block completion when required reports/evidence are missing.

**Does not prove:**

- generated app quality
- token saving
- broad AI productivity
- production readiness
- full TDD sufficiency

## Requirements

- Node.js 20+, npm
- Java 21+ and Gradle (only if you run backend verification)
- OpenCode (only for the optional agent workflow)

## 1. Create a clean project

Do **not** run this inside the Persona Harness repository. Use a clean temp dir.

```bash
mkdir -p /tmp/persona-harness-demo
cd /tmp/persona-harness-demo
npm init -y
npm install -D persona-harness
```

## 2. Add a small README

```bash
cat > README.md <<'EOF'
# Todo API

Build a Java 21 Spring Boot REST API with Gradle.

## Requirements
- Users can create, list, and complete todos.
- Missing todos return an appropriate error response.

## Technical Constraints
- Java 21, Spring Boot 3, Gradle only, REST API only.
- Controllers delegate to application services.
- Repository interfaces live in domain; implementations in infrastructure.
- Application services must not own storage state or id sequences.
EOF
```

## 3. Initialize Persona Harness

```bash
npx ph init
npx ph bootstrap backend
npx ph doctor
npx ph workflow check
```

## 4. Try to finish too early

```bash
npx ph workflow finish implement
```

Expected: **finish is blocked.**

This is expected, and it is the whole point. You have not yet provided the
required reports, PH-generated evidence, or a real verification result — so PH
refuses to let a "done" claim through. A blocked finish here means the gate is
working, not that something is broken.

## 5. What to do next

The agent (or you) should now:

- run the workflow implement step;
- run verification through the PH rail or a bounded command;
- fill the implementation report;
- fill the review report;
- run `npx ph workflow finish implement` again.

When the required evidence exists on disk, finish stops blocking. This demo does
not claim anything about the quality of the code produced — only that
completion was gated on evidence. See [MEASURED-CLAIMS](MEASURED-CLAIMS.md).
