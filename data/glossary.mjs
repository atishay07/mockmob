// One name per concept, the same in the app (web IA plan section 6, 15 Oct 2026).
//
// APPROVED is what students read. RETIRED_TERMS are names that must leave student-facing copy;
// data/tests/glossary.test.mjs counts them across the website source and fails if the count grows
// above GLOSSARY_BASELINE. The IA9 integration brings it to 0 and then makes the test strict.
//
// Patterns are case sensitive on purpose: product names are capitalised in copy, while CSS classes,
// ids and API keys ('arena-nav-link', 'prepos_credit', '/admission-compass') are lower case and
// never count. Pure data and functions, no imports.

export const APPROVED = Object.freeze({
  signedInArea: null, // D1: no name; the places speak for themselves
  home: 'Today',
  choosing: 'Practice',
  launcher: 'Start',
  quickPractice: 'Quick practice',
  fullMock: 'Full mock',
  ntaMode: 'NTA mode',
  sampleSet: '5 sample questions',
  repairFeature: 'Mistake Repair',
  repairVerb: 'Repair',
  repairStages: Object.freeze(['Found', 'Repaired', 'Checked', 'Holds']),
  afterMock: 'After this mock',
  doNext: 'Do these next',
  swot: 'SWOT for this mock',
  record: 'Your record',
  recordEntry: 'Where your marks go',
  assistant: 'Ask Mobi',
  nextStep: "Tonight's move",
  nextStepDaytime: "Today's move",
  cutoffTool: 'Cutoff calculator',
  cutoffToolLine: 'Which DU courses your subjects open, with last year’s cutoffs',
  cutoffToolPro: 'Your gap to each college',
  comboTool: 'Combo planner',
  comboToolLine: 'Which CUET subjects to take',
  toolsGroup: 'CUET tools',
  stream: 'Question stream',
  lessons: 'Concepts',
  bookmarks: 'Saved questions',
  progress: Object.freeze(['Your week', 'Milestones', 'Personal bests']),
  competition: 'Leaderboard',
  points: 'points',
  contribute: 'Contribute questions',
  submissions: 'Your submissions',
  hub: 'You',
  settings: 'Account',
  wallet: 'practice credits',
  aiWallet: 'AI credits',
  proLock: 'Comes with Pro',
  mascot: 'Mobi',
  sheet: 'Your sheet',
});

// Upload status words: one set (plan 6, truth fixes), keyed by data/contribution_ui.js
// contributionState(): live (live, approved), held (rejected, quarantined, blocked, failed), pending.
export const UPLOAD_STATUS = Object.freeze({
  pending: 'In review',
  live: 'Live',
  held: 'Not published',
});

const retired = (id, pattern, use, note = null) => Object.freeze({ id, pattern, use, ...(note ? { note } : {}) });

export const RETIRED_TERMS = Object.freeze([
  retired('arena', /\bArena\b/, null, 'D1: the signed-in area has no name (covers My Arena)'),
  retired('radar', /\bRadar\b/, 'Your record'),
  retired('prepos', /\bPrepOS\b/, 'Ask Mobi, or AI credits for the wallet'),
  retired('mentor', /\bMentor\b/, 'Ask Mobi'),
  retired('benchmarks', /\bBenchmarks?\b/, null, 'retired with /rival (N5)'),
  retired('score-recovery', /\bScore Recovery\b/, 'Mistake Repair', 'allowed only as positioning on About'),
  retired('mistake-lab', /\bMistake [Ll]ab\b/, 'Mistake Repair'),
  retired('mistake-replay', /\bMistake Replay\b/, 'Mistake Repair'),
  retired('repair-lab', /\bRepair Lab\b/, 'Mistake Repair'),
  retired('compass', /\bCompass\b/, 'Cutoff calculator', 'covers DU Compass, Admission Compass and Compass Pro'),
  retired('ranks', /\bRanks\b/, 'Leaderboard'),
  retired('mock-sprint', /\bMock Sprint\b/, 'Full mock'),
  retired('xp', /\bXP\b/, 'points'),
  retired('mobber', /\bMobbers?\b/, null),
  retired('feed-the-bank', /\bFeed the bank\b/i, 'Contribute questions'),
  retired('my-uploads', /\bMy uploads\b/, 'Your submissions'),
  retired('ai-cr', /\bAI CR\b/, 'AI credits'),
  retired('explanation-credits', /\bexplanation credits?\b/i, 'AI credits'),
  retired('needs-access', /\bNeeds access\b/, 'Comes with Pro'),
  retired('volt-weeks', /\bVolt weeks?\b/i, 'Your week'),
  retired('pip', /\bPip\b/, 'Mobi'),
  retired('combo-planner-case', /\bCombo Planner\b/, 'Combo planner'),
  retired('saved-bank', /\bSaved Question Bank\b/, 'Saved questions'),
  retired('discovery-feed', /\bDiscovery feed\b/i, 'Question stream'),
  retired('explore-pro', /\bExplore Pro\b/, null),
  retired('credit-gated', /\bcredit-gated\b/i, null, 'say the number instead (plan 4.4)'),
  retired('arsenal', /\bThe Arsenal\b/, null),
  retired('join-the-mob', /\bJoin the Mob\b/, 'Start free'),
]);

