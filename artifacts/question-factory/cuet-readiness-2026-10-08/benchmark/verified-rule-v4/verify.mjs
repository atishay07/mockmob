import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

const root = path.resolve('artifacts/question-factory/cuet-readiness-2026-10-08/benchmark/verified-rule-v4');
const registry = JSON.parse(fs.readFileSync('data/source_registry.json', 'utf8'));
const dev = JSON.parse(fs.readFileSync(path.join(root, 'development/cases.json'), 'utf8'));
const release = JSON.parse(fs.readFileSync(path.join(root, 'release-sealed/cases.json'), 'utf8'));
const freeze = JSON.parse(fs.readFileSync(path.join(root, 'freeze.json'), 'utf8'));
const { expectedReleaseBinding } = await import(pathToFileURL(path.join(process.cwd(), 'scripts/pipeline/lib/releaseEvidenceV7.mjs')).href);
const cases = [...dev, ...release];
const hash = (s) => crypto.createHash('sha256').update(s, 'utf8').digest('hex');
const normalize = (s) => s.replace(/\s+/g, ' ').trim().replace(/[–—]/g, '-').toLowerCase();

assert.equal(cases.length, freeze.cases, 'freeze case count');
assert.equal(hash(JSON.stringify(cases)), freeze.payloadSha256, 'combined payload hash');
assert.equal(hash(JSON.stringify(dev)), freeze.developmentSha256, 'development payload hash');
assert.equal(hash(JSON.stringify(release)), freeze.releaseSha256, 'release payload hash');
assert.deepEqual(freeze.contract_binding, expectedReleaseBinding(), 'exact v7.2 release binding');
assert.equal(freeze.verifier_version, freeze.contract_binding.verifier_version, 'bound verifier version');
assert.deepEqual(freeze.release_eligibility, {
  scope: 'diagnostic', classification: 'fresh', preregistration_id: 'verified-rule-v4-diagnostic-2026-10-08-01',
  approved_before_evaluation: true, previously_read: false, tuned_on: false,
}, 'fresh preregistration fields');
assert.equal(freeze.evaluationStatus, 'not_evaluated', 'no model results are fabricated');
assert.equal(freeze.releaseResult, null, 'release result remains pending');
assert.equal(new Set(cases.map(c => c.benchmarkId)).size, cases.length, 'unique case ids');
assert.deepEqual(new Set(dev.map(c => c.partition)), new Set(['development']));
assert.deepEqual(new Set(release.map(c => c.partition)), new Set(['release']));

const devRoots = new Set(dev.map(c => c.rootFamily));
for (const c of release) assert(!devRoots.has(c.rootFamily), `partition root overlap: ${c.rootFamily}`);
const bySubject = Object.fromEntries(['english','accountancy','business_studies','economics'].map(subject => [subject, cases.filter(c => c.subject === subject)]));
for (const [subject, rows] of Object.entries(bySubject)) {
  assert(rows.filter(c => c.label === 'valid').length >= 10, `${subject} needs at least 10 source-certified valid cases`);
  assert(new Set(rows.map(c => c.rootFamily)).size >= 10, `${subject} needs at least 10 concept roots`);
}
for (const defect of ['wrong_key','overlapping_options','missing_decisive_condition','unsupported_explanation','syllabus_mismatch','numeric_error']) {
  assert(cases.some(c => c.defectCategory === defect), `missing controlled defect ${defect}`);
}

