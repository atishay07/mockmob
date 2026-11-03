import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root = path.resolve('artifacts/question-factory/cuet-readiness-2026-10-08/benchmark/verified-rule-v4');
const out = path.join(root, 'key-audit');
const dev = JSON.parse(fs.readFileSync(path.join(root, 'development/cases.json'), 'utf8'));
const release = JSON.parse(fs.readFileSync(path.join(root, 'release-sealed/cases.json'), 'utf8'));
const freeze = JSON.parse(fs.readFileSync(path.join(root, 'freeze.json'), 'utf8'));
const cases = [...dev, ...release];
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
if (hash(JSON.stringify(dev)) !== freeze.developmentSha256 || hash(JSON.stringify(release)) !== freeze.releaseSha256 ||
    hash(JSON.stringify(cases)) !== freeze.payloadSha256 || freeze.evaluationStatus !== 'not_evaluated') {
  throw new Error('current_v4_freeze_integrity_or_prerequisite_failure');
}
const valid = cases.filter(c => c.label === 'valid');
if (valid.length !== 40 || new Set(valid.map(c => c.rootFamily)).size !== 40) throw new Error('expected_40_unique_valid_roots');
const shuffleSeed = crypto.randomBytes(32).toString('hex');
const packet = valid.map(c => ({
  case_id: c.benchmarkId,
  root_family: c.rootFamily,
  subject: c.subject,
  partition: c.partition,
  stem: c.question.stem,
  passage: c.question.passage,
  options: c.question.options.map(o => ({ label: o.id, text: o.text })),
  source: {
    id: c.certificate.source.id,
    type: c.certificate.source.type,
    url: c.certificate.source.url || null,
    locator: c.certificate.source.locator,
    excerpt: c.certificate.source.exactExcerpt,
    excerpt_sha256: c.certificate.source.excerptSha256,
  },
  syllabus: {
    official_url: c.certificate.syllabus.officialUrl,
    exact_entitlement: c.certificate.syllabus.exactEntitlement,
    identity_sha256: c.certificate.syllabus.identitySha256,
    extraction_sha256: c.certificate.syllabus.extractionSha256,
  },
})).sort((a,b) => hash(`${shuffleSeed}:${a.case_id}`).localeCompare(hash(`${shuffleSeed}:${b.case_id}`)));
fs.mkdirSync(out, { recursive: true });
const packetPath = path.join(out, 'blind-review-packet.json');
const packetText = `${JSON.stringify({ schema: 'cuet-v4-key-blind-review-v1', freeze_payload_sha256: freeze.payloadSha256, source_case_count: packet.length, note: 'Allowlisted question, source excerpt, and syllabus fields only; answer labels, oracle keys, proposed keys, explanations, derivations, and defect certificates are excluded.', cases: packet }, null, 2)}\n`;
fs.writeFileSync(packetPath, packetText);
console.log(JSON.stringify({ blind_packet: 'key-audit/blind-review-packet.json', fixture_payload_sha256: freeze.payloadSha256, packet_sha256: hash(packetText), valid_cases: packet.length, unique_roots: new Set(packet.map(x=>x.root_family)).size,
  by_subject: Object.fromEntries(['english','accountancy','business_studies','economics'].map(s=>[s,packet.filter(c=>c.subject===s).length])), keys_or_explanations_emitted: false }));
