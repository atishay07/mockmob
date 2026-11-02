// Key cards content checks (KEYCARDS-CONTENT-SPEC.md section 5, checks 1-5) and the file writers shared by
// validate.mjs and review-merge.mjs. Pure where it can be: the PDF text is read through `pdfText()` and cached.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalJSON } from '../../data/canonical_json.mjs';
import { ENGLISH_KINDS, NCERT_KINDS, chapterSlug, isStopword } from '../../data/keycards.js';
import katex from 'katex';
import { FORBIDDEN_TEX, KATEX_OPTIONS, TEX_SUBJECTS, alnumBag, splitTex, texLines, texToPlain } from '../../data/keycards_tex.js';
import { stripKindPrefix } from '../../src/components/keycards/kinds.js';

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
const LABELLED_BACK = new Set(['example', 'fact']);
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

const EDGE = 3; // running heads and page numbers sit in the first or last few lines of a page
const edgeLines = (text) => {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  return lines.length <= EDGE * 2 ? lines : [...lines.slice(0, EDGE), ...lines.slice(-EDGE)];
};
const headKey = (line) => line.replace(/\d+/g, '#').replace(/\s+/g, ' ').trim().toLowerCase();

/**
 * Printed page = PDF page index (1-based) + offset. The offset is the majority vote over each page's page numbers: a line
 * that is only an integer ("49"), or an integer at either end of a short running head in the first or last lines
 * ("BUSINESS STUDIES 290", "291 Consumer Protection"). A stray number in a table does not move the vote. Null when
 * nothing votes.
 */
export function detectOffset(pages) {
  const votes = new Map();
  pages.forEach((text, i) => {
    const seen = new Set();
    const edges = new Set(edgeLines(text));
    for (const raw of text.split(/\r?\n/)) {
      const line = raw.trim();
      // Anywhere on the page: a line that is only a number (pdftotext often puts the corner number mid-text).
      // In the first or last lines only: a short running head that starts or ends with the number.
      const m = /^(\d{1,4})$/.exec(line) || (edges.has(line) && line.length <= 60 ? /^(\d{1,4})\s+\D.*$|^\D.*\s(\d{1,4})$/.exec(line) : null);
      if (!m) continue;
      const off = Number(m[1] ?? m[2]) - (i + 1);
      if (off < 0 || seen.has(off)) continue;
      seen.add(off);
      votes.set(off, (votes.get(off) || 0) + 1);
    }
  });
  let best = null;
  for (const [off, n] of votes) if (!best || n > best.n || (n === best.n && off < best.off)) best = { off, n };
  return best ? best.off : null;
}

/** Running heads: edge lines up to 120 characters (Accountancy prints a 71-character even-page head) whose shape (digits ignored) repeats on at least 30% of pages. */
function runningHeads(pages) {
  const count = new Map();
  for (const text of pages) for (const key of new Set(edgeLines(text).filter((l) => l.length <= 120).map(headKey))) count.set(key, (count.get(key) || 0) + 1);
  const min = Math.max(2, Math.ceil(pages.length * 0.3));
  return new Set([...count].filter(([, n]) => n >= min).map(([key]) => key));
}

/** A page without its running heads, page number and reprint line, normalised (for quotes that cross a page). */
function pageBody(text, heads) {
  const edges = new Set(edgeLines(text));
  return norm(text.split(/\r?\n/).filter((l) => {
    const t = l.trim();
    if (/^\d{1,4}$/.test(t) || /^Reprint \d{4}-\d{2}$/i.test(t)) return false;
    return !(edges.has(t) && heads.has(headKey(t)));
  }).join(' '));
}

/**
 * A second extraction in pdfium's reading order (scripts/keycards/pdfium_pages.py; Python with pypdfium2). pdftotext
 * interleaves two-column pages and side boxes line by line, so a sentence printed whole can come out split; a quote passes
 * when it is exact in either extraction. Optional: without Python or pypdfium2 (or with KEYCARDS_PDFIUM=0) only pdftotext
 * is read. Returns [raw page text] or null.
 */
function pdfiumPages(file) {
  if (process.env.KEYCARDS_PDFIUM === '0') return null;
  const script = path.join(ROOT, 'scripts/keycards/pdfium_pages.py');
  for (const bin of [process.env.KEYCARDS_PYTHON, 'python', 'python3'].filter(Boolean)) {
    try {
      const raw = execFileSync(bin, [script, file], { maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] }).toString('utf8');
      const pages = JSON.parse(raw);
      if (Array.isArray(pages)) return pages.map(String);
    } catch { /* try the next interpreter */ }
  }
  return null;
}

