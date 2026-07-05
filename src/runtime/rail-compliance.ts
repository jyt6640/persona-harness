import { writeRailComplianceEvidence, type RailComplianceFindingCode } from "./evidence.js"
import type { TopLevelIntent } from "./top-level-intent-router.js"
import { readWorkflowReportStatus } from "./workflow-report-status.js"

type RailComplianceState = {
  readonly sessionID: string
  readonly userPrompt: string
  readonly intent: TopLevelIntent
  readonly railMarker: string
  requirementsSplitOrNextObserved: boolean
  debugReproductionObserved: boolean
  gitStatusObserved: boolean
  gitDiffObserved: boolean
  rawVerificationObserved: boolean
  bearshellVerificationObserved: boolean
  readonly reported: Set<string>
}

type ToolObservation = {
  readonly tool: string
  readonly sessionID: string
  readonly callID?: string
  readonly args: Record<string, unknown>
}

type RailComplianceTrackerOptions = {
  readonly evidenceDir?: string
}

type ComplianceWarning = {
  readonly code: RailComplianceFindingCode
  readonly confidence: "HIGH" | "MEDIUM" | "LOW"
  readonly message: string
  readonly observedAction: string
  readonly expectedAction: string
}

const IMPLEMENTATION_REPORT_PATH = ".persona/workflow/implementation-report.md"
const REVIEW_REPORT_PATH = ".persona/workflow/review-report.md"

const FILE_MUTATION_TOOL_PATTERN = /(?:^|[._-])(edit|write|patch|apply_patch|multiedit|multi_edit)(?:$|[._-])/iu
const SHELL_TOOL_PATTERN = /(shell|bash|terminal|exec|command)/iu
const WORKFLOW_SPLIT_OR_NEXT_PATTERN = /\b(?:npx\s+)?ph\s+workflow\s+(?:split|next)\b/iu
const DEBUG_REPRODUCTION_PATTERN =
  /\b(?:npm\s+(?:test|run\s+(?:test|build))|vitest|gradle(?:w)?|\.\/gradlew|mvn|pytest|go\s+test|cargo\s+test|curl|bootRun|build|test)\b/iu
const GIT_STATUS_PATTERN = /\bgit\s+status\b/iu
const GIT_DIFF_PATTERN = /\bgit\s+diff\b/iu
const GIT_MUTATION_PATTERN = /\bgit\s+(?:commit|push|tag)\b/iu
const VERIFICATION_PATTERN =
  /\b(?:npm\s+(?:test|run\s+(?:test|build))|vitest|gradle(?:w)?|\.\/gradlew|mvn\s+(?:test|package|verify)|pytest|go\s+test|cargo\s+test|bootRun|curl)\b/iu
const BEARSHELL_PATTERN = /\b(?:npx\s+)?ph\s+bearshell\b/iu
const WORKFLOW_FINISH_OR_CHECK_PATTERN = /\b(?:npx\s+)?ph\s+workflow\s+(?:finish\s+implement|check)\b/iu

function textValues(value: unknown): readonly string[] {
  if (typeof value === "string") {
    return [value]
  }
  if (Array.isArray(value)) {
    return value.flatMap(textValues)
  }
  if (typeof value === "object" && value !== null) {
    return Object.values(value).flatMap(textValues)
  }
  return []
}

function commandText(observation: ToolObservation): string {
  if (!SHELL_TOOL_PATTERN.test(observation.tool)) {
    return ""
  }
  return textValues(observation.args).join("\n")
}

function isFileMutation(observation: ToolObservation): boolean {
  if (FILE_MUTATION_TOOL_PATTERN.test(observation.tool)) {
    return true
  }
  const command = commandText(observation)
  return /(?:^|\s)(?:apply_patch|tee\s+|cat\s+>|printf\b[\s\S]*>)/iu.test(command)
}

function missingWorkflowReports(projectDir: string): readonly string[] {
  return [
    ...(readWorkflowReportStatus(projectDir, IMPLEMENTATION_REPORT_PATH) === "filled" ? [] : [IMPLEMENTATION_REPORT_PATH]),
    ...(readWorkflowReportStatus(projectDir, REVIEW_REPORT_PATH) === "filled" ? [] : [REVIEW_REPORT_PATH]),
  ]
}

export class RailComplianceTracker {
  private readonly states = new Map<string, RailComplianceState>()

  constructor(private readonly options: RailComplianceTrackerOptions = {}) {}

  startRail(sessionID: string, userPrompt: string, intent: TopLevelIntent, railMarker: string): void {
    this.states.set(sessionID, {
      sessionID,
      userPrompt,
      intent,
      railMarker,
      requirementsSplitOrNextObserved: false,
      debugReproductionObserved: false,
      gitStatusObserved: false,
      gitDiffObserved: false,
      rawVerificationObserved: false,
      bearshellVerificationObserved: false,
      reported: new Set(),
    })
  }

