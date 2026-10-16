// The trap atlas, the trap tag in an opened answer, the key-quality loop and "Traps you meet" (spec
// tmp/mistake-lab-v4/SPEC.md 4.7 second part, 4.11 and "Slice 4"). PURE: no I/O. Server side only, because option
// hashes use node:crypto (data/cohort_picks.js); the website and the app read the finished sentences.
//
// The atlas names the trap on one wrong option of one question. It is filled, once, by a committed v3 Mistake Repair
// (the repair's own trap_type, on the option the student chose), and every later student reads it without paying.
// Rows are keyed by the question and a hash of the option's text (never its position), so a shuffled NTA paper and a
// stored-order paper find the same row. A tag shows only when every repair of that option agrees: one that names a
// different trap type leaves it blank. Three question formats also carry a trap by their shape alone (no model, no
// repair): assertion-reason, match-the-list and sequence questions; their tags say "From the question format".
//
// The key-quality loop: a wrong option picked by 20 or more other students and by more of them than the key itself is
// no trap to teach. That question gets no trap label and goes to the existing re-check queue (the same path as a
// student report: src/lib/server/keyQuality.js). It is read from the cohort counts, never guessed.
//
// "Traps you meet" counts, from the student's own answers, how often a wrong option that carries a named trap was
// the one they picked. Arithmetic only: no cause, no forecast, no rank.
import COPY from './mistake_lab.copy.json' with { type: 'json' };
import { TRAP_LABELS } from './repair_presentation.mjs';
import { TRAP_TYPES, allowedTrapType } from './mistake_repair.js';
import { optionHash, optionRawText } from './option_hash.js';
import { correctIndex } from './recovery.js';
import { when, istDayMonth } from './attempt_ledger.js';
import { fill } from './across_mocks.js';

export const TRAPS_VERSION = 1;
const T = COPY.traps;
const LETTERS = 'ABCDEFGH';
const letter = (i) => LETTERS[i] || String(i + 1);
const IST_OFFSET_MS = 330 * 60 * 1000;
const DAY_MS = 86_400_000;

export const TRAP_RULES = Object.freeze({
  keyLoopMin: 20, // a wrong option picked by 20 or more other students, and by more than the key, is a key-quality flag
  rowMin: 3, // a trap shows in "Traps you meet" from 3 chances
  periodMin: 5, // "Falling": 5 or more chances in each period ...
  fallingDrop: 30, // ... and the later catch rate at least 30 points lower
  stillLaterMin: 4, // "Still catching you": 4 or more chances in the later period, at least half caught, rate not lower
  stillShare: 0.5,
  sources: Object.freeze(['repair', 'format']),
});

/** Trap types that name something (every type but "other"). */
export const NAMED_TRAPS = Object.freeze(TRAP_TYPES.filter((t) => t !== 'other'));
const NAMED = new Set(NAMED_TRAPS);

/** "A look-alike term" -> "a look-alike term". */
export function trapPhrase(trapType) {
  const label = TRAP_LABELS[trapType];
  return label ? label.charAt(0).toLowerCase() + label.slice(1) : null;
}

const istDayNumber = (ms) => Math.floor((Number(ms) + IST_OFFSET_MS) / DAY_MS);

// ---------- Filling the atlas (one committed v3 repair) ----------

/**
 * What one committed v3 repair writes: { qid, optionHash, trapType }, or null when it writes nothing. `other` names no
 * trap, so it is never stored; a chosen option that reads the same as the key is not a wrong option.
 */
export function atlasRecordFor({ question, chosenIndex, keyIndex, trapType } = {}) {
  if (!question?.id || !NAMED.has(trapType) || allowedTrapType(trapType, question) !== trapType) return null;
  const options = Array.isArray(question.options) ? question.options : [];
  if (!Number.isInteger(chosenIndex) || chosenIndex < 0 || chosenIndex >= options.length) return null;
  if (!Number.isInteger(keyIndex) || keyIndex < 0 || keyIndex >= options.length || keyIndex === chosenIndex) return null;
  const hash = optionHash(options[chosenIndex]);
  if (hash === optionHash(options[keyIndex])) return null;
  return { qid: question.id, optionHash: hash, trapType };
}

