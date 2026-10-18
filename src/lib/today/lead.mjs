// The lead card on Today, pass 1018 (docs/design-decisions/pass-1018/TODAY-1018.md sections 3, 6.1 and 6.2).
// PURE: no I/O, no clock (the caller passes `now`). Adds what the lead card shows to any move from buildMove (a plain
// title, the move's kind and its stake), builds the other moves a student can swap into the lead, and picks the two
// shown under it.
//
// The stake is the record's own arithmetic: every paper is marked +5 and −1, so a wrong answer is 5 not gained plus 1
// taken, 6 marks. A chapter's stake is its open marks (wrong and blank, 5 each). Never a promise of marks to gain.
import { openMistakes, paperDay, paperName, repairMinutes, moveOverline } from './move.mjs';
import { firstTimedMockHref, shortestTimedPaper } from '../../../data/first_timed_mock.js';

export const MARKS_PER_MISTAKE = 6;
const DAY_MS = 86400000;
const LONG_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const whole = (n) => Number.isInteger(n) && n >= 0;
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const word = (n) => ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'][n] ?? String(n);
const pills = () => ({ length: true, second: 'else' });

/** The kind of a move: two moves of one kind are never offered side by side. */
export function kindOf(move) {
  if (!move) return null;
  if (['repair', 'firstRepair'].includes(move.id) || (move.id === 'returning' && move.open > 0)) return 'repair';
  if (move.id === 'revise') return 'revise';
  if (['practice', 'smart', 'weakest'].includes(move.id)) return 'practice';
  if (['firstMock', 'mock'].includes(move.id)) return 'mock';
  if (['dayOne', 'returning'].includes(move.id)) return 'start';
  return move.id;
}

/** The lead card's title (the copy deck in section 7). */
export function leadTitle(move, now = Date.now()) {
  switch (move?.id) {
    case 'resume': return 'Your session is waiting';
    case 'check': return move.title || 'Your next check';
    case 'dayOne': return 'Find your starting point';
    case 'returning': return move.open > 0 ? 'Repair your last paper' : 'Find your footing again';
    case 'firstRepair': case 'repair': return 'Repair your last paper';
    case 'revise': return 'Revise what came back';
    case 'done': return moveOverline(now).startsWith('Tonight') ? 'Done for tonight' : 'Done for today';
    case 'firstMock': return 'Your first full mock';
    case 'mock': return 'A full mock instead';
    case 'smart': return 'Practise your weak chapters';
    case 'weakest': return 'Practise your weakest chapter';
    case 'another': return 'Start with another subject';
    case 'practice': return move.chapter ? 'Practise your weakest chapter' : 'Practise a fresh set';
    default: return move?.title || '';
  }
}

/** The stake line: { value, word } or null. Repairs and Revise count 6 a mistake; a chapter counts its open marks. */
export function stakeOf(move) {
  if (!move || !(move.number > 0)) return null;
  if (kindOf(move) === 'repair') return { value: move.number * MARKS_PER_MISTAKE, word: 'marks they cost you' };
  if (move.id === 'revise') return { value: move.number * MARKS_PER_MISTAKE, word: 'marks they cost you then' };
  if (move.chapterOpen > 0) return { value: move.chapterOpen, word: `marks open there, over ${plural(move.chapterSessions || 1, 'paper')}` };
  return null;
}

/** When a paper was saved, as a student says it: "today", "yesterday", "Saturday" within the week, else "11 Oct". */
export function paperWhen(at, now = Date.now()) {
  const t = Number(at);
  if (!Number.isFinite(t)) return '';
  const days = Math.floor((now + 19800000) / DAY_MS) - Math.floor((t + 19800000) / DAY_MS);
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days > 1 && days < 7) return LONG_DAYS[new Date(t + 19800000).getUTCDay()];
  return paperDay(t);
}

/** The line a move shows when it sits in the footer as a choice: { title, value }. */
export function choiceOf(move, now = Date.now()) {
  if (!move) return null;
  if (move.choice) return move.choice;
  const k = kindOf(move);
  if (k === 'repair') return { title: 'Repair a mistake', value: `${move.open ?? move.number} open${move.paperAt ? ` from ${paperWhen(move.paperAt, now)}` : ''}` };
  if (move.id === 'revise') return { title: 'Revise what is due', value: `${move.number} due${move.key?.minutes ? `, about ${move.key.minutes} min` : ''}` };
  if (k === 'practice') return { title: move.chapter ? 'Practise your weakest' : 'Practise a fresh set', value: move.chapter || `${move.number} questions` };
  if (move.id === 'dayOne') return { title: 'Your starting point', value: `${move.number} questions` };
  if (move.id === 'returning') return { title: 'Warm up', value: `${move.number} questions, ${move.key?.minutes || 10} min` };
  if (move.id === 'done') return { title: leadTitle(move, now), value: `${move.number} minutes` };
  if (move.id === 'firstMock') return { title: 'Your first full mock', value: `${move.number} ${move.label}` };
  return { title: leadTitle(move, now), value: move.number != null ? `${move.number} ${move.label}` : '' };
}

/** Any move, ready for the lead card: its title, kind, stake and choice line. */
export function leadOf(move, { now = Date.now() } = {}) {
  if (!move || move.id === 'failed') return move;
  // Revise brings back every subject's mistakes, so it names no one subject and shows no subject object.
  const titled = { ...move, ...(move.id === 'revise' ? { subject: null, art: 'glyph' } : {}), title: leadTitle(move, now), kind: kindOf(move) };
  return { ...titled, stake: stakeOf(titled), choice: choiceOf(titled, now) };
}