const pdfCache = new Map();
/**
 * { code, pages: [raw], page: [normalised], body: [normalised, running heads and page numbers stripped], full, offset,
 * alt: { page, body, full } | null (the pdfium extraction, same page indexes) }, or null when the PDF is missing.
 */
export function pdfText(code) {
  if (pdfCache.has(code)) return pdfCache.get(code);
  const file = path.join(pdfDir(), `${code}.pdf`);
  let out = null;
  if (/^[a-z]{4}\d{3}$/.test(code) && existsSync(file)) {
    BIN = BIN || pdftotextBin();
    const raw = execFileSync(BIN, ['-enc', 'UTF-8', file, '-'], { maxBuffer: 64 * 1024 * 1024 }).toString('utf8');
    const pages = raw.split('\f');
    if (pages.length > 1 && !pages[pages.length - 1].trim()) pages.pop();
    const heads = runningHeads(pages);
    const second = pdfiumPages(file);
    const altHeads = second && second.length === pages.length ? runningHeads(second) : null;
    const alt = altHeads ? { page: second.map(norm), body: second.map((text) => pageBody(text, altHeads)), full: norm(second.join(' ')) } : null;
    out = { code, pages, page: pages.map(norm), body: pages.map((text) => pageBody(text, heads)), full: norm(raw), offset: detectOffset(pages), alt };
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
  // A whole page as printed (a table heading repeated on every page is still text), or the stripped pages joined; in
  // the pdftotext extraction and, when present, the pdfium one.
  const windowsOf = (src) => {
    const at = (i) => src.body[i] || '';
    const whole = (i) => src.page?.[i] || '';
    return [whole(idx), whole(idx - 1), whole(idx + 1), at(idx), at(idx - 1) + at(idx), at(idx) + at(idx + 1), at(idx - 1) + at(idx) + at(idx + 1)];
  };
  const windows = [...windowsOf(pdf), ...(pdf.alt ? windowsOf(pdf.alt) : [])];
  if (windows.some((w) => w.includes(q))) return null;
  return pdf.full.includes(q) || pdf.alt?.full.includes(q) ? 'quote:wrong_page' : 'quote:not_in_pdf';
}

// ---------------------------------------------------------------- shape, blanks

const isText = (v) => typeof v === 'string' && v.trim().length > 0;
const stripEnum = (line) => line.replace(/^\s*(?:\(?(?:\d{1,2}|[ivxlc]{1,5}|[a-h])[.)]|[-\u2022*\u2013])\s+/i, '');

// A front must stand on its own (section 3, "one idea per card"; the reviewers' most common flag): never a pronoun or
// linking word that points back at text the student cannot see, and never a lowercase fragment. A first word with a
// capital or a digit inside it (mRNA, pH, tRNA) is a term, not a fragment.
const DANGLING = /^(?:It|Its|This|These|They|Those|Such|Thus|Hence|So|Therefore|However|Moreover|Alternatively|Also|Here|In other words|Not only that|On the other hand)\b/;
export const danglingStart = (text) => {
  const t = String(text ?? '').trim();
  const first = t.split(/\s+/)[0] || '';
  return DANGLING.test(t) || /^[a-z]+[,;:)]?$/.test(first);
};

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
  if (danglingStart(card.front)) r.push('shape:front_dangling');
  if (card.back.length > (LONG_BACK.has(card.kind) ? LIMITS.backLong : LIMITS.back)) r.push('shape:back_too_long');
  if (TEX_SUBJECTS.includes(subject) && frontCapitalFunction(card)) r.push('shape:front_capital_function');
  if (card.tex !== undefined) r.push(...texCheck(card, subject));
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

