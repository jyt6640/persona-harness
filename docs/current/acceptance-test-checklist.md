# Persona Harness 인수 테스트 평가표 (0.4.1-rc.2 + local-current 기준)

작성일: 2026-07-02. 기본 registry 대상: `persona-harness@0.4.1-rc.2`
(HEAD `bcb5f08`). `0.4.1-rc.2` 이후 아직 publish되지 않은 surface는
local-current tarball mode에서만 평가한다.

## 판정 규칙

* 각 항목: **PASS / FAIL / N.A** + 비고.
* 등급: **[B] Blocker** = 하나라도 FAIL이면 인수 거부. **[M] Major** = FAIL 시
  릴리스 보류 후 판단. **[m] minor** = 기록만.
* 원칙: 판정 근거는 **exit code와 파일 산출물**이다. 출력 문구의 인상이 아니라
  종료 코드/생성 파일/차단 여부로 판정한다.
* 테스트 환경: repo 자체가 아니라 **fresh tarball 설치 + 임시 fixture 디렉토리**
  에서 실행한다 (repo 자체는 self-profile 혼선이 있음).
* OpenCode가 필요한 항목은 별도 OpenCode matrix에서만 [B]/[M]로 판정한다.
  일반 fresh package acceptance에서는 OpenCode 부재를 N.A로 기록할 수 있다.
* AI에게 이 평가표를 실행시킬 때도 동일 원칙을 적용한다. 같은 fixture 안의
  PH OFF/ON 비교는 동일 README.md, 동일 시작 커밋, 동일 task prompt를 사용한다.
* 대상 모드는 둘로 나눈다. **Registry mode**는 `persona-harness@next` 또는
  exact published version만 설치해 평가한다. **Local-current mode**는 현재 repo
  HEAD에서 `npm pack`한 tarball로 평가한다. 설치한 package에 없는 command는
  FAIL이 아니라 해당 mode에서 N.A로 기록하고, package version/gitHead를 남긴다.

준비:

```bash
cd /Users/yongtae/Desktop/persona-harness && npm pack
mkdir -p /tmp/ph-acceptance && cd /tmp/ph-acceptance
npm init -y && npm i /Users/yongtae/Desktop/persona-harness/persona-harness-0.4.1-rc.2.tgz
alias ph="npx ph"
```

---

## A. 패키지/설치 표면

| ID | 등급 | 항목 | 실행 | PASS 기준 | 판정 |
| --- | --- | --- | --- | --- | --- |
| A1 | [B] | fresh 설치 | `npm i <tarball>` | exit 0, 경고성 스크립트 실행 없음 | |
| A2 | [B] | 버전 출력 | `ph --version` / `ph version` | `0.4.1-rc.2` 정확히 출력, package metadata와 일치 | |
| A3 | [B] | 도움말 | `ph` (인자 없음) | usage 출력, exit 0 또는 명시적 non-zero 규약 | |
| A4 | [M] | doctor | `ph doctor` | OpenCode 부재 시 오류가 아니라 진단으로 보고 | |
| A5 | [B] | init 멱등성 | `ph init` 2회 연속 | 2회째도 exit 0, 기존 설정 파괴 없음 | |
| A6 | [m] | init 파일 경계 | `ph init` 후 파일 확인 | `.persona/harness.jsonc`, `.persona/conventions/`, `.persona/rules/`, `.opencode/opencode.json`, `.gitignore`는 생성 가능. `AGENTS.md`, `.persona/project-profile.jsonc`, plan/report 템플릿은 만들지 않음 | |

## B. 워크플로 레일 핵심 루프

