// Key cards content checks (KEYCARDS-CONTENT-SPEC.md section 5, checks 1-5) and the file writers shared by
// validate.mjs and review-merge.mjs. Pure where it can be: the PDF text is read through `pdfText()` and cached.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalJSON } from '../../data/canonical_json.mjs';
import { ENGLISH_KINDS, NCERT_KINDS, chapterSlug, isStopword } from '../../data/keycards.js';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
// Paths are read from the environment on every call (tests and the pipeline point them at their own folders).
const ncertRoot = () => (process.env.KEYCARDS_NCERT_DIR ? path.resolve(process.env.KEYCARDS_NCERT_DIR, '..') : path.resolve(ROOT, '../ncert-books'));
export const pdfDir = () => (process.env.KEYCARDS_NCERT_DIR ? path.resolve(process.env.KEYCARDS_NCERT_DIR) : path.join(ncertRoot(), 'pdf'));
export const draftsDir = () => (process.env.KEYCARDS_DRAFTS_DIR ? path.resolve(process.env.KEYCARDS_DRAFTS_DIR) : path.join(ncertRoot(), 'drafts'));
export const reviewsDir = () => (process.env.KEYCARDS_REVIEWS_DIR ? path.resolve(process.env.KEYCARDS_REVIEWS_DIR) : path.join(ncertRoot(), 'reviews'));
export const outDir = () => (process.env.KEYCARDS_OUT_DIR ? path.resolve(process.env.KEYCARDS_OUT_DIR) : path.join(ROOT, 'data/keycards'));
export const SOURCE_LABEL = 'NCERT Reprint 2026-27';

// Size limits (section 3: "about" 140 / 420 / 700 / 160), with a small tolerance so "about" is not a hair trigger.
export const LIMITS = Object.freeze({ front: 150, back: 450, backLong: 750, note: 180 });
const LONG_BACK = new Set(['list', 'steps', 'types']);
// Kinds whose back may be several exact fragments of the quote joined by line breaks (a list, a table row, a formula with
// its symbols). The spec names list, steps and types; difference, formula and entry are tables or ledgers in NCERT and
// need the same shape. Every fragment must still be inside the quote, and the quote inside the PDF.
const FRAGMENT_BACK = new Set(['list', 'steps', 'types', 'difference', 'formula', 'entry']);
const BLANK = /_{3,}/g;

/** Section 5 normalisation: NFKC, lowercase, only letters and digits (so hyphenated line breaks and spacing vanish). */
export const norm = (text) => String(text ?? '').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
const words = (text) => String(text ?? '').normalize('NFKC').toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);
export const sha256 = (text) => createHash('sha256').update(text).digest('hex');
/** The content hash a review verdict is tied to: any change to what the card says needs a new review. */
export const cardHash = (card) => sha256(canonicalJSON({ ...card, reasons: undefined, review: undefined }));

// ---------------------------------------------------------------- PDF text

function pdftotextBin() {
  const tried = [process.env.KEYCARDS_PDFTOTEXT, 'pdftotext', '/mingw64/bin/pdftotext', 'C:\\Program Files\\Git\\mingw64\\bin\\pdftotext.exe'].filter(Boolean);
  for (const bin of tried) {
    try { execFileSync(bin, ['-v'], { stdio: 'ignore' }); return bin; } catch (e) { if (e.code !== 'ENOENT' && e.status !== undefined) return bin; }
  }
  throw new Error(`pdftotext not found (tried ${tried.join(', ')}); set KEYCARDS_PDFTOTEXT`);
}
let BIN = null;

/**
 * Printed page = PDF page index (1-based) + offset. The offset is the majority vote over the standalone integer lines
 * of each page (the corner page numbers), so a stray number in a table does not move it. Null when nothing votes.
 */
export function detectOffset(pages) {
  const votes = new Map();
  pages.forEach((text, i) => {
    const seen = new Set();
    for (const line of text.split('\n')) {
      const m = /^\s*(\d{1,4})\s*$/.exec(line);
      if (!m) continue;
      const off = Number(m[1]) - (i + 1);
      if (off < 0 || seen.has(off)) continue;
      seen.add(off);
      votes.set(off, (votes.get(off) || 0) + 1);
    }
  });
  let best = null;
  for (const [off, n] of votes) if (!best || n > best.n || (n === best.n && off < best.off)) best = { off, n };
  return best ? best.off : null;
}

