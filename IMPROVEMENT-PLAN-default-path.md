# Persona Harness 개선안 P1 — 기본 경로 박멸 (default-path)

> 성격: P1 단계별 실행 스펙. 각 STEP은 별도 브랜치에서 stage한 뒤 사용자 승인 전에는 커밋하지 않는다. 방향·로드맵 정본은 `PROJECT-PLAN.md`.
> 현재 실행 기준: `origin/main` exact `f6cb462081f8982879959db8143fa33557ef824e` (2026-07-12).
> 설계 배경: 첫 실사용 보고(2026-07-11, 기존 Java 프로젝트 + TUI 호스트 + Windows 경로 관측) + 당시 `origin/main` `09791561bb9675dda93c841232e5e06af2cf75f4` 관찰 + 실사용자 `harness.jsonc`. `0979156` 및 중간 기준 `18c62da`의 좌표는 역사적 설계 배경일 뿐 이후 STEP의 구현 근거로 사용하지 않는다.
> 선행: `IMPROVEMENT-PLAN-gate-first.md`(P0, 24/27 수용 완료, 아카이브 대상). 이 문서는 그 다음 tranche다.
> 한 줄 요지: **P0는 "준비된 프로젝트의 진입"을 완성했다. P1은 "준비 안 된 프로젝트·호스트·자연어"라는 기본 현실에서도 게이트에 도달하게 만든다.**

---

## STEP 0 기준 재고정 — exact main `f6cb462`

이번 P1 실행의 모든 코드 근거는 다음 exact main 스냅샷에 고정한다.

- 기준 SHA: `f6cb462081f8982879959db8143fa33557ef824e`.
- 릴리스 상태: `persona-harness@0.7.0-rc.1` 정리 후 main이며, P1은 릴리스 변경 계열과 분리한다.
- 기본 설정 정의: `src/config/harness-config.ts:93-135 @ f6cb462081f8982879959db8143fa33557ef824e`.
- 기본 init의 템플릿 복사와 project-local OpenCode 설정 생성:
  `src/cli/init.ts:128-138,166-206 @ f6cb462081f8982879959db8143fa33557ef824e`.
- 기본 bootstrap과 `--strict` 분기:
  `src/cli/bootstrap.ts:352-380 @ f6cb462081f8982879959db8143fa33557ef824e`.
- `--strict`의 `executeVerification`·`systemConstitution`·`runtimeInjection` 번들:
  `src/cli/bootstrap-strict.ts:42-76 @ f6cb462081f8982879959db8143fa33557ef824e`.
- closure verification 직접 실행/구조화 evidence 분기:
  `src/cli/workflow-closure-verification.ts:24-52 @ f6cb462081f8982879959db8143fa33557ef824e`.
- `executeVerification=false`일 때 TDD 실행/closure advisory 강등:
  `src/cli/workflow-tdd.ts:41-50,84-97 @ f6cb462081f8982879959db8143fa33557ef824e`.
- lock identity의 device/inode/generation/raw 결합:
  `src/cli/go-lock-state.ts:13-18,110-170` 및
  `src/cli/go-lock.ts:75-88 @ f6cb462081f8982879959db8143fa33557ef824e`.
- 기존 intent corpus preregistration:
  `experiments/intent-detection/corpus.json:1-9 @ f6cb462081f8982879959db8143fa33557ef824e`.
- npm allowlist는 `experiments/**`를 포함하지 않음:
  `package.json:17-95 @ f6cb462081f8982879959db8143fa33557ef824e`.

이하의 `0979156`/`18c62da` 언급은 문제 발견 당시의 설계 배경을 설명할 때만 유지하며, 실제 STEP 판정과 변경은 위 exact main 또는 각 STEP 브랜치의 exact commit을 사용한다.

---

## 0. 문제 정의 — 실사용 1호가 그린 지도

첫 외부형 사용(기존 위키 Java 프로젝트, TUI, "그냥 해줘" 자연어)에서 관측된 실패 3건 + 파생 발견 2건:

