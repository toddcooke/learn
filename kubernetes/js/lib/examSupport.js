// Pure exam-support logic extracted from js/views/mockExam.js so the
// bug-prone parts (checkpoint validation, timer threshold announcements) can
// be unit tested without a DOM. No storage or DOM access lives here — the
// view reads/clears the persisted checkpoint and owns the live region; this
// module only decides what a raw stored value means.

// Validates a raw persisted checkpoint value against the current question
// bank. Returns `{ checkpoint, expired }` for a well-formed checkpoint, or
// `null` for anything malformed (wrong shape, empty/unresolvable question
// ids) — the caller is responsible for clearing the stored value on null.
//
// A checkpoint whose deadline has passed is NOT rejected — it comes back
// with `expired: true` so the view can score the saved answers instead of
// silently throwing them away.
//
// `flags` is an OPTIONAL array of question indexes (flagged for review).
// Checkpoints saved before flags existed have no such field; anything that
// isn't an array of in-range integer indexes normalizes to `[]` rather than
// invalidating an otherwise-good checkpoint.
export function validateCheckpoint(raw, questionsById, now) {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;

  const { questionIds, answers, index, deadline, flags } = raw;
  const isWellFormed = Array.isArray(questionIds) && questionIds.length > 0
    && Array.isArray(answers)
    && Number.isInteger(index) && index >= 0
    && typeof deadline === 'number';
  if (!isWellFormed) return null;

  const exam = questionIds.map((id) => questionsById.get(id));
  if (exam.some((q) => !q)) return null;

  const answeredCount = answers.filter((a) => Array.isArray(a) && a.length > 0).length;

  return {
    checkpoint: {
      exam,
      answers: exam.map((_, i) => (Array.isArray(answers[i]) ? answers[i] : null)),
      index: Math.min(Math.max(index, 0), exam.length - 1),
      deadline,
      flags: Array.isArray(flags)
        ? flags.filter((f) => Number.isInteger(f) && f >= 0 && f < exam.length)
        : [],
      answeredCount,
      secondsLeft: Math.max(0, Math.round((deadline - now) / 1000)),
    },
    expired: deadline <= now,
  };
}

// Checked lowest-threshold-first: a throttled background tab can jump many
// minutes in one tick and cross BOTH thresholds at once, and announcing
// "10 minutes remaining" when under a minute actually remains would be
// affirmatively wrong. Only the lowest crossed threshold is returned.
const TIMER_THRESHOLDS = [
  { seconds: 60, message: '1 minute remaining' },
  { seconds: 600, message: '10 minutes remaining' },
];

// Returns the announcement for the lowest threshold crossed between the
// previous timer tick (`prevSeconds`) and this one (`nowSeconds`), or `null`
// when no threshold was crossed. A threshold counts as crossed only on the
// tick it happens (`prev > threshold && now <= threshold`), so each fires at
// most once and a resumed exam already past a threshold never fires it
// retroactively.
export function crossedThreshold(prevSeconds, nowSeconds) {
  for (const { seconds, message } of TIMER_THRESHOLDS) {
    if (prevSeconds > seconds && nowSeconds <= seconds) return message;
  }
  return null;
}
