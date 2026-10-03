// CUET subject combination planner. Pure; runs in the browser on the published DU index.
//
// The student lists the DU programmes they want and the subjects they could realistically
// take. Every combination of up to `maxPapers` of those subjects is checked against DU's own
// 2026 eligibility rules (the same evaluator as the calculator), then ranked by how many target
// programmes it unlocks, how many DU programmes it unlocks in total, and how few papers it
// needs. It says nothing about scores, cutoffs or admission chances.
import { evaluateGroup } from './eligibility.js';

export const DEFAULT_MAX_PAPERS = 5; // the CUET UG 2026 limit; 2027 rules are provisional
export const MAX_POOL = 12;

const selectionOf = (items) => ({
  languages: items.filter((i) => i.kind === 'language').map((i) => i.id),
  domains: items.filter((i) => i.kind === 'domain').map((i) => i.id),
  gat: items.some((i) => i.kind === 'gat'),
});

function* subsets(items, max) {
  const n = items.length;
  const pick = [];
  function* walk(start) {
    if (pick.length) yield pick.map((i) => items[i]);
    if (pick.length === max) return;
    for (let i = start; i < n; i++) { pick.push(i); yield* walk(i + 1); pick.pop(); }
  }
  yield* walk(0);
}

/** Pool entries look like { kind: 'language' | 'domain' | 'gat', id }. */
export function rankCombos(options) {
  return planCombos(options).ranked;
}

/**
 * Ranked combinations plus `keep`: the subjects present in EVERY combination (not just the
 * ones shown) that meets all targets. Alternatives must reach as many targets as the best one.
 */
export function planCombos({ groups, pool, targets = [], maxPapers = DEFAULT_MAX_PAPERS, limit = 5 }) {
  const items = pool.slice(0, MAX_POOL);
  const targetSet = new Set(targets);
  const results = [];
  for (const combo of subsets(items, maxPapers)) {
    const selection = selectionOf(combo);
    let unlocked = 0;
    const met = [];
    for (const group of groups) {
      if (!evaluateGroup(group, selection).eligible) continue;
      unlocked += 1;
      if (targetSet.has(group.id)) met.push(group.id);
    }
    results.push({ items: combo, selection, unlocked, met });
  }
  results.sort((a, b) => b.met.length - a.met.length || b.unlocked - a.unlocked || a.items.length - b.items.length);

  const bestMet = results[0]?.met.length || 0;
  const full = targets.length ? results.filter((r) => r.met.length === targets.length) : [];
  const keep = full.length ? full[0].items.filter((item) => full.every((r) => r.items.some((i) => i.kind === item.kind && i.id === item.id))) : [];

  // Keep distinct outcomes: a larger combination is only worth showing if it unlocks more,
  // and an alternative is only shown if it reaches as many targets as the best one.
  const out = [];
  for (const r of results) {
    if (r.met.length < bestMet) break;
    if (out.some((o) => o.met.length >= r.met.length && o.unlocked >= r.unlocked && o.items.length <= r.items.length)) continue;
    out.push(r);
    if (out.length >= limit) break;
  }
  const ranked = out.map((r) => ({
    ...r,
    missed: targets.filter((id) => !r.met.includes(id)).map((id) => {
      const group = groups.find((g) => g.id === id);
      return { id, name: group?.name || id, nearest: group ? evaluateGroup(group, r.selection).nearest : null };
    }),
  }));
  return { ranked, keep };
}

/** Subjects that appear in every combination meeting all targets: the ones not to drop. */
export function mustKeep(ranked, targetCount) {
  const full = ranked.filter((r) => targetCount > 0 && r.met.length === targetCount);
  if (!full.length) return [];
  return full[0].items.filter((item) => full.every((r) => r.items.some((i) => i.kind === item.kind && i.id === item.id)));
}