| # | 관측 | 근본 원인 |
| --- | --- | --- |
| F1 | "기존 프로젝트에 해줘" → 티켓 없이 바로 구현, bearshell 미사용 | 자연어 진입 감지 부재 (훅 PARK) + F2 |
| F2 | 에이전트 자백: "persona-harness 실행 규칙이 세션에 없음" | AGENTS.md 미설치 또는 호스트가 미독. **attached-but-inert 상태를 아무도 감지 못함** |
| F3 | 기존 프로젝트 + TUI에서 profile 설정 곤란 | P0-1은 명시적으로 "prepared-project entry"로 스코프됨(수용 기록 원문). 준비 자체는 여전히 다단계 |
| F4 | 사용자 harness.jsonc가 전부 false — "그래서 안 됐다"는 오진 유통 | 기본값의 3분류(§1)가 문서화 안 됨. 특히 executeVerification의 default/bootstrap 분기 |
| F5 | `src\main\java\...` — Windows에서 사용됨 | PH는 Windows에서 한 번도 측정된 적 없음. lock 프로토콜은 device/inode 바인딩 |

**오진 경고**: "다 false여서 안 됐다"는 절반만 맞다. 진입 스티어링은 runtimeInjection이 아니라 정적 AGENTS.md(rail-entry 10/10) 담당이므로, measured-negative 플래그를 켜도 F1·F2는 그대로다. 이 오진이 사용자에게 measured-negative 기능을 켜게 유도하는 것 자체가 해결해야 할 문제다.

---

## 1. 진단 — false의 3분류 (실물 코드 확인 완료)

| 분류 | 플래그 | 판정 | 근거 |
| --- | --- | --- | --- |
| 측정 기각 | `runtimeInjection`, `systemConstitution`, `idleContinuation`, `ralphLoop` | 켜지 않는다. 재론은 별도 측정 tranche로만 | 10-pair measured-negative, PROJECT-PLAN §2 |
| **온보딩 분기** | `executeVerification` | **게이트 구멍 아님, 그러나 조용한 약화 경로 있음** — 아래 상술 | `src/config/harness-config.ts:93-120`, `src/cli/workflow-closure-verification.ts:24-52`, `src/cli/bootstrap.ts:352-380` @ `f6cb462081f8982879959db8143fa33557ef824e` |
| 무관/서랍 | `multiAgent`, `writeDeny` | preview 유지, F1~F3과 무관 | P0 §2 |

### executeVerification의 진실 (현재 실행 기준 @ `f6cb462081f8982879959db8143fa33557ef824e`)

- default는 `false`(`src/config/harness-config.ts:93-120`)지만, **false여도 게이트는 텍스트 주장을 믿지 않는다**: 리포트가 "검증 성공"을 주장해도 구조화된 실행 evidence가 없으면 `verification: "unknown"`으로 남는다(`src/cli/workflow-closure-verification.ts:34-52`). 즉 완료-무결성 약속은 유지된다.
- `true`면 PH가 closure/finish에서 검증 명령을 직접 실행한다(`src/cli/workflow-closure-verification.ts:24-28`).
- 기본 init은 저장소 템플릿을 복사하고(`src/cli/init.ts:166-194`), 기본 bootstrap은 `--strict`가 주어진 경우에만 strict mutation을 호출한다(`src/cli/bootstrap.ts:352-380`). 현재 `executeVerification=true`를 만드는 CLI 경로는 `--strict`이며, `enableStrictClosureVerification`은 executeVerification과 함께 **systemConstitution=true를 켜고 `withRuntimeInjection`으로 runtimeInjection=true까지 켠다**(`src/cli/bootstrap-strict.ts:42-76`) — measured-negative 2개가 게이트 무결성 플래그와 한 명령에 번들되어 있다.
- 결론 둘: (a) **지금 강한 enforcement로 가는 안전한 명령이 존재하지 않는다** → D1의 remediation은 attach(D2) 착지 전까지 WARN 보고만 가능하다. (b) `--strict`의 번들링 자체가 PH 원칙(측정 기각 기능의 기본 비활성) 위반 후보 — **D4 감사에 결함으로 기록하고 별도 unbundling tranche 후보로 올린다.** 이번 tranche에서는 --strict를 수정하지 않는다.
- false 상태에서는 **TDD 레일이 advisory로 강등**된다(`src/cli/workflow-tdd.ts:41-50,84-97`).
- 실사용자의 all-false 설정 파일 = "강한 모드로 가는 안전한 경로가 없는 제품"의 산출물. F3·F4는 같은 뿌리.

---

## 2. D1 — 설치 무결성 게이트 (F2, 최우선·최저가)

**원인**: "붙었지만 죽은" 상태를 감지하는 판정이 없다. 조용한 실패 = 이 제품이 제일 싫어하는 것.