for (const c of cases) {
  const src = c.certificate.source;
  assert.equal(hash(src.exactExcerpt), src.excerptSha256, `${c.benchmarkId}: excerpt hash`);
  const official = registry.sources[c.certificate.syllabus.sourceId];
  assert(official, `${c.benchmarkId}: syllabus source exists`);
  assert.equal(official.identity_sha256, c.certificate.syllabus.identitySha256, `${c.benchmarkId}: syllabus source identity`);
  assert.equal(official.extraction_sha256, c.certificate.syllabus.extractionSha256, `${c.benchmarkId}: syllabus extraction identity`);
  assert(normalize(official.facts['full-syllabus'].text).includes(normalize(c.certificate.syllabus.exactEntitlement)), `${c.benchmarkId}: exact syllabus entitlement`);
  if (src.id !== 'benchmark-authored-english-passages-v1') {
    const registered = registry.sources[src.id];
    assert(registered, `${c.benchmarkId}: source record exists`);
    assert.equal(registered.identity_sha256, src.identitySha256, `${c.benchmarkId}: source identity`);
    assert.equal(registered.extraction_sha256, src.extractionSha256, `${c.benchmarkId}: source extraction version`);
    const text = registered.facts[src.locator]?.text;
    assert.equal(text, src.exactExcerpt, `${c.benchmarkId}: registered excerpt exact match`);
  } else {
    assert.equal(hash(src.exactExcerpt), src.identitySha256, `${c.benchmarkId}: authored passage source hash`);
    assert(c.question.passage && c.question.passage === src.exactExcerpt, `${c.benchmarkId}: passage included in payload`);
    assert(c.question.passage.trim().split(/\s+/).length <= 300, `${c.benchmarkId}: English passage <= 300 words`);
  }
  if (c.certificate.answerEvidence?.mode === 'exact-source-span') {
    assert(normalize(src.exactExcerpt).includes(normalize(c.certificate.answerEvidence.decisiveText)), `${c.benchmarkId}: exact answer proof span`);
    assert.equal(c.certificate.answerEvidence.excerptSha256, src.excerptSha256, `${c.benchmarkId}: answer proof bound to excerpt`);
  }
  if (c.certificate.answerEvidence?.mode === 'deterministic-arithmetic') {
    assert.equal(c.certificate.answerEvidence.excerptSha256, src.excerptSha256, `${c.benchmarkId}: arithmetic source binding`);
    const numeric = c.certificate.defectCertificate;
    const text = c.question.stem;
    const profit = Number(text.match(/profit of ₹([\d]+)/)?.[1] || text.match(/amount of ₹([\d]+)/)?.[1]);
    const ratioMatch = text.match(/ratio (?:is )?(\d+):(\d+)/);
    assert(Number.isFinite(profit) && ratioMatch, `${c.benchmarkId}: numeric inputs present in stem`);
    const computed = profit * Number(ratioMatch[1]) / (Number(ratioMatch[1]) + Number(ratioMatch[2]));
    assert.equal(computed, numeric.correctValue, `${c.benchmarkId}: independently recomputed numeric answer`);
    assert.equal(c.certificate.answerEvidence.decisiveText, `${profit}*${ratioMatch[1]}/${Number(ratioMatch[1])+Number(ratioMatch[2])}=${computed}`, `${c.benchmarkId}: numeric proof statement`);
  }
  if (c.defectCategory === 'wrong_key') {
    assert.notEqual(c.question.proposedKey, c.certificate.groundTruthKey, `${c.benchmarkId}: wrong key mutation`);
  } else if (c.defectCategory === 'overlapping_options') {
    assert.equal(c.certificate.groundTruthKey.length, 2, `${c.benchmarkId}: overlap has two keys`);
    const [a,b] = c.certificate.groundTruthKey.map(k => c.question.options.find(o => o.id === k).text);
    assert.equal(a, b, `${c.benchmarkId}: duplicate keyed options`);
  } else if (c.defectCategory === 'missing_decisive_condition') {
    assert.equal(c.certificate.groundTruthKey, null, `${c.benchmarkId}: under-specified has no unique key`);
    assert(c.certificate.decisiveAssumptions.length >= 1, `${c.benchmarkId}: decisive condition recorded`);
  } else if (c.defectCategory === 'unsupported_explanation') {
    assert(c.question.explanation.includes('source also says the opposite'), `${c.benchmarkId}: controlled unsupported claim present`);
    assert(!src.exactExcerpt.toLowerCase().includes('source also says the opposite'), `${c.benchmarkId}: claim absent from source`);
  } else if (c.defectCategory === 'syllabus_mismatch') {
    assert.match(c.certificate.defectCertificate.exactSyllabusText, /excluding/i, `${c.benchmarkId}: explicit exclusion certificate`);
    assert(c.certificate.defectCertificate.excludedPhrase, `${c.benchmarkId}: exact excluded topic`);
  } else if (c.defectCategory === 'numeric_error') {
    assert.equal(c.certificate.defectCertificate.correctValue, c.certificate.answerEvidence ? c.certificate.answerEvidence.correctValue : c.certificate.derivation.match(/= (\d+)/)?.[1] && Number(c.certificate.derivation.match(/= (\d+)/)[1]), `${c.benchmarkId}: numeric derivation`);
    assert.notEqual(c.certificate.defectCertificate.proposedValue, c.certificate.defectCertificate.correctValue, `${c.benchmarkId}: wrong numeric option`);
  }
}

const defects = Object.fromEntries(['wrong_key','overlapping_options','missing_decisive_condition','unsupported_explanation','syllabus_mismatch','numeric_error'].map(k => [k, cases.filter(c => c.defectCategory === k).length]));
const validBySubject = Object.fromEntries(Object.entries(bySubject).map(([s, rows]) => [s, { valid: rows.filter(c => c.label === 'valid').length, roots: new Set(rows.map(c => c.rootFamily)).size, releaseValid: release.filter(c => c.subject === s && c.label === 'valid').length }]));
console.log(JSON.stringify({ result: 'PASS', cases: cases.length, roots: new Set(cases.map(c => c.rootFamily)).size, validBySubject, defects, developmentRoots: devRoots.size, releaseRoots: new Set(release.map(c => c.rootFamily)).size, frozenHashes: { development: freeze.developmentSha256, release: freeze.releaseSha256 } }, null, 2));