  observeTool(projectDir: string, observation: ToolObservation): void {
    const state = this.states.get(observation.sessionID)
    if (state === undefined) {
      return
    }

    const command = commandText(observation)
    this.updateState(state, command)
    for (const warning of this.warnings(projectDir, state, observation, command)) {
      this.report(projectDir, state, observation, warning)
    }
  }

  private updateState(state: RailComplianceState, command: string): void {
    if (WORKFLOW_SPLIT_OR_NEXT_PATTERN.test(command)) {
      state.requirementsSplitOrNextObserved = true
    }
    if (DEBUG_REPRODUCTION_PATTERN.test(command)) {
      state.debugReproductionObserved = true
    }
    if (GIT_STATUS_PATTERN.test(command)) {
      state.gitStatusObserved = true
    }
    if (GIT_DIFF_PATTERN.test(command)) {
      state.gitDiffObserved = true
    }
    if (VERIFICATION_PATTERN.test(command)) {
      if (BEARSHELL_PATTERN.test(command)) {
        state.bearshellVerificationObserved = true
      } else {
        state.rawVerificationObserved = true
      }
    }
  }

  private warnings(
    projectDir: string,
    state: RailComplianceState,
    observation: ToolObservation,
    command: string,
  ): readonly ComplianceWarning[] {
    const warnings: ComplianceWarning[] = []
    const fileMutation = isFileMutation(observation)

    if (state.intent.primary === "review" && fileMutation) {
      warnings.push({
        code: "review-rail-file-modification",
        confidence: "HIGH",
        message: "Review rail observed a file modification.",
        observedAction: `${observation.tool} modified a file`,
        expectedAction: "Review rail should report findings first and avoid edits unless the user explicitly asks for fixes.",
      })
    }

    if (state.intent.primary === "requirements" && fileMutation && !state.requirementsSplitOrNextObserved) {
      warnings.push({
        code: "requirements-rail-direct-implementation",
        confidence: "HIGH",
        message: "Requirements rail observed implementation before workflow split/next.",
        observedAction: `${observation.tool} modified a file before ticket workflow evidence`,
        expectedAction: "Run `npx ph workflow split` and `npx ph workflow next` before implementation.",
      })
    }

    if (state.intent.primary === "debug" && fileMutation && !state.debugReproductionObserved) {
      warnings.push({
        code: "debug-rail-edit-without-reproduction",
        confidence: "MEDIUM",
        message: "Debug rail observed an edit before reproduction evidence.",
        observedAction: `${observation.tool} modified a file before a test/build/smoke command was observed`,
        expectedAction: "Reproduce the failure, record hypotheses, then edit only the confirmed cause.",
      })
    }

    if (state.intent.primary === "git" && GIT_MUTATION_PATTERN.test(command) && (!state.gitStatusObserved || !state.gitDiffObserved)) {
      warnings.push({
        code: "git-rail-mutation-without-status-diff",
        confidence: "HIGH",
        message: "Git rail observed a mutating git command before status and diff evidence.",
        observedAction: command,
        expectedAction: "Run `git status` and `git diff` before commit/push/tag.",
      })
    }

    if (WORKFLOW_FINISH_OR_CHECK_PATTERN.test(command)) {
      if (state.rawVerificationObserved && !state.bearshellVerificationObserved) {
        warnings.push({
          code: "raw-final-verification-without-bearshell",
          confidence: "HIGH",
          message: "Raw verification was observed without final `npx ph bearshell` verification.",
          observedAction: command,
          expectedAction: "Rerun final test/build/bootRun/smoke verification through `npx ph bearshell`.",
        })
      }

      const missingReports = missingWorkflowReports(projectDir)
      if (missingReports.length > 0) {
        warnings.push({
          code: "workflow-report-missing",
          confidence: "HIGH",
          message: `Workflow reports are not filled: ${missingReports.join(", ")}`,
          observedAction: command,
          expectedAction: "Fill implementation and review reports before finishing the workflow.",
        })
      }
    }

    return warnings
  }

  private report(
    projectDir: string,
    state: RailComplianceState,
    observation: ToolObservation,
    warning: ComplianceWarning,
  ): void {
    if (state.reported.has(warning.code)) {
      return
    }
    state.reported.add(warning.code)
    writeRailComplianceEvidence(projectDir, {
      hook: "tool.execute.after",
      sessionID: state.sessionID,
      callID: observation.callID,
      userPrompt: state.userPrompt,
      primaryIntent: state.intent.primary,
      secondaryIntents: state.intent.secondary,
      railMarker: state.railMarker,
      finding: "WARN",
      confidence: warning.confidence,
      code: warning.code,
      message: warning.message,
      observedAction: warning.observedAction,
      expectedAction: warning.expectedAction,
    }, {
      evidenceDir: this.options.evidenceDir,
    })
  }
}
