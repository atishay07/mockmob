// Local, read-only pathway validation. No database, provider or network access.
//   node scripts/learning/validate-pathway.mjs sacrificing_gaining          # check, write report + built pathway
//   node scripts/learning/validate-pathway.mjs sacrificing_gaining --check  # fail if the built file is stale
// Software consistency only: academic validation stays pending until an independent
// reviewer or a calibrated cohort result is recorded (docs/brain/DECISION-2026-10-03-DIFFERENTIATOR.md).
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { checkPathwayContent, buildEnginePathway, pathwayDigest, questionRow } from '../../data/pathway_validation.js';

const id = process.argv[2] || 'sacrificing_gaining';
const checkOnly = process.argv.includes('--check');
const dir = new URL('../../data/recovery_candidates/', import.meta.url);
const source = JSON.parse(readFileSync(new URL(`${id}.source.json`, dir), 'utf8'));
const report = checkPathwayContent(source);
const built = buildEnginePathway(source);
const digest = pathwayDigest(built);
const builtUrl = new URL(`${id}.pathway.json`, dir);
const builtText = JSON.stringify(built, null, 2) + '\n';

if (checkOnly) {
  const stale = !existsSync(builtUrl) || readFileSync(builtUrl, 'utf8') !== builtText;
  console.log(JSON.stringify({ pathway: id, passed: report.passed, failed: report.failed, stale }));
  process.exit(report.passed && !stale ? 0 : 1);
}

const full = {
  generatedAt: new Date().toISOString(), mode: 'local_read_only', databaseApplied: false, paidCalls: 0,
  pathway: { id: built.id, version: built.version, sourceVersion: built.sourceVersion, ruleVersion: built.ruleVersion, digest, state: built.state },
  levels: {
    researchHypothesis: 'recorded',
    sourceImplementation: report.passed ? 'passed_software_consistency' : 'failed_software_consistency',
    academicValidation: 'pending: needs an independent Accountancy reviewer sign-off on explanations, mappings and exam fit, then cohort probe concordance',
    stagingVerification: 'not_started: items are not seeded; signed evidence records come only from the backend verification job',
    liveAvailability: 'not_available: recovery release gates are false',
  },
  software: report,
  questionRowsDryRun: [...built.probes, ...built.repair, ...built.checks].map(item => ({ ...questionRow(built, item), content_hash: item.contentHash, status: 'not_seeded' })),
};
writeFileSync(builtUrl, builtText);
mkdirSync(new URL('../../docs/brain/reports/', import.meta.url), { recursive: true });
writeFileSync(new URL(`../../docs/brain/reports/pathway-${id}-validation.json`, import.meta.url), JSON.stringify(full, null, 2) + '\n');
for (const r of report.results.filter(r => !r.passed)) console.error(`FAIL ${r.id}${r.item ? ` [${r.item}]` : ''}: ${r.detail}`);
console.log(JSON.stringify({ pathway: id, passed: report.passed, checks: report.total, failed: report.failed, digest, reviewItems: report.reviewItems }));
process.exit(report.passed ? 0 : 1);
