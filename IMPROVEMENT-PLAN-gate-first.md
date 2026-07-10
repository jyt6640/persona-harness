# Persona Harness 개선안 — 게이트-중심 재정렬 (Java-first)

> 성격: 로컬 검토용 드래프트. **커밋 대상 아님.** 방향 합의용 메모이며, 확정 로드맵은 `PROJECT-PLAN.md`가 정본이다.
> 작성 근거: 이 저장소 실물 코드/설정 + OMO 소스(`~/Desktop/oh-my-openagent-dev`, v4.10.0) + attendance 실사용 관찰.
> 한 줄 요지: **OMO를 "표면 단위"가 아니라 "Core/어댑터 아키텍처 단위"로 레퍼런스한다. 앞문은 프로파일→티켓(숨김)→게이트만 남긴다.**

---

## 0. 포지셔닝 (한 문장, 한 직업)

- OMO = "에이전트를 **증폭**한다"(주입·스킬·teammode).
- PH  = "에이전트가 완료를 **못 속이게** 한다"(결정적 완료 게이트).

이 대비가 제품의 전부다. 신규 사용자가 PH가 뭔지 알려고 `MEASURED-CLAIMS`를 읽게 만들면 안 된다 — 그건 경계 문서지 첫인상 문서가 아니다.

측정으로 확인된 냉정한 사실: PH가 자랑할 수 있는 증명된 유일한 제품은 **완료 게이트 + ast-grep 컨벤션 엔진**이고, 이건 OMO에 없는 PH 고유 자산이다. 반대로 OMO에서 베낀 부분(주입·릴레이·스킬 표면)은 PH 측정이 measured-null/negative로 기각했다. 즉 **자랑할 건 OMO에서 안 온 부분이고, OMO에서 온 부분은 자랑 못 한다.** 개선의 방향은 여기서 도출된다.

---

## 1. 단일 진입점 — split/next/finish를 사용자가 몰라도 되게

### 문제
지금 사용자는 `init → bootstrap → intake → implement → split → next → finish` 7개 명령의 존재와 순서를 알아야 가치가 나온다. attendance 프로젝트 실사에서 backlog가 빈 채 리포트만 채워져 있었다 = 직전 세션이 `split`을 건너뛰고 바로 구현했다는 증거(문제 재현). `docs/START-HERE.md`에 "에이전트가 티켓을 건너뛰면"이 이미 트러블슈팅으로 존재 = 기본 경로가 사용자를 오도한다는 자백.

### 설계 — 자동화 대상은 딱 하나, "레일 진입"
진입만 자동이면 그 뒤(split→next→…→finish)는 레일이 알아서 시킨다. 3층으로 나눈다.

1. 사용자 표면 = 자연어 하나. "출근 정정 API 추가해줘".
2. 진입 스티어링(가벼움). **기본 배선은 훅이다**: OMO식 `UserPromptSubmit` 훅이 "구현 의도"를 감지해 레일 진입을 유도한다. `ph go "<목표>"` 래퍼(capture→split→next→레일출력 한 방)는 훅이 놓쳤을 때의 **수동 폴백**이다. 근거: finish 게이트는 레일에 진입한 세션에만 작동하는데, attendance 실패가 바로 "진입 안 함"이었다 — 훅이 없으면 게이트는 제일 필요한 세션(아무 생각 없이 "해줘")에서 도달 불가능한 기능이 된다.
3. 하부 파이프(티켓·리포트·게이트)는 그대로 두되 **사용자에게 안 보인다.** split/next/finish라는 단어를 평생 몰라도 된다.

