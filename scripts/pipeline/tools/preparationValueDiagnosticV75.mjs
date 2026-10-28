// Read-only diagnostic: runs the free v7.5 preparation-value checks over the eligible candidates of a saved campaign.
// The legacy candidates carry no learning objective, so the objective and vocabulary-target rules are reported as
// not_applicable. This describes legacy outputs only; it is not a v7.5 release measurement and calls no provider.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { FINDING_CODES_V75, OBJECTIVE_RULE_CODES_V75, preparationValueV75 } from '../lib/preparationValueV75.mjs';

const input = resolve(process.argv[2] || 'artifacts/question-factory/cuet-readiness-cost-source-c-100-2026-10-08/all-candidates.json');
const rows = JSON.parse(readFileSync(input, 'utf8')), eligible = rows.filter(row => row.state === 'eligible');
const counts = Object.fromEntries(FINDING_CODES_V75.map(code => [code, { blocking: [], non_blocking: [] }]));
const flagged = new Set(), blockedIds = new Set();
for (const row of eligible) {
  const value = preparationValueV75(row.candidate, { objectiveRules: false });
  for (const finding of value.findings) { counts[finding.code][finding.blocking ? 'blocking' : 'non_blocking'].push(row.id); flagged.add(row.id); }
  if (value.blocking) blockedIds.add(row.id);
}
const report = {
  source: input, scope: 'legacy diagnostic, not a v7.5 release measurement', eligible_candidates: eligible.length,
  candidates_with_any_finding: flagged.size, candidates_with_blocking_finding: blockedIds.size,
  findings: Object.fromEntries(FINDING_CODES_V75.map(code => OBJECTIVE_RULE_CODES_V75.includes(code)
    ? [code, 'not_applicable']
    : [code, { blocking: counts[code].blocking.length, non_blocking: counts[code].non_blocking.length, blocking_ids: counts[code].blocking, non_blocking_ids: counts[code].non_blocking }])),
};
console.log(JSON.stringify(report, null, 2));
