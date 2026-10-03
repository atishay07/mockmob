// DU programme-eligibility engine. Pure functions, no I/O.
//
// Rules come verbatim from the UG Bulletin of Information 2026-27 (see
// data/du-csas-2026 and scripts/du-csas). A combination is a list of typed slots:
//   { type: 'lang', any: n }                  any n languages from List A
//   { type: 'lang', specific: ['bengali'] }   that exact language (optionally + any: n more)
//   { type: 'domain', subject: 'physics' }    that exact List B subject
//   { type: 'free', count: n }                any n List B subjects
//   { type: 'gat' }                           General Aptitude Test
// A student is eligible for a programme if ANY combination is satisfied by the subjects
// they will take. Taking extra subjects never disqualifies.

export const CATEGORY_LABELS = {
  UR: 'Unreserved (UR)',
  'OBC-NCL': 'OBC-NCL',
  SC: 'SC',
  ST: 'ST',
  EWS: 'EWS',
  SIKH: 'Sikh minority',
  PwBD: 'PwBD',
  KM: 'Kashmiri migrant',
  SGC: 'Single girl child',
  'ORPHAN-FEMALE': 'Orphan (female)',
  'ORPHAN-MALE': 'Orphan (male)',
};

export const MAIN_CATEGORIES = ['UR', 'OBC-NCL', 'SC', 'ST', 'EWS'];
export const OTHER_CATEGORIES = ['SIKH', 'PwBD', 'KM', 'SGC', 'ORPHAN-FEMALE', 'ORPHAN-MALE'];

export function emptySelection() {
  return { languages: [], domains: [], gat: false };
}

function needsOf(combination, requiresLanguage) {
  const need = { specific: [], anyLang: 0, domains: [], free: 0, gat: false };
  for (const slot of combination.slots || []) {
    if (slot.type === 'lang') {
      if (slot.specific) need.specific.push(...slot.specific);
      need.anyLang += slot.any || 0;
    } else if (slot.type === 'domain') need.domains.push(slot.subject);
    else if (slot.type === 'free') need.free += slot.count;
    else if (slot.type === 'gat') need.gat = true;
  }
  const hasLangSlot = need.specific.length > 0 || need.anyLang > 0;
  // "Candidates must appear in any one language from List A" on top of the listed subjects.
  if (requiresLanguage && !hasLangSlot) need.anyLang = 1;
  return need;
}

// What is missing for ONE combination, as machine-readable gaps.
export function gapsFor(combination, requiresLanguage, selection) {
  const need = needsOf(combination, requiresLanguage);
  const langs = new Set(selection.languages);
  const doms = new Set(selection.domains);
  const gaps = [];
  for (const lang of need.specific) if (!langs.has(lang)) gaps.push({ kind: 'language', id: lang });
  const spareLangs = [...langs].filter((l) => !need.specific.includes(l)).length;
  const missingLangs = Math.max(0, need.anyLang - spareLangs);
  if (missingLangs > 0) gaps.push({ kind: 'any-language', count: missingLangs });
  for (const d of need.domains) if (!doms.has(d)) gaps.push({ kind: 'domain', id: d });
  const spareDomains = [...doms].filter((d) => !need.domains.includes(d)).length;
  const missingFree = Math.max(0, need.free - spareDomains);
  if (missingFree > 0) gaps.push({ kind: 'any-domain', count: missingFree });
  if (need.gat && !selection.gat) gaps.push({ kind: 'gat' });
  return gaps;
}

export function gapSize(gaps) {
  return gaps.reduce((n, g) => n + (g.count || 1), 0);
}

export function evaluateGroup(group, selection) {
  const { combinations, requiresLanguage } = group.eligibility;
  let best = null;
  for (const combination of combinations) {
    const gaps = gapsFor(combination, requiresLanguage, selection);
    if (gaps.length === 0) {
      // Bulletin: some later combinations are "considered only if seats remain vacant" after
      // candidates who used the earlier ones. Eligible, but a lower-priority route.
      const secondary =
        /^Combination (III|IV)$/.test(combination.label) &&
        (group.eligibility.notes || []).some((n) => /only if seats remain vacant/i.test(n));
      return {
        eligible: true,
        matched: { label: combination.label, text: combination.text },
        secondary,
        nearest: null,
      };
    }
    const size = gapSize(gaps);
    if (!best || size < best.size) best = { size, combination, gaps };
  }
  return {
    eligible: false,
    matched: null,
    nearest: best && { label: best.combination.label, text: best.combination.text, gaps: best.gaps, size: best.size },
  };
}