### 핵심 원칙
- 진입 주입은 "가볍게"(스티어링만, 세션당 O(1)). 이게 measured-negative였던 무거운 콘텐츠 주입과 선을 긋는 지점이다. 정체성/철학은 정적 AGENTS.md로(rail-entry 10/10 검증됨).
- **훅은 강제가 아니라 스티어링.** 발화해도 레일 진입을 하드하게 강제하지 않고 "구현 의도로 보임 — 레일로 진입하라" 지시 한 줄만 주입한다. 오탐(질문을 구현으로 오인)이 나도 에이전트가 맥락 보고 무시할 수 있어 오발 비용이 ~0. 이 덕분에 감지 기준은 다소 공격적으로 잡아도 된다.
- **미탐이 오탐보다 아프다.** 오탐은 짜증이지만 미탐은 attendance 버그의 재현이다. 감지 기준 평가 시 "구현 의도인데 안 잡은 케이스"를 더 무겁게 센다.
- **발화 로그 필수.** 세션마다 훅 발화/비발화와 근거를 기록해 rail-entry처럼 실세션 정밀도를 사후 측정 가능하게 한다. 이게 있어야 "measured-negative 주입과 선을 그었다"를 측정 규율대로 증명할 수 있다.
- 게이트가 막을 때의 UX가 승부처. `finish`가 블로커를 뱉으면 raw로 던지지 말고 **다음 할 일 하나 + 정확한 해결 명령**을 평문으로. PH엔 이미 `workflow closure next --json`과 `workflow continue`가 그 "다음 한 걸음"을 계산한다 → 진입점에 배선하면 게이트가 벽이 아니라 안내가 된다. 이 블로커 렌더링은 `ph go` 없이도 `finish` 출력에 독립 적용 가능하므로 STEP 1과 병행해도 된다.

### 가시성 사다리 — "검증되면 숨긴다"
OMO는 검증 여부와 무관하게 전부 훅 뒤에 숨긴다(그래서 inert 껍데기가 보이지 않게 쌓인다). PH는 반대로 전부 명령으로 노출한다(그래서 학습 곡선이 제품을 죽인다). 둘 다 극단이고, 원칙은 **가시성이 검증 단계를 따라간다**:

| 검증 상태 | 표면 |
| --- | --- |
| 미검증 | 명시적 명령으로만 (측정 가능하게 밖에 둠) |
| measured-positive | 훅으로 내재화 (사용자 표면에서 사라짐, 발화 로그로 관측성 유지) |
| measured-negative | 서랍 (§2) |

컨벤션의 warn→block 승격 사다리와 같은 모양이다. 지금 내재화 자격이 있는 건 rail-entry(10/10) 하나 = 의도 감지 훅이 첫 내재화 사례. "숨긴다"는 **호출을 숨기는 것**(사용자가 명령 안 침)이지 **동작을 숨기는 것**(뭐가 왜 발화했는지 알 수 없음)이 아니다 — 후자는 OMO가 치르는 디버깅 비용이며 따라가지 않는다(`ph doctor`에서 세션별 훅 발화 내역 조회 가능하게). **영구 예외 하나: 게이트의 판정 순간은 검증돼도 절대 숨기지 않는다.** "완료가 막혔다 + 다음 한 걸음"은 사용자가 보는 제품 그 자체다.

### 청중 3층 분리 — OMO에서 가져올 진짜 교훈
OMO 대비 PH의 결함은 명령 개수(사람 기준 ~40 vs 1~2)가 아니라 **청중 미구분**이다. OMO는 사람=install 한 번, 에이전트=훅 내부, 개발 인프라=비노출로 깨끗이 갈라져 있는데, PH는 셋이 한 usage 화면에 섞여 있다. 특히 evidence 계열(측정 인프라)이 사용자 문서에 노출된 건 순수 소음이다. 재편:

| 청중 | 명령 | 노출 |
| --- | --- | --- |
| 사람 | `init`, `go`, `doctor` | `ph --help` (이것만) |
| 에이전트 레일 | `workflow *`, `observe`, `bearshell` | `ph workflow --help` |
| PH 개발자(측정 인프라) | `evidence *`, `smoke`, `feedback`, `review backend-shape`, `workflow ralph-loop/role-boundary` | `ph dev --help` 네임스페이스로 격리 |

에이전트-facing API로서 명령이 많은 건 죄가 아니다(에이전트는 usage를 읽는다). 죄는 그게 사람 문서에 사람 명령인 척 나열된 것이다. 단, OMO에서 가져오면 안 되는 것도 명시: **게이트까지 마법으로 만들지 않는다** — OMO 훅은 증폭이라 조용히 실패해도 되지만 PH 게이트는 막는 순간이 제품이라 명시적이어야 한다.

---

## 2. inert 표면 실사 — 접을 것 / 남길 것

원칙: **(a) OMO 복사본이면서 (b) report-only거나 default-off거나 measured-negative인 것**은 기본(앞문) 표면에서 내려 `advanced/experimental` 네임스페이스로. 삭제가 아니라 앞문에서 치우는 것.

