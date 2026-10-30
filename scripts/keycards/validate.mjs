#!/usr/bin/env node
// Key cards machine checks (KEYCARDS-CONTENT-SPEC.md section 5, checks 1-5) over the authors' drafts, then the files the
// site bundles (KEYCARDS-BUILD-SPEC.md 2a).
//
//   node scripts/keycards/validate.mjs [--subject=business_studies] [--machine-only] [--dry-run]
//
// Input   ncert-books/drafts/<code>.json = { code, subject, cards: [...], coverageNotes?: { <chapterKey>: "..." } }
//         data/keycards/review-verdicts.json (written by review-merge.mjs; check 6)
// Output  data/keycards/decks/<subject>.json        published cards only (0 failed checks)
//         data/keycards/quarantine/<subject>.json   every other card, each with `reasons`
//         data/keycards/coverage/<subject>.json     per chapter: by kind, by importance, quarantined, coverage_note
//         data/keycards/manifest.json               { <subject>: { version, sha256, cards } }
// A card that fails a check is quarantined; the run still succeeds. Malformed input (a draft that is not JSON, or not
// { code, subject, cards: [] }, or whose code is not its file name) exits 1 before anything is written.
// Check 6 (independent review): a card is published only with a passing verdict for its exact content. --machine-only
// skips that (a dry look at the machine checks before review); never use it for a release.
//
// Paths: KEYCARDS_NCERT_DIR (the PDFs; default ../ncert-books/pdf), KEYCARDS_DRAFTS_DIR, KEYCARDS_OUT_DIR,
// KEYCARDS_PDFTOTEXT (default: pdftotext on PATH, then /mingw64/bin/pdftotext).
import { readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadKeycardsSyllabus } from '../../src/lib/server/keycardsSyllabus.js';
import {
  VERDICTS_FILE, draftsDir as defaultDrafts, outDir, blanksCheck, cardHash, duplicateReasons, quoteCheck, readJSON, shapeCheck, syllabusCheck,
  writeManifest, writeSubject,
} from './lib.mjs';

export const DRAFT_NAME = /^[a-z]{4}[0-9a-z]{3}\.json$/;
const ignoredFiles = [];

/** Read and shape-check every draft file. Throws (exit 1) on malformed input. */
export function readDrafts(dir = defaultDrafts(), { subjects = null } = {}) {
  if (!existsSync(dir)) throw new Error(`drafts folder not found: ${dir}`);
  const errors = [];
  const drafts = [];
  // Only <code>.json files are drafts (an NCERT code such as lebs101); anything else in the folder (an author's scratch
  // file) is listed in `ignored` and never read.
  const all = readdirSync(dir).filter((f) => f.endsWith('.json')).sort();
  ignoredFiles.splice(0, ignoredFiles.length, ...all.filter((f) => !DRAFT_NAME.test(f)));
  for (const name of all.filter((f) => DRAFT_NAME.test(f))) {
    const file = path.join(dir, name);
    let doc;
    try { doc = readJSON(file); } catch (e) { errors.push(`${name}: not JSON (${e.message})`); continue; }
    const code = name.replace(/\.json$/, '');
    if (!doc || typeof doc !== 'object' || Array.isArray(doc)) { errors.push(`${name}: not an object`); continue; }
    if (doc.code !== code) errors.push(`${name}: code "${doc.code}" is not the file name`);
    if (typeof doc.subject !== 'string' || !/^[a-z_]+$/.test(doc.subject)) errors.push(`${name}: subject missing or malformed`);
    if (!Array.isArray(doc.cards)) errors.push(`${name}: cards is not an array`);
    if (doc.coverageNotes !== undefined && (typeof doc.coverageNotes !== 'object' || Array.isArray(doc.coverageNotes))) errors.push(`${name}: coverageNotes is not an object`);
    if (errors.length) continue;
    if (subjects && !subjects.includes(doc.subject)) continue;
    drafts.push({ file: name, ...doc });
  }
  if (errors.length) throw Object.assign(new Error(`malformed drafts:\n  ${errors.join('\n  ')}`), { malformed: errors });
  return drafts;
}