/** Running heads and the reprint line: short lines on at least 30% of pages, stripped so a quote can cross a page. */
function runningLines(pages) {
  const count = new Map();
  for (const text of pages) for (const line of new Set(text.split('\n').map((l) => l.trim()).filter((l) => l && l.length <= 60))) count.set(line, (count.get(line) || 0) + 1);
  const min = Math.max(2, Math.ceil(pages.length * 0.3));
  return new Set([...count].filter(([line, n]) => n >= min || /^Reprint \d{4}-\d{2}$/.test(line)).map(([line]) => line));
}

const pdfCache = new Map();
/** { code, pages: [raw], body: [normalised, running heads and page numbers stripped], offset } or null when the PDF is missing. */
export function pdfText(code) {
  if (pdfCache.has(code)) return pdfCache.get(code);
  const file = path.join(pdfDir(), `${code}.pdf`);
  let out = null;
  if (/^[a-z]{4}\d{3}$/.test(code) && existsSync(file)) {
    BIN = BIN || pdftotextBin();
    const raw = execFileSync(BIN, ['-enc', 'UTF-8', file, '-'], { maxBuffer: 64 * 1024 * 1024 }).toString('utf8');
    const pages = raw.split('\f');
    if (pages.length > 1 && !pages[pages.length - 1].trim()) pages.pop();
    const heads = runningLines(pages);
    const body = pages.map((text) => norm(text.split('\n').filter((l) => !heads.has(l.trim()) && !/^\s*\d{1,4}\s*$/.test(l)).join('\n')));
    out = { code, pages, body, full: norm(raw), offset: detectOffset(pages) };
  }
  pdfCache.set(code, out);
  return out;
}

/**
 * Check 1. The normalised quote must be in the cited PDF, on the cited printed page or the page before or after it (a
 * line that crosses a page is searched across the joined pair). Returns a reason or null.
 */
export function quoteCheck(card, getPdf = pdfText) {
  const src = card.source || {};
  if (src.kind !== 'ncert') return null;
  const q = norm(card.quote);
  if (!q) return 'quote:missing';
  const pdf = getPdf(src.code);
  if (!pdf) return `quote:pdf_missing:${src.code}`;
  if (pdf.offset === null) return 'quote:page_offset_unknown';
  const idx = Number(src.page) - pdf.offset - 1; // 0-based page index of the printed page
  if (!Number.isInteger(idx) || idx < 0 || idx >= pdf.body.length) return 'quote:page_out_of_range';
  const at = (i) => pdf.body[i] || '';
  const windows = [at(idx), at(idx - 1), at(idx + 1), at(idx - 1) + at(idx), at(idx) + at(idx + 1), at(idx - 1) + at(idx) + at(idx + 1)];
  if (windows.some((w) => w.includes(q))) return null;
  return pdf.full.includes(q) ? 'quote:wrong_page' : 'quote:not_in_pdf';
}

// ---------------------------------------------------------------- shape, blanks

const isText = (v) => typeof v === 'string' && v.trim().length > 0;
const stripEnum = (line) => line.replace(/^\s*(?:\(?(?:\d{1,2}|[ivxlc]{1,5}|[a-h])[.)]|[-\u2022*\u2013])\s+/i, '');

/** Fill each `____` in `front` with the blanks in order. */
export function fillBlanks(front, blanks) {
  let i = 0;
  return String(front).replace(BLANK, () => (i < blanks.length ? blanks[i++] : '____'));
}