**설계**:
- `ph doctor`를 "설치 검사"에서 **"세션 도달성 검사"**로 승격:
  1. AGENTS.md 존재 + PH 스티어링 블록 버전 일치
  2. 호스트 설정(opencode.json) 플러그인 등록 여부
  3. 호스트 어댑터 부재 감지(비-OpenCode) 시 정직 판정: "이 호스트에는 어댑터가 없음 — AGENTS.md 스티어링만 유효한데 그 파일이 없음/낡음" + **해결 명령 정확히 하나**
  4. enforcement 모드 보고: "PH-run verification OFF(evidence-only 모드) — TDD 레일 advisory" 를 명시 출력 (§1의 조용한 약화를 시끄럽게)
- `ph go` preflight에 같은 검사 편입: 미준비 시 지금은 nonzero뿐 → "**attach부터: <명령>**" 한 줄 (D2가 그 목적지).
- 원칙 재사용: 블로커는 next action 하나 + literal command 하나 (P0-2 계약 그대로).

**수용 기준**: attached-but-inert fixture(AGENTS.md 없음/버전 불일치/플러그인 미등록/약한 enforcement)를 만들고 doctor가 4종 전부를 정확한 단일 명령과 함께 판정하는 결정적 테스트.

---

## 3. D2 — 기존 프로젝트 온보딩 단일화 `ph attach` (F3·F4)

**설계**: 미준비 프로젝트에서 한 명령으로 준비 완료 상태까지.

1. **추론 먼저**: gradle/패키지 구조 스캔으로 profile 초안 자동 생성 — `instructions infer`·`intake`·`stack-alignment profile` 기존 자산의 배선이지 신규 엔진이 아니다.
2. **확인만 받기**: 초안 제시 → 사용자 승인(TUI 친화, `--yes`로 무인). 인터뷰 최소화 — 물어볼 것은 추론 불가 항목만.
3. **강한 모드로 설치**: AGENTS.md + harness.jsonc + profile 을 bootstrap과 **동일한 enforcement**(executeVerification=true 포함)로 심는다. §1의 조용한 약화 경로를 봉쇄.
4. 실패/충돌 시 무기록 보장 + 단일 next action — `go`의 preflight 계약과 동일한 모양.

**스코프 확장 선언**: P0-1 수용 기록의 "prepared-project entry"를 "any-project entry"로 넓히는 작업이며, `go`는 건드리지 않고 앞단에 attach를 세운다(변경 계열 분리).

**수용 기준**: 실제 기존 Java 프로젝트(위키 사용기 재현 + attendance)에서 attach → doctor 전부 녹색 → `go` → 게이트 도달까지 무편집 통과 캡처.

---

## 4. D3 — 진입 훅 P0-4 PARK 해제 계획 (F1)

기합의 원칙(스티어링 비강제·미탐>오탐·발화 로그·게이트 판정은 절대 숨기지 않음) 위의 실행 계획:

1. **corpus 가동은 오늘부터**: 실사용 1호의 "그냥 해줘" 프롬프트가 positive 수집 1호. `experiments/entry-intent-corpus/`(패키지 `files` 제외 검증)에 한/영 positive·negative 축적. corpus 존재는 활성화 근거가 아니라 측정 재료(운영 원칙 6).
2. **감지기는 결정적**: LLM 분류 금지. 한/영 명령형 동사 + 코드 명사 휴리스틱 — 재현 가능, 비용 0, corpus로 직접 측정 가능.
3. **탑재 위치**: 신규 runtime 경계를 뚫지 않는다. OpenCode 어댑터의 기존 훅 지점에 얹되 **첫 사용자 메시지 1회만**(세션당 O(1)), 신규 플래그 `features.entrySteering`(기본 off)로 게이팅. measured-negative였던 콘텐츠 주입과 플래그·로그·범위가 분리됨을 코드와 문서 양쪽에 명시.
4. **발화 로그 + doctor 관측**: 발화/비발화와 근거를 세션별 기록, `ph doctor`에서 조회.
5. **사다리**: opt-in 출시 → corpus 기반 precision/recall 측정(미탐 가중) → 기준 통과 시에만 릴리스 결정으로 기본 on. 기준 미달이면 opt-in 유지 또는 재PARK.
6. **호스트 한계 정직**: 훅은 OpenCode 전용. 훅 없는 호스트의 항구적 fallback은 AGENTS.md 스티어링(D1이 그 존재·신선도를 보장) — 이 관계를 지원 매트릭스(D5)에 명문화.