| ID | 등급 | 항목 | 실행 | PASS 기준 | 판정 |
| --- | --- | --- | --- | --- | --- |
| B1 | [B] | intake→plan | `ph intake` → `ph plan` | draft profile/plan 파일 생성, exit 0 | |
| B2 | [B] | capture→split | `ph workflow capture --stdin` → `ph workflow split` | Step 섹션이 티켓 카드로 분할됨 | |
| B3 | [B] | next | `ph workflow next` | pending 티켓 1개 출력 | |
| B4 | [B] | **evidence 없는 finish 차단** | 구현/증거 없이 `ph workflow finish implement` | **exit ≠ 0** + blocker 목록 + fix-path 커맨드 제시 | |
| B5 | [B] | guard | plan 없는 상태에서 `ph workflow guard implement` | 차단 (exit ≠ 0) | |
| B6 | [M] | check 가독성 | `ph workflow check` | 현재 상태/blocker가 사람이 읽고 다음 행동을 알 수 있음 | |
| B7 | [B] | archive 불변성 | `ph workflow archive <ticket>` 후 파일 확인 및 같은 티켓 재archive | work ticket 제거, archive/history 파일 존재, 같은 티켓 재archive는 idempotent 또는 명확한 오류 | |
| B8 | [M] | 전체 루프 완주 | B1→B7 순서대로 | 중간에 수동 JSON 편집 없이 완주 가능 | |

## C. TDD 게이트 — 핵심 차별점, 전 항목 Blocker

전제: fixture는 실제 Gradle 프로젝트(실패 JUnit 테스트 1개 준비).
`enforce.executeVerification: true`, `enforce.tdd: true`.

| ID | 등급 | 항목 | 실행 | PASS 기준 | 판정 |
| --- | --- | --- | --- | --- | --- |
| C1 | [B] | strict-off 정직성 | strict off 상태에서 `ph workflow test` | **가짜 evidence를 쓰지 않고** advisory 안내만 (exit 0, evidence 파일 0개) | |
| C2 | [B] | red 기록 | 실패 테스트 존재 상태에서 `ph workflow test` | PH가 직접 gradle 실행, 실패 케이스명 출력, `red-*.json` 생성 (`execution: "ph-direct-gradle-junit"`) | |
| C3 | [B] | **green-only 차단** | red 없이 통과 테스트만으로 `ph workflow test` → finish | workflow test exit 1, finish exit 1, evidence 0개 | |
| C4 | [B] | **forged evidence 차단** | `red-forged.json` 수기 작성 후 finish | **finish exit 1** — 위조 파일 무시 | |
| C5 | [B] | compile-error 차단 | 컴파일 안 되는 테스트로 `ph workflow test` | exit 1, red evidence 미생성 (컴파일 실패 ≠ red) | |
| C6 | [B] | red→green 완주 | C2 후 구현 → green 기록 → finish | same ticket/testId 매칭, finish exit 0 | |
| C7 | [B] | 티켓 불일치 차단 | 다른 티켓의 red로 finish 시도 | 차단 (exit ≠ 0) | |
| C8 | [M] | tdd status 읽기 | `ph workflow tdd` | 현재 red/green 상태 + 다음 행동 출력, read-only (파일 변경 없음) | |

## D. Conformance / Observer

| ID | 등급 | 항목 | 실행 | PASS 기준 | 판정 |
| --- | --- | --- | --- | --- | --- |
| D1 | [B] | Controller→Repository 위반 검출 | 위반 fixture에 `ph observe --json src/main/java` | 해당 위반 finding 보고 | |
| D2 | [B] | **near non-violation 무해 통과** | Controller→Service→Repository 정상 fixture | finding 0 (false positive 없음) | |
| D3 | [M] | service.state-ownership | 위반/정상 fixture 각 1 | 위반만 검출 | |
| D4 | [B] | block 레벨 closure 연동 | level=block 위반 존재 시 finish | finish 차단 + fix-path | |
| D5 | [M] | ast-grep 부재 내성 | sg/ast-grep 없는 환경에서 `ph observe --json src/main/java` | 크래시 없이 skip 보고 | |

## E. Evidence / 측정 커맨드

