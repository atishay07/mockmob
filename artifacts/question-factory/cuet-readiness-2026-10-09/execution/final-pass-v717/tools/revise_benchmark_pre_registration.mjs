import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const base = 'artifacts/question-factory/cuet-readiness-2026-10-09/execution/final-pass-v717/qualification-fresh32/';
const read = name => JSON.parse(readFileSync(base + name, 'utf8'));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const authored = read('sealed/authored.json'), originalPacket = read('blind/packet.json');
const registry = read('source-registry.json'), originalMap = read('sealed/blind-id-map.json');
const changes = new Map();
function change(slot, fields, note, extra = {}) {
  const item = authored.items.find(item => item.slot === slot);
  if (!item) throw Error('missing_slot:' + slot);
  const originalId = item.id;
  item.id += '-custody-r1';
  item.family_id += '-custody-r1';
  Object.assign(item.candidate, fields);
  Object.assign(item, extra);
  item.provenance = { ...item.provenance, prior_draft_id: originalId, pre_registration_revision: note };
  changes.set(slot, { item, originalId, note });
}
const AC = 'ncertcol-leac204-v1', EC = 'ncertcol-leec203-v1';
change('A_V1', {
  concept: 'common-size-inter-firm-expense-comparison',
  body: 'Company P has revenue from operations of ₹800 lakh and expenses of ₹600 lakh. Company Q has revenue from operations of ₹200 lakh and expenses of ₹160 lakh. Using common-size statements, which comparison is correct?',
  options: ['P has expenses of 75% of revenue, against Q’s 80%; P has the lower expense share.', 'Q has the lower expense share because its expenses are lower in rupees.', 'P has expenses of 80% of revenue, against Q’s 75%; Q has the lower expense share.', 'The expense shares are equal because each company’s expenses are below its revenue.'],
  key: 'A', explanation: 'Common-size profit-and-loss statements express expenses as a percentage of revenue from operations. P: 600 ÷ 800 × 100 = 75%; Q: 160 ÷ 200 × 100 = 80%. P has the lower expense share despite its larger absolute expenses.',
  sources: [[AC, 'p4-c0-g2-s0'], [AC, 'p12-c0-g2-s0']],
  objective: 'Compare expense shares of differently sized companies using the common-size revenue basis.'
}, 'Replace trend computation whose official syllabus entitlement was not established with explicitly entitled common-size comparison.');
change('A_D2', {
  concept: 'common-size-missing-revenue-base',
  body: 'A company reports expenses of ₹100 lakh. In its common-size statement of profit and loss, what percentage of revenue from operations do these expenses represent?',
  explanation: 'Common-size profit-and-loss statements express expenditure as a percentage of revenue from operations. Revenue is not supplied, so no percentage can be determined from the printed information.',
  sources: [[AC, 'p12-c0-g2-s0']], objective: 'Identify a missing decisive revenue base in a common-size expense calculation.'
}, 'Remove incidental trend syllabus gap; retain the intended missing decisive input defect.', { defect_note: 'Revenue from operations is missing. Different positive revenues produce different percentages; the proposed numeric key is not determined.', answer_set: [] });
change('A_D3', {
  concept: 'common-size-explanation-inverts-ratio',
  body: 'Revenue from operations is ₹200 lakh and cost of goods sold is ₹150 lakh. In a common-size statement of profit and loss, what percentage of revenue is cost of goods sold?',
  options: ['25%', '133.33%', '75%', '50%'], key: 'C',
  explanation: 'Common-size analysis divides revenue by expenditure: ₹200 lakh ÷ ₹150 lakh × 100 = 133.33%. Therefore option C is correct.',
  sources: [[AC, 'p12-c0-g2-s0']], objective: 'Calculate an expense share; the keyed result is correct but the explanation inverts the ratio.'
}, 'Remove incidental trend syllabus gap while preserving an independently false explanation.', { defect_note: 'The correct expense/revenue ratio is 150/200 = 75%, option C. The explanation gives the reversed ratio 200/150 = 133.33% and misstates the common-size rule.', answer_set: ['C'] });
change('E_V4', {
  explanation: 'Short-run marginal cost is the change in total cost per unit of change in output. Output rises by one unit, so MC = (₹49 − ₹44) ÷ (4 − 3) = ₹5.',
  sources: [[EC, 'p9-c0-g0-s23']]
}, 'Supply the decisive marginal-cost definition and remove the unsupported claim about the headerless schedule.');
change('E_D1', {
  body: 'A firm’s total cost is ₹44 at output 3 and ₹49 at output 4. What is the short-run marginal cost when output rises from 3 units to 4 units?',
  explanation: 'The change in total cost per unit of output change is (₹49 − ₹44) ÷ (4 − 3) = ₹5 (option B).',
  sources: [[EC, 'p9-c0-g0-s23']], objective: 'Compute marginal cost from printed adjacent total costs; the candidate key differs from the calculation.'
}, 'Print all decisive values and supply the marginal-cost definition; preserve the wrong-key defect.', { defect_note: 'The independently determined answer is B, ₹5; the candidate key C is ₹8.', answer_set: ['B'] });
change('E_D3', {
  body: 'A firm’s fixed cost is ₹20 at both output levels. Variable cost is ₹60 at output 8 and ₹75 at output 9. What is its short-run marginal cost of increasing output from 8 to 9?',
  explanation: 'Marginal cost is total variable cost divided by output: ₹75 ÷ 9 = ₹8.33. The keyed answer is D, ₹15.',
  sources: [[EC, 'p9-c0-g0-s0'], [EC, 'p9-c0-g0-s23']],
  objective: 'Apply incremental cost with unchanged fixed cost; the key is correct but the explanation substitutes average variable cost.'
}, 'Remove unlabeled schedule dependence and explicit-answer retrieval; preserve the false explanation.', { defect_note: 'Total costs are ₹80 and ₹95, so the incremental cost is ₹15, D. The explanation falsely defines MC as TVC/output, which is AVC.', answer_set: ['D'] });
authored.created_at = new Date().toISOString();
authored.schema = 'cuet-v717-authored-custody-revision-v1';
authored.parent_authored_sha256 = sha(readFileSync(base + 'sealed/authored.json'));
authored.construction_note += ' Six pre-registration custody revisions fix established source/syllabus construction gaps; no paid evaluation, outcomes or registration existed. Original drafts and independent derivations preserved.';
const mapping = structuredClone(originalMap); mapping.items = {};
const packet = structuredClone(originalPacket); packet.created_at = authored.created_at; packet.parent_packet_sha256 = sha(readFileSync(base + 'blind/packet.json'));
packet.items = authored.items.map(item => {
  const previousId = item.provenance?.prior_draft_id || item.id;
  const priorOpaque = Object.entries(originalMap.items).find(([, id]) => id === previousId)[0];
  const prior = originalPacket.items.find(row => row.opaque_id === priorOpaque);
  const opaque = item.id === previousId ? priorOpaque : 'q717-' + sha(Buffer.from(item.id)).slice(0, 24);
  mapping.items[opaque] = item.id;
  return { ...prior, opaque_id: opaque, question: item.candidate.body, family_id: item.family_id,
    options: item.candidate.options.map((text, i) => ({ key: 'ABCD'[i], text })),
    excerpts: [...item.candidate.sources.map(([id, locator]) => {
      const source = registry.sources[id];
      if (!source?.facts?.[locator]?.text || !source.extraction_checked || source.state !== 'active') throw Error('source_missing:' + id + ':' + locator);
      return { source_id: id, source_version: source.version, source_pack_id: source.source_pack_id, locator, text: source.facts[locator].text };
    }), ...prior.excerpts.filter(source => source.kind === 'official_syllabus')] };
});
const out = (name, value) => { writeFileSync(base + name, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' }); return { path: base + name, sha256: sha(readFileSync(base + name)) }; };
const outputs = [out('sealed/authored-custody-r1.json', authored), out('sealed/blind-id-map-custody-r1.json', mapping), out('blind/packet-custody-r1.json', packet)];
outputs.push(out('sealed/PRE-REGISTRATION-REVISIONS.json', { created_at: authored.created_at, native_calls: 0, old_artifacts_preserved: true, changes: [...changes].map(([slot, row]) => ({ slot, old_id: row.originalId, new_id: row.item.id, reason: row.note })), outputs }));
console.log(JSON.stringify({ outputs, changed: changes.size, native_calls: 0 }));