**수용 기준**: corpus ≥ 한/영 각 24쌍, 감지기 단위 테스트, 발화 로그 fixture, opt-in 상태로 실사용 세션 관측 기록.

---

## 5. D4 — 기본값 전수 감사 (F4)

`harness.jsonc` 전 플래그에 대해 한 표:

| 컬럼 | 내용 |
| --- | --- |
| flag | 이름 |
| 분류 | measured-negative / 게이트 무결성 / 온보딩 분기 / UX / 죽은 플래그 |
| default | 현재 기본값 |
| bootstrap/attach 설정값 | 경로별 실제 값 |
| 의도 | 유지 / 경로 통일 / 제거 후보 |
| 근거 | file:line @ SHA |

핵심 판정 대상:
- `executeVerification`: default false 유지 여부보다 **경로 통일**(attach도 bootstrap처럼 true)이 논점. default 자체의 변경은 측정+릴리스 결정으로만.
- 죽은 플래그 탐지: 어떤 코드도 읽지 않는 플래그는 diff-rules와 같은 수순(제거 후보 보고).
- doctor의 enforcement 모드 보고(D1-4)가 이 표의 런타임 출력판이 된다.

**수용 기준**: 표 완성(전 플래그, 근거 file:line) + 죽은 플래그 목록 + 경로 불일치 목록. 문서 전용 수용 단위 — 기본값 변경은 이 tranche에서 하지 않는다.

---

## 6. D5 — 플랫폼 정직성 (F5)

- Windows는 실사용에서 관측됐으나 PH는 win32에서 무측정. lock 프로토콜의 device/inode 바인딩·pbcopy·open 등 POSIX 전제 다수.
- 이번 tranche 범위: **지원을 만드는 게 아니라 주장하지 않는 것.**
  1. doctor가 win32 감지 시 "미검증 플랫폼" 정직 판정 + 알려진 위험(lock identity 미측정) 한 줄.
  2. README/START-HERE에 지원 매트릭스: 검증 = macOS/Linux + OpenCode. 미검증 = Windows. 어댑터 예정 = codex.
- Windows 실측·지원은 수요 신호가 기록되면 별도 platform tranche로 (C 보증 부활 금지 원칙과 같은 구조).

---

## 7. 착수 순서 (2026-07-11 HQ 리뷰 반영 — 수정 후 채택)

```
STEP 0  기준 SHA·관측 사실을 현재 exact main으로 재고정 (0979156 근거는 배경으로 강등)
STEP 1  D4 기본값 전수 감사        ← D1의 문구·remediation 의미론을 공급. 문서 전용·최저 위험
STEP 2  D1 doctor 도달성 판정      ← AGENTS 관리 블록 계약 정의 포함. remediation은 현재
                                     가능한 명령만, 약한 enforcement는 WARN 보고
STEP 3  D2 transactional attach    ← go transaction 패턴 재사용 필수. bootstrap 순차 쓰기 호출 금지
STEP 4  D1 remediation을 attach로 배선
STEP 5  D5 플랫폼 정직성
STEP 6  D3-A corpus 확장(기존 experiments/intent-detection에 신규 preregistration) + scorer
STEP 7  D3-B 오프라인 감지기 측정 → 기준 통과 + 사용자 승인 시에만 D3-C opt-in hook
```

리뷰가 잡은 순서 원칙: 의미(D4) → 진단(D1) → 목적지(D2) → 배선(D1↔D2) → 자동화(D3, 측정 게이트 뒤). D3는 corpus/측정/훅 3개 수용 단위로 분리 — opt-in이라도 runtime hook 표면 확장이므로 측정 통과 전 NO-GO.

병렬 규칙은 P0와 동일: 한 수용 단위 = 한 변경 계열, 병합 전 증거로 병합 후 상태를 수용하지 않음, 노출 제거 ≠ 경로 제거, 신규 강제·기본값 변경은 측정 + 릴리스 결정으로만.

**이 tranche가 성공했다는 판정 기준(전체)**: 실사용 1호 시나리오(기존 Java 프로젝트, 준비 0, TUI, "그냥 해줘")를 재현했을 때 — doctor가 inert를 판정하고, attach 한 방이 강한 모드로 준비를 끝내고, go가 게이트까지 태우는 흐름이 무편집 캡처로 남는 것. F1의 자연어 감지는 opt-in 훅 + corpus 측정으로 후속.

