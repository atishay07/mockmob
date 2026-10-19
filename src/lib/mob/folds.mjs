// The canonical earn table (MOB-BUILD-SPEC-V3 section 0.4, F5). Owned here; lib/features/social/logic/fold_catalog.dart
// is kept equal by a contract test (data/tests/fixtures/mob_v3/folds.json). Pure: no I/O.
// Rules: 12 Folds plus Mobi (never collected). Four starters are free to everyone. The other eight are earned by
// deterministic, stated events: never random, bought, traded or gifted. Pro and Free get the same table.

export const STARTERS = Object.freeze(['dart', 'dogear', 'hexa', 'kandil']);

// key -> { folds (corner count), colour (the paper colour as RRGGBB, from the final art: the app's fold_catalog.dart says the same), source (fold_unlocks.source), need (the count the rule asks for), scope, line }
// scope: 'starter' (none), 'mob' (earned by a Mob together: have is the best value across the student's Mobs), 'you'.
export const FOLDS = Object.freeze({
  dart: { folds: 1, colour: '5FBEF2', source: null, need: 0, scope: 'starter', line: 'Answers first, then learns to check.' },
  dogear: { folds: 1, colour: 'FF8FA0', source: null, need: 0, scope: 'starter', line: 'Learning to trust the first pick.' },
  hexa: { folds: 1, colour: '5562D9', source: null, need: 0, scope: 'starter', line: 'Builds each answer step by step.' },
  kandil: { folds: 1, colour: 'F4B04A', source: null, need: 0, scope: 'starter', line: 'Keeps the desk lit for everyone.' },
  hop: { folds: 3, colour: '33BFA0', source: 'mob_quest', need: 1, scope: 'mob', line: 'Bounces back after a wrong one.' },
  crane: { folds: 3, colour: 'B98CF5', source: 'mob_traps', need: 3, scope: 'mob', line: 'Folds it until it is right.' },
  stamp: { folds: 3, colour: 'EFE6D2', source: 'mob_weeks', need: 4, scope: 'mob', line: 'Seals every fix that held.' },
  naav: { folds: 2, colour: 'E3DCCB', source: 'first_full_mock', need: 1, scope: 'you', line: 'Steady in the last ten minutes.' },
  tally: { folds: 2, colour: 'F2A07E', source: 'clean_games', need: 3, scope: 'you', line: 'Counts the minus marks too.' },
  patang: { folds: 2, colour: 'E2404A', source: 'beat_best', need: 1, scope: 'you', line: 'Rises against the wind.' },
  sticky: { folds: 2, colour: '9BAF8E', source: 'fixes_held', need: 5, scope: 'you', line: 'Remembers the formula for you.' },
  cutting: { folds: 2, colour: 'B9814F', source: 'came_back', need: 1, scope: 'you', line: 'Knows a break is part of the plan.' },
});
export const FOLD_KEYS = Object.freeze(Object.keys(FOLDS));
export const FINISHES = Object.freeze(['plain', 'foil']);
export const FOIL_DAYS = 30; // the Foil edge for the Fold you sit as: a 30-day personal chain (source chain_30)

export const isFold = (v) => typeof v === 'string' && FOLD_KEYS.includes(v);
export const isStarter = (v) => STARTERS.includes(v);

// Den objects: Mob chain milestones (weeks in a row), all earned.
export const MOB_ITEMS = Object.freeze([
  { at: 2, item: 'den_stamp' },
  { at: 4, item: 'desk_bell' }, // week 4 also brings Stamp (the Fold) to every member
  { at: 8, item: 'brass_lamp' },
  { at: 12, item: 'foil_seal' },
  { at: 20, item: 'stamp_row_2' },
]);

/** The den items a Mob owns at its best run of `bestWeeks`, and the next one. */
export function mobShelf(bestWeeks) {
  const best = Math.max(0, Number(bestWeeks) || 0);
  const items = MOB_ITEMS.filter((x) => best >= x.at).map((x) => x.item);
  const next = MOB_ITEMS.find((x) => best < x.at) || null;
  return { items, nextItem: next ? { at: next.at, item: next.item } : null };
}

/** The next Mob-chain reward after `weeks` (Stamp the Fold rides with the desk bell at 4). */
export function nextMobReward(weeks) {
  const next = MOB_ITEMS.find((x) => weeks < x.at);
  if (!next) return null;
  return { at: next.at, item: next.at === 4 ? 'stamp' : next.item };
}

/**
 * The weekly quest parcel always shows its true contents in advance: Hop until the Mob owns Hop; then the Mob-chain
 * item this week's stitch reaches, if any; else the stitch itself.
 */
export function parcelFor({ mobOwnsHop, weeksIfStitched }) {
  if (!mobOwnsHop) return { kind: 'fold', fold: 'hop' };
  const hit = MOB_ITEMS.find((x) => x.at === weeksIfStitched);
  if (hit) return hit.at === 4 ? { kind: 'fold', fold: 'stamp' } : { kind: 'item', item: hit.item };
  return { kind: 'stitch' };
}

/**
 * What the rule counts, from server facts. facts: { questsDone (Mobs: best), trapsFixed (best), mobWeeks (best),
 * fullMocks, cleanGames, beatBest, fixesHeld, cameBack, chainBest }. Returns { have, need } with have capped at need.
 */
export function ruleProgress(key, facts = {}) {
  const f = FOLDS[key];
  if (!f || f.scope === 'starter') return { have: 0, need: 0 };
  const raw = {
    hop: facts.questsDone, crane: facts.trapsFixed, stamp: facts.mobWeeks, naav: facts.fullMocks, tally: facts.cleanGames,
    patang: facts.beatBest, sticky: facts.fixesHeld, cutting: facts.cameBack,
  }[key];
  return { have: Math.min(f.need, Math.max(0, Number(raw) || 0)), need: f.need };
}

/** The Folds the facts earn (never a starter): the keys whose rule is met. Deterministic. */
export function earnedBy(facts = {}) {
  return FOLD_KEYS.filter((k) => FOLDS[k].scope !== 'starter').filter((k) => {
    const p = ruleProgress(k, facts);
    return p.need > 0 && p.have >= p.need;
  });
}

// The personal chain milestones (MOB-BUILD-SPEC-V3 0.4). The rest passes themselves come from the chain algorithm (2.3).
export const CHAIN_MILESTONES = Object.freeze([
  { at: 3, reward: 'rest_pass' }, { at: 7, reward: 'rest_pass' }, { at: 14, reward: 'rest_pass' }, { at: 21, reward: 'rest_pass' },
  { at: 30, reward: 'foil' }, { at: 50, reward: 'ribbon' }, { at: 75, reward: 'ribbon' }, { at: 100, reward: 'ribbon' }, { at: 150, reward: 'ribbon' },
]);

/** The catalogue as the app's contract copy (fold_catalog.dart must equal it). */
export const foldCatalogJson = () => ({
  starters: [...STARTERS],
  folds: FOLD_KEYS.map((key) => ({ key, ...FOLDS[key] })),
  mobItems: MOB_ITEMS.map((x) => ({ ...x })),
  chainMilestones: CHAIN_MILESTONES.map((x) => ({ ...x })),
  foilDays: FOIL_DAYS,
});
