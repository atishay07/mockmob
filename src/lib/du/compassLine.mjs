// The Admission Compass line on Today: how many DU programmes the student's subjects open, and the
// first college on My colleges with its 2026 Round 1 cutoff. Pure rules, no I/O, so the same code that
// runs the Compass page counts here (evaluateAll over the Bulletin's combinations) and a test can pin the
// number. Nothing is estimated: the count is the eligibility engine's, the cutoff is DU's published value.
//
// Which subjects count follows the Compass page exactly (CutoffCalculator): a selection kept on this
// device wins, otherwise the subjects on the student's profile. Today therefore never disagrees with the
// number Compass opens on.
import { effectiveCutoff, evaluateAll } from './eligibility.js';
import { decodeSelection, formatScore } from './client.js';

/** Profile subject ids are the DU catalog ids, except the aptitude test. */
export const toDuId = (id) => (id === 'general_test' ? 'gat' : id);

export const COMPASS_HREF = '/admission-compass';
export const NO_SUBJECTS_LINE = 'Add your subjects to see which DU programmes they open.';
export const NO_SUBJECTS_KEY = 'Add subjects';
export const OPEN_KEY = 'Open Colleges'; // One name for the place on every surface (W-067).

/** The subjects the Compass page would start from, as the comma list it reads. */
export function startingList({ saved, profile } = {}) {
  const fromDevice = typeof saved?.s === 'string' ? saved.s.trim() : '';
  if (fromDevice) return fromDevice;
  return (Array.isArray(profile) ? profile : []).filter((id) => typeof id === 'string').map(toDuId).join(',');
}

/**
 * The line's state. `rules` is public/du/2026/rules.json (or index.json). Returns
 *   { status: 'unavailable' }                      the rules have not loaded
 *   { status: 'no-subjects' }                      the student has no DU subjects yet
 *   { status: 'ready', open, total, category }     open of total DU programmes
 */
export function compassState({ rules, saved = null, profile = [] } = {}) {
  const groups = Array.isArray(rules?.groups) ? rules.groups : null;
  if (!groups || !groups.length) return { status: 'unavailable' };
  const selection = decodeSelection(startingList({ saved, profile }), rules);
  const any = selection.languages.length + selection.domains.length > 0 || selection.gat;
  if (!any) return { status: 'no-subjects' };
  const open = evaluateAll(groups, selection).filter((r) => r.eligible).length;
  const category = typeof saved?.c === 'string' && saved.c ? saved.c : 'UR';
  return { status: 'ready', open, total: groups.length, category };
}

export const countLine = (open, total) => `${open} of ${total} DU programmes open to your subjects`;

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/**
 * The 2026 Round 1 cutoff of one My colleges entry, for a category. `offerings` is the programme's file
 * (public/du/2026/offerings/<id>.json). Returns { cutoff, category } or null when the college has no row or
 * DU published no Round 1 cutoff for it. An unknown category falls back to Unreserved, as the Compass does.
 */
export function roundOneCutoff(offerings, entry, category = 'UR') {
  const rows = Array.isArray(offerings?.rows) ? offerings.rows : [];
  const mine = rows.filter((r) => r[0] === entry?.college);
  if (!mine.length) return null;
  const row = mine.find((r) => norm(r[1]) === norm(entry.programme)) || mine[0];
  const cats = Array.isArray(offerings.categories) ? offerings.categories : ['UR'];
  const used = cats.includes(category) ? category : 'UR';
  const cutoff = effectiveCutoff(row[2], Math.max(0, cats.indexOf(used)));
  return typeof cutoff === 'number' ? { cutoff, category: used } : null;
}

/** "2026 Round 1 cutoff 718.6 for UR" (one decimal in en-IN, as Compass shows it). */
export const cutoffLine = ({ cutoff, category }) => `2026 Round 1 cutoff ${formatScore(cutoff)} for ${category}`;