export function evaluateAll(groups, selection) {
  const hasAnything = selection.languages.length + selection.domains.length > 0 || selection.gat;
  return groups.map((group) => ({
    group,
    ...(hasAnything ? evaluateGroup(group, selection) : { eligible: false, matched: null, nearest: null }),
  }));
}

// Which single added subject would unlock the most programmes?
export function suggestUnlocks(groups, selection, catalog, limit = 4) {
  const base = new Set(evaluateAll(groups, selection).filter((r) => r.eligible).map((r) => r.group.id));
  const candidates = [];
  for (const l of catalog.languages) if (!selection.languages.includes(l.id)) candidates.push({ kind: 'language', id: l.id, name: l.name });
  for (const d of catalog.domains) if (!selection.domains.includes(d.id)) candidates.push({ kind: 'domain', id: d.id, name: d.name });
  if (!selection.gat) candidates.push({ kind: 'gat', id: 'gat', name: 'General Aptitude Test' });
  const out = [];
  for (const c of candidates) {
    const next = {
      languages: c.kind === 'language' ? [...selection.languages, c.id] : selection.languages,
      domains: c.kind === 'domain' ? [...selection.domains, c.id] : selection.domains,
      gat: c.kind === 'gat' ? true : selection.gat,
    };
    const unlocked = evaluateAll(groups, next).filter((r) => r.eligible && !base.has(r.group.id));
    if (unlocked.length) out.push({ ...c, unlocks: unlocked.length, programmes: unlocked.map((r) => r.group.name) });
  }
  out.sort((a, b) => b.unlocks - a.unlocks || a.name.localeCompare(b.name));
  return out.slice(0, limit);
}

export function describeGap(gap, catalog) {
  if (gap.kind === 'language') return `Add ${catalog.languages.find((l) => l.id === gap.id)?.name || gap.id}`;
  if (gap.kind === 'any-language') return gap.count === 1 ? 'Add one more language' : `Add ${gap.count} more languages`;
  if (gap.kind === 'domain') return `Add ${catalog.domains.find((d) => d.id === gap.id)?.name || gap.id}`;
  if (gap.kind === 'any-domain') return gap.count === 1 ? 'Add one more domain subject' : `Add ${gap.count} more domain subjects`;
  return 'Add General Aptitude Test';
}

// ---- Cutoffs -------------------------------------------------------------------------

// DU's UR merit list includes every candidate whatever their category, so a candidate in a
// reserved category clears a round if they meet EITHER the UR or their category cutoff.
export function effectiveCutoff(rowRound, categoryIndex, urIndex = 0) {
  if (!rowRound) return null;
  const cat = rowRound[categoryIndex];
  const ur = rowRound[urIndex];
  const vals = [cat, ur].filter((v) => typeof v === 'number');
  return vals.length ? Math.min(...vals) : null;
}

// status of one college seat for a score: which published round(s) the score would have cleared.
export function seatStatus(score, row, categoryIndex) {
  const rounds = [row[2], row[3], row[4]].map((r) => effectiveCutoff(r, categoryIndex));
  if (rounds.every((v) => v === null)) return { id: 'none', label: 'No allocation recorded', cleared: [] };
  const cleared = rounds.map((v, i) => (v !== null && score >= v ? i + 1 : null)).filter(Boolean);
  if (cleared.includes(1)) return { id: 'r1', label: 'Clears Round I', cleared };
  if (cleared.includes(2)) return { id: 'r2', label: 'Clears Round II', cleared };
  if (cleared.includes(3)) return { id: 'r3', label: 'Clears Round III', cleared };
  return { id: 'below', label: 'Below last year', cleared };
}

// Every combination of a programme checked against the student's subjects, so the UI can show
// the exact Bulletin rule next to what is met and what is missing (nothing is hidden).
export function explainCombinations(group, selection, catalog) {
  const { combinations, requiresLanguage } = group.eligibility;
  return combinations.map((combination) => {
    const gaps = gapsFor(combination, requiresLanguage, selection);
    const secondary =
      /^Combination (III|IV)$/.test(combination.label) &&
      (group.eligibility.notes || []).some((n) => /only if seats remain vacant/i.test(n));
    return {
      label: combination.label,
      text: combination.text,
      ok: gaps.length === 0,
      secondary,
      missing: gaps.map((g) => describeGap(g, catalog)),
      extraLanguage: requiresLanguage && !(combination.slots || []).some((s) => s.type === 'lang'),
    };
  });
}