/** A stored atlas row that may show: it names a type, at least one repair agrees, none disagrees. */
export const cleanAtlasRow = (row) => !!row && NAMED.has(row.trap_type) && Number(row.repairs_agreeing) >= 1 && !(Number(row.repairs_disagreeing) > 0);

/** rows (trap_atlas rows) -> Map(qid -> Map(option_hash -> row)). Rows that may not show are left out. */
export function indexAtlas(rows) {
  const out = new Map();
  for (const row of Array.isArray(rows) ? rows : []) {
    if (!row || typeof row.qid !== 'string' || typeof row.option_hash !== 'string' || !cleanAtlasRow(row)) continue;
    if (!out.has(row.qid)) out.set(row.qid, new Map());
    out.get(row.qid).set(row.option_hash, row);
  }
  return out;
}

// ---------- Format rules: assertion-reason, match-the-list, sequence ----------

const stemOf = (q) => String(q?.question ?? q?.body ?? '');
const typeOf = (q) => String(q?.questionType ?? q?.question_type ?? '').toLowerCase();
const textsOf = (q) => (Array.isArray(q?.options) ? q.options : []).map((o) => optionRawText(o).replace(/\s+/g, ' ').trim());

const NOT_EXPLAIN = /\bnot\s+(?:the\s+|a\s+)?(?:correct\s+)?explanation\b|\b(?:does\s*n[o']?t|doesn['’]t|cannot|can\s*not|do\s+not)\s+explain\b|\bis\s+not\s+the\s+correct\b/i;
const EXPLAINS = /\bexplanation\b|\bexplains?\b/i;
/** For an assertion-reason option that calls both statements true: does it say R explains A (true), not (false), or neither (null). Null when the option is not a both-true option. */
export function bothTrueLink(text) {
  const t = String(text ?? '').replace(/\s+/g, ' ');
  if (!/\bboth\b[^.]*\btrue\b/i.test(t) || /\bboth\b[^.]*\bfalse\b/i.test(t)) return undefined;
  if (NOT_EXPLAIN.test(t)) return false;
  return EXPLAINS.test(t) ? true : null;
}

const PAIR = /\(?\b([A-F])\b\)?\s*(?:[-–→=:]|to)\s*\(?\b(VI|IV|V|I{1,3}|[1-6])\b\)?/gi;
function pairsOf(text) {
  const map = new Map();
  for (const m of String(text ?? '').matchAll(PAIR)) {
    const label = m[1].toUpperCase();
    if (map.has(label)) return null;
    map.set(label, m[2].toUpperCase());
  }
  return map.size >= 3 ? map : null;
}
function orderOf(text) {
  const tokens = (String(text ?? '').match(/\b[A-F1-6]\b/gi) || []).map((t) => t.toUpperCase());
  return tokens.length >= 3 && new Set(tokens).size === tokens.length ? tokens : null;
}
const sameSet = (lists) => lists.every((l) => l.length === lists[0].length && l.every((x) => lists[0].includes(x)));

/**
 * The format of a question, from its type and its shape: 'assertion_reason', 'match_list', 'sequence' or null. The
 * shape must hold in every option, so a question that only mentions an assertion in passing is not caught.
 */
export function questionFormat(q) {
  const options = textsOf(q);
  if (options.length < 3) return null;
  const type = typeOf(q);
  const stem = stemOf(q);
  if (type === 'assertion_reason' || (/\bassertion\b/i.test(stem) && /\breason\b/i.test(stem) && options.some((o) => bothTrueLink(o) !== undefined))) {
    return options.some((o) => bothTrueLink(o) !== undefined) ? 'assertion_reason' : null;
  }
  const pairs = options.map(pairsOf);
  if (pairs.every(Boolean) && sameSet(pairs.map((p) => [...p.keys()])) && (/match/i.test(type) || /\bmatch\b|\blist\b|\bcolumn\b/i.test(stem))) return 'match_list';
  const orders = options.map(orderOf);
  if (orders.every(Boolean) && sameSet(orders) && (/sequence|jumble|rearrang|order/.test(type) || /\b(?:arrange|sequence|correct order|chronolog|order)\b/i.test(stem))) return 'sequence';
  return null;
}