/** Check 2. Required fields, id pattern, sizes, and front/back derived from the quote. Returns reasons[]. */
export function shapeCheck(card, subject) {
  const r = [];
  const kinds = subject === 'english' ? [...ENGLISH_KINDS, ...NCERT_KINDS] : NCERT_KINDS;
  if (!card || typeof card !== 'object' || Array.isArray(card)) return ['shape:not_object'];
  for (const f of ['id', 'subject', 'chapterKey', 'chapter', 'unit', 'kind', 'front', 'back']) if (!isText(card[f])) r.push(`shape:missing_${f}`);
  if (r.length) return r;
  if (card.subject !== subject) r.push('shape:subject_mismatch');
  if (!kinds.includes(card.kind)) r.push('shape:kind_unknown');
  if (!Number.isInteger(card.v) || card.v < 1) r.push('shape:v');
  if (!['must', 'good'].includes(card.importance)) r.push('shape:importance');
  if (!Number.isInteger(card.asked) || card.asked < 0) r.push('shape:asked');
  if (!Array.isArray(card.tags) || card.tags.some((t) => typeof t !== 'string')) r.push('shape:tags');
  if (!Number.isFinite(card.order)) r.push('shape:order');
  if (!Array.isArray(card.blanks) || card.blanks.some((b) => !isText(b))) r.push('shape:blanks');
  if (card.note !== undefined && card.note !== null && (typeof card.note !== 'string' || card.note.length > LIMITS.note)) r.push('shape:note');
  const slug = String(card.chapterKey).startsWith(`${subject}.`) ? String(card.chapterKey).slice(subject.length + 1) : null;
  if (!slug || slug !== chapterSlug(slug)) r.push('shape:chapter_key');
  const idRe = new RegExp(`^kc\\.${subject}\\.${(slug || '').replace(/[-]/g, '\\-')}\\.[a-z][a-z0-9_]*-[a-z0-9]+(?:-[a-z0-9]+)*$`);
  if (!slug || !idRe.test(card.id)) r.push('shape:id_pattern');
  if (card.front.length > LIMITS.front) r.push('shape:front_too_long');
  if (card.back.length > (LONG_BACK.has(card.kind) ? LIMITS.backLong : LIMITS.back)) r.push('shape:back_too_long');
  const src = card.source;
  if (!src || typeof src !== 'object') { r.push('shape:source'); return r; }
  if (src.kind === 'ncert') {
    if (!/^[a-z]{4}\d{3}$/.test(String(src.code || ''))) r.push('shape:source_code');
    if (!isText(src.book)) r.push('shape:source_book');
    if (!Number.isInteger(src.chapterNo) || src.chapterNo < 1) r.push('shape:source_chapter');
    if (!Number.isInteger(src.page) || src.page < 1) r.push('shape:source_page');
    if (!isText(card.quote)) { r.push('shape:quote_missing'); return r; }
    r.push(...derivedCheck(card));
  } else if (src.kind === 'authored' || src.kind === 'wordnet') {
    if (subject !== 'english') r.push('shape:source_kind');
    if (Array.isArray(card.blanks) && card.blanks.length && isText(card.quote)) r.push(...derivedCheck(card));
  } else {
    r.push('shape:source_kind');
  }
  return r;
}

/** back (and for term / key_line, front) derived from quote as section 3 says. */
function derivedCheck(card) {
  const r = [];
  const q = norm(card.quote);
  const back = norm(card.back);
  const blanks = Array.isArray(card.blanks) ? card.blanks : [];
  if (card.kind === 'term' || card.kind === 'key_line') {
    const holes = (String(card.front).match(BLANK) || []).length;
    if (!blanks.length || holes !== blanks.length) r.push('shape:blank_count');
    else if (norm(fillBlanks(card.front, blanks)) !== q) r.push('shape:front_not_quote');
    // term: "the term, then the full sentence"; key_line: the full line with the blanked words marked.
    const termBack = card.kind === 'term' && back.endsWith(q) && norm(blanks.join(' ')) === back.slice(0, back.length - q.length);
    if (!(back === q || termBack)) r.push('shape:back_not_quote');
    return r;
  }
  if (back === q || (back && q.includes(back))) return r;
  if (FRAGMENT_BACK.has(card.kind)) {
    const parts = String(card.back).split(/\n+/).map(stripEnum).map(norm).filter(Boolean);
    if (parts.length && parts.every((p) => q.includes(p))) return r;
  }
  r.push('shape:back_not_quote');
  return r;
}

/** Check 3. Each blank is in the quote, is not a stopword, and does not show elsewhere in the front. Returns reasons[]. */
export function blanksCheck(card) {
  const r = [];
  const blanks = Array.isArray(card?.blanks) ? card.blanks : [];
  if (!blanks.length) return r;
  const quoteWords = ` ${words(card.quote).join(' ')} `;
  const frontWords = ` ${words(String(card.front).replace(BLANK, ' ')).join(' ')} `;
  blanks.forEach((b, i) => {
    const w = words(b);
    if (!w.length) { r.push(`blanks:${i}:empty`); return; }
    if (!quoteWords.includes(` ${w.join(' ')} `)) r.push(`blanks:${i}:not_in_quote`);
    if (w.every(isStopword)) r.push(`blanks:${i}:stopword`);
    if (frontWords.includes(` ${w.join(' ')} `)) r.push(`blanks:${i}:shown_in_front`);
  });
  return r;
}