/**
 * The other moves a student can put in the lead, each a whole move. Inputs as buildMove, plus `subjects` (the student's
 * subject ids) and `length` (10, 20 or 30). In the order of preference (6.1): Repair, Revise, the weakest chapter, a
 * full mock (none in 14 days), another subject. `revise` is { due, dueTotal } (due = asked today, capped at 10).
 */
export function choiceMoves({ papers = null, revise = null, facts = null, repaired = null, top = null, subjectName = (id) => id, subjects = [], firstSubject = null, length = 10, now = Date.now() } = {}) {
  const out = [];
  const last = papers?.[0] || null;
  const open = openMistakes(last, repaired);
  if (open > 0) {
    out.push(leadOf({
      id: 'repair', overline: 'Up next', number: open, label: open === 1 ? 'mistake to repair' : 'mistakes to repair',
      why: `${open === last.wrong ? (open === 1 ? 'It is from' : `All ${word(open)} are from`) : `${plural(open, 'open mistake')} from`} ${paperName(last, subjectName)} on ${paperDay(last.completedAt)}. Repair finds the reason behind each one.`,
      key: { label: 'Start repair', href: `/result/${encodeURIComponent(last.id)}`, minutes: repairMinutes(open) },
      pills: pills(), art: 'object', subject: last.subject, open, aiEach: 1, paperAt: last.completedAt,
    }, { now }));
  }
  const due = whole(revise?.due) ? revise.due : 0;
  if (due > 0) {
    const total = whole(revise?.dueTotal) && revise.dueTotal > due ? revise.dueTotal : due;
    const m = leadOf({
      id: 'revise', overline: 'Up next', number: due, label: due === 1 ? 'mistake comes back today' : 'mistakes come back today',
      why: total > due
        ? `${total} of your wrong answers are due. Revise brings back ${due} a day, oldest first, so none is lost.`
        : `Revise brings back what you got wrong after 1, 3, 7 and 21 days. ${due === 1 ? 'This one is' : `These ${word(due)} are`} due today, so the fix holds.`,
      key: { label: 'Start Revise', href: '/review/revise', minutes: Math.max(5, Math.ceil(due / 5) * 5) },
      pills: pills(), art: 'object', subject: null, due, free: true,
    }, { now });
    m.choice = { title: 'Revise what is due', value: total > due ? `${due} of ${total} due today` : `${due} due, about ${m.key.minutes} min` };
    out.push(m);
  }
  if (top?.chapter && top?.subject) {
    const count = length === 10 ? 10 : 20;
    out.push(leadOf({
      id: 'weakest', overline: 'Up next', number: count, label: `questions on ${top.chapter}`, chapter: top.chapter, chapterOpen: top.open, chapterSessions: top.sessions,
      why: `${top.chapter} has ${plural(top.open, 'mark')} open in your record: ${(top.wrong || 0) + (top.skip || 0)} of ${top.n} questions missed. Marked +5 and −1, the CUET way.`,
      key: { label: 'Start practice', href: `/dashboard?${new URLSearchParams({ subject: top.subject, chapter: top.chapter, mode: 'quick', count: String(count) })}`, minutes: length },
      pills: pills(), art: 'object', subject: top.subject,
    }, { now }));
  }
  const paper = shortestTimedPaper();
  const lastMock = (papers || []).find((p) => ['full', 'nta'].includes(p?.mode));
  const mockStale = !lastMock || !(now - Number(lastMock.completedAt) < 14 * DAY_MS);
  if (paper && mockStale) {
    const subject = facts?.subject || last?.subject || firstSubject || null;
    const m = leadOf({
      id: 'mock', overline: 'Up next', number: paper.questions, label: `questions in ${paper.minutes} minutes`,
      why: 'Timed like the real paper, a fresh paper from the bank each time. It gives every chapter a mark at once.',
      key: { label: 'Start full mock', href: firstTimedMockHref(subject, paper), minutes: paper.minutes },
      pills: pills(), art: 'object', subject,
    }, { now });
    m.choice = { title: 'Full mock instead', value: `${paper.questions} questions, ${paper.minutes} min` };
    out.push(m);
  }
  const anchor = last?.subject || firstSubject;
  const others = (Array.isArray(subjects) ? subjects : []).filter((s) => s && s !== anchor);
  if (others.length) {
    const names = others.slice(0, 3).map(subjectName);
    const m = leadOf({
      id: 'another', overline: 'Up next', number: 10, label: `${names[0]} questions`,
      why: `Practice works on every subject you study. ${names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]} are` : `${names[0]} is`} open.`,
      key: { label: 'Start', href: `/dashboard?${new URLSearchParams({ subject: others[0], mode: 'quick', count: '10' })}`, minutes: 10 },
      pills: pills(), art: 'object', subject: others[0],
    }, { now });
    m.choice = { title: 'Another subject', value: names.join(', ') };
    out.push(m);
  }
  return out;
}

/**
 * The two choices under the lead: the first two moves in `pool` of a kind different from the lead's and from each
 * other (never the lead itself). While the student has picked another move, the caller puts the recommended move first
 * in the pool with `suggested: true`, so it stays one tap away.
 */
export function pickChoices(lead, pool = []) {
  if (!lead || lead.id === 'failed') return [];
  const seen = new Set([kindOf(lead)]);
  const out = [];
  for (const m of pool) {
    if (!m || m.id === lead.id) continue;
    const k = kindOf(m);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(m);
    if (out.length === 2) break;
  }
  return out;
}

/** The lead at a chosen length keeps its stake honest: a repair or Revise counts 6 for each mistake now in it. */
export function refit(move) {
  if (!move || move.id === 'failed') return move;
  return { ...move, stake: stakeOf(move) };
}

/** The day's key for the kept pick (sessionStorage `mm:today-pick:v1:<day>`). */
export const pickKey = (dayKey) => `mm:today-pick:v1:${dayKey}`;