### 실제 활성 상태 (2026-07 실사) — 런타임은 이미 대부분 꺼져 있다

중요한 정정: "공유 스킬을 꺼라"는 이미 상당 부분 되어 있다. 실물 근거:

- **배포 패키지가 이미 스트립함.** `package.json`의 `files`는 공유 스킬 중 `packages/shared-skills/skills/programming/SKILL.md`, `programming/references/java`(오직 java — go/rust/python/typescript 레퍼런스는 미포함), `packages/shared-skills/skills/workflow`만 싣는다. `frontend`,`visual-qa`,`ultraresearch`,`ulw-plan`,`remove-ai-slops`,`start-work` 등은 npm 패키지에 아예 들어가지 않는다.
- **런타임 주입 게이팅.** `dist/runtime/hooks.js`의 `hasEnabledSharedSkillDomain` + `runtimeInjection`(기본 OFF) + `backend` 도메인이 모두 참일 때만 공유 스킬이 주입된다. `runtimeInjection`이 기본 OFF라 **기본 설정에서는 공유 스킬 주입이 아예 발화하지 않는다.**
- **enabledDomains.** `harness.jsonc`는 `["backend","programming","workflow"]`만 활성. `frontend` 등은 애초에 라우팅 대상이 아니다.

결론: 사용자 관찰대로 **실질적으로 programming(java) 하나만 살아 있고 나머지는 이미 꺼짐/미배포**다. 따라서 §2의 작업은 "런타임에서 끄기"가 아니라 **소스·에이전트·문서에 남은 죽은 표면 정리**다. 배포 패키지가 이미 이 방향에 동의하고 있다 = 좋은 신호이자, 나머지도 같은 기준으로 밀면 된다는 근거.

### 그래서 진짜 정리 대상 (런타임 아님, 표면/소스/문서)

| 어디 | 지금 상태 | 할 일 |
| --- | --- | --- |
| 소스 레포 `references/{go,rust,python,typescript,rust-ub}` | 배포엔 빠졌지만 소스엔 그대로 | Java 팩 확정 전까지 보류 서랍으로 격리(다언어 팩 착수 시 부활) |
| `.persona/rules/diff-rules/` (28개 md) | 개인지침인데 `files`에 실리고 init이 통째 복사. **런타임 참조 0건**(rule-loader는 backend/clean-code만 화이트리스트). `diff-rules-classification.md` 스스로 reference-only 선언 | `files`와 init 복사에서 제거, `references/diff-rules/`만 유지. 제품 진입은 승격 파이프라인([게이트 가능]→§5 컨벤션, [전달 전용]→dedup 후 role rules)으로만 |
| `.opencode/opencode.json` 릴레이 에이전트(test-writer/implementer/reviewer) | 기본 bootstrap이 심을 수 있음 | preview 라벨, 기본 앞문에서 제외(§1의 진입점과 무관) |
| README/docs가 스킬·릴레이·MCP를 "기능"처럼 나열 | 첫인상 오염 | advanced 페이지로 이동(§3) |
| 40-모듈 런타임 지도 | 대부분 report-only/off인데 문서로 노출 | 내부 구현 세부로 내리고 앞문 비노출 |

즉 "끄는" 작업은 거의 끝났고, 남은 건 **"안 보이게 + 안 실리게 + 안 광고하게"** 하는 표면·문서 정리다.

### 접거나 숨길 것

| 대상 | 이유 | 처리 |
| --- | --- | --- |
| 공유 스킬 다수(`frontend`,`visual-qa`,`ultraresearch`,`ultimate-browsing`,`ulw-plan`,`remove-ai-slops`,`start-work`) | OMO 복사본, Java/Spring 게이트에 하중 없음 | opt-in 서랍 |
| Role Checklist Relay / `multiAgent` | 서브에이전트 위임 실관측 0 | preview 라벨, 앞문 금지 |
| runtime injection / system-constitution | measured-negative | 측정-게이팅 실험으로만 |
| idle-continuation | 실세션 사망 | 접기 |
| ralph-loop / workflow loop | cap, fixture-only | advanced |
| code-nav / lsp / codegraph preview | 정직한 unavailable 유지하되 앞문 아님 | advanced |
| report-only 워크플로우 레일 5종 | 게이트 비직결 | requirements(티켓 레일)만 남기고 병합·축소 |