/**
 * The trap the question's own format puts on wrong option `index`: { trapType, detail, format } or null.
 *   assertion_reason  both this option and the key call both statements true and differ only on the link
 *   match_list        this option matches some, not all, of the pairs the key matches
 *   sequence          this option puts some, not all, of the items where the key puts them
 */
export function formatTrapFor(question, index) {
  const key = correctIndex(question);
  const options = textsOf(question);
  if (!Number.isInteger(key) || key < 0 || key >= options.length || !Number.isInteger(index) || index < 0 || index >= options.length || index === key) return null;
  const format = questionFormat(question);
  if (format === 'assertion_reason') {
    const mine = bothTrueLink(options[index]);
    const theirs = bothTrueLink(options[key]);
    if (typeof mine === 'boolean' && typeof theirs === 'boolean' && mine !== theirs) return { trapType: 'assertion_reason_link', detail: T.format.assertion_reason_link, format };
    return null;
  }
  if (format === 'match_list') {
    const a = pairsOf(options[index]);
    const k0 = pairsOf(options[key]);
    if (!a || !k0) return null;
    const n = k0.size;
    const same = [...k0].filter(([label, value]) => a.get(label) === value).length;
    return same > 0 && same < n ? { trapType: 'partly_true', detail: fill(T.format.match_list, { k: same, n }), format } : null;
  }
  if (format === 'sequence') {
    const a = orderOf(options[index]);
    const k0 = orderOf(options[key]);
    if (!a || !k0) return null;
    const n = k0.length;
    const same = k0.filter((token, i) => a[i] === token).length;
    return same > 0 && same < n ? { trapType: 'partly_true', detail: fill(T.format.sequence, { k: same, n }), format } : null;
  }
  return null;
}

// ---------- The key-quality loop ----------

/**
 * A key-quality flag from one question's cohort read ({ n, counts, keyIndex }): a wrong option picked by 20 or more
 * other students and by more of them than the key. Returns { index, picks, keyPicks, n } or null.
 */
export function keyQualityFlag(read) {
  if (!read || !Array.isArray(read.counts) || !Number.isInteger(read.keyIndex)) return null;
  const keyPicks = Number(read.counts[read.keyIndex]) || 0;
  let top = null;
  read.counts.forEach((raw, i) => {
    const picks = Number(raw) || 0;
    if (i !== read.keyIndex && picks >= TRAP_RULES.keyLoopMin && picks > keyPicks && (!top || picks > top.picks)) top = { index: i, picks };
  });
  return top ? { ...top, keyPicks, n: Number(read.n) || read.counts.reduce((s, c) => s + (Number(c) || 0), 0) } : null;
}

/**
 * Every question of the cohort snapshot (data/cohort/question_picks.v1.json) that the loop flags:
 * [{ qid, n, keyPicks, topPicks, topHash }], the biggest gap first. The key's hash is the entry's own keyHash.
 */
export function keyQualityFlags(snapshot) {
  const out = [];
  for (const [qid, entry] of Object.entries(snapshot?.questions || {})) {
    if (!entry?.picks || typeof entry.keyHash !== 'string') continue;
    const keyPicks = Number(entry.picks[entry.keyHash]) || 0;
    let top = null;
    for (const [hash, raw] of Object.entries(entry.picks)) {
      const picks = Number(raw) || 0;
      if (hash !== entry.keyHash && picks >= TRAP_RULES.keyLoopMin && picks > keyPicks && (!top || picks > top.picks)) top = { hash, picks };
    }
    if (top) out.push({ qid, n: Number(entry.n) || Object.values(entry.picks).reduce((s, c) => s + (Number(c) || 0), 0), keyPicks, topPicks: top.picks, topHash: top.hash });
  }
  return out.sort((a, b) => (b.topPicks - b.keyPicks) - (a.topPicks - a.keyPicks) || a.qid.localeCompare(b.qid));
}