| ID | 등급 | 항목 | 실행 | PASS 기준 | 판정 |
| --- | --- | --- | --- | --- | --- |
| E1 | [M] | metrics | `ph evidence metrics --json` | evidence 없으면 "없음"을 정직 보고, 있으면 집계. exit 0 | |
| E2 | [M] | ab-run | `ph evidence ab-run` (조건 1회) | 실제 커맨드 실행 + 구조화 evidence JSON 기록 | |
| E3 | [M] | ab-report | `ph evidence ab-report --json` | E2 산출물 집계, **클레임 문구 없음** | |
| E4 | [M] | pminus-report | `ph evidence pminus-report` | 매칭 시나리오 없으면 `none`, 있으면 keep/downgrade/remove-candidate 힌트. **설정 변경/삭제 없음** (read-only) | |
| E5 | [M] | pminus-status | `ph evidence pminus-status --json` | local-current tarball에서 평가. matching evidence가 있으면 surface decision/status non-empty, 없으면 none/empty를 정직 보고. registry `0.4.1-rc.2`에는 아직 없으므로 N.A. **설정 변경/삭제 없음** (read-only) | |
| E6 | [m] | evidence 경로 발견성 | 각 커맨드 출력 확인 | 산출물 경로가 출력에 표시됨 | |

## F. OpenCode 플러그인 런타임 (OpenCode 설치 환경 필요)

이 섹션은 OpenCode가 설치된 matrix에서만 평가한다. OpenCode가 없는 일반
fresh package acceptance에서는 F열 전체를 N.A로 기록할 수 있으며, 그 자체는
인수 거부 사유가 아니다.

| ID | 등급 | 항목 | 실행 | PASS 기준 | 판정 |
| --- | --- | --- | --- | --- | --- |
| F1 | [B] | 플러그인 로드 | OpenCode 세션 시작 | 로드 오류 없음, 세션 정상 | |
| F2 | [B] | .java 주입 트리거 | .java 파일 편집 세션 | injection block 주입 확인 (결정론: 파일 role 기반) | |
| F3 | [M] | 비-.java 무간섭 | .ts 파일 작업 | Java rail 주입 없음 | |
| F4 | [B] | hook 오류 격리 | hook 내부 오류 유발 | 세션이 죽지 않고 runtime warning으로 격리 | |
| F5 | [M] | codegraph opt-in no-op | codegraph 바이너리 없는 환경 | 등록 안 함, 오류 없음 (default 미등록 확인) | |
| F6 | [M] | LSP facade 정직성 | jdtls 없는 환경에서 LSP wrapper | protocol-alive + status-only "unavailable" 보고, 크래시 없음 | |
| F7 | [m] | token telemetry | 세션 후 `.persona/evidence/token-usage/` | provider 토큰 JSON 생성 | |

## G. 정직성 / 문서 클레임 감사

| ID | 등급 | 항목 | 실행 | PASS 기준 | 판정 |
| --- | --- | --- | --- | --- | --- |
| G1 | [B] | Forbidden Claim 감사 | README + CLI 출력 전수 | "token 절약/품질 보장/full TDD/LSP 효과" 클레임 **0건** | |
| G2 | [B] | not-proven 유지 | README Project Status | injection-effect-not-proven 명시 유지 | |
| G3 | [M] | A/B 산출물 boundaries | ab-report/pminus 출력 | no-claim/limitations 문구 포함 | |
| G4 | [m] | external archive 포인터 | README 또는 metrics 출력 | 아카이브 증거 위치 안내 존재 (현재 알려진 갭 — FAIL 예상) | |

## H. 회귀 / 품질 게이트

| ID | 등급 | 항목 | 실행 | PASS 기준 | 판정 |
| --- | --- | --- | --- | --- | --- |
| H1 | [B] | 전체 테스트 | `npm test` | 해당 commit의 full test suite PASS (개수는 read-back 기록, 고정 숫자로 판정하지 않음) | |
| H2 | [B] | 타입 | `npm run typecheck` | exit 0 | |
| H3 | [M] | 의존성 표면 | package.json | dependencies는 `@opencode-ai/plugin`뿐, codegraph/lsp-mcp는 optional 유지 | |
| H4 | [m] | 신규 파일 잔재 | `git status` | 테스트 후 워킹트리 오염 없음 | |

---

## I. 토큰 계측 표면 (절약 검증 아님 — 계측기 검증)

