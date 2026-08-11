import { isDeepStrictEqual } from "node:util"

const SCHEMA_VERSION = "opencode-interview-observation.1"
const MAX_EVENTS = 2_048
const MAX_IDENTIFIER_LENGTH = 512
const MAX_TEXT_LENGTH = 16_384
const APPROVAL_RESPONSES = new Set(["once", "always"])

const SAFE_EVENT_TYPES = new Set([
  "command.executed",
  "file.edited",
  "file.watcher.updated",
  "message.part.removed",
  "message.part.updated",
  "message.removed",
  "message.updated",
  "permission.replied",
  "session.compacted",
  "session.diff",
  "session.idle",
  "session.status",
  "tool.execute.after",
  "tool.execute.before",
])

const MUTATION_EVENT_TYPES = new Set([
  "command.executed",
  "file.edited",
  "file.watcher.updated",
  "session.diff",
  "tool.execute.after",
  "tool.execute.before",
])

const COMMAND_PATTERN = /`[^`]*`|(?:^|\s)(?:bash|command|curl|git|npm|npx|run|shell|execute)\b/iu
const FILE_CHANGE_PATTERN = /(?:\b(?:add|change|create|delete|edit|modify|remove|update|write)\b.*\b(?:file|source|screen|component)\b|(?:src|app|components|pages|routes)\/|\.(?:c|cc|cpp|go|java|js|jsx|mjs|py|rs|ts|tsx|vue)\b)/iu
const PLAN_PATTERN = /\b(?:next step|plan|roadmap|step \d|steps)\b/iu
const SOLUTION_PATTERN = /\b(?:build|implement|implementation|recommend|solution|use|here(?:'s| is))\b/iu

export const OPENCODE_INTERVIEW_OBSERVATION_SCHEMA_VERSION = SCHEMA_VERSION

export function evaluateOpenCodeInterviewObservation(value) {
  if (!isObservation(value)) {
    return blocked("observation-schema-invalid", false)
  }

  const state = {
    approved: false,
    assistantMessageID: undefined,
    assistantPartIDs: new Set(),
    assistantTextParts: new Map(),
    messageRoles: new Map(),
    preApprovalNoMutation: true,
    sessionID: undefined,
  }

  for (const event of value.events) {
    const code = consumeEvent(event, state)
    if (code !== undefined) {
      return blocked(code, state.preApprovalNoMutation)
    }
  }

  if (state.assistantMessageID === undefined) {
    return result("blocked", "assistant-response-missing", state)
  }

  const response = [...state.assistantTextParts.values()].join(" ").trim()
  const responseCode = classifyAssistantResponse(response)
  if (responseCode !== "ready") {
    return result("blocked", responseCode, state)
  }

  return result(
    state.preApprovalNoMutation ? "passed" : "blocked",
    state.preApprovalNoMutation ? "ready" : "pre-approval-mutation",
    state,
    responseCode === "ready",
  )
}

function consumeEvent(event, state) {
  const type = event.type
  const properties = event.properties

  if (type === "message.updated") {
    const info = properties.info
    if (!isBoundIdentifier(info.id) || !isBoundIdentifier(info.sessionID) || !isRole(info.role)) {
      return "observation-schema-invalid"
    }
    const sessionCode = bindSession(info.sessionID, state)
    if (sessionCode !== undefined) return sessionCode
    if (info.role === "assistant") {
      if (state.assistantMessageID !== undefined && state.assistantMessageID !== info.id) {
        return "multiple-assistant-responses"
      }
      state.assistantMessageID = info.id
    }
    state.messageRoles.set(info.id, info.role)
    return undefined
  }

  if (type === "message.part.updated") {
    const part = properties.part
    if (!isBoundIdentifier(part.id) || !isBoundIdentifier(part.sessionID) || !isBoundIdentifier(part.messageID)) {
      return "observation-schema-invalid"
    }
    const sessionCode = bindSession(part.sessionID, state)
    if (sessionCode !== undefined) return sessionCode
    const role = state.messageRoles.get(part.messageID)
    if (role === undefined) {
      return "assistant-response-order-invalid"
    }
    if (part.type === "text") {
      if (typeof part.text !== "string" || part.text.length > MAX_TEXT_LENGTH) {
        return "observation-schema-invalid"
      }
      if (role === "assistant") {
        if (state.assistantMessageID !== part.messageID) {
          return "assistant-response-order-invalid"
        }
        state.assistantPartIDs.add(part.id)
        state.assistantTextParts.set(part.id, part.text)
      }
      return undefined
    }
    if (role === "assistant" && (part.type === "tool" || part.type === "patch")) {
      return recordMutation(state)
    }
    return undefined
  }

  if (type === "permission.replied") {
    if (!isBoundIdentifier(properties.sessionID) || !isBoundIdentifier(properties.permissionID)) {
      return "observation-schema-invalid"
    }
    const sessionCode = bindSession(properties.sessionID, state)
    if (sessionCode !== undefined) return sessionCode
    if (typeof properties.response !== "string") {
      return "observation-schema-invalid"
    }
    if (APPROVAL_RESPONSES.has(properties.response)) {
      state.approved = true
    }
    return undefined
  }

  if (MUTATION_EVENT_TYPES.has(type)) {
    if (type === "file.edited" || type === "file.watcher.updated") {
      if (!isRecord(properties) || typeof properties.file !== "string" || properties.file.length > MAX_TEXT_LENGTH) {
        return "observation-schema-invalid"
      }
    } else if (!isBoundIdentifier(properties.sessionID)) {
      return "observation-schema-invalid"
    } else {
      const sessionCode = bindSession(properties.sessionID, state)
      if (sessionCode !== undefined) return sessionCode
    }
    return recordMutation(state)
  }

  if (type === "session.status" || type === "session.idle" || type === "session.compacted") {
    if (!isBoundIdentifier(properties.sessionID)) {
      return "observation-schema-invalid"
    }
    const sessionCode = bindSession(properties.sessionID, state)
    if (sessionCode !== undefined) return sessionCode
    return undefined
  }

  if (type === "message.part.removed") {
    if (!isBoundIdentifier(properties.sessionID) || !isBoundIdentifier(properties.messageID) || !isBoundIdentifier(properties.partID)) {
      return "observation-schema-invalid"
    }
    const sessionCode = bindSession(properties.sessionID, state)
    if (sessionCode !== undefined) return sessionCode
    return undefined
  }

  if (type === "message.removed") {
    if (!isBoundIdentifier(properties.sessionID) || !isBoundIdentifier(properties.messageID)) {
      return "observation-schema-invalid"
    }
    const sessionCode = bindSession(properties.sessionID, state)
    if (sessionCode !== undefined) return sessionCode
    return undefined
  }

  if (type === "session.diff") {
    return "observation-schema-invalid"
  }

  return "observation-event-invalid"
}

function recordMutation(state) {
  if (!state.approved) {
    state.preApprovalNoMutation = false
    return "pre-approval-mutation"
  }
  return undefined
}

function bindSession(sessionID, state) {
  if (state.sessionID === undefined) {
    state.sessionID = sessionID
    return undefined
  }
  return state.sessionID === sessionID ? undefined : "foreign-event"
}

function classifyAssistantResponse(text) {
  if (!text || text.length > MAX_TEXT_LENGTH || /[\r\n]/u.test(text) || (text.match(/\?/gu) ?? []).length !== 1 || !text.endsWith("?")) {
    return "assistant-response-not-single-question"
  }
  if (COMMAND_PATTERN.test(text)) return "assistant-response-command-content"
  if (FILE_CHANGE_PATTERN.test(text)) return "assistant-response-file-change-content"
  if (PLAN_PATTERN.test(text)) return "assistant-response-plan-content"
  if (SOLUTION_PATTERN.test(text)) return "assistant-response-solution-content"
  return "ready"
}

function result(status, code, state, responsePredicatePostModel = false) {
  return Object.freeze({
    schemaVersion: SCHEMA_VERSION,
    status,
    code,
    ambiguousInterviewFirst: status === "passed" && responsePredicatePostModel && state.preApprovalNoMutation,
    responsePredicatePostModel,
    preApprovalNoMutation: state.preApprovalNoMutation,
  })
}

function blocked(code, preApprovalNoMutation) {
  return Object.freeze({
    schemaVersion: SCHEMA_VERSION,
    status: "blocked",
    code,
    ambiguousInterviewFirst: false,
    responsePredicatePostModel: false,
    preApprovalNoMutation,
  })
}

function isObservation(value) {
  if (!isRecord(value) || !isDeepStrictEqual(Object.keys(value).sort(), ["events", "schemaVersion"])) return false
  if (value.schemaVersion !== SCHEMA_VERSION || !Array.isArray(value.events) || value.events.length > MAX_EVENTS) return false
  return value.events.every(isEvent)
}

function isEvent(value) {
  return isRecord(value)
    && typeof value.type === "string"
    && SAFE_EVENT_TYPES.has(value.type)
    && isRecord(value.properties)
}

function isRole(value) {
  return value === "assistant" || value === "user"
}

function isBoundIdentifier(value) {
  return typeof value === "string" && value.length > 0 && value.length <= MAX_IDENTIFIER_LENGTH && !/[\0\r\n]/u.test(value)
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}
