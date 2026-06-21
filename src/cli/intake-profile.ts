export type ProjectProfileQuestion = {
  readonly id: string
  readonly prompt: string
  readonly choices: readonly string[]
  readonly answer: string | null
}

export type ProjectProfile = {
  readonly schema: "persona.project-profile.v1"
  readonly status: "draft"
  readonly scope: {
    readonly role: "backend"
    readonly mvp: "java-spring-clean-code"
    readonly productized: false
  }
  readonly defaults: {
    readonly language: "java"
    readonly framework: "spring"
    readonly buildTool: "gradle"
    readonly testPolicy: "deferred"
  }
  readonly questions: readonly ProjectProfileQuestion[]
  readonly notes: {
    readonly project: string | null
  }
  readonly philosophy: {
    readonly company: null
    readonly personal: null
    readonly project: null
    readonly priority: readonly [
      "project-specific",
      "company/team",
      "personal",
      "clean-code-baseline",
      "framework-default",
    ]
  }
  readonly next: readonly string[]
}

type IntakeChoice = {
  readonly value: string
  readonly label: string
}

export type IntakeQuestionDefinition = {
  readonly id: string
  readonly prompt: string
  readonly choices: readonly IntakeChoice[]
  readonly recommended: string
}

export const PROFILE_PATH = ".persona/project-profile.jsonc"