// ---------- The trap tag in an opened answer (lab.traps) ----------

/** The tag for one wrong option, from an atlas row or the format: the finished sentences. */
function tagFor({ index, trapType, source, detail = null }) {
  return {
    index, letter: letter(index), trapType, label: TRAP_LABELS[trapType],
    text: fill(T.labels.tag, { phrase: trapPhrase(trapType) }), detail,
    source, sourceText: T.source[source],
  };
}

/** The trap on one served wrong option of a snapshot question, atlas first and then the format, or null. */
export function trapForOption({ question, index, atlasByHash = null }) {
  const options = Array.isArray(question?.options) ? question.options : [];
  const key = correctIndex(question);
  if (!Number.isInteger(index) || index < 0 || index >= options.length || index === key) return null;
  if (atlasByHash && atlasByHash.size) {
    const row = atlasByHash.get(optionHash(options[index]));
    // The option must not read the same as the key: a corrected key could land on a stored trap option.
    if (cleanAtlasRow(row) && Number.isInteger(key) && key >= 0 && optionHash(options[key]) !== row.option_hash) {
      return tagFor({ index, trapType: row.trap_type, source: 'repair' });
    }
  }
  const format = formatTrapFor(question, index);
  return format ? tagFor({ index, trapType: format.trapType, source: 'format', detail: format.detail }) : null;
}

/**
 * lab.traps (contract_traps_v1.json, `paper`): { version, tags: { [qid]: tag } } for the student's wrong answers on this
 * paper, or null when no wrong answer has a tag. Left out: held questions (any answer review), blanks, right answers,
 * and any question the key-quality loop flags (`lab.byQuestion[qid].others`, the cohort read the Lab already shows).
 * `atlas` is indexAtlas(rows) or null: without it only the format rules show.
 */
export function buildTrapTags({ attempt, answerReviews = {}, lab = null, atlas = null } = {}) {
  const questions = Array.isArray(attempt?.questionsSnapshot) ? attempt.questionsSnapshot : [];
  const details = new Map((attempt?.details || []).map((d) => [d.qid, d]));
  const tags = {};
  for (const q of questions) {
    const d = details.get(q?.id);
    if (!d || d.isCorrect !== false || !Number.isInteger(d.givenIndex)) continue;
    if (answerReviews?.[q.id]) continue; // any answer review (held, corrected, re-checked): not a clean wrong answer
    if (keyQualityFlag(lab?.byQuestion?.[q.id]?.others)) continue;
    const tag = trapForOption({ question: q, index: d.givenIndex, atlasByHash: atlas?.get(q.id) || null });
    if (tag) tags[q.id] = tag;
  }
  return Object.keys(tags).length ? { version: TRAPS_VERSION, tags } : null;
}

// ---------- Traps you meet (4.11) ----------

/**
 * Per served option of a snapshot question: which named traps the option carries. Map(trapType -> Set(index)), the key's
 * own option left out. Atlas rows are matched by option hash, format traps by shape.
 */
export function trapOptions(question, atlasByHash = null) {
  const out = new Map();
  const options = Array.isArray(question?.options) ? question.options : [];
  const key = correctIndex(question);
  if (!Number.isInteger(key) || key < 0 || key >= options.length) return out;
  const keyHash = atlasByHash?.size ? optionHash(options[key]) : null;
  for (let i = 0; i < options.length; i++) {
    if (i === key) continue;
    const found = [];
    if (atlasByHash?.size) {
      const row = atlasByHash.get(optionHash(options[i]));
      if (cleanAtlasRow(row) && row.option_hash !== keyHash) found.push(row.trap_type);
    }
    const format = formatTrapFor(question, i);
    if (format) found.push(format.trapType);
    for (const type of new Set(found)) {
      if (!out.has(type)) out.set(type, new Set());
      out.get(type).add(i);
    }
  }
  return out;
}

