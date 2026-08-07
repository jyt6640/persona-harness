# Observer precision on real Spring codebases

Every precision claim about the Java observers so far rested on fixtures the
project wrote itself. Fixtures prove the matcher fires on the shape it was
written for; they cannot show what the observers say about code written by
people who had never heard of this harness.

This is that measurement, run on 2026-08-07 against two public Spring projects,
with every warning read by hand.

## What was measured

| project | why it was chosen |
| --- | --- |
| [`spring-projects/spring-petclinic`](https://github.com/spring-projects/spring-petclinic) | Spring's own reference application. Small, deliberate, and layered the way the Spring team chose to layer it — not the way this harness prefers. |
| [`macrozheng/mall`](https://github.com/macrozheng/mall) | A large multi-module production-shaped e-commerce backend. 7 Maven modules, 47 Controllers, 50 Services. |

Neither project was modified. Nothing was planted.

## Results

| project | Java files | files with an opinion | PASS | WARN | WARN verified correct |
| --- | ---: | ---: | ---: | ---: | ---: |
| spring-petclinic | 30 | 6 (20%) | 8 | 9 | 9 / 9 |
| mall | 519 | 149 (29%) | 188 | 5 | 5 / 5 |
| **total** | **549** | **155 (28%)** | **196** | **14** | **14 / 14** |

Before the fixes in the same change, the same run produced 16 warnings of which
2 were wrong — 87.5% precision — and reached only 19% of mall's files. Both
gaps are described below.

## Read this number with its limit

**The observers have an opinion about 28% of the Java files they inspect.** The
remaining 72% are `UNKNOWN`: MyBatis-generated models and mappers,
configuration, entities, parameter objects, utilities, and anything else no
observer covers. `mall` alone contributes 420 `UNKNOWN` findings.

So "0 false positives across 549 files" is not "the harness checked 549 files".
It checked 155 and stayed quiet about the rest. Precision is what was measured
here. Recall was not, and a project can pass every observer while being wrong in
ways no observer looks at.

### What the silence is actually made of

The 28% figure reads worse than the situation is, so it is worth breaking down.
Of mall's 370 unobserved files:

| | files | is this a gap? |
| --- | ---: | --- |
| MyBatis-generated `*Example` | 76 | no — generated, nobody edits it |
| interfaces | 112 | no — no fields, nothing to observe |
| data holders (no method bodies) | 63 | no — POJOs |
| logic, but only getters/setters/`toString` | 88 | no |
| **real logic, unobserved** | **31** | **yes** |

So the honest gap in mall is 31 files out of 519 — **6%** — not 72%. Sixteen of
those 31 are Spring `*Config` classes; the rest are utilities, aspects, an
exception handler, and a JWT helper. Whether a layering observer should have an
opinion about a `@Configuration` class is a design question, not an oversight.

This breakdown was produced by classifying each unobserved file, and it is the
number to argue with — not the coverage percentage.

### The filename heuristic was checked and held

Roles are assigned by filename suffix, which is what hid the `*ServiceImpl.java`
gap below. Across both projects, **101 classes annotated `@Controller`,
`@RestController`, or `@Service` were checked against their filenames and none
mismatched.** The suffix list was incomplete; the approach was not wrong.

Two projects is also a small sample, and both are Java/Spring/Maven web
backends. Nothing here extends to other stacks.

## The blind spot this found: `*ServiceImpl.java`

`service.storage-ownership` matched `*Service.java` only. In `mall`, **all 50
`*Service.java` files are interfaces** — zero are classes — and the 49
`*ServiceImpl.java` files hold every field and every line of logic. One sampled
implementation is 327 lines against a 73-line interface.

So the observer was inspecting the one file in each pair that structurally
cannot own storage, and never looking at the one that can. It reported `UNKNOWN`
on all 50 interfaces, which was at least honest, but it saw nothing.

Extending the match to `*ServiceImpl.java` immediately produced 19 warnings —
**all 19 wrong.** The field pattern made the access modifier optional, so every
`List<Foo> itemList = ...` declared inside a method body matched, and the
type-argument pattern crossed newlines so a method signature could be captured
whole as a field. Neither could show up while the observer only ever saw
interfaces, which have no method bodies.

Requiring an access modifier and confining type arguments to one line removed
all 19. A planted `ServiceImpl` holding `Map<Long, Order> orderStore` and
`AtomicLong nextId` is still reported, with a local `List<String> auditList` in
the same file correctly ignored. mall's 49 implementations now report `PASS`,
which is right — they delegate to MyBatis mappers rather than holding state.

Coverage of mall went from 19% to 29% of files as a result.

## The two false positives this found

`controller.service-dependency` reported `WelcomeController` and
`CrashController` as HIGH-confidence "missing a Service layer". One returns a
view name; the other throws. Neither declares a field or a constructor.

The warning asserted that orchestration was sitting in the web layer, and in
both files there was no orchestration at all. Absence of a Service is only
observable once the Controller collaborates with *something* — otherwise there
is nothing the observer can see either way, and the honest verdict is `UNKNOWN`.

Both files now report `UNKNOWN`. A Controller that injects a Repository, or any
other non-Service collaborator, still warns.

## The 14 warnings that were correct

**spring-petclinic (9).** `OwnerController`, `PetController`, `VisitController`,
and `VetController` each warn twice — once for depending on a Repository
directly, once for having no Service. Petclinic genuinely does call repositories
from controllers; that is a deliberate choice in a reference application, and
the harness reporting it is correct even though the Spring team would not call
it a defect. `VetController` also warns for an unbounded `findAll()` returning
the whole table over HTTP.

**mall (5).** Three `dto.boundary` warnings on types named `*Dto`, whose
direction is not expressed in the name. Two `controller.service-dependency`
warnings, both real: `RestTemplateDemoController` assembles remote HTTP calls
inline in the Controller, and `MinioController` builds a `MinioClient` inside a
request method and performs bucket checks and uploads there. Neither has a
Service.

Notably, **zero** `controller.repository-dependency` warnings across mall's 47
Controllers. mall routes through Services consistently, and the harness stayed
silent — which is the result that matters most for precision.

## Reproducing this

```bash
git clone --depth 1 https://github.com/spring-projects/spring-petclinic.git
cd spring-petclinic
npm init -y && npm install persona-harness
npx ph init && npx ph bootstrap backend
npx ph observe src/main/java
```

For `mall`, run `ph observe` once per module against `<module>/src/main/java`.
The coverage breakdown above comes from the `java-file.applicability` findings
in `ph observe --json`, classified per file by reading each one.

Warnings must be read against the source to be counted; this document counts a
warning as correct only where the cited file was opened and the condition
confirmed.