export const INTAKE_QUESTIONS: readonly IntakeQuestionDefinition[] = [
  {
    id: "user-language",
    prompt: "사용자와 agent가 주로 사용할 언어는 무엇인가요?",
    choices: [
      { value: "ko", label: "한국어" },
      { value: "en", label: "English" },
      { value: "ja", label: "日本語" },
      { value: "zh-cn", label: "简体中文" },
      { value: "recommend", label: "추천값 사용" },
    ],
    recommended: "ko",
  },
  {
    id: "project-context",
    prompt: "이 프로젝트는 어떤 맥락에 가깝나요?",
    choices: [
      { value: "solo", label: "개인 프로젝트" },
      { value: "team", label: "팀 프로젝트" },
      { value: "company", label: "회사/조직 프로젝트" },
      { value: "open-source", label: "오픈소스 프로젝트" },
      { value: "learning", label: "학습 목적" },
      { value: "recommend", label: "추천값 사용" },
    ],
    recommended: "solo",
  },
  {
    id: "project-goal",
    prompt: "이 프로젝트의 목적은 어느 쪽에 가깝나요?",
    choices: [
      { value: "prototype", label: "빠른 검증" },
      { value: "production-service", label: "실제 운영 서비스" },
      { value: "study", label: "학습/미션" },
      { value: "internal-tool", label: "내부 도구" },
      { value: "portfolio", label: "포트폴리오" },
      { value: "recommend", label: "추천값 사용" },
    ],
    recommended: "production-service",
  },
  {
    id: "project-scale",
    prompt: "프로젝트 규모와 생명주기는 어느 쪽인가요?",
    choices: [
      { value: "throwaway", label: "버려도 되는 짧은 실험" },
      { value: "small", label: "작은 서비스" },
      { value: "medium", label: "중간 규모 이상으로 확장 가능" },
      { value: "long-lived", label: "오래 유지보수할 서비스" },
      { value: "recommend", label: "추천값 사용" },
    ],
    recommended: "small",
  },
  {
    id: "application-type",
    prompt: "애플리케이션 형태는 어떤 쪽인가요?",
    choices: [
      { value: "rest-api", label: "REST API" },
      { value: "mvc-web", label: "Spring MVC 웹 애플리케이션" },
      { value: "batch", label: "batch/job 중심" },
      { value: "library", label: "라이브러리/모듈" },
      { value: "mixed", label: "여러 형태 혼합" },
      { value: "recommend", label: "추천값 사용" },
    ],
    recommended: "rest-api",
  },
  {
    id: "storage",
    prompt: "데이터 저장 방식은 어떤 쪽인가요?",
    choices: [
      { value: "none", label: "저장소 없음" },
      { value: "in-memory", label: "서버 실행 중만 유지" },
      { value: "file", label: "파일 기반 저장" },
      { value: "database", label: "DB 사용" },
      { value: "external-api", label: "외부 API/서비스가 source of truth" },
      { value: "mixed", label: "여러 저장 방식 혼합" },
      { value: "recommend", label: "추천값 사용" },
    ],
    recommended: "database",
  },
  {
    id: "persistence-technology",
    prompt: "영속성 기술은 어떤 쪽을 원하나요?",
    choices: [
      { value: "not-needed", label: "현재 필요 없음" },
      { value: "jdbc-template", label: "JdbcTemplate" },
      { value: "jpa", label: "JPA" },
      { value: "mybatis", label: "MyBatis" },
      { value: "custom", label: "직접 구현/특수 저장소" },
      { value: "recommend", label: "추천값 사용" },
    ],
    recommended: "jdbc-template",
  },
  {
    id: "migration-style",
    prompt: "DB schema/migration 방식은 어떤 쪽인가요?",
    choices: [
      { value: "schema.sql", label: "Spring Boot schema.sql" },
      { value: "flyway", label: "Flyway" },
      { value: "liquibase", label: "Liquibase" },
      { value: "none", label: "DB는 쓰지만 migration 도구는 안 씀" },
      { value: "not-needed", label: "DB/persistence 자체가 필요 없음" },
      { value: "recommend", label: "추천값 사용" },
    ],
    recommended: "flyway",
  },
  {
    id: "package-style",
    prompt: "패키지를 무엇 기준으로 나눌까요?",
    choices: [
      { value: "simple-mvc", label: "작은 프로젝트용 Controller/Service/Repository 중심" },
      { value: "layer-first", label: "presentation/application/domain/infrastructure를 상위 layer로 분리" },
      { value: "domain-first", label: "domain/module 아래 presentation/application/domain/infrastructure" },
      { value: "feature-first", label: "feature 단위로 묶고 내부에서 필요한 계층 분리" },
      { value: "recommend", label: "추천값 사용" },
    ],
    recommended: "domain-first",
  },
  {
    id: "architecture-style",
    prompt: "선택한 패키지 구조 안에서 내부 계층은 어떻게 나눌까요?",
    choices: [
      { value: "simple-layered", label: "단순 layer 구조" },
      { value: "clean-architecture-light", label: "가벼운 Clean Architecture" },
      { value: "hexagonal-light", label: "가벼운 port/adapter 구조" },
      { value: "strict-clean-architecture", label: "엄격한 Clean Architecture" },
      { value: "recommend", label: "추천값 사용" },
    ],
    recommended: "clean-architecture-light",
  },
  {
    id: "boundary-strictness",
    prompt: "계층/DTO/검증 경계는 어느 정도로 엄격하게 가져갈까요?",
    choices: [
      { value: "lightweight", label: "작은 프로젝트 기준으로 최소 경계만" },
      { value: "pragmatic", label: "외부 request/response는 분리하고 내부는 필요할 때 분리" },
      { value: "strict", label: "request/response, command/result, validation, layer boundary를 엄격히 분리" },
      { value: "recommend", label: "추천값 사용" },
    ],
    recommended: "strict",
  },
] as const

export function createBackendProfile(
  answers: ReadonlyMap<string, string> = new Map<string, string>(),
  projectNote: string | null = null,
): ProjectProfile {
  return {
    schema: "persona.project-profile.v1",
    status: "draft",
    scope: {
      role: "backend",
      mvp: "java-spring-clean-code",
      productized: false,
    },
    defaults: {
      language: "java",
      framework: "spring",
      buildTool: "gradle",
      testPolicy: "deferred",
    },
    questions: INTAKE_QUESTIONS.map((question) => ({
      id: question.id,
      prompt: question.prompt,
      choices: question.choices.map((choice) => choice.value),
      answer: answers.get(question.id) ?? null,
    })),
    notes: {
      project: projectNote,
    },
    philosophy: {
      company: null,
      personal: null,
      project: null,
      priority: ["project-specific", "company/team", "personal", "clean-code-baseline", "framework-default"],
    },
    next: [
      "Run npx ph plan.",
      "Review .persona/workflow/plan.md before implementation.",
      "Ask the agent to implement only after the plan is accepted.",
    ],
  }
}
