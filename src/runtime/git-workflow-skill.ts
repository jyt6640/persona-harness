import type { TopLevelIntent } from "./top-level-intent-router.js"

function secondaryLine(intent: TopLevelIntent): string {
  return intent.secondary.length > 0 ? intent.secondary.join(", ") : "none"
}

export function formatGitWorkflowBlock(intent: TopLevelIntent): string {
  return [
    "[Persona Harness Git Workflow]",
    "",
    `Detected intent: ${intent.primary}`,
    `Secondary intents: ${secondaryLine(intent)}`,
    `Reason: ${intent.reason}`,
    "",
    "의도 감지: git 작업 요청으로 판단함.",
    "근거: 사용자가 commit/push/tag/history 같은 저장소 작업을 명시함.",
    "다음 행동: 작업트리와 diff를 먼저 확인하고 요청된 git 작업만 수행한다.",
    "",
    "Required flow:",
    "- git status를 확인한다.",
    "- diff를 확인한다. staged diff와 unstaged diff를 구분한다.",
    "- 관련 파일만 stage한다. unrelated dirty work는 섞지 않는다.",
    "- atomic commit을 만든다. 메시지는 repo의 기존 스타일을 따른다.",
    "- push는 사용자가 명시적으로 요청한 경우에만 수행한다.",
    "- push 전에는 현재 브랜치와 upstream 상태를 확인한다.",
    "- 완료 후 commit hash와 남은 worktree 상태를 보고한다.",
    "",
    "Evidence checklist:",
    "- git status",
    "- diff summary",
    "- staged files",
    "- commit hash when committed",
    "- push target when pushed",
    "- remaining worktree state",
    "",
    "Non-goals:",
    "- 구현/debug/refactor rail이 아니다.",
    "- 사용자가 요청하지 않은 rebase/reset/stash/drop을 하지 않는다.",
    "- generated app product quality 보증이 아니다.",
    "- AST/linter/enforcement gate가 아니다.",
  ].join("\n")
}
