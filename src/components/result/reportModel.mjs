// Report a problem with a question (T4, 15 Nov 2026): the words and the request of the result page's report sheet.
//
// The sheet replaced window.prompt, which some in-app browsers and installed web apps never show (it returns null, so the
// report was dropped without a word). The request goes to the route the prompt used, POST /api/questions/:id/interact with
// interaction_type 'report' and flow_context 'review' (src/app/api/questions/[id]/interact/route.js). That route keeps any
// metadata object as it is and records one report per account per question (src/lib/server/questionReports.js); the
// moderation page shows `metadata.note` (src/app/(app)/moderation/ModerationPageClient.jsx). So the reason travels twice:
// as its id in `metadata.reason` (for counting) and in words at the head of `metadata.note` (for the moderator).
// Pure, no React, so a node test holds the reasons, the request and the error words.

export const REPORT_INTERACTION = Object.freeze({ type: 'report', flow: 'review', source: 'result_analysis' });

export const REPORT_REASONS = Object.freeze([
  Object.freeze({ id: 'wrong_key', label: 'Wrong answer key' }),
  Object.freeze({ id: 'unclear', label: 'The question is unclear' }),
  Object.freeze({ id: 'off_syllabus', label: 'Not in the CUET syllabus' }),
  Object.freeze({ id: 'typo', label: 'Typo or formatting' }),
  Object.freeze({ id: 'other', label: 'Something else' }),
]);

export const NOTE_MAX = 300;

export const REPORT_COPY = Object.freeze({
  title: 'What looks wrong?',
  noteLabel: 'Add a note (optional)',
  noteLabelNeeded: 'Add a note',
  notePlaceholder: 'For example: option C is the right answer',
  send: 'Send report',
  sending: 'Sending…',
  cancel: 'Cancel',
  sentTitle: 'Thanks. Your report is saved.',
  sentDuplicate: 'You have already reported this question. We will check it.',
  done: 'Done',
  pickReason: 'Pick what looks wrong.',
  needNote: 'Add a few words so we know what to check.',
  rowSent: 'Reported. Thank you.',
  rowOpen: 'Report a problem with this question',
});

const reasonOf = (id) => REPORT_REASONS.find((r) => r.id === id) || null;

/** The note as it will be sent: spaces tidied, cut at NOTE_MAX. */
export function cleanNote(note) {
  return String(note ?? '').replace(/\s+/g, ' ').trim().slice(0, NOTE_MAX);
}

/** Whether the form can be sent, and if not, the one line that says why: { ok: true } | { ok: false, field, line }. */
export function checkReport({ reason, note } = {}) {
  if (!reasonOf(reason)) return { ok: false, field: 'reason', line: REPORT_COPY.pickReason };
  if (reason === 'other' && !cleanNote(note)) return { ok: false, field: 'note', line: REPORT_COPY.needNote };
  return { ok: true };
}

/**
 * The body of POST /api/questions/:id/interact for one report.
 *   reason   a REPORT_REASONS id
 *   note     what the student typed (optional except for 'other')
 *   attempt  { id, subject }
 *   row      { verdict, d: { givenIndex }, q: { correctIndex } }
 */
export function reportRequest({ reason, note, attempt, row }) {
  const picked = reasonOf(reason);
  if (!picked) throw new Error('REPORT_REASON_REQUIRED');
  const detail = cleanNote(note);
  return {
    interaction_type: REPORT_INTERACTION.type,
    flow_context: REPORT_INTERACTION.flow,
    session_id: attempt?.id ?? null,
    metadata: {
      source: REPORT_INTERACTION.source,
      reason: picked.id,
      // What the moderation page prints: the reason in words, then the student's own note.
      note: detail ? `${picked.label}. ${detail}` : `${picked.label}.`,
      detail: detail || null,
      attempt_id: attempt?.id ?? null,
      subject: attempt?.subject ?? null,
      verdict: row?.verdict ?? null,
      given_index: Number.isInteger(row?.d?.givenIndex) ? row.d.givenIndex : null,
      correct_index: Number.isInteger(row?.q?.correctIndex) ? row.q.correctIndex : null,
    },
  };
}

/** What the sheet says once the server has answered yes. `body` is the route's JSON ({ duplicate: true } for a repeat). */
export function sentLine(body) {
  return body && body.duplicate === true ? REPORT_COPY.sentDuplicate : REPORT_COPY.sentTitle;
}

/**
 * One plain line for a report the server did not take. The form keeps what the student chose and typed, so every line
 * ends with what to do next. `error` is what src/lib/fetcher.js throws: { status, kind: 'network' }.
 */
export function reportErrorLine(error) {
  const status = Number(error?.status);
  if (error?.kind === 'network' || (typeof navigator !== 'undefined' && navigator.onLine === false)) return 'No connection. Your report is still here: send it again when you are back online.';
  if (status === 429) return 'You have sent a lot of reports this hour. Try this one again later.';
  if (status === 401) return 'Your sign-in needs a refresh. Reload the page, then send it again.';
  if (status === 404 || status === 410) return 'This question is no longer in the question bank, so there is nothing to report.';
  return 'Your report did not send. Try again.';
}