/** Run checks 1-5 (and 6 unless machineOnly) on one subject's cards. Returns { published, quarantined }. */
export function checkSubject(subject, cards, { syllabus, previous = null, verdicts = {}, machineOnly = false, getPdf } = {}) {
  const prior = new Map((previous?.cards || []).map((c) => [c.id, c]));
  const dup = duplicateReasons(cards.filter((c) => c && typeof c === 'object'));
  const published = [];
  const quarantined = [];
  for (const card of cards) {
    const reasons = shapeCheck(card, subject);
    if (!reasons.includes('shape:not_object')) {
      reasons.push(...blanksCheck(card));
      const q = reasons.some((r) => r.startsWith('shape:missing') || r === 'shape:quote_missing') ? null : getPdf ? quoteCheck(card, getPdf) : quoteCheck(card);
      if (q) reasons.push(q);
      if (typeof card.chapterKey === 'string') { const s = syllabusCheck(card, syllabus); if (s) reasons.push(s); }
      reasons.push(...(dup.get(card) || []));
      // The id is stable: the same id and version must mean the same content (changing content means v+1).
      const before = prior.get(card.id);
      if (before && before.v === card.v && cardHash(before) !== cardHash(card)) reasons.push('shape:id_reused');
    }
    if (!reasons.length && !machineOnly) {
      const verdict = verdicts[card.id];
      if (!verdict) reasons.push('review:missing');
      else if (verdict.hash !== cardHash(card)) reasons.push('review:stale');
      else if (!verdict.ok) reasons.push(...(verdict.reasons?.length ? verdict.reasons.map((r) => `review:${r}`) : ['review:failed']));
    }
    if (reasons.length) quarantined.push({ ...(card && typeof card === 'object' ? card : { value: card }), reasons });
    else published.push(card);
  }
  return { published, quarantined };
}

export async function runValidate({ subjects = null, machineOnly = false, dryRun = false, draftsDir = defaultDrafts(), getPdf, log = console.log } = {}) {
  const drafts = readDrafts(draftsDir, { subjects });
  const syllabus = await loadKeycardsSyllabus();
  const verdicts = readJSON(VERDICTS_FILE(), {});
  const bySubject = new Map();
  for (const d of drafts) {
    const s = bySubject.get(d.subject) || { cards: [], notes: {} };
    s.cards.push(...d.cards);
    Object.assign(s.notes, d.coverageNotes || {});
    bySubject.set(d.subject, s);
  }
  const summary = {};
  const manifest = {};
  for (const [subject, { cards, notes }] of bySubject) {
    const previous = readJSON(path.join(outDir(), 'decks', `${subject}.json`), null);
    const { published, quarantined } = checkSubject(subject, cards, { syllabus, previous, verdicts, machineOnly, getPdf });
    const reasons = {};
    for (const q of quarantined) for (const r of q.reasons) { const k = r.split(':').slice(0, 2).join(':'); reasons[k] = (reasons[k] || 0) + 1; }
    summary[subject] = { cards: cards.length, published: published.length, quarantined: quarantined.length, reasons };
    if (!dryRun) manifest[subject] = writeSubject(subject, published, quarantined, notes);
  }
  if (!dryRun && Object.keys(manifest).length) writeManifest(manifest);
  log(JSON.stringify({ syllabus: syllabus.source, machineOnly, dryRun, ignored: [...ignoredFiles], subjects: summary }, null, 2));
  return summary;
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const args = process.argv.slice(2);
  const opt = (name) => args.find((a) => a.startsWith(`--${name}=`))?.split('=').slice(1).join('=');
  runValidate({
    subjects: opt('subject') ? opt('subject').split(',') : null,
    machineOnly: args.includes('--machine-only'),
    dryRun: args.includes('--dry-run'),
  }).catch((e) => { console.error(e.message); process.exit(1); });
}