### 남길 것 (진짜 코어 6)

1. `finish` 게이트 + closure 상태머신
2. 티켓 라이프사이클 (단, 진입점 뒤로 숨김)
3. evidence + `executeVerification`
4. **ast-grep 컨벤션 엔진** (`controller.repository-dependency` block 등 — OMO에 없는 PH 고유 차별점)
5. bearshell
6. project-profile + `instructions infer` (기존 프로젝트 온보딩)

한 줄: **앞문에 남는 건 "프로파일(자동) → 티켓(숨김) → 게이트"뿐.** 나머지 OMO 표면은 다 advanced 서랍으로.

---

## 3. QUICK-DEMO / 온보딩 — "게이트 1개" 중심

### 새 온보딩 = 3박자, 한 개념
1. 한 명령으로 설치+attach.
2. 사용자가 증거 없이 "완료해" → **게이트가 평문 사유로 막음**(이 순간이 제품의 전부).
3. 단일 진입점으로 진짜 작업 → 게이트 통과.

이 세 장면이 "AI가 '다 됐다'고 거짓말 못 하게 한다" 하나만 각인시킨다. `QUICK-DEMO`가 이미 "몇 분 안에 완료가 막히는 걸 본다"고 약속하니, 그걸 **첫 경험의 전부**로.

앞문에서 뺄 것: 스킬 라이브러리, 릴레이, 주입, MCP preview, 40-모듈 지도 → 전부 advanced 페이지. 신규 경로는 딱 세 단어만: 프로파일(자동), 진입 명령 하나, 게이트.

---

## 4. 다언어 확장 — Core/어댑터 아키텍처 (OMO 소스가 정답지)

받아온 OMO 소스는 지금 "Multi-Harness Agent OS Refactor"(OpenCode/Codex/Pi) 중이고, 이미 **언어·호스트 중립 Core-18 + 어댑터 2개**(`omo-opencode`=Ultimate, `omo-codex`=Light/LazyCodex) 구조다. 그리고 "세팅이 무겁다"는 피드백에 **경량 에디션 + 설치 한 방**으로 답했다 — PH가 지금 겪는 문제와 동일, 답도 동일.

PH도 같은 층위로 레퍼런스한다:

- `PH-core` (언어·호스트 중립): 게이트, closure 상태머신, 워크플로우/티켓, evidence, 단일 진입점.
- 호스트 어댑터: `ph-opencode`(플러그인·훅), `ph-codex`(경량).
- 언어 팩: `pack-java-spring`(첫 팩) → 이후 `pack-python`, `pack-ts`.

규칙·컨벤션·observer·stack-alignment는 전부 **언어 팩**으로 내려가고, 코어와 정체성("완료를 못 속인다")은 언어가 바뀌어도 불변. **표면을 베끼면 inert 껍데기가 쌓이고, 구조를 베끼면 다언어 확장이 공짜로 따라온다.**

---

## 5. Java-first 구체화 — Iron List → 게이트 컨벤션 매핑 (핵심)

"구체화 하나 해두면 추상화는 쉽다"의 그 구체화가 바로 이것. 당신이 작성한 `packages/shared-skills/skills/programming/references/java/`의 **Iron List 16규칙**(`README.md`)과 no-excuse fixture가, PH의 ast-grep 컨벤션 엔진이 강제할 **게이트 명세**다. 스킬(전달)과 컨벤션(강제)은 같은 규칙의 두 반쪽이고, PH의 차별점은 **Iron List를 결정적 게이트로 바꾸는 것**이다.

이미 연결된 것(증거):

- Iron List 13 "프레임워크는 edge에" ↔ 컨벤션 `controller.persistence-import`, fixture `domain-framework-import`.
- Iron List 14 "4레이어 패키지(presentation/application/domain/infrastructure)" ↔ 컨벤션 `presentation.request-dto-record`/`response-dto-record`, attendance 실제 레이어와 일치.
- 가짜 gradle-shim 금지(java/README) ↔ `finish`의 `stack-alignment-mismatch` 블로커("remove fake gradle-shim.js").
- no-excuse fail fixtures(`broad-catch`,`empty-catch`,`field-injection`,`mutable-static`,`optional-get`,`raw-type`,`setter`,`vague-name`,`printstacktrace`) ↔ **아직 게이트化 안 됨** = 다음 컨벤션 승격 후보.

