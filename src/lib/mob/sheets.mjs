// Full mock together (owner D167): the mark sheets the whole Mob compares. Pure: the service passes the paper's sections,
// the sitting's picks and the bank's keys. CUET marks, +5 right, -1 wrong, 0 not answered; 50 questions, 250 marks.
//   - Sections are the paper's syllabus units (English: its pattern sections), in the order the paper first meets them.
//   - Time is the server's (the run's start to the hand-in, at most 60 minutes). A section's time is the runner's own
//     record of seconds per question when the device kept one, else null: it is shown, never ranked.
//   - Before the close a sheet holds counts only, never which question was right (the answers stay held, F1).
//   - A member who keeps their marks private shows "finished" and nothing else (L-10).
import { MOCK_MAX_MARKS } from './games.mjs';

const OTHER = Object.freeze({ key: 'other', label: 'Other questions' });
const accuracyOf = (right, wrong) => (right + wrong > 0 ? Math.round((100 * right) / (right + wrong)) : null);

/**
 * sections: [{ key, label } | null per question] in paper order; picks: [pick per question, -1 = not answered];
 * keys: [correct index per question]; seconds: [seconds per question, -1 = unknown] or null.
 * Returns { sections: [{ key, label, of, marks, right, wrong, skipped, timeMs }] } (what the run stores as its sheet).
 */
export function markSheet({ sections = [], picks = [], keys = [], seconds = null }) {
  const out = new Map();
  const n = Math.max(keys.length, picks.length);
  for (let q = 0; q < n; q += 1) {
    const sec = sections[q] && typeof sections[q].key === 'string' ? sections[q] : OTHER;
    if (!out.has(sec.key)) out.set(sec.key, { key: sec.key, label: String(sec.label || sec.key), of: 0, marks: 0, right: 0, wrong: 0, skipped: 0, ms: 0, timed: true });
    const row = out.get(sec.key);
    row.of += 1;
    const pick = Number.isInteger(picks[q]) ? picks[q] : -1;
    if (pick < 0) row.skipped += 1;
    else if (pick === keys[q]) { row.right += 1; row.marks += 5; } else { row.wrong += 1; row.marks -= 1; }
    const s = Array.isArray(seconds) ? seconds[q] : -1;
    if (Number.isFinite(s) && s >= 0) row.ms += s * 1000; else row.timed = false;
  }
  return { sections: [...out.values()].map(({ ms, timed, ...r }) => ({ ...r, timeMs: timed && Array.isArray(seconds) ? ms : null })) };
}

/**
 * One member's sheet as the Mob sees it. run: { marks, right_n, wrong_n, skipped_n, sheet: { sections, timeMs } };
 * member: { memberId, name, colour, fold, you }; hidden: the member keeps their marks private and it is not your own.
 */
export function sheetView(run, member, { hidden = false } = {}) {
  const base = { memberId: member.memberId, name: member.name, colour: member.colour, fold: member.fold, you: member.you === true, private: hidden };
  if (hidden) return { ...base, marks: null, of: MOCK_MAX_MARKS, right: null, wrong: null, skipped: null, accuracy: null, timeMs: null, sections: null };
  const right = Number(run.right_n) || 0;
  const wrong = Number(run.wrong_n) || 0;
  const sections = Array.isArray(run.sheet?.sections) ? run.sheet.sections.map((s) => ({
    key: s.key, label: s.label, of: Number(s.of) || 0, marks: Number(s.marks) || 0, right: Number(s.right) || 0, wrong: Number(s.wrong) || 0, skipped: Number(s.skipped) || 0,
    accuracy: accuracyOf(Number(s.right) || 0, Number(s.wrong) || 0), timeMs: Number.isFinite(s.timeMs) ? s.timeMs : null,
  })) : [];
  return {
    ...base, marks: Number(run.marks) || 0, of: MOCK_MAX_MARKS, right, wrong, skipped: Number(run.skipped_n) || 0,
    accuracy: accuracyOf(right, wrong), timeMs: Number.isFinite(run.sheet?.timeMs) ? run.sheet.timeMs : null, sections,
  };
}

/** The sheets in podium order: by marks (most first), then by hand-in time; private sheets after, by hand-in time. */
export function orderSheets(rows) {
  return [...rows].sort((a, b) => (a.view.private - b.view.private) || ((b.view.marks ?? -1e9) - (a.view.marks ?? -1e9)) || (a.at - b.at)).map((r) => r.view);
}