// Caveat lines the landing and public pages must not carry (plan 4.3). Not counted in the glossary
// baseline: the IA4 and IA8 tests use them on their own pages.
export const CAVEAT_PATTERNS = Object.freeze([
  /being prepared/i, /\bRolling out\b/i, /awaiting (source|calibration|checks|permitted)/i,
  /still being audited/i, /awaiting calibration/i, /PRODUCT RULE/, /switched off while spending checks/i,
]);

// Where a retired term may stay, and why. Paths are repository-relative, '/' separated.
export const ALLOWLIST = Object.freeze([
  Object.freeze({ path: /^src\/app\/about\//, ids: ['score-recovery'], why: 'About keeps "Score Recovery" as positioning (plan 6)' }),
]);

// What the glossary test scans: student-facing source. Admin, previews, fixtures and tests are left out.
export const SCAN_ROOTS = Object.freeze(['src/app', 'src/components', 'src/lib', 'data/learning_engine.js', 'data/capabilities.js']);
export const SCAN_EXCLUDE = Object.freeze([
  /^src\/app\/admin\//, /^src\/app\/preview\//, /^src\/app\/creator\//, /\/__tests__\//, /\.test\.m?js$/,
  /^src\/lib\/arenaNavigation\.js$/, // the IA0 shim keeps old export names only, no labels
]);
export const SCAN_EXTENSIONS = Object.freeze(['.js', '.jsx', '.mjs']);

/**
 * The baseline, recorded by IA0 on 15 Oct 2026 against wt-web-ia (production 4d006fb9 + STATUS),
 * with the new navigation in place. It may only go down. IA9 sets it to 0.
 */
export const GLOSSARY_BASELINE = Object.freeze({
  date: '2026-10-15',
  total: 270,
  byTerm: Object.freeze({
    prepos: 110, radar: 47, compass: 37, benchmarks: 18, arena: 16, 'credit-gated': 6, 'mistake-replay': 5,
    'combo-planner-case': 5, mobber: 4, 'score-recovery': 4, xp: 4, mentor: 3, 'needs-access': 2, 'my-uploads': 2,
    'feed-the-bank': 1, 'saved-bank': 1, 'join-the-mob': 1, 'mistake-lab': 1, 'mock-sprint': 1, 'explore-pro': 1, 'volt-weeks': 1,
  }),
});

/**
 * The student-visible strings in a JS or JSX source: string literals, template text and JSX text.
 * Comments are dropped. A heuristic, tuned to count retired names, not to parse JavaScript.
 */
export function studentStrings(source) {
  const src = String(source || '');
  const out = [];
  let code = '';
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    const next = src[i + 1];
    if (c === '/' && next === '/') { while (i < src.length && src[i] !== '\n') i += 1; continue; }
    if (c === '/' && next === '*') { const end = src.indexOf('*/', i + 2); i = end === -1 ? src.length : end + 2; continue; }
    if (c === '"' || c === "'" || c === '`') {
      let j = i + 1;
      let text = '';
      while (j < src.length && src[j] !== c) {
        if (src[j] === '\\') { text += src[j + 1] || ''; j += 2; continue; }
        if (c !== '`' && src[j] === '\n') break;
        text += src[j];
        j += 1;
      }
      out.push(text);
      code += ' ';
      i = j + 1;
      continue;
    }
    code += c;
    i += 1;
  }
  // JSX text between tags, once strings and comments are gone.
  for (const match of code.matchAll(/>([^<>{}]*[A-Za-z][^<>{}]*)</g)) out.push(match[1]);
  return out.filter((text) => /[A-Za-z]/.test(text) && !/^(\.{0,2}\/|@\/|https?:)/.test(text.trim()));
}

/** Retired-term hits in one file's source: [{ id, text }]. */
export function retiredHits(source, path = '') {
  const allowed = new Set(ALLOWLIST.filter((entry) => entry.path.test(path)).flatMap((entry) => entry.ids));
  const hits = [];
  for (const text of studentStrings(source)) {
    for (const term of RETIRED_TERMS) {
      if (allowed.has(term.id)) continue;
      const matches = text.match(new RegExp(term.pattern.source, `${term.pattern.flags.replace('g', '')}g`));
      if (matches) for (let k = 0; k < matches.length; k += 1) hits.push({ id: term.id, text: text.trim().slice(0, 120) });
    }
  }
  return hits;
}

/** The first retired term in a single label, or null. Used by navigation and other label tests. */
export function retiredTermIn(label) {
  const text = String(label || '');
  return RETIRED_TERMS.find((term) => term.pattern.test(text))?.id || null;
}

/** "Tonight's move" from 4 PM to 4:59 AM, "Today's move" otherwise: the app's isEvening rule (formatters.dart). */
export function moveLabel(now = new Date(), { timeZone = 'Asia/Kolkata' } = {}) {
  const hour = Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hourCycle: 'h23', timeZone }).format(new Date(now)));
  return hour >= 16 || hour < 5 ? APPROVED.nextStep : APPROVED.nextStepDaytime;
}