제안: Iron List 각 규칙에 "게이트 상태"를 붙인 매트릭스를 만든다.

| Iron List 규칙 | 현재 게이트 상태 | 승격 후보 |
| --- | --- | --- |
| 13 no framework import in domain | 컨벤션 warn 존재 | block 승격(정밀도 확인 후) |
| 14 four-layer package | 컨벤션 warn 존재 | 유지/승격 |
| 8 no raw types | fixture만 존재 | ast-grep 컨벤션化 |
| 9 no unsafe Optional.get | fixture만 존재 | ast-grep 컨벤션化 |
| 11 no broad catch | fixture만 존재 | ast-grep 컨벤션化(no-excuse-ok 주석 예외 지원) |
| 12 no mutable static | fixture만 존재 | ast-grep 컨벤션化 |
| 6 no public setter | fixture만 존재 | 정밀도 검토 후 |

이 매트릭스가 완성되면 언어 팩의 형태가 정의된다: **팩 = Iron List(전달) + fixtures(적대 테스트) + ast-grep 컨벤션(게이트).** Python/TS 팩도 같은 삼각형만 채우면 되므로, 추상화(다언어)가 자동으로 쉬워진다.

주의(측정 규율): warn→block 승격은 "지금 켜기"가 아니라 "며칠 warn 관찰 후 오탐 없는 정밀 규칙만 승격". 저정밀 규칙을 하드 블록으로 만들지 않는다(java/README의 rule strength 원칙과 동일).

---

## 6. 착수 순서 (제안)

1. **Java-first 구체화 먼저.** §5 Iron List→게이트 매트릭스를 채우고, no-excuse fixture 중 정밀한 3~4개를 ast-grep 컨벤션으로 승격(warn) → attendance에서 오탐 관측.
2. **단일 진입점 프로토타입.** 의도 감지 훅(기본 배선, 스티어링만, 발화 로그) + `ph go "<목표>"` 래퍼(수동 폴백, capture→split→next→레일 자동 연결) + 게이트 블로커를 `closure next` 평문으로 렌더(이것만은 STEP 1과 병행 가능).
3. **표면 실사 적용.** §2 표대로 앞문/advanced 분리(삭제 아님).
4. **온보딩 재작성.** §3 3박자로 QUICK-DEMO 재구성.
5. **추상화(Core/어댑터 분리)는 마지막.** Java 팩이 삼각형(전달+fixture+게이트)으로 구체화된 뒤에 Core 경계를 뽑는다.

> 원칙 유지: 신규 강제/기본값 변경은 측정 근거 + 릴리스 결정으로만(`PROJECT-PLAN.md` 3장). 이 문서는 방향 메모이며 어떤 기본값도 바꾸지 않는다.

---

## 7. 실행 프롬프트 (에이전트에게 그대로 주는 것)

아래를 복사해서 에이전트에게 준다. 이 문서(`IMPROVEMENT-PLAN-gate-first.md`)를 스펙으로 삼아 §6 순서대로 실행하게 한다. Java-first 구체화가 끝나기 전에는 추상화(Core/어댑터)로 넘어가지 않는다.