주의: PH는 토큰 절약을 클레임하지 않는다 (Forbidden Claim Table). 따라서
"토큰이 줄어드는가"는 **인수 항목이 아니다**. 인수 대상은 "계측기가 정확히
기록하는가"와 "절약 클레임이 없는가"뿐이다. 절약 여부 자체는 부록 J의 별도
측정 프로토콜로 다루며, 그 결과는 인수 판정에 영향을 주지 않는다.

| ID | 등급 | 항목 | 실행 | PASS 기준 | 판정 |
| --- | --- | --- | --- | --- | --- |
| I1 | [M] | telemetry 기록 | OpenCode 세션 1회 후 `.persona/evidence/token-usage/<session>.json` | provider input/output/reasoning/cacheRead/total 필드가 실제 값으로 기록됨 (0-fill 아님) | |
| I2 | [B] | compaction 기본 off | 기본 설정 세션 | compaction 트리거/`session.summarize` 호출 0회 | |
| I3 | [M] | compaction opt-in 동작 | `enforce.compaction` on + ratio 유발 가능 시 | 트리거 시 cooldown이 persist되고 중복 트리거 없음. ratio 관측 불가 환경이면 N.A로 기록 (FAIL 아님) | |
| I4 | [M] | ab-run 토큰 필드 | `ph evidence ab-run` (providerTokens 제공/미제공 각 1회) | 제공 시 기록, 미제공 시 `null`로 정직 기록 (추정치 fabricate 없음) | |
| I5 | [B] | 절약 클레임 부재 | README/CLI/evidence 출력 전수 | "token saving/절약" 단정 문구 0건 (G1과 중복 확인) | |

## 인수 판정 기준

* **인수**: [B] 24개 전부 PASS, [M] FAIL ≤ 2개(사유 기록).
* **조건부 인수**: [B] 전부 PASS, [M] FAIL 3~4개 → 수정 후 해당 항목만 재시험.
* **거부**: [B] FAIL ≥ 1개.

## 가중치 참고 (어디를 깐깐하게 볼 것인가)

1. **C열(TDD 게이트)이 제품의 심장이다.** C3/C4(green-only·forged 차단)가
   무너지면 나머지가 전부 PASS여도 제품 주장이 무너진다. 여기에 시간의 절반을
   써라.
2. **D2(false positive 없음)가 D1(검출)보다 중요하다.** 잘못 잡는 게이트는
   꺼지고, 꺼진 게이트는 없는 제품이다.
3. **G열은 형식 검사가 아니다.** 이 프로젝트의 차별 자산이 정직성이므로,
   클레임 한 줄의 과장도 [B]다.
4. E열은 이번 릴리스에서 [M]이다 — 측정 도구는 신설 표면이라 FAIL이 나와도
   게이트 제품의 인수를 막지 않는다. 단 E4의 read-only 위반(설정을 실제로
   바꾸는 경우)은 즉시 [B]로 승격한다.

## 기록 양식

각 FAIL은 다음을 남긴다: 항목 ID / 실행 커맨드 / exit code / stdout·stderr
캡처 / 재현 fixture 경로. 캡처는
`persona-harness-artifacts/archive/<날짜>-acceptance/` 아래 보존한다.

## AI 실행 지침

이 평가표를 AI 에이전트에게 맡길 때는 아래 지침을 그대로 전달한다.

```text
Persona Harness acceptance를 실행한다. repo 자체가 아니라 fresh tarball install
및 임시 fixture 디렉토리를 사용한다. 판정 근거는 exit code, 생성 파일, JSON
schema, blocker 여부, read-only/no-mutation 여부다. 출력 문구의 인상으로
PASS 처리하지 않는다.

각 항목은 PASS / FAIL / N.A와 비고를 남긴다. OpenCode가 없는 환경에서는 F열을
N.A로 둘 수 있다. FAIL은 항목 ID, 실행 커맨드, exit code, stdout/stderr,
fixture 경로를 archive에 남긴다.

PH OFF/ON 또는 agent-session A/B를 실행할 때 같은 fixture 안에서는 동일
README.md, 동일 시작 커밋, 동일 task prompt를 사용한다. README나 task가
달라지면 PH 효과 비교가 아니라 요구사항 차이 비교가 되므로 해당 pair는
무효 처리한다.

토큰 절약, 앱 품질 보장, full TDD, LSP/CodeGraph 효과, broad reliability,
closure success는 claim하지 않는다. token/provider telemetry는 계측 검증과
별도 A/B 분석의 입력일 뿐이다. missing telemetry는 0으로 치지 말고 missing으로
기록한다.
```

