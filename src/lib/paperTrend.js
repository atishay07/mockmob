// Recent papers of the same kind and length, from /api/attempts/summary. PURE.
// Only server-scored attempts count (the same ones the study rhythm counts), only papers whose
// format id matches the newest one (same mode, subject, question count and scoring), and nothing
// is shown with fewer than three of them: two dots are not a trend.

export const TREND_MAX = 6;
export const TREND_MIN = 3;
const SERVER_SCORED = /:(server_snapshot_v1|server_practice_v1)$/;
const MODE_WORDS = { full: 'full mocks', nta: 'NTA mocks', quick: 'quick sets', practice: 'practice sets' };

const sentence = (s) => { const t = String(s || '').replace(/_/g, ' ').trim(); return t ? t[0].toUpperCase() + t.slice(1) : ''; };

/** @returns {null | {formatId, subject, kind, total, maxMarks, points: {id, marks, at}[], newest, delta}} oldest point first */
export function pickTrend(items) {
  const usable = (Array.isArray(items) ? items : []).filter((i) => i
    && typeof i.formatId === 'string' && SERVER_SCORED.test(i.formatId)
    && Number.isFinite(i.marks) && Number.isFinite(i.maxMarks) && i.maxMarks > 0 && Number.isFinite(i.completedAt));
  if (!usable.length) return null;
  const byNewest = (a, b) => b.completedAt - a.completedAt || String(a.id).localeCompare(String(b.id));
  usable.sort(byNewest);
  const head = usable[0];
  const same = usable.filter((i) => i.formatId === head.formatId).slice(0, TREND_MAX);
  if (same.length < TREND_MIN) return null;
  const points = same.slice().reverse().map((i) => ({ id: i.id, marks: i.marks, at: i.completedAt }));
  const newest = points[points.length - 1];
  const before = points[points.length - 2];
  return {
    formatId: head.formatId,
    subject: sentence(head.subject),
    kind: MODE_WORDS[head.mode] || 'papers',
    total: head.total,
    maxMarks: head.maxMarks,
    points,
    newest,
    delta: newest.marks - before.marks,
  };
}

/** Plain words for the change since the paper before. */
export function deltaWords(delta) {
  if (delta === 0) return 'The same as the paper before.';
  const n = Math.abs(delta);
  return `${n} ${n === 1 ? 'mark' : 'marks'} ${delta > 0 ? 'above' : 'below'} the paper before.`;
}

/** Line and dot positions, 0 to 100 on both axes (y up). A flat record sits mid-height. */
export function layoutPoints(points) {
  const n = points.length;
  const marks = points.map((p) => p.marks);
  const lo = Math.min(...marks);
  const hi = Math.max(...marks);
  const span = hi - lo;
  return points.map((p, i) => ({
    ...p,
    x: n === 1 ? 50 : 8 + (84 * i) / (n - 1),
    y: span === 0 ? 50 : 12 + (76 * (p.marks - lo)) / span,
  }));
}
