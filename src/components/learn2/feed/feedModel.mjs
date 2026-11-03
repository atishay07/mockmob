// The Explore feed's client rules (A1 3.3, 3.8, 3.10; A8 F6, F9, F11, F17, F18): pure, so node --test holds them
// (feedModel.test.mjs). One definition of every count (B7 G): "Questions" are plain questions; old mistakes have their own
// line; "seen" counts cards that were on screen, not positions passed.
import { checkpointLines } from '../stage/endModel.mjs';

const secondsOf = (item) => {
  const own = Number(item?.seconds);
  if (Number.isFinite(own) && own > 0) return own;
  return item?.type === 'question' ? 60 : 15;
};

/** Seconds of the items from index `from` on (the current one counts until it is finished). */
export const secondsFrom = (items, from) => (items || []).slice(Math.max(0, from)).reduce((s, i) => s + secondsOf(i), 0);

/**
 * The session's own numbers from the client's item states.
 *   answered, right   plain questions answered and right (old mistakes left out, B7 G)
 *   mistakes, fixed   old mistakes answered and fixed
 *   kept              cards kept in this session
 *   seen              cards that were on screen (states[id].seen)
 */
export function feedNumbers(items, states) {
  const out = { answered: 0, right: 0, mistakes: 0, fixed: 0, kept: 0, seen: 0 };
  for (const item of items || []) {
    const st = states?.[item.id] || {};
    if (item.type === 'card') {
      if (st.kept) out.kept += 1;
      if (st.seen) out.seen += 1;
      continue;
    }
    const res = st.answer?.res;
    if (!res) continue;
    if (item.origin === 'mistake') { out.mistakes += 1; if (res.correct) out.fixed += 1; } else { out.answered += 1; if (res.correct) out.right += 1; }
  }
  return out;
}

/**
 * A checkpoint's number and its one line (A1 3.8 as amended by R2 screens 12): "2 of 3 right" / "6 cards seen" and
 * "8 of 21 done, about 6 min left." Never a zero lead ("0 kept" is dropped); the third line is gone.
 */
export function checkpointText(numbers, { done, of, seconds }) {
  // done is the one count the stopped end and the stop sheet use (stoppedCount); a zero is left out of the line.
  const n = numbers || {};
  const left = timeLeftOf(seconds);
  const { big, line } = checkpointLines({ answered: n.answered, right: n.right, seen: n.seen, kept: n.kept }, { done, of, left });
  return { big, status: line, line: null };
}

/**
 * The one "done" count of a feed: the place of the last card kept or question answered, capped at the feed's length. The checkpoint,
 * the Close stop sheet and the stopped end all print this, so one stop never reads two numbers (a turned card holds nothing).
 */
export const stoppedCount = (of, itemsDone) => Math.max(0, Math.min(Number(of) || 0, Number(itemsDone) || 0));

const timeLeftOf = (seconds) => (seconds > 0 ? (seconds * 1.1 < 60 ? 'Under a minute left' : `About ${Math.max(1, Math.round((seconds * 1.1) / 60))} min left`) : null);

/** "Up next: ..." from the next slot (A1 3.3), null when nothing follows. */
export function upNextText(slot) {
  if (!slot) return null;
  if (slot.type === 'end') return 'Up next: how it went';
  if (slot.type === 'checkpoint') return 'Up next: a checkpoint';
  const item = slot.item;
  if (item?.type === 'card') return 'Up next: a Key card';
  if (item?.origin === 'mistake') {
    const label = String(item.mistake?.label || '');
    const said = label.replace(/^You missed this\s*/i, '').trim();
    return said ? `Up next: a question you missed ${said}` : 'Up next: an open mistake';
  }
  return 'Up next: a question';
}

/** Each plain question's place among the feed's plain questions: Map(id -> { n, of }). */
export function questionPlaces(items) {
  const qs = (items || []).filter((i) => i.type === 'question' && i.origin !== 'mistake');
  return new Map(qs.map((q, i) => [q.id, { n: i + 1, of: qs.length }]));
}

/**
 * The list after an answer's re-insert (BUILD-1101 1.7, A8 F9, F11, F18). reinsert = { itemId, at, item, moved }.
 *   moved     the card already in the list moves to `at` (or stays when it is closer); never a copy
 *   otherwise the copy goes in at `at`, once (an id already in the list is never added twice)
 * `at` is a place in the server's full list; a resumed list holds only what was not done, so there it is the answered
 * item's place plus 3 (the server's gap).
 */
export function spliceReinsert(list, { answeredId, reinsert, resumed = false } = {}) {
  const items = Array.isArray(list) ? list : [];
  const id = reinsert?.item?.id || reinsert?.itemId;
  if (!id) return items;
  const from = items.findIndex((x) => x.id === answeredId);
  const wanted = resumed || !Number.isFinite(Number(reinsert.at)) ? from + 3 : Number(reinsert.at);
  if (reinsert.moved) {
    const j = items.findIndex((x) => x.id === id);
    if (j < 0) return items;
    const target = Math.max(from + 1, Math.min(items.length - 1, wanted));
    if (j <= target) return items;
    const next = items.filter((_, k) => k !== j);
    next.splice(target, 0, items[j]);
    return next;
  }
  if (!reinsert.item || items.some((x) => x.id === id)) return items;
  const next = [...items];
  next.splice(Math.max(from + 1, Math.min(next.length, wanted)), 0, reinsert.item);
  return next;
}

/** The phone sheet "This feed": one row per item with its state (A1 3.7). */
export function sheetRows(items, states, base = 0) {
  return (items || []).map((item, i) => {
    const st = states?.[item.id] || {};
    const res = st.answer?.res;
    const state = item.type === 'card' ? (st.kept ? 'kept' : st.seen ? 'seen' : null) : res ? (res.correct ? 'right' : 'wrong') : st.skipped ? 'seen' : null;
    const words = item.type === 'card' ? String(item.card?.front || '') : String(item.question?.body || '');
    return { id: item.id, n: base + i + 1, kind: item.type === 'card' ? 'Key card' : item.origin === 'mistake' ? 'Open mistake' : 'Question', words: words.replace(/_{3,}/g, '___').replace(/\s+/g, ' ').trim(), state };
  });
}