// "Sin(sin⁻¹ x) = x" is wrong maths: a function name is never capitalised. The front as the card shows it (after the kind
// prefix) starts with a capitalised function name followed by "(", a superscript (⁻¹, ²) or a space and a formula (not a
// word: "Log of a product" is prose).
const CAPITAL_FUNCTION = /^(?:Sin|Cos|Tan|Cot|Sec|Cosec|Csc|Log|Ln|Exp)(?:[(⁻⁰¹²³⁴⁵⁶⁷⁸⁹ⁿ]| (?![a-z]{2,}\b))/;
export const frontCapitalFunction = (card) => [card.front, card.tex?.front === undefined ? null : texToPlain(card.tex.front)]
  .some((f) => typeof f === 'string' && CAPITAL_FUNCTION.test(stripKindPrefix(card.kind, f).trimStart()));

// Typeset formulas (handoff-1102/MATHTEX-SPEC.md section 3): tex is a faithful rendering of the plain front and back, so
// its letters and digits must be theirs, line by line. Signs and operators cannot be checked by machine (the image
// reviewer checks them).
const TEX_LIMITS = Object.freeze({ front: 400, back: 1500, inline: 40 });
const INLINE_GRID = /\\begin\{(?:[a-zA-Z]*matrix|array|d?cases|aligned)\}/;
const plainBack = (tex) => texLines(tex).map(texToPlain).join('\n');

/** The tex field's checks (called from shapeCheck when the card has one). Returns reasons[]. */
export function texCheck(card, subject) {
  const tex = card?.tex;
  if (!tex || typeof tex !== 'object' || Array.isArray(tex) || !Object.keys(tex).length
    || Object.keys(tex).some((k) => k !== 'front' && k !== 'back') || Object.values(tex).some((v) => !isText(v))) return ['shape:tex_form'];
  const r = [];
  const add = (why) => { if (!r.includes(why)) r.push(why); };
  if (!TEX_SUBJECTS.includes(subject)) add('shape:tex_subject');
  if (card.kind === 'term' || card.kind === 'key_line' || (Array.isArray(card.blanks) && card.blanks.length)) add('shape:tex_kind');
  const strings = [tex.front, tex.back].filter((v) => v !== undefined);
  for (const text of strings) {
    const split = splitTex(text);
    const maths = split.parts.filter((p) => p.type === 'math');
    if (!split.ok || !maths.length) add('shape:tex_delims');
    // A forbidden command never reaches KaTeX.
    if (FORBIDDEN_TEX.test(text)) { add('shape:tex_command'); continue; }
    for (const p of maths) {
      try { katex.renderToString(p.value, { ...KATEX_OPTIONS, displayMode: p.display }); } catch { add('shape:tex_parse'); }
      // Inline math wraps inside a line of prose: a long formula or a grid of rows belongs on a $$…$$ line of its own.
      if (!p.display && ([...texToPlain(`$${p.value}$`)].length > TEX_LIMITS.inline || INLINE_GRID.test(p.value))) add('shape:tex_inline_long');
    }
  }
  const plainFront = tex.front === undefined ? null : texToPlain(tex.front);
  const plain = tex.back === undefined ? null : plainBack(tex.back);
  const backLimit = LONG_BACK.has(card.kind) ? LIMITS.backLong : LIMITS.back;
  if ((tex.front?.length || 0) > TEX_LIMITS.front || (tex.back?.length || 0) > TEX_LIMITS.back
    || (plainFront?.length || 0) > LIMITS.front || (plain?.length || 0) > backLimit) add('shape:tex_too_long');
  if ([plainFront, plain].some((t) => t !== null && t.includes('\\'))) add('shape:tex_plain');
  if (plainFront !== null && alnumBag(plainFront) !== alnumBag(card.front)) add('shape:tex_mismatch');
  if (tex.back !== undefined) {
    const texRows = texLines(tex.back);
    const backRows = texLines(card.back);
    if (texRows.length !== backRows.length) add('shape:tex_lines');
    else {
      texRows.forEach((line, i) => {
        if (alnumBag(texToPlain(line)) !== alnumBag(backRows[i])) add('shape:tex_mismatch');
        const back = norm(backRows[i]);
        if (splitTex(line).parts.some((p) => p.type === 'text' && !back.includes(norm(p.value)))) add('shape:tex_prose');
      });
    }
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
  // example: "the concept it illustrates, with NCERT's line"; fact: "the fact, with the NCERT sentence that states it"
  // (KEYCARDS-CONTENT-SPEC.md section 2). One short first line names it; everything after it must be NCERT's own words.
  if (LABELLED_BACK.has(card.kind)) {
    const [label, ...rest] = String(card.back).split(/\n+/);
    const body = norm(rest.join(' '));
    if (rest.length && label.trim().length <= 80 && body && q.includes(body)) return r;
  }
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
