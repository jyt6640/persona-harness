export const POST_BUILD_CLOSURE_NEXT_ACTION =
  "if build/test/runtime already pass, fill implementation and review reports, archive the completed ticket after review, then run `npx ph workflow finish implement`"

export function postBuildClosureChecklistLines(ticketId: string | undefined): readonly string[] {
  return [
    "Post-build closure checklist:",
    "If build/test/runtime already pass, do not start new app generation.",
    "Fill .persona/workflow/implementation-report.md with verification evidence, then run npx ph plan --report-filled implementation.",
    "Fill .persona/workflow/review-report.md after review/manual QA, then run npx ph plan --report-filled review.",
    ...ticketClosureLines(ticketId),
    "Run npx ph workflow finish implement before claiming completion.",
    "",
  ]
}

function ticketClosureLines(ticketId: string | undefined): readonly string[] {
  if (ticketId === undefined) {
    return ["Review completed pending tickets; archive only tickets that are satisfied after review."]
  }
  const ticketLabel = /^req[-_]?/iu.test(ticketId) ? "req ticket" : "ticket"
  return [`Review the current ${ticketLabel}; if it is satisfied, run npx ph workflow archive ${ticketId}.`]
}
