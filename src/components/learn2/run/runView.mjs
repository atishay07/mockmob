// Pure rules of the run player's screens (A4-chapter-run.md 3.3 and 3.4, A1 3.3 to 3.9, BUILD-1101 B2 and B7): what the
// session panel counts, what the status line says, how a re-insert lands, and how the end reads. No React, no imports, so
// node --test holds them (runView.test.mjs). runMath.js (S1) keeps the seconds and the stem rules.

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** The front's size step by its length in characters (R3-SPEC L1): 's' up to 60, 'm' up to 140, 'l' longer. */
export function frontStep(text) {
  const n = String(text || '').replace(/\s+/g, ' ').trim().length;
  return n <= 60 ? 's' : n <= 140 ? 'm' : 'l';
}

/** The tag at the card's head: why this card is here (a recap shows none). */
export function stageTag(item, { recap = false } = {}) {
  if (!item || recap) return null;
  if (item.reason === 'line') return 'The line you needed';
  if (item.reason === 'earlier' || item.again || item.stage === 'again') return 'Back from earlier';
  if (item.stage === 'due') return 'Due today';
  return null;
}

const pileOf = (item) => (item?.type === 'question' ? (item.origin === 'mistake' ? 'mistakes' : 'questions') : item?.type === 'lesson' ? 'lesson' : 'cards');
// R3-SPEC ruling W: question mistakes are "open mistakes" everywhere (never "old mistakes").
export const PILE_NAMES = Object.freeze({ cards: 'Key cards', questions: 'Questions', mistakes: 'Open mistakes', lesson: 'Lesson' });
/** "16 Key cards", "2 questions", "1 open mistake", "1 lesson": a pile's total before any of it is done. */
export const pileTotal = (id, n) => (id === 'cards' ? `${n} Key ${n === 1 ? 'card' : 'cards'}` : id === 'questions' ? plural(n, 'question') : id === 'mistakes' ? plural(n, 'open mistake') : plural(n, 'lesson'));

/**
 * The piles of this run worked down (A4 3.3.3): one row per pile the run holds, `done` of `of` counted by distinct cards
 * (a card back from earlier is the same card), the row of the item on screen marked. A resumed run only holds what was left,
 * so its rows read "N left" instead of a count that would start again at 0.
 */
export function runPiles(items, finished, { at = -1, resumed = false } = {}) {
  const list = Array.isArray(items) ? items : [];
  const rows = new Map();
  const seen = new Map();
  list.forEach((item, i) => {
    const id = pileOf(item);
    const row = rows.get(id) || { id, label: PILE_NAMES[id], done: 0, of: 0, current: false };
    const unit = item.type === 'card' ? `c:${item.card?.id || item.id}` : `i:${item.id}`;
    const first = !seen.has(unit);
    if (first) { seen.set(unit, i); row.of += 1; }
    if (i < finished && first) row.done += 1;
    if (i === at) row.current = true;
    rows.set(id, row);
  });
  const order = ['lesson', 'cards', 'questions', 'mistakes'];
  // R2 screens 10: no column of zeros. Before an item of a pile is done the row reads its total ("16 Key cards"), after
  // that "4 of 16"; a resumed run's row reads what is left, and "Done" when nothing is.
  return [...rows.values()].sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id)).map((r) => {
    const left = Math.max(0, r.of - r.done);
    if (resumed) return { ...r, value: left ? `${left} left` : 'Done' };
    if (!r.done) return { ...r, label: pileTotal(r.id, r.of), value: '' };
    return { ...r, value: `${r.done} of ${r.of}` };
  });
}

/** Plain questions answered and right, the open mistakes tried and fixed, and the current streak of right answers (B7 G). */
export function answerTally(items, answers) {
  const t = { answered: 0, right: 0, tried: 0, fixed: 0, streak: 0 };
  for (const item of items || []) {
    const r = answers?.[item.id]?.result;
    if (!r || item.type !== 'question') continue;
    if (item.origin === 'mistake') { t.tried += 1; if (r.correct) t.fixed += 1; } else { t.answered += 1; if (r.correct) t.right += 1; }
    t.streak = r.correct ? t.streak + 1 : 0;
  }
  return t;
}

