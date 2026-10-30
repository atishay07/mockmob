// The syllabus as Key cards and chapter state read it (KEYCARDS-BUILD-SPEC.md 1 and 2). One small adapter so the merge
// with syllabus v2 is trivial:
//   - when data/cuet_syllabus.js exists (branch web/1031-syllabus), its documented interface is used as it is:
//     SUBJECT_OPTIONS, CHAPTERS, RETIRED_CHAPTERS, resolveChapter, chaptersFor, unitsFor;
//   - until then, the lookups fall back to data/canonical_syllabus.js: every chapter in a CUET unit is live, the
//     "Existing ... Coverage" units count as retired, and there are no NCERT references or chips.
// No 'server-only' and no alias imports, so node:test and scripts/keycards/*.mjs load it directly.
// The v2 import sits inside try in an async function: webpack marks it optional, so a build without the file only warns.
import * as canonical from '../../../data/canonical_syllabus.js';
import { chapterKeyOf } from '../../../data/keycards.js';

// The same options as data/cuet_syllabus.js SUBJECT_OPTIONS (spec section 1), used only while that file is absent.
export const FALLBACK_SUBJECT_OPTIONS = Object.freeze({
  mathematics: { label: 'Section', choices: [{ id: 'B1', label: 'B1 Mathematics' }, { id: 'B2', label: 'B2 Applied Mathematics' }], default: 'B1' },
  computer_science: { label: 'Section', choices: [{ id: 'B1', label: 'B1 Computer Science' }, { id: 'B2', label: 'B2 Informatics Practices' }], default: 'B1' },
  accountancy: { label: 'Part', choices: [{ id: 'AFS', label: 'Analysis of Financial Statements' }, { id: 'CAS', label: 'Computerised Accounting' }], default: 'AFS' },
});

const CHIPS = Object.freeze({ cuetOnly: 'CUET only', cbseClass11: 'CBSE teaches this in Class 11' });

/** The chip a chapter row shows, or null. */
export function chipFor(chapter) {
  if (chapter?.cuetOnly) return CHIPS.cuetOnly;
  if (chapter?.cbseClass11) return CHIPS.cbseClass11;
  return null;
}

/** Is `section` open for a student whose saved option is `option`? No option saved: everything. */
export function sectionOpen(section, option) {
  if (!option || section === null || section === undefined || section === '' || section === 'common') return true;
  // Section A (computer science) and A1 (mathematics) are common to both options.
  if (section === 'A' || section === 'A1') return true;
  return section === option;
}

function fromV2(mod) {
  const chapters = Array.isArray(mod.CHAPTERS) ? mod.CHAPTERS : [];
  const byKey = new Map(chapters.map((c) => [c.key, c]));
  const retiredByKey = new Map();
  for (const [subject, names] of Object.entries(mod.RETIRED_CHAPTERS || {})) {
    for (const [name, reason] of Object.entries(names || {})) retiredByKey.set(chapterKeyOf(subject, name), { retired: true, reason, name, subject });
  }
  const options = mod.SUBJECT_OPTIONS || FALLBACK_SUBJECT_OPTIONS;
  const chaptersFor = (subject, opts = {}) => (typeof mod.chaptersFor === 'function'
    ? mod.chaptersFor(subject, opts)
    : chapters.filter((c) => c.subject === subject && sectionOpen(c.section, opts.option)));
  const unitsFor = (subject, opts = {}) => {
    if (typeof mod.unitsFor === 'function') return mod.unitsFor(subject, opts);
    const out = [];
    for (const c of chaptersFor(subject, opts)) {
      let u = out.find((x) => x.unit === c.unit);
      if (!u) { u = { unit: c.unit, chapters: [] }; out.push(u); }
      u.chapters.push(c);
    }
    return out;
  };
  return {
    source: 'v2',
    year: mod.SYLLABUS_YEAR ?? 2026,
    subjectOptions: (subject) => options[subject] || null,
    resolveChapter: (subject, name) => mod.resolveChapter(subject, name),
    chapterByKey: (key) => byKey.get(key) || retiredByKey.get(key) || null,
    chaptersFor,
    unitsFor,
  };
}

function fromCanonical() {
  const live = new Map(); // key -> chapter
  const retired = new Map();
  const bySubject = new Map();
  for (const subject of canonical.CANONICAL_SYLLABUS) {
    const id = subject.subject_id;
    const units = [];
    let unitOrder = 0;
    for (const u of subject.units) {
      unitOrder += 1;
      const isOld = /^Existing .* Coverage$/i.test(u.unit_name);
      const sectionMatch = /^Section (A|B1|B2)\b/.exec(u.unit_name);
      const list = [];
      u.chapters.forEach((name, i) => {
        const key = chapterKeyOf(id, name);
        if (isOld) { retired.set(key, { retired: true, reason: 'not_in_cuet_2026', name, subject: id }); return; }
        const c = { key, subject: id, name, title: name, unit: u.unit_name, unitOrder, order: i + 1, ncert: null, section: sectionMatch ? sectionMatch[1] : null, cuetOnly: false, cbseClass11: false, lightWeight: false };
        if (!live.has(key)) { live.set(key, c); list.push(c); }
      });
      if (list.length) units.push({ unit: u.unit_name, chapters: list });
    }
    bySubject.set(id, units);
  }
  const unitsFor = (subject, { option } = {}) => (bySubject.get(subject) || [])
    .map((u) => ({ unit: u.unit, chapters: u.chapters.filter((c) => sectionOpen(c.section, option)) }))
    .filter((u) => u.chapters.length);
  return {
    source: 'canonical',
    year: 2026,
    subjectOptions: (subject) => FALLBACK_SUBJECT_OPTIONS[subject] || null,
    resolveChapter(subject, name) {
      const key = chapterKeyOf(subject, name);
      const c = live.get(key);
      if (c) return { key, name: c.name, title: c.title, unit: c.unit, section: c.section, retired: false };
      const r = retired.get(key);
      return r ? { retired: true, reason: r.reason, name: r.name } : null;
    },
    chapterByKey: (key) => live.get(key) || retired.get(key) || null,
    chaptersFor: (subject, opts = {}) => unitsFor(subject, opts).flatMap((u) => u.chapters),
    unitsFor,
  };
}

let loading = null;
/** The syllabus adapter, loaded once per process. */
export function loadKeycardsSyllabus() {
  if (!loading) {
    loading = (async () => {
      let mod = null;
      try {
        mod = await import('../../../data/cuet_syllabus.js');
      } catch {
        mod = null; // syllabus v2 not merged yet: the canonical fallback below
      }
      return mod && typeof mod.resolveChapter === 'function' ? fromV2(mod) : fromCanonical();
    })();
  }
  return loading;
}

/** For tests: build the adapter from a given module (or the fallback when null) without caching. */
export const syllabusFrom = (mod) => (mod && typeof mod.resolveChapter === 'function' ? fromV2(mod) : fromCanonical());
