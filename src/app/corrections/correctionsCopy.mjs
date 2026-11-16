// The words of /corrections (16 Nov 2026). Each line is backed by code or data, named beside it, so it can be checked:
//   the log itself         data/corrections.json through data/corrections.mjs
//   the report control     src/components/result/reportModel.mjs (REPORT_COPY.rowOpen), drawn at the foot of every opened
//                          question on the result page (src/app/(app)/result/[id]/ResultPageClient.jsx)
//   once per account       src/lib/server/questionReports.js (a second report from one account is a duplicate)
//   three students         REPORT_POLICY.distinctReporters = 3 (accounts at least a day old), then the question goes to
//                          status 'pending', verification 'disputed': no surface serves it (data/practice_source.js)
//   a moderator decides    src/app/(app)/moderation: approve puts it back live, reject keeps it out
//   your result says so    data/answer_corrections.mjs answerReview: "Key corrected" or "key being re-checked" on the result
// Plain module (no React) so node tests read it.

export const CORRECTIONS_PATH = '/corrections';

export const HEAD = Object.freeze({
  crumb: 'Corrections',
  title: 'What we got wrong.',
  lead: 'Every mistake we have found in our CUET questions, with the date and what we did about it.',
  rule: 'When a question is wrong, we fix it or take it out of practice, and list it here.',
});

// What each stamp means, in the order of data/corrections.mjs ACTIONS.
export const LEGEND = Object.freeze([
  Object.freeze({ action: 'fixed', line: 'The question stays, corrected.' }),
  Object.freeze({ action: 'pulled', line: 'Practice no longer serves it.' }),
  Object.freeze({ action: 'held', line: 'Out of practice until it is checked again.' }),
]);

export const LOG = Object.freeze({
  title: 'The log, newest first',
  span: (first, latest) => `This log starts on ${first}. Latest entry: ${latest}.`,
  empty: 'Nothing to list yet. The first correction we make will appear here with its date.',
});

/** "7 fixed, 4 taken out" for a day's entries. */
export function daySummary(entries) {
  const n = (action) => entries.filter((e) => e.action === action).length;
  const parts = [];
  if (n('fixed')) parts.push(`${n('fixed')} fixed`);
  if (n('pulled')) parts.push(`${n('pulled')} taken out`);
  if (n('held')) parts.push(`${n('held')} held for a re-check`);
  return parts.join(', ');
}

export const REPORT = Object.freeze({
  title: 'Found a mistake?',
  how: 'Report it from your result. After a mock, tap a question on your result to open it, then tap “Report a problem with this question” at the bottom of it.',
  steps: Object.freeze([
    Object.freeze({ title: 'Tell us what looks wrong', body: 'Pick a reason, such as a wrong answer key, and add a note if you like. Each account reports a question once.' }),
    Object.freeze({ title: 'Three reports take it out', body: 'When three different students report the same question, it comes out of practice until it is checked.' }),
    Object.freeze({ title: 'A moderator decides', body: 'If the question is right, it goes back. If it is wrong, it stays out until it is fixed.' }),
  ]),
  result: 'If a question you answered is changed or taken out, your result for that paper says so.',
  guest: 'Reporting needs an account, because you report from your own results.',
  student: 'Open any of your results to report a question.',
  email: 'Spotted one on a page with no report link?',
  emailCta: 'Write to us',
});
