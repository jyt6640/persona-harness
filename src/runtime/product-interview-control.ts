import {
  isProductDiscoverySuppressed,
  parseExplicitPersonaSkillCommand,
} from "./persona-shared-skill-activation.js"

const STOP_PATTERN = /^(?:stop|pause|그만|중단)$/iu
const NATURAL_STOP_PATTERN = /(?:(?:do\s+not|don't|stop|skip)\s+(?:the\s+)?(?:product\s+)?(?:discovery|interview|questions?)|(?:(?:product\s+)?(?:discovery|interview|questions?))\s+(?:is\s+)?(?:not\s+(?:needed|now)|stop|skip)|(?:제품|프로덕트)?\s*(?:탐색|인터뷰|질문)\s*(?:를|을|은|는)?\s*(?:하지\s*마(?:요|세요)?|말아(?:줘|주세요)?|그만(?:해|하자|해줘|해주세요)?|중단(?:해|하자|해줘|해주세요)?|필요\s*없(?:어|어요|습니다)?))/iu
const NON_PRODUCT_TASK_SWITCH_PATTERN = /(?:feedback[-\s]?dogfooding|dogfooding|workflow\s+finish(?:\s+implement)?|source-read-runtime-unavailable|history\s+archive|(?:피드백|이슈)\s*(?:로|을|를|에)?\s*(?:기록|남기|등록|정리)|(?:워크플로|workflow)\s*(?:finish|진단|오류)|(?:구현|리뷰)\s*보고서)/iu

export function isExplicitProductInterviewRequest(message: string): boolean {
  const command = parseExplicitPersonaSkillCommand(message)
  return command.kind === "valid" && command.skillId === "deep-interview"
}

export function isProductInterviewStop(message: string): boolean {
  return STOP_PATTERN.test(message)
    || NATURAL_STOP_PATTERN.test(message)
    || isProductDiscoverySuppressed(message)
    || NON_PRODUCT_TASK_SWITCH_PATTERN.test(message)
}