---

## 부록 J. 토큰 절약 측정 프로토콜 (인수 외 — 별도 실행)

인수와 분리해서 돌리는 이유: 절약은 클레임된 적 없으므로 인수 조건이 될 수
없고, negative 결과가 나와도 인수는 유효하다. negative는 P-minus의 입력이다.

### J.1 측정 대상 시나리오 (확실성 순)

| 순위 | 시나리오 | OFF | ON | 현재 상태 |
| --- | --- | --- | --- | --- |
| 1 | **주입 레이어 agent-session A/B** | 플러그인 미설치 | 플러그인 설치(기본 설정) | **미측정 — injection-value 0/3을 채우는 그 측정. 최우선** |
| 2 | developer MCP bundle | bundle 미등록 | 등록 | docs/search-heavy task에서만 의미 |
| 3 | compaction | off | on + 장기 세션 | post-trigger telemetry 불안정 → ratio 관측 가능해질 때까지 defer |
| 4 | codegraph / LSP | 미등록 | 등록 | target tool 실호출이 관측된 run만 해석 대상 |

### J.2 프로토콜 (P1 minimum protocol 준수)

1. 동일 Java/Spring fixture + 동일 task prompt를 OFF/ON 각 **5회 이상**.
   5회는 pilot으로만 해석한다. 효과/토큰 claim 후보로 해석하려면 원칙적으로
   **10개 이상 paired run**과 QA의 통계 해석 승인이 필요하다.
2. 각 run을 `ph evidence ab-run`으로 기록: provider
   input/output/reasoning/cacheRead/total, read chars, tool calls, MCP calls,
   elapsed, success/failure. provider 토큰은 telemetry JSON
   (`.persona/evidence/token-usage/`)에서 가져와 결합한다.
3. 집계는 `ph evidence ab-report --json` → `ph evidence pminus-report`.
4. 해석 규칙:
   * success rate이 다르면 토큰 비교 무효 (실패한 run은 싸다).
   * cacheRead가 총량의 대부분인 워크로드에서는 평균이 아니라 **p95와
     variance**를 본다. 5회에서 variance가 크면 반복을 늘린다.
   * paired delta, median, IQR 또는 bootstrap confidence interval을 같이
     기록한다. 표본이 작으면 "underpowered"로 표시하고 claim하지 않는다.
   * target tool(코드그래프/LSP/MCP)이 한 번도 호출 안 된 run은 그
     시나리오의 증거가 아니다 — "등록됐지만 미사용"으로 분류.
5. 결과 처리:
   * 개선 관측 → scoped claim ("fixture X, N회, ON이 total -Y%, 동일 성공률").
   * 무개선/악화 → pminus-report의 keep-opt-in/downgrade/remove-candidate
     판정에 반영. **이것도 성공한 측정이다.**

### J.3 예상에 대한 정직한 메모

과거 실측(code-nav A/B, cacheRead ~90% 지배)에 비추면, 주입 레이어는 토큰을
**늘리는** 쪽으로 나올 가능성이 낮지 않다 — 주입은 컨텍스트를 더하는
기능이고, PH의 절약 후보는 주입이 아니라 (a) finish 차단이 막아주는 재작업
루프, (b) compaction이다. (a)는 토큰이 아니라 completion-integrity로 이미
측정됐고, (b)는 트리거 관측 전이다. 따라서 J.1-1의 negative는 실패가 아니라
"PH는 게이트 제품이지 토큰 제품이 아니다"라는 포지셔닝 확정 증거로 쓴다.
