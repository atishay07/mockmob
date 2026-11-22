// The CUET 2026 paper, checked against MockMob: the home page's teaser (owner, 22 Nov 2026; LK368 made the full pages at
// /cuet-2026-coverage and this a compact teaser that leads there).
//
// Where the numbers come from: data/coverage/cuet2026/public/summary.json, written by scripts/coverage/build-public.mjs from
// NTA's 2026 master papers (one shift a subject, every question authenticated against NTA's final key) and the two independent
// checks of each question against MockMob's served questions and Key cards (data/coverage/METHOD.md). A question counts only
// when BOTH checks found it covered; reading-skill items are shown on the full pages and left out of the count. Nothing here is
// typed by hand: coverage2026.test.mjs holds these figures to the summary and the summary to the README's own line.
//
// The check was made after the exam, on the bank as it is now: the words never say MockMob predicted the paper.
import SUMMARY from '../../../data/coverage/cuet2026/public/summary.json' with { type: 'json' };

// The full pages' address and stream order, the same as src/components/coverage/coverageCopy.mjs (a test holds them equal).
// Not imported from there: the home page's file set stays free of the full pages' method words.
export const COVERAGE_PATH = '/cuet-2026-coverage';
const subjectPath = (id) => `${COVERAGE_PATH}/${id}`;
export const STREAM_ORDER = Object.freeze(['commerce', 'science', 'humanities', 'general', 'other']);
export const COVERAGE_SUMMARY = SUMMARY;
/** How many subject bars the teaser draws at most. */
export const TEASER_ROWS = 6;

/** A whole percent, rounded half up. */
export const coveragePct = (covered, of) => (of > 0 ? Math.round((covered / of) * 100) : 0);

const streamRank = (id) => {
  const at = STREAM_ORDER.indexOf(id || 'other');
  return at < 0 ? STREAM_ORDER.length : at;
};

/** The teaser's model: the total and up to TEASER_ROWS subjects (stream order, then name), each with its own link. */
export function coverageTeaser(summary = SUMMARY, max = TEASER_ROWS) {
  const subjects = [...(summary.subjects || [])]
    .sort((a, b) => streamRank(a.stream) - streamRank(b.stream) || a.name.localeCompare(b.name))
    .slice(0, max)
    .map((s) => ({ id: s.id, name: s.name, covered: s.covered, of: s.counted, pct: s.pct, href: subjectPath(s.id) }));
  const total = summary.total || { covered: 0, counted: 0, pct: 0 };
  return { total: { covered: total.covered, of: total.counted, pct: total.pct }, subjects };
}

export const COVERAGE_COPY = Object.freeze({
  kicker: 'Checked against the real paper',
  h2: 'CUET 2026, checked question by question.',
  mark: 'question by question.',
  totalLabel: (of) => `of the ${of} questions we checked are taught in MockMob`,
  row: (covered, of) => `${covered} of ${of} questions`,
  key: 'See every question',
  note: 'One 2026 shift for each subject. A question counts only when two separate checks both found it in MockMob.',
});
