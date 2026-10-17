// The chapter picker's pure rules (START-1017 D6, owner F8): chapters grouped by the syllabus's own units, a search
// that forgives case, punctuation and "&" against "and", and the 12-chapter limit the server applies.
// No React and no browser globals, so data/tests/fine_tune_scope.test.mjs runs them under node --test.
import { getCanonicalSubject, getCanonicalUnitForChapter } from '../../../../data/canonical_syllabus.js';

/** The most chapters one set takes: the server's slice (practiceSessions.js) and the app's maxChapters. */
export const MAX_CHAPTERS = 12;

const clean = (value) => String(value || '').trim();

/**
 * Units for the picker from a /api/chapters body. Grouped bodies keep their units; a flat list is grouped by the
 * canonical syllabus (data/canonical_syllabus.js) where its chapters are known there, and the rest go under
 * "Other chapters". `flat` is true when no unit holds more than one chapter (Business Studies): the picker then
 * shows one list with no unit headers. Returns { units: [{ id, name, chapters: [{ id, name }] }], count, flat }.
 */
export function chapterUnits(body, internalSubject = '') {
  const seen = new Set();
  const take = (chapter, index, unitId) => {
    const name = clean(chapter?.name ?? chapter);
    if (!name || seen.has(name)) return null;
    seen.add(name);
    return { id: clean(chapter?.id) || `${unitId}-${index}`, name };
  };
  let units = [];
  if (body?.grouped && Array.isArray(body.units)) {
    units = body.units.map((unit, u) => {
      const id = clean(unit?.id) || `unit-${u}`;
      return { id, name: clean(unit?.name) || 'Other chapters', chapters: (unit?.chapters || []).map((c, i) => take(c, i, id)).filter(Boolean) };
    });
  } else {
    const list = Array.isArray(body?.chapters) ? body.chapters : [];
    const canonical = getCanonicalSubject(internalSubject);
    const byName = new Map();
    const order = [];
    const other = [];
    list.forEach((chapter, i) => {
      const unitName = canonical ? getCanonicalUnitForChapter(internalSubject, clean(chapter?.name ?? chapter))?.unit_name || null : null;
      if (!unitName) { other.push([chapter, i]); return; }
      if (!byName.has(unitName)) { byName.set(unitName, []); order.push(unitName); }
      byName.get(unitName).push([chapter, i]);
    });
    // Units in the syllabus's own order, not the order the chapters happened to arrive in.
    const rank = (name) => { const at = canonical?.units?.findIndex((u) => u.unit_name === name) ?? -1; return at >= 0 ? at : 999; };
    order.sort((a, b) => rank(a) - rank(b));
    units = order.map((name, u) => ({ id: `unit-${u}`, name, chapters: byName.get(name).map(([c, i]) => take(c, i, `unit-${u}`)).filter(Boolean) }));
    if (other.length) units.push({ id: 'unit-other', name: units.length ? 'Other chapters' : '', chapters: other.map(([c, i]) => take(c, i, 'unit-other')).filter(Boolean) });
  }
  units = units.filter((unit) => unit.chapters.length > 0);
  const count = units.reduce((n, unit) => n + unit.chapters.length, 0);
  const flat = units.length === 0 || (units.length === 1 && !units[0].name) || units.every((unit) => unit.chapters.length === 1);
  return { units, count, flat };
}

/** Text for matching: lower case, "&" read as "and", punctuation dropped, spaces collapsed. */
export function searchKey(value) {
  return String(value || '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9\s]+/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * The units that match a search, each with only its matching chapters. Matching is on the chapter's own name, so every
 * chapter shown contains what was typed (owner F8: find a chapter by typing it). Only when no chapter name matches does a
 * unit's name count, and then that unit shows all its chapters ("reconstitution" finds the four chapters of that unit).
 * Units with no match fold away. An empty query returns the units as they are.
 */
export function filterUnits(units = [], query = '') {
  const needle = searchKey(query);
  if (!needle) return units;
  const byChapter = units.map((unit) => {
    const chapters = unit.chapters.filter((chapter) => searchKey(chapter.name).includes(needle));
    return chapters.length ? { ...unit, chapters } : null;
  }).filter(Boolean);
  if (byChapter.length) return byChapter;
  return units.filter((unit) => unit.name && searchKey(unit.name).includes(needle));
}

/**
 * Where the typed text sits in a chapter name, for the highlight: [start, end] in the name's own characters, or null.
 * Case-insensitive on the raw text ("&" and punctuation forgiveness only decide the match, not the highlight).
 */
export function matchRange(name = '', query = '') {
  const needle = String(query || '').trim().toLowerCase();
  if (!needle) return null;
  const at = String(name).toLowerCase().indexOf(needle);
  return at >= 0 ? [at, at + needle.length] : null;
}

/** Adds or removes one chapter; never past MAX_CHAPTERS. Returns the new list (the same list when nothing changes). */
export function toggleChapter(chosen = [], name, max = MAX_CHAPTERS) {
  if (chosen.includes(name)) return chosen.filter((entry) => entry !== name);
  if (chosen.length >= max) return chosen;
  return [...chosen, name];
}

/** "Whole unit" adds the unit's chapters up to the limit; "Clear unit" (every chapter already chosen) removes them. */
export function toggleUnit(chosen = [], unit, max = MAX_CHAPTERS) {
  const names = (unit?.chapters || []).map((chapter) => chapter.name);
  if (names.length && names.every((name) => chosen.includes(name))) return chosen.filter((name) => !names.includes(name));
  const next = [...chosen];
  for (const name of names) { if (next.length >= max) break; if (!next.includes(name)) next.push(name); }
  return next;
}

/**
 * What a link or a remembered choice may keep for a mode: chapters only for a mode that takes them, and only names
 * the subject has. Returns { chapters, dropped } where dropped counts what was set aside.
 */
export function chaptersForMode(allowsChapters, chosen = [], known = null) {
  const valid = (known ? chosen.filter((name) => known.includes(name)) : chosen).slice(0, MAX_CHAPTERS);
  return allowsChapters ? { chapters: valid, dropped: chosen.length - valid.length } : { chapters: [], dropped: chosen.length };
}