/** "Right." or "Right. 4 in a row." from 3 in a row (B7 D). */
export const rightLine = (streak) => (streak >= 3 ? `Right. ${streak} in a row.` : 'Right.');

/** The live region on each move (B1): "Card 3 of 21", "Question 4 of 21", "Lesson 1 of 21". */
export function positionWords(item, position, total) {
  const noun = item?.type === 'question' ? 'Question' : item?.type === 'lesson' ? 'Lesson' : 'Card';
  return `${noun} ${position} of ${total}`;
}

/** The stop sheet's line (A4 3.3.10, R2 ruling 6). */
export { stopSheetLine as stopLine } from '../stage/endModel.mjs';

/**
 * How many items the student has finished, for the stop sheet's "N of M done". It counts the items before the one on screen,
 * plus the one on screen once the server has it: an answered question, or a card whose rating or look the server already
 * holds while the card is still flying away. Counting that flying card keeps the sheet equal to the end screen, which counts
 * up to the last item the server saw.
 */
export function itemsFinished({ phase, at, length, item = null, answered = false, acted = false }) {
  if (phase !== 'play') return length;
  return at + (item && ((item.type === 'question' && answered) || acted) ? 1 : 0);
}

/**
 * Whether the server holds an event for an item of the run player (R5 LK45 fix 2: the stop sheet counts the way the end does,
 * reachedPlace in stage/endModel.mjs). An item before the one on screen holds one when it is a card (rated or looked at), a
 * lesson (read or skipped) or an answered question; a skipped question writes nothing. The item on screen holds one once its
 * rating, look or answer is in the server's hands (`acted` for a card, a result for a question).
 */
export function itemHeld({ item, index, at, answers = {}, actedId = null }) {
  if (!item || index > at) return false;
  if (item.type === 'question') return Boolean(answers?.[item.id]?.result);
  if (index < at) return true;
  return item.type === 'card' && actedId === item.id;
}

/**
 * Where a re-inserted item goes in the client's list (A5 R7, A8 F9 and F11). The server's `at` is a place in the run's whole
 * list; a resumed run holds only the items after `offset`. `moved: true` moves the item already in the list (never a copy).
 * Returns the new list (the same list when nothing changes).
 */
export function placeReinsert(list, { itemId, at, item = null, moved = false } = {}, { current = 0, offset = 0 } = {}) {
  const items = Array.isArray(list) ? list : [];
  if (!itemId) return items;
  const want = Number.isFinite(Number(at)) ? Number(at) - offset : current + 3;
  const has = items.findIndex((x) => x.id === itemId);
  if (has >= 0) {
    if (!moved || has <= current) return items;
    const rest = items.filter((x) => x.id !== itemId);
    const i = Math.max(current + 1, Math.min(rest.length, want));
    // R5 LK38: the card has now used its one second showing, so its Missed words are the server's fresh ones (no "in this run").
    const moved_ = item?.returns ? { ...items[has], returns: item.returns } : items[has];
    return [...rest.slice(0, i), moved_, ...rest.slice(i)];
  }
  if (!item) return items;
  const i = Math.max(current + 1, Math.min(items.length, want));
  return [...items.slice(0, i), { ...item, id: itemId }, ...items.slice(i)];
}

// ---------------------------------------------------------------- the end (A4 3.4, shared form with the feed end)

/** "Getting there" -> 'getting_there', the state key the ring shape reads. */
export const stateKeyOf = (label) => String(label || '').trim().toLowerCase().replace(/\s+/g, '_');

/** "Admission of a Partner moved from Getting there to Holding." -> { from, to } (Pro only; null when nothing moved). */
export function movedParts(moved) {
  const m = String(moved || '').match(/moved from (.+?) to (.+?)\.?$/);
  return m ? { from: m[1], to: m[2] } : null;
}

