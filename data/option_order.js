// One stable option order per question (R5 Packet A, LK44, 2 Nov 2026).
//
// The owner noticed that "every answer is A" in Explore and Learn: older subjects' keys are stored mostly as A
// (Accountancy A 1,206 / B 96 / C 62 / D 41). NTA papers already shuffle per session (data/nta_item_checks.js
// ntaServedRow). Every other surface serves the order this module gives: a permutation seeded from the question id
// alone, so a question looks the same in Learn, Explore, Saved, a practice paper, a Mob paper, Revise and Rival,
// for every student, every time.
//
// The rules are the NTA engine's own (ntaServedRow and shuffleBlockers): options that name other options ("All of
// the above", "Both A and B"), single-label options, a conventional last option ("No error"), a stem that names an
// option, an explanation that names an option in a way that cannot be rewritten, and an unresolved key keep the
// stored order. Served letters A, B, C, D are given in served order; the key and the explanation's letter
// references move with their options; stored self-letter prefixes ("A. ...") are removed.
//
// order[i] is the stored index of the option served at position i (the NTA engine's nta_option_order). Stability
// needs the same inputs on every surface: the options, the stem (question/body), the key (correct_index /
// correct_answer) and the explanation. A surface that reads fewer columns must not call servedRow.
//
// Persisting: prefer the stored index or the stored letter (storedKeyAt) over a served letter, so old rows (which
// were served in the stored order) and new rows mean the same thing.
import { ntaServedRow, keyIndexOf } from './nta_item_checks.js';

export const OPTION_ORDER_VERSION = 'stable-1';
const SEED = `mockmob-options:${OPTION_ORDER_VERSION}`;
const LETTERS = 'ABCDE';

/** Options as an array: a JSON string is parsed; anything else that is not an array is an empty list. */
export function optionList(raw) {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') { try { const parsed = JSON.parse(raw); return Array.isArray(parsed) ? parsed : []; } catch { return []; } }
  return [];
}

const identity = (n) => Array.from({ length: n }, (_, i) => i);

/**
 * The row as every non-NTA surface serves it: options in the stable order, relabelled A-D in served order, the key
 * (correct_index, correct_answer) and the explanation's option references remapped. Adds option_order (served
 * position i shows stored option option_order[i]) and options_shuffled. Never mutates the input.
 */
export function servedRow(row) {
  if (!row || typeof row !== 'object') return { row, order: [], shuffled: false, reasons: ['no_row'] };
  const options = optionList(row.options);
  // An explanation kept as { text } is read and remapped through its text (ntaServedRow reads a string).
  const boxed = row.explanation && typeof row.explanation === 'object' && typeof row.explanation.text === 'string' ? row.explanation : null;
  const input = options === row.options && !boxed ? row : { ...row, options, ...(boxed ? { explanation: boxed.text } : {}) };
  const result = ntaServedRow(input, SEED);
  const order = Array.isArray(result.row?.nta_option_order) ? result.row.nta_option_order : identity(options.length);
  const out = { ...result.row, option_order: order, options_shuffled: Boolean(result.shuffled) };
  if (boxed) out.explanation = { ...boxed, text: result.row.explanation };
  delete out.nta_option_order;
  delete out.nta_options_shuffled;
  return { row: out, order, shuffled: Boolean(result.shuffled), reasons: result.reasons || [] };
}

// A questionOut-shaped question (data/db.js: body/question, options, correctIndex, correctAnswer, explanation) as the
// row servedRow reads. questionOut's correctIndex resolves the key the way keyIndexOf does, so both give one order.
const rowOfOut = (q) => ({
  id: q?.id, question: q?.question ?? q?.body ?? q?.stem, options: q?.options,
  correct_index: Number.isInteger(q?.correctIndex) ? q.correctIndex : null, correct_answer: q?.correctAnswer ?? null, explanation: q?.explanation ?? null,
});

/**
 * A questionOut-shaped question in the stable order: options relabelled A-D in served order, correctIndex and
 * correctAnswer remapped, explanation remapped, plus optionOrder and optionsShuffled (the snapshot fields NTA papers
 * already carry). Every other field is kept.
 */
export function servedOut(q) {
  if (!q || typeof q !== 'object') return q;
  const s = servedRow(rowOfOut(q));
  const key = Number.isInteger(s.row.correct_index) && s.row.correct_index >= 0 ? s.row.correct_index : q.correctIndex;
  return {
    ...q, options: s.row.options, correctIndex: key, correctAnswer: s.row.correct_answer ?? q.correctAnswer ?? null,
    explanation: s.row.explanation, optionOrder: s.order, optionsShuffled: s.shuffled,
  };
}

/** The stable order of a questionOut-shaped question. */
export function outOrder(q) {
  return servedRow(rowOfOut(q)).order;
}

/** The stable order alone: order[servedIndex] = storedIndex. */
export function stableOrder(row) {
  return servedRow(row).order;
}

export function isPermutation(order, n = Array.isArray(order) ? order.length : 0) {
  if (!Array.isArray(order) || order.length !== n) return false;
  const seen = new Set(order);
  return seen.size === n && order.every((v) => Number.isInteger(v) && v >= 0 && v < n);
}

/** The stored index of the option served at `servedIndex`; -1 when out of range. No order means the stored order. */
export function storedIndexOf(order, servedIndex) {
  if (!Number.isInteger(servedIndex) || servedIndex < 0) return -1;
  if (!Array.isArray(order) || !order.length) return servedIndex;
  return servedIndex < order.length ? order[servedIndex] : -1;
}

/** The served position of stored option `storedIndex`; -1 when out of range. */
export function servedIndexOf(order, storedIndex) {
  if (!Number.isInteger(storedIndex) || storedIndex < 0) return -1;
  if (!Array.isArray(order) || !order.length) return storedIndex;
  return order.indexOf(storedIndex);
}

/** The letter a stored option has always been known by: its own key when it carries one, else A-E by position. */
export function storedKeyAt(rawOptions, storedIndex) {
  const options = optionList(rawOptions);
  if (!Number.isInteger(storedIndex) || storedIndex < 0 || storedIndex >= options.length) return null;
  const option = options[storedIndex];
  if (option && typeof option === 'object' && option.key != null && String(option.key).trim()) return String(option.key).trim().toUpperCase();
  return LETTERS[storedIndex] || null;
}

/** The stored index a stored letter names (its own key first, then A-E by position); -1 when none. */
export function storedIndexOfKey(rawOptions, letter) {
  const options = optionList(rawOptions);
  const want = String(letter ?? '').trim().toUpperCase();
  if (!want) return -1;
  const keyed = options.findIndex((option) => option && typeof option === 'object' && option.key != null && String(option.key).trim().toUpperCase() === want);
  if (keyed >= 0) return keyed;
  const at = LETTERS.indexOf(want);
  return want.length === 1 && at >= 0 && at < options.length ? at : -1;
}

/** A served letter (A-E by served position) as the stored letter of the same option, through the row's stable order. */
export function storedLetterOfServed(row, servedLetter) {
  const served = LETTERS.indexOf(String(servedLetter ?? '').trim().toUpperCase());
  if (served < 0) return null;
  return storedKeyAt(row?.options, storedIndexOf(stableOrder(row), served));
}

/** A stored letter as the letter the same option is served under. */
export function servedLetterOfStored(row, storedLetter) {
  const stored = storedIndexOfKey(row?.options, storedLetter);
  const at = servedIndexOf(stableOrder(row), stored);
  return at >= 0 ? LETTERS[at] : null;
}

export { keyIndexOf };
