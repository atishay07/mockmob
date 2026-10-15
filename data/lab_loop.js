// The slice 3 parts of the Mistake Lab on one result (spec tmp/mistake-lab-v4/SPEC.md 4.7 to 4.10), added beside the
// slice 1 and 2 contract by the route (data/mock_swot.js resultHistory, option labLoop). PURE: the server passes in
// the student's repairs and playbook rows (src/lib/server/ruleBook.js loadRuleSources), or null when they could not
// be read. Each part fails on its own and becomes null; the rest of the Lab is untouched.
//   acrossMocks       Across your mocks, as the record stood when this paper was taken (contract_across_v1.json)
//   repairOrder       the repair queue ordered by what other students answered (contract_repair_order_v1.json)
//   rules             the Rule book's short form { count, countLabel, active } (contract_rules_v1.json summary)
//   prove.ruleCheck   the rule in force when this mock started, checked on its record (contract_rulecheck_v1.json)
import { when } from './attempt_ledger.js';
import { buildAcrossMocks } from './across_mocks.js';
import { buildRepairOrder } from './repair_order.js';
import { buildRuleBook, buildRuleCheck, ruleInForce, ruleSummary, bookRules } from './rule_book.js';

/** { acrossMocks, repairOrder, rules, prove: { ruleCheck } }. `warn(part, error)` hears each part that failed. */
export function buildLabLoop({ attempt, allAttempts = [], answerReviews = {}, lab = null, sources = null, warn = () => {} } = {}) {
  const step = (name, fn) => { try { return fn() ?? null; } catch (e) { warn(name, e); return null; } };
  const acrossMocks = step('acrossMocks', () => buildAcrossMocks({ attempts: allAttempts, asOf: when(attempt) }));
  const repairOrder = step('repairOrder', () => buildRepairOrder({ lab, attempt, answerReviews }));
  const book = sources ? step('rules', () => buildRuleBook({ attempts: allAttempts, repairs: sources.repairs, playbook: sources.playbook })) : null;
  const ruleCheck = sources ? step('ruleCheck', () => {
    const rule = ruleInForce(sources.playbook, attempt);
    if (!rule) return null;
    const found = bookRules(book).find((r) => r.id === rule.id);
    return buildRuleCheck({ attempt, attempts: allAttempts, rule: { ...rule, chapter: found?.chapter ?? null, subject: found?.subject ?? null } });
  }) : null;
  return { acrossMocks, repairOrder, rules: ruleSummary(book), prove: { ruleCheck } };
}