/** Check 4 over one subject: same normalised quote and kind, or same front. The first in book order keeps its place. */
export function duplicateReasons(cards) {
  const out = new Map();
  const seenQuote = new Map();
  const seenFront = new Map();
  const seenId = new Map();
  const sorted = [...cards].sort((a, b) => String(a.chapterKey).localeCompare(String(b.chapterKey)) || (Number(a.order) || 0) - (Number(b.order) || 0));
  for (const c of sorted) {
    const add = (why) => out.set(c, [...(out.get(c) || []), why]);
    if (seenId.has(c.id)) add(`duplicate:id:${c.id}`); else seenId.set(c.id, c);
    const qk = `${c.kind}|${norm(c.quote)}`;
    if (norm(c.quote)) { if (seenQuote.has(qk)) add(`duplicate:quote:${seenQuote.get(qk).id}`); else seenQuote.set(qk, c); }
    const fk = norm(c.front);
    if (fk) { if (seenFront.has(fk)) add(`duplicate:front:${seenFront.get(fk).id}`); else seenFront.set(fk, c); }
  }
  return out;
}

/** Check 5. The chapter is a live CUET 2026 chapter (syllabus adapter) and the card's chapter names it. */
export function syllabusCheck(card, syllabus) {
  const ch = syllabus.chapterByKey(card.chapterKey);
  if (!ch) return 'syllabus:unknown_chapter';
  if (ch.retired) return `syllabus:retired:${ch.reason || 'retired'}`;
  if (ch.subject && ch.subject !== card.subject) return 'syllabus:subject_mismatch';
  return null;
}

// ---------------------------------------------------------------- files

export const readJSON = (file, fallback = undefined) => {
  if (!existsSync(file)) { if (fallback !== undefined) return fallback; throw new Error(`missing ${file}`); }
  return JSON.parse(readFileSync(file, 'utf8'));
};
export function writeJSON(file, value) {
  mkdirSync(path.dirname(file), { recursive: true });
  const text = `${JSON.stringify(value, null, 2)}\n`;
  writeFileSync(file, text);
  return text;
}

/** The verdicts review-merge.mjs keeps: { [cardId]: { ok, hash, reasons, code, at } }. */
export const VERDICTS_FILE = () => path.join(outDir(), 'review-verdicts.json');

/** Per chapter: cards by kind and by importance, quarantined count, and the coverage note. */
export function coverageFor(subject, published, quarantined, notes = {}) {
  const chapters = {};
  const row = (key) => (chapters[key] ||= { published: 0, quarantined: 0, byKind: {}, byImportance: { must: 0, good: 0 }, coverage_note: notes[key] ?? null });
  for (const c of published) {
    const r = row(c.chapterKey);
    r.published += 1;
    r.byKind[c.kind] = (r.byKind[c.kind] || 0) + 1;
    if (c.importance in r.byImportance) r.byImportance[c.importance] += 1;
  }
  for (const c of quarantined) row(typeof c.chapterKey === 'string' ? c.chapterKey : '(unknown)').quarantined += 1;
  for (const r of Object.values(chapters)) {
    r.mustShare = r.published ? Math.round((r.byImportance.must / r.published) * 100) / 100 : null;
    r.belowMinimum = r.published < 15 && !r.coverage_note;
  }
  return { subject, chapters };
}

/**
 * Write one subject's deck, quarantine and coverage, and return its manifest entry. The deck version moves up by one
 * when the published card set changes (ids, versions or content), never otherwise.
 */
export function writeSubject(subject, published, quarantined, notes = {}) {
  const deckFile = path.join(outDir(), 'decks', `${subject}.json`);
  const previous = readJSON(deckFile, null);
  const cards = [...published].sort((a, b) => String(a.chapterKey).localeCompare(String(b.chapterKey)) || a.order - b.order || a.id.localeCompare(b.id));
  const same = previous && canonicalJSON(previous.cards || []) === canonicalJSON(cards);
  const version = previous ? (same ? previous.version : (Number(previous.version) || 0) + 1) : 1;
  const text = writeJSON(deckFile, { subject, version, source: SOURCE_LABEL, cards });
  writeJSON(path.join(outDir(), 'quarantine', `${subject}.json`), { subject, cards: quarantined });
  writeJSON(path.join(outDir(), 'coverage', `${subject}.json`), coverageFor(subject, cards, quarantined, notes));
  return { version, sha256: sha256(text), cards: cards.length };
}

/** Recompute the manifest entry of every deck on disk (sha256 of the exact file bytes). */
export function writeManifest(entries) {
  const file = path.join(outDir(), 'manifest.json');
  const manifest = { ...readJSON(file, {}), ...entries };
  const sorted = Object.fromEntries(Object.keys(manifest).sort().map((k) => [k, manifest[k]]));
  writeJSON(file, sorted);
  return sorted;
}