```text
먼저 이 저장소 루트의 IMPROVEMENT-PLAN-gate-first.md 전체를 bearshell로 읽고, 그걸 이번 작업의 스펙으로 삼아라. 어떤 기본값(harness.jsonc의 enforce/features/conventions 레벨)도 내 명시 승인 없이 바꾸지 마라. 커밋도 하지 마라(stage + 초안 메시지까지만, 최종 커밋은 내 승인).

순서는 문서 §6을 그대로 따른다. 각 단계는 티켓 하나로 쪼개고, 근거는 실제 파일 file:line으로만 대라. 추측 금지.

STEP 1 — Java-first 구체화 (가장 먼저, 이것이 끝나기 전엔 다음 단계 착수 금지):
- packages/shared-skills/skills/programming/references/java/README.md 의 Iron List 16규칙을 전부 읽어라.
- packages/shared-skills/skills/programming/fixtures/java/no-excuse/ 의 fail/pass fixture를 전부 읽어라.
- .persona/conventions/*.yml 와 harness.jsonc conventions 로 지금 게이트化된 규칙을 확인해라.
- 산출물: docs/current/java-ironlist-gate-matrix.md 에 "Iron List 규칙 | 현재 게이트 상태(none/fixture-only/warn/block) | 승격 후보(y/n) | 근거 file:line" 표를 만들어라.
- 그 표에서 정밀도가 확실한(오탐 위험 낮은) fixture 3~4개만 골라 .persona/conventions/ 에 ast-grep 컨벤션으로 추가하되 레벨은 warn 으로만. block 승격은 절대 이번에 하지 마라.
- 검증: /Users/yongtae/Desktop/attendance 에서 그 warn 컨벤션을 observe로 돌려 오탐이 나오는지 기록해라(ph observe --json). 오탐 나오면 그 규칙은 후보에서 빼고 보고해라.

STEP 2 — 단일 진입점 프로토타입 (훅 = 기본 배선, go = 수동 폴백):
- 문서 §1의 3층 설계대로, capture→split→next→레일출력을 한 방에 하는 래퍼(ph go "<목표>")와 UserPromptSubmit 의도 감지 훅을 같이 구현하되, 래퍼는 훅이 발화했을 때 실행되는 공통 경로로 두어라. 훅이 기본 배선이고 go는 훅이 놓쳤을 때의 수동 폴백이다.
- 훅은 스티어링만 한다: 레일 진입을 강제하지 말고 "구현 의도로 보임 — 레일로 진입하라" 지시 한 줄 주입까지만. 발화/비발화와 그 근거를 세션별로 로그에 남기고, ph doctor에서 조회 가능하게 해라.
- finish 블로커를 raw로 던지지 말고 workflow closure next / workflow continue 결과를 평문 "다음 할 일 하나 + 해결 명령"으로 렌더해라. (이 렌더링은 STEP 1과 병행 가능.)
- 검증: attendance에서 "티켓 몰라도 자연어 하나로 진입→게이트까지" 흐름이 도는지 실제로 태워보고 캡처해라. 훅 감지 평가는 미탐(구현 의도인데 안 잡음)을 오탐보다 무겁게 세라.

STEP 3 — 표면/문서 정리 (런타임 끄기 아님):
- 문서 §2 "진짜 정리 대상" 표대로, 소스 references/{go,rust,python,typescript,rust-ub} 격리, .opencode 릴레이 에이전트 preview 라벨, README/docs의 스킬·릴레이·MCP를 advanced 페이지로 이동. 삭제 아님, 앞문에서만 치움.
- diff-rules 배포 중단: package.json files에서 .persona/rules/diff-rules 제거 + init의 rules 통째 복사에서 diff-rules 제외. 콘텐츠 삭제 아님 — references/diff-rules/ 원본은 유지하고, 제품 진입은 classification 문서의 승격 파이프라인으로만. 이미 init으로 심어진 프로젝트의 잔존 파일 처리 방침(doctor 안내 등)도 한 줄 정해라.

STEP 4 — 온보딩 재작성:
- 문서 §3의 3박자로 QUICK-DEMO를 "게이트 1개" 중심으로 다시 써라. 신규 경로엔 프로파일(자동)·진입 명령 하나·게이트만 노출.

STEP 5 — 추상화(맨 마지막):
- Java 팩이 "Iron List(전달)+fixture(적대 테스트)+ast-grep 컨벤션(게이트)" 삼각형으로 구체화된 뒤에만, 문서 §4의 PH-core/어댑터/언어팩 경계를 뽑는 설계안을 docs에 초안으로 작성해라(구현은 별도 승인).

각 STEP 끝나면: 무엇을 바꿨는지 + 근거 file:line + 검증 증거(observe/QA 캡처 경로)를 보고하고 멈춰라. 다음 STEP은 내 확인 후 진행한다. finish/게이트를 약화시키거나, 저정밀 규칙을 block으로 올리거나, 측정 없이 기본값을 바꾸는 건 금지다.
```

> 이 프롬프트는 문서의 방향을 실행 지시로 옮긴 것일 뿐, 그 자체로 어떤 기본값도 바꾸지 않는다. 실제 변경은 각 STEP의 티켓·게이트·측정을 거친다.
