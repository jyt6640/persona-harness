const APPROVAL_PATTERN = /^(?:승인|진행하자|시작하자|approve|proceed|go\s+ahead)$/iu
const CLARIFICATION_PATTERN = /(?:무슨\s*말|뭔\s*말|이해(?:가)?\s*안|모르겠|설명(?:해|해줘|해주세요|좀)|쉽게\s*(?:말|설명)|what\s+(?:does|do)\b.*\bmean|(?:i\s+)?(?:do\s+not|don't)\s+understand|(?:can|could)\s+you\s+explain|please\s+explain)/iu
const RECOMMEND_PATTERN = /^(?:recommend|recommendation|추천)$/iu
const STOP_PATTERN = /^(?:stop|pause|cancel|그만|중단|취소)$/iu

export function isSocraticInterviewApproval(message: string): boolean {
  return APPROVAL_PATTERN.test(message)
    || (/^[a-z]+$/iu.test(message) && isEditDistanceAtMostOne(message.toLowerCase(), "approve"))
}

export function isSocraticInterviewClarification(message: string): boolean {
  return CLARIFICATION_PATTERN.test(message)
}

export function isSocraticInterviewRecommendation(message: string): boolean {
  return RECOMMEND_PATTERN.test(message)
}

export function isSocraticInterviewStop(message: string): boolean {
  return STOP_PATTERN.test(message)
}

function isEditDistanceAtMostOne(value: string, expected: string): boolean {
  if (value === expected) return true
  if (Math.abs(value.length - expected.length) > 1) return false

  let valueIndex = 0
  let expectedIndex = 0
  let edits = 0
  while (valueIndex < value.length && expectedIndex < expected.length) {
    if (value[valueIndex] === expected[expectedIndex]) {
      valueIndex += 1
      expectedIndex += 1
      continue
    }
    edits += 1
    if (edits > 1) return false
    if (value.length > expected.length) {
      valueIndex += 1
      continue
    }
    if (value.length < expected.length) {
      expectedIndex += 1
      continue
    }
    valueIndex += 1
    expectedIndex += 1
  }
  return edits + (value.length - valueIndex) + (expected.length - expectedIndex) <= 1
}