/** "14 back Wed, 2 back in 20 days" from the server's groups; the total in Revise. */
export function reviseSummary(groups) {
  const list = (groups || []).filter((g) => Number(g?.count) > 0);
  const total = list.reduce((s, g) => s + Number(g.count), 0);
  return { total, line: list.map((g) => `${g.count} ${String(g.label).replace(/^back on /, 'back ')}`).join(', ') };
}

/**
 * The end's lines (A4 3.4.2, B7 G): label and value, only rows with something in them.
 *   Key cards     "16 rated, all got it" | "16 rated: 12 got it, 3 easy, 1 missed" (+ ", 2 looked at")
 *   Questions     "3 of 3 right"
 *   Open mistakes "2 of 2 fixed" | "1 of 2 fixed, 1 still open"
 */
export function endLines(data, { kind = 'mix' } = {}) {
  const n = data?.numbers || {};
  const lineOf = (label) => (data?.lines || []).find((l) => String(l.label).toLowerCase() === label)?.text || '';
  const out = [];
  const cardsText = lineOf('cards');
  if (kind === 'recap') {
    if (cardsText) out.push({ label: 'Key cards', value: cardsText });
  } else {
    const rated = Number(n.cards) || 0;
    const looked = Number((cardsText.match(/(\d+) looked at/) || [])[1]) || 0;
    const detail = String(n.detail?.cards || cardsText.replace(/,?\s*\d+ looked at/, '')).trim();
    const onlyGot = new RegExp(`^${rated} got it$`).test(detail);
    let value = rated ? `${rated} rated${detail ? (onlyGot ? ', all got it' : `: ${detail}`) : ''}` : '';
    if (looked) value = value ? `${value}, ${looked} looked at` : `${looked} looked at`;
    if (value) out.push({ label: 'Key cards', value });
  }
  const q = lineOf('questions') || n.detail?.questions;
  if (q) out.push({ label: 'Questions', value: q });
  // Open mistakes the run never reached (a stop before them) are not a line: nothing was tried.
  const m = n.mistakes === 0 ? null : lineOf('mistakes') || n.detail?.fixed;
  if (m) out.push({ label: 'Open mistakes', value: /fixed/.test(m) ? m : `${m} fixed` });
  return out;
}

/** The lead's heading, reason and key (A4 3.4.3): a run's key names its length ("Start 10 minutes"); else its own verb. */
export function leadView(option) {
  if (!option) return null;
  const title = option.title || String(option.label || '').replace(/, \d+ minutes?$/, '').replace(/, \d+ min$/, '');
  const minutes = Number(option.run?.minutes) || Number(option.minutes) || null;
  const isRun = option.run && (option.run.kind === 'mix' || option.run.kind === 'feed' || !option.run.kind) && minutes;
  const key = isRun ? `Start ${minutes} minutes` : title;
  return { heading: key === title ? null : title, reason: option.evidence || null, key };
}

/** The Free block of the end after the day's session (A4 3.4.4): the server's line split into its two sentences. */
export function freeEndLines(lead) {
  const line = String(lead?.line || '').trim();
  if (!line) return null;
  const m = line.match(/^(.+?\.)\s+(.+)$/);
  return m ? { head: m[1], rest: m[2] } : { head: line, rest: null };
}

/** The first sentence of Free's line on a first run ("Free opened 5 of this chapter's 46 cards."). */
export const firstSentence = (text) => (String(text || '').match(/^.+?\.(?=\s|$)/) || [String(text || '')])[0].trim() || null;

/** The end's title line (A4 3.4.2, 3.4.5): "10 minutes on" or "Stopped at 7 of 21 in", and the chapter's name. */
export function endTitle(title, { stoppedAt = null, total = null, kind = 'mix' } = {}) {
  const m = String(title || '').match(/^(.*?\b(?:minutes? on|recap of))\s+(.+)$/i);
  const name = m ? m[2] : String(title || '');
  if (stoppedAt !== null && total && stoppedAt < total && kind !== 'recap') return { lead: `Stopped at ${stoppedAt} of ${total} in`, name };
  return { lead: m ? m[1] : null, name };
}

export { plural };
