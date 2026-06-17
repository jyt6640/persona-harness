import { resolveFileRole } from "./file-role.js"
import type { FileRole, PendingInjection } from "./types.js"

const CLEAN_CODE_BASELINE = [
  "메서드는 하나의 의도를 가져야 한다.",
  "메서드 이름은 구현 방식이 아니라 유스케이스와 의도를 드러내야 한다.",
] as const

const ROLE_POLICIES: Record<FileRole, readonly string[]> = {
  controller: [
    "Controller는 HTTP 요청/응답 변환만 담당한다.",
    "Controller에는 비즈니스 로직을 넣지 않는다.",
    "Entity를 API 응답으로 직접 반환하지 않는다.",
    "Request/Response DTO를 명시적으로 사용한다.",
  ],
  service: [
    "Service public 메서드는 유스케이스 흐름을 표현한다.",
    "@Transactional 경계는 Service public 메서드 기준으로 둔다.",
    "Controller나 Repository 책임을 Service에 섞어 넣지 않는다.",
    "도메인 예외는 의미 있는 타입이나 에러 코드로 드러낸다.",
  ],
  repository: [
    "Repository는 영속성 접근만 담당한다.",
    "비즈니스 판단은 Repository query 조건에 숨기지 않는다.",
    "외부로 Entity 노출이 필요한지 호출 계층에서 명확히 결정한다.",
  ],
  entity: [
    "Entity는 setter를 열지 않는다.",
    "상태 변경은 의미 있는 도메인 메서드로만 한다.",
    "도메인 불변식은 Entity나 Domain 객체 안에서 지킨다.",
  ],
  domain: [
    "도메인 객체는 비즈니스 언어를 메서드 이름에 담는다.",
    "도메인 불변식은 호출자에게 떠넘기지 않는다.",
    "상태 전이는 명시적인 메서드로 표현한다.",
  ],
  "request-dto": [
    "Request DTO는 외부 입력 계약과 검증 경계를 표현한다.",
    "Request DTO가 Entity 생성 세부사항을 직접 소유하지 않게 한다.",
  ],
  "response-dto": [
    "Response DTO는 외부 출력 계약을 표현한다.",
    "Entity를 API 응답으로 직접 반환하지 않는다.",
  ],
  exception: [
    "RuntimeException을 직접 던지는 대신 의미 있는 예외 타입을 사용한다.",
    "예외는 호출자가 이해할 수 있는 에러 정책과 연결한다.",
  ],
  test: [
    "테스트 이름은 실패 조건과 기대 동작을 드러낸다.",
    "성공 케이스보다 경계와 실패 케이스를 먼저 확인한다.",
  ],
  "java-common": [
    "Java 파일에는 clean-code baseline을 항상 적용한다.",
    "역할이 애매하면 책임을 새 타입으로 분리할 수 있는지 먼저 확인한다.",
  ],
}

export function createInjectionBlock(targetFile: string): PendingInjection {
  const fileRole = resolveFileRole(targetFile)
  const policies = [...ROLE_POLICIES[fileRole], ...CLEAN_CODE_BASELINE].slice(0, 8)
  const block = [
    "[Persona Harness Injection]",
    "",
    `현재 파일: ${targetFile}`,
    `파일 역할: ${fileRole}`,
    "",
    "적용 정책:",
    ...policies.map((policy) => `- ${policy}`),
    "",
    "주의:",
    "이 Phase 0 블록은 rule-loader 결과가 아니라 hook feasibility 검증용 임시 injection이다.",
  ].join("\n")

  return {
    targetFile,
    fileRole,
    block,
  }
}