---

## 8. 실행 프롬프트 (개정판 — §7 순서 기준)

```text
먼저 이 저장소 루트의 IMPROVEMENT-PLAN-default-path.md 전체를 읽고 이번 작업의 스펙으로 삼아라.

[불변 규칙]
- measured-negative 기능(runtimeInjection, systemConstitution, idleContinuation, ralphLoop)의
  "신규 활성화"를 만드는 코드·안내·문서 전부 금지. 기존 --strict가 이들을 켜는 것은 이번
  tranche에서 수정하지 않되, STEP 1 감사에 "번들링 결함"으로 기록하고 별도 unbundling
  tranche 후보로 보고하라. doctor 등 어떤 신규 출력도 --strict를 remediation으로 안내하지 마라.
- 어떤 기본값(harness.jsonc의 enforce/features/conventions)도 사용자 명시 승인 없이 바꾸지 마라.
- 커밋은 각 STEP마다 stage + 커밋 메시지 초안까지만. 최종 커밋은 사용자 확인 후.
- 각 STEP은 별도 브랜치/수용 단위 (한 수용 단위 = 한 변경 계열).
- 근거는 현재 exact main의 file:line @ SHA로만. 추측 금지.
- 각 STEP 끝나면 변경 요약 + 근거 + 검증 증거를 보고하고 멈춰라. 다음 STEP은 사용자 확인 후.
- 게이트 판정을 숨기거나 약화하는 변경, 측정 없는 기본값 변경, 저정밀 감지기의 강제화 금지.

STEP 0 — 기준 재고정 (문서만):
- 현재 exact main SHA를 확인하고, IMPROVEMENT-PLAN-default-path.md의 모든 file:line 근거를
  그 SHA 기준으로 재검증·갱신하라. 0979156 기준 근거는 "설계 배경"으로 강등 표기.
- 이후 모든 STEP의 근거는 이 SHA(또는 각 STEP 브랜치의 exact commit)로만 댄다.

STEP 1 — D4 기본값 전수 감사 (문서 전용 수용 단위, 최우선):
- src/config/harness-config.ts 의 전 플래그로 docs/current/harness-default-audit.md 작성. 스키마:
  flag | 분류(measured-negative/게이트 무결성/온보딩 분기/UX/죽은 플래그) | default |
  bootstrap 설정값 | --strict 설정값 | (미래) attach 설정값 | 의도 | 근거 file:line @ SHA
- 죽은 플래그(어떤 코드도 읽지 않음) 목록을 별도 보고. 제거는 하지 마라.
- executeVerification 경로 분석을 정확히 기록하라: default false, 기본 bootstrap은 켜지 않음,
  유일한 활성 경로 --strict는 systemConstitution·runtimeInjection과 번들
  (enableStrictClosureVerification, bootstrap-strict.ts), false 시 TDD advisory 강등
  (workflow-tdd.ts). --strict 번들링을 결함 항목으로 기록.
- 이 표의 문구가 STEP 2 doctor 출력의 의미론 사전이 된다.

STEP 2 — D1 doctor 도달성 판정:
- 먼저 AGENTS.md "PH 관리 블록" 계약을 정의하라 (docs/current/agents-managed-block-contract.md):
  시작/끝 marker, block schema/version, 사용자 작성 내용 보존 방식, 구버전 migration 규칙,
  중복·부분 손상 판정. 이 계약이 없으면 버전 검사는 제목 문자열 비교에 불과하다.
  기존 bootstrap이 심는 AGENTS 본문(bootstrap.ts의 생성부)을 계약의 v1로 소급 정의하되,
  marker 삽입 등 생성부 변경은 STEP 3(attach)과 같은 계열로 미루고 이번 STEP은 검사만 구현.
- ph doctor를 세션 도달성 검사로 승격:
  (a) AGENTS.md 존재 + 관리 블록 관측 여부(계약 v1 기준. marker 없는 구버전은 "legacy 관측"으로)
  (b) 호스트 어댑터 등록: project-local .opencode/opencode.json 검사 결과를
      "project-local 등록이 관측되지 않음"으로만 표현하라. global config 가능성이 있으므로
      "미등록" 단정 금지. "비-OpenCode 호스트" 확정 판정도 금지 — host marker/handshake가
      없는 현재는 관측 사실만 말한다.
  (c) enforcement 모드 보고: executeVerification=false면
      "PH-run verification OFF — evidence-only 모드, TDD 레일 advisory" WARN.
      remediation 명령은 안내하지 마라(안전한 명령이 아직 없음 — STEP 4에서 attach로 배선).
- doctor 판정 모델을 먼저 정의하고 구현하라:
  finding 등급 WARN/BLOCK, blocker 우선순위, exit code 규칙,
  그리고 전체 출력에서 "최우선 next action + literal command"는 정확히 하나 (P0-2 계약의 doctor 적용).
- 검증: attached-but-inert fixture(AGENTS 없음/legacy 블록/local 등록 미관측/약한 enforcement)
  각각의 결정적 테스트 + 기존 스위트 회귀 없음.

STEP 3 — D2 transactional attach:
- 미준비/기존 프로젝트에서 한 명령으로 준비를 끝내는 attach를 구현하되,
  bootstrap을 그대로 호출하지 마라. ph go의 transaction 패턴을 재사용하라:
  preflight 전체 완료 후 쓰기 시작, owned-path snapshot, staged temporary tree,
  generation/revalidation, 충돌 시 기존 파일 보존, 성공 시에만 publish, 실패 시 무기록.
- 동작: (a) gradle/패키지 스캔으로 profile 초안 추론(instructions infer·intake 기존 경로 재사용),
  (b) 초안 확인(비대화형 --yes), (c) AGENTS.md는 STEP 2 계약의 versioned 관리 블록으로 설치,
  (d) enforcement는 executeVerification=true만 켠다 — systemConstitution·runtimeInjection은
      절대 켜지 않는다(--strict와의 차이가 이 STEP의 존재 이유 중 하나다).
- ph --help public 명령을 4개 유지할지 attach 추가 5개로 할지 구현 전에 사용자에게 물어라.
- 이미 준비됐지만 약한 enforcement인 프로젝트의 remediation(attach --repair 또는 별도 좁은 명령)
  도 설계안으로만 제시하고 사용자 결정을 받아라.
- 검증: 실사용 1호 시나리오 재현 fixture(기존 Java 프로젝트, 준비 0)에서
  attach --yes → doctor green → go → 게이트 도달 무편집 통과를 결정적 테스트+캡처로.

STEP 4 — D1 remediation 배선:
- STEP 2에서 비워둔 doctor/go preflight의 remediation을 attach 한 줄로 연결하라.
- 약한 enforcement WARN의 remediation은 STEP 3에서 사용자가 결정한 경로로 연결하라.

STEP 5 — D5 플랫폼 정직성:
- doctor에 win32 감지 시 "미검증 플랫폼" 정직 판정 + lock identity(device/inode) 미측정 위험 한 줄.
- README/START-HERE에 지원 매트릭스: 검증 = macOS/Linux + OpenCode,
  미검증 = Windows, 어댑터 예정 = codex. Windows 지원 주장 금지.

STEP 6 — D3-A corpus 확장 + scorer (훅 코드 금지):
- 새 디렉토리를 만들지 마라. 기존 experiments/intent-detection/corpus.json 에
  신규 preregistration 버전을 추가하는 방식으로 한/영 positive·negative를 확장하라.
  실사용 1호의 "그냥 해줘" 계열을 positive로 기록하라.
- 결정적 의도 감지기(한/영 명령형 동사+코드 명사 휴리스틱, LLM 금지)와
  precision/recall scorer(미탐 가중 명시)를 experiments 안에 오프라인 도구로만 구현하라.
  runtime/플러그인 코드는 이 STEP에서 한 줄도 건드리지 마라.
- package.json files 제외를 테스트로 검증하라.

STEP 7 — D3-B 측정 → D3-C opt-in hook (측정 통과 + 사용자 승인 전 NO-GO):
- STEP 6의 감지기를 확장 corpus로 측정하고 결과를
  docs/current/entry-steering-measurement.md 초안으로 보고하라.
- 측정 기준(사전 등록): 미탐 가중 기준을 corpus 확장 전에 preregistration에 박아라.
- 기준 통과를 사용자가 확인한 뒤에만 D3-C(OpenCode 어댑터 기존 훅 지점, 첫 사용자 메시지 1회,
  features.entrySteering 기본 off, 발화/비발화 세션 로그 + doctor 조회)를 별도 수용 단위로 착수하라.
  통과 전에는 D3-C 코드를 작성하지 마라.
```
