// Weak chapters (Radar), web redesign W2.4: the words and numbers beside the record view.
// Pure, unit tested in radarModel.test.mjs. Scores are the server's per-session percentages.
import { plural, shortDate } from '../review/reviewModel.mjs';

/** cold: no session yet; thin: one or two (too few to read a pattern); ready: three or more. */
export function radarStage(sessions) {
  const n = Number.isFinite(sessions) ? sessions : 0;
  if (n <= 0) return 'cold';
  return n < 3 ? 'thin' : 'ready';
}

const pct = (v) => (Number.isFinite(v) ? Math.round(v) : null);

/** The last `max` sessions as bars, oldest on the left. Heights are clamped; the label is not. */
export function trendBars(timeline, { max = 12, now } = {}) {
  const rows = (Array.isArray(timeline) ? timeline : []).filter((t) => t && pct(t.score) !== null);
  const start = Math.max(0, rows.length - max);
  return rows.slice(start).map((t, i, list) => {
    const score = pct(t.score);
    const n = start + i + 1;
    const date = shortDate(t.at, now);
    return {
      key: `${n}-${t.at ?? ''}`,
      n,
      score,
      height: Math.min(100, Math.max(0, score)),
      label: date ? `Session ${n}, ${date}` : `Session ${n}`,
      latest: i === list.length - 1,
    };
  });
}

/** The line under the trend. A rough guide, because every session is a different paper. */
export function trendCaption(timeline) {
  const rows = (Array.isArray(timeline) ? timeline : []).filter((t) => t && pct(t.score) !== null);
  if (rows.length === 0) return 'Finish a session to start your trend.';
  if (rows.length === 1) return `One session so far, at ${pct(rows[0].score)}%. One more and the trend starts.`;
  const first = pct(rows[0].score);
  const last = pct(rows[rows.length - 1].score);
  return `${first}% to ${last}% across ${plural(rows.length, 'session')}. Each session is a different set of questions, so read it as a rough guide.`;
}

/** The lead under the title, with the sample it rests on. */
export function radarLead({ totalAttempts = 0, questions = 0, device = 0 } = {}) {
  const base = 'Radar reads your saved sessions and shows where marks are being lost, chapter by chapter.';
  if (!totalAttempts) return base;
  const sample = ` From ${plural(totalAttempts, 'session')} and ${plural(questions, 'answered question')}.`;
  return base + sample + (device > 0 ? ` ${device === 1 ? 'One earlier session was' : `${device} earlier sessions were`} scored on your device before server scoring.` : '');
}

/** "3 sessions, average 62%" for a subject row. */
export function subjectLine(s) {
  const sessions = Number.isFinite(s?.tests) ? s.tests : 0;
  return Number.isFinite(s?.avg) ? `${plural(sessions, 'session')}, average ${Math.round(s.avg)}%` : plural(sessions, 'session');
}