/**
 * "Falling" or "Still catching you" for the two periods of one trap, or null. Compared as whole numbers (k1 / n1 against
 * k2 / n2 by cross-multiplying), never as decimals: 7 of 10 against 4 of 10 is exactly 30 points, and 0.7 - 0.4 is not.
 */
export function trapStatus(before, since) {
  if (!before || !since || !(before.n > 0) || !(since.n > 0)) return null;
  const gapPoints100 = (before.k * since.n - since.k * before.n) * 100; // (rate before - rate since) * n1 * n2 * 100
  const scale = before.n * since.n;
  if (before.n >= TRAP_RULES.periodMin && since.n >= TRAP_RULES.periodMin && gapPoints100 >= TRAP_RULES.fallingDrop * scale) return 'falling';
  if (since.n >= TRAP_RULES.stillLaterMin && since.k >= TRAP_RULES.stillShare * since.n && gapPoints100 <= 0) return 'still';
  return null;
}

/**
 * Traps you meet (contract_traps_v1.json, `sheet`; GET /api/me/traps): every named trap the student has had a chance
 * to fall for, with how often they did, and the split before and after the middle chance. `attempts` are the student's
 * own (camelCase, as Database.getAttempts returns them); `atlas` is indexAtlas(rows) or null; `skip` is a Set of question
 * ids that count for nothing (held for re-check, or flagged by the key-quality loop: their key is in doubt, as it is for the
 * trap tag). States:
 *   ready  at least one trap has 3 or more chances
 *   empty  no trap has 3 chances yet
 */
export function buildTrapsMeet({ attempts = [], atlas = null, skip = null } = {}) {
  const chances = new Map(); // trapType -> [{ at, caught }]
  for (const a of Array.isArray(attempts) ? attempts : []) {
    const at = when(a);
    if (!at || !Array.isArray(a.questionsSnapshot)) continue;
    const given = new Map((a.details || []).filter((d) => d && Number.isInteger(d.givenIndex)).map((d) => [d.qid, d.givenIndex]));
    for (const q of a.questionsSnapshot) {
      if (!q?.id || !given.has(q.id)) continue;
      if (skip?.has(q.id)) continue; // a question held for re-check, or flagged by the key-quality loop, is no chance
      const mine = given.get(q.id);
      for (const [type, indexes] of trapOptions(q, atlas?.get(q.id) || null)) {
        if (!chances.has(type)) chances.set(type, []);
        chances.get(type).push({ at, caught: indexes.has(mine) });
      }
    }
  }
  const rows = [];
  for (const [trapType, list] of chances) {
    if (list.length < TRAP_RULES.rowMin) continue;
    const sorted = [...list].sort((x, y) => x.at - y.at);
    const caught = sorted.filter((c) => c.caught).length;
    const splitDay = istDayNumber(sorted[Math.ceil(sorted.length / 2)]?.at ?? sorted[0].at);
    const early = sorted.filter((c) => istDayNumber(c.at) < splitDay);
    const late = sorted.filter((c) => istDayNumber(c.at) >= splitDay);
    const split = early.length && late.length;
    const before = split ? { k: early.filter((c) => c.caught).length, n: early.length } : null;
    const since = split ? { k: late.filter((c) => c.caught).length, n: late.length } : null;
    const status = trapStatus(before, since);
    const date = split ? istDayMonth(late[0].at) : null;
    rows.push({
      trapType, label: TRAP_LABELS[trapType], caught, of: sorted.length,
      text: fill(T.row, { trap: TRAP_LABELS[trapType], k: caught, n: sorted.length }),
      periods: split ? { date, before, since, text: fill(T.periods, { date, k: before.k, n: before.n, k2: since.k, n2: since.n }) } : null,
      status, statusLabel: status ? T.status[status] : null,
    });
  }
  rows.sort((x, y) => y.caught - x.caught || y.of - x.of || x.trapType.localeCompare(y.trapType));
  return {
    version: TRAPS_VERSION,
    state: rows.length ? 'ready' : 'empty',
    title: T.labels.title,
    rows,
    message: rows.length ? null : T.empty,
    basis: T.basis,
    fine: T.fine,
  };
}
