// Release gate for self-study content. Zero model calls, zero production writes.
// Independently recomputes arithmetic, re-derives WordNet facts from hashed source lines, finds NCERT
// reconciliation phrases on the cited PDF pages, checks reading evidence and answer-key structure.
// Anything uncertain is quarantined, never forced into release.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { canonicalStudyJSON } from '../../data/study_content.js';
import { parseRational, parseRatio, cardItem } from '../../data/study_engine.js';
import { parseSynset } from './lib/wordnet.mjs';
import { compilePacket } from '../../data/study/authored/packetCompiler.mjs';

const sha = v => createHash('sha256').update(v).digest('hex');
const digest = v => sha(canonicalStudyJSON(v));
const contentPath = process.argv.find(a => a.startsWith('--content='))?.slice(10) || 'data/study/pilot.json';
const content = JSON.parse(readFileSync(contentPath, 'utf8'));
const skipSources = process.argv.includes('--skip-pdf'); // tests without the ignored PDFs
if (skipSources && process.argv.includes('--write')) throw new Error('SOURCE_CHECK_REQUIRED: cannot publish with PDF reconciliation disabled');
const registry = JSON.parse(readFileSync('data/study/sources/registry.json', 'utf8'));
const wordnet = JSON.parse(readFileSync('data/study/sources/wordnet-excerpts.json', 'utf8'));
const problems = new Map();
const flag = (id, message) => { if (!problems.has(id)) problems.set(id, []); problems.get(id).push(message); };

// ---------- Exact arithmetic, written independently of the authoring helpers ----------
const g = (a, b) => b ? g(b, a % b) : Math.abs(a);
const F = (n, d) => { const k = g(n, d) || 1; return d < 0 ? [-n / k, -d / k] : [n / k, d / k]; };
const minus = ([a, b], [c, d]) => F(a * d - c * b, b * d);
const shareOf = (ratio, i) => F(ratio[i], ratio.reduce((s, x) => s + x, 0));
const sameNumber = (a, b) => { const x = parseRational(a), y = parseRational(b); return !!x && !!y && x[0] === y[0] && x[1] === y[1]; };
const sameRatio = (a, b) => { const x = parseRatio(a), y = parseRatio(b); return !!x && !!y && x.join(':') === y.join(':'); };
function compute(calc) {
  switch (calc.op) {
    case 'sacrifice': { const [n, d] = minus(calc.old, calc.new); return { kind: 'number', value: `${n}/${d}` }; }
    case 'gain': { const [n, d] = minus(shareOf(calc.new, calc.partner), shareOf(calc.old, calc.partner)); return { kind: 'number', value: `${n}/${d}` }; }
    case 'sacrificing_ratio': {
      const s = calc.old.map((_, i) => minus(shareOf(calc.old, i), shareOf(calc.new, i)));
      const den = s.reduce((m, [, d]) => m / g(m, d) * d, 1);
      return { kind: 'ratio', value: s.map(([n, d]) => n * den / d).join(':') };
    }
    case 'revaluation_net': return { kind: 'number', value: String(Math.abs(calc.items.reduce((t, i) => t + (i.side === 'credit' ? i.amount : -i.amount), 0))) };
    case 'revaluation_share': { const [n, d] = F(calc.amount * calc.ratio[calc.partner], calc.ratio.reduce((s, x) => s + x, 0)); return { kind: 'number', value: `${n}/${d}` }; }
    case 'value_added': return { kind: 'number', value: String(calc.output - calc.input) };
    case 'value_chain': { const total = calc.chain.reduce((s, f) => s + f.output - f.input, 0); if (total !== calc.chain.at(-1).output) return { kind: 'error' }; return { kind: 'number', value: String(total) }; }
    case 'gva': return { kind: 'number', value: String(calc.output - calc.input) };
    case 'nva': return { kind: 'number', value: String(calc.output - calc.input - calc.dep) };
    case 'deflator': { const [n, d] = F(calc.nominal * 100, calc.real); return { kind: 'number', value: `${n}/${d}` }; }
    case 'real_gdp': { const [n, d] = F(calc.nominal * 100, calc.deflator); return { kind: 'number', value: `${n}/${d}` }; }
    case 'nominal_q': return { kind: 'number', value: String(calc.q * calc.p) };
    case 'real_q': return { kind: 'number', value: String(calc.q * calc.base) };
    case 'revenue_deficit': return {kind:'number',value:String(calc.expenditure-calc.receipts)};
    case 'fiscal_deficit': return {kind:'number',value:String(calc.expenditure-(calc.revenue+calc.capital))};
    case 'primary_deficit': return {kind:'number',value:String(calc.fiscal-calc.interest)};
    case 'liquidity_ratio': return {kind:'number',value:String(calc.assets/calc.liabilities)};
    case 'quick_assets': return {kind:'number',value:String(calc.assets-(calc.inventory+calc.prepaid))};
    default: return { kind: 'error' };
  }
}
function checkCalc(owner, item) {
  if (!item.calc) return;
  const expected = compute(item.calc);
  const claimed = item.calc.expect ?? item.answer;
  const ok = expected.kind === 'ratio' ? sameRatio(claimed, expected.value) : expected.kind === 'number' ? sameNumber(claimed, expected.value) : false;
  if (!ok) flag(owner, `ARITHMETIC_MISMATCH:${item.id || item.variantId}:${claimed}≠${expected.value}`);
  if (item.type === 'numeric' && !parseRational(item.answer)) flag(owner, `UNPARSEABLE_NUMERIC:${item.variantId || item.id}`);
  if (item.type === 'ratio' && !parseRatio(item.answer)) flag(owner, `UNPARSEABLE_RATIO:${item.variantId || item.id}`);
}

// ---------- Structure and keys ----------
const KINDS = ['explanation', 'worked_example', 'contrast', 'mistake', 'steps', 'word_set', 'knowledge_check','diagram'];
const TYPES = ['reading', 'choice', 'text', 'numeric', 'ratio', 'reveal'];
function checkItem(owner, item, { card = false } = {}) {
  if (!TYPES.includes(item.type) || (card && item.type === 'reading')) return flag(owner, `INVALID_TYPE:${item.id || item.variantId}`);
  if (item.type === 'reading') return;
  if (!item.prompt || !item.explanation) flag(owner, `MISSING_PROMPT_OR_EXPLANATION:${item.id || item.variantId}`);
  if (item.type === 'choice') {
    if (!Array.isArray(item.options) || item.options.length < 2 || !Number.isInteger(item.answer) || !item.options[item.answer]) flag(owner, `INVALID_KEY:${item.id || item.variantId}`);
    if (new Set(item.options).size !== item.options?.length) flag(owner, `DUPLICATE_OPTIONS:${item.id || item.variantId}`);
    if (item.optionNotes && (item.optionNotes.length !== item.options.length || item.optionNotes[item.answer] !== null || item.optionNotes.some((n, i) => i !== item.answer && !n))) flag(owner, `OPTION_NOTES_MISMATCH:${item.id || item.variantId}`);
  } else if (item.answer === undefined || item.answer === '') flag(owner, `MISSING_ANSWER:${item.id || item.variantId}`);
  checkCalc(owner, item);
  if (item.optionChecks) checkMainIdea(owner, item);
  if (item.task === 'inference') checkInference(owner, item);
}
const norm = s => String(s).toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, ' ');
function checkMainIdea(owner, item) {
  const text = norm(item.context);
  if (item.optionChecks.filter(c => c.type === 'main').length !== 1 || item.optionChecks[item.answer].type !== 'main') flag(owner, `MAIN_IDEA_KEY:${item.id || item.variantId}`);
  item.optionChecks.forEach((c, i) => {
    if (c.type === 'detail' && !text.includes(norm(c.evidence))) flag(owner, `DETAIL_NOT_IN_PASSAGE:${item.id || item.variantId}:${i}`);
    if (c.type === 'unsupported' && (!c.absent?.length || c.absent.some(w => text.includes(norm(w))))) flag(owner, `UNSUPPORTED_OPTION_IS_SUPPORTED:${item.id || item.variantId}:${i}`);
  });
}
function checkInference(owner, item) {
  const text = norm(item.context), kind = item.options[item.answer];
  const evidence = item.evidence || [];
  if (evidence.some(e => !text.includes(norm(e)))) flag(owner, `EVIDENCE_NOT_IN_PASSAGE:${item.id || item.variantId}`);
  if (kind === 'Stated in the passage' && !evidence.length) flag(owner, `STATED_WITHOUT_EVIDENCE:${item.id || item.variantId}`);
  if (kind === 'Can be inferred' && (evidence.length < 1 || text.includes(norm(item.statement).replace(/\.$/, '')))) flag(owner, `INFERENCE_NOT_DISTINCT:${item.id || item.variantId}`);
  if (kind === 'Not supported' && evidence.length) flag(owner, `UNSUPPORTED_WITH_EVIDENCE:${item.id || item.variantId}`);
}

// ---------- WordNet: every string re-derived from hashed source lines ----------
const synsets = new Map();
for (const [offset, entry] of Object.entries(wordnet.lines)) {
  if (sha(entry.line) !== entry.sha256 || !entry.line.startsWith(`${offset} `)) { flag('wordnet', `LINE_HASH:${offset}`); continue; }
  synsets.set(offset, parseSynset(entry.line));
}
const antonymsOf = s => {
  const own = s.pointers.filter(p => p.symbol === '!').map(p => synsets.get(p.offset)?.words || []).flat();
  if (own.length) return own;
  return s.pointers.filter(p => p.symbol === '&').flatMap(p => (synsets.get(p.offset)?.pointers || []).filter(q => q.symbol === '!').flatMap(q => synsets.get(q.offset)?.words || []));
};
const factFor = word => { const f = wordnet.facts.find(x => x.word === word); return f && sha(f.line) === f.sha256 && synsets.get(f.offset); };
const licenseOk = wordnet.license.includes('Permission to use, copy, modify and distribute') && readFileSync('data/study/sources/WORDNET-LICENSE.txt', 'utf8') === wordnet.license;
function checkVocabCard(card) {
  const s = factFor(card.word);
  if (!s || s.offset !== card.sourceFact || !s.words.includes(card.word)) return flag(card.id, 'WORDNET_SENSE_MISSING');
  const forms = [card.word, ...s.words.filter(w => w !== card.word && w.replace('sk', 'sc') === card.word)];
  for (const v of card.variants) {
    if (v.task === 'meaning') {
      if (v.options[v.answer] !== s.definition) flag(card.id, `MEANING_NOT_VERBATIM:${v.variantId}`);
      if (v.context && !s.examples.includes(v.context)) flag(card.id, `EXAMPLE_NOT_VERBATIM:${v.variantId}`);
      v.options.forEach((o, i) => { if (i !== v.answer) { const other = wordnet.facts.map(f => synsets.get(f.offset)).find(x => x.definition === o); if (!other || !v.optionNotes[i].includes(`“${wordnet.facts.find(f => f.offset === other.offset).word}”`)) flag(card.id, `DISTRACTOR_UNSOURCED:${v.variantId}:${i}`); } });
    } else if (v.task === 'gap_fill') {
      if (v.answer !== card.word || !forms.some(f => s.examples.includes(v.context.replace('_____', f))) || v.hint !== `It means: ${s.definition}`) flag(card.id, `GAP_NOT_VERBATIM:${v.variantId}`);
    } else if (v.task === 'spelling') {
      if (v.answer !== card.word || v.prompt !== `Which word means: ${s.definition}?`) flag(card.id, `SPELLING_NOT_VERBATIM:${v.variantId}`);
    } else if (v.task === 'synonym' || v.task === 'antonym') {
      const target = v.options[v.answer];
      const pool = v.task === 'synonym' ? s.words : antonymsOf(s);
      if (!pool.includes(target)) flag(card.id, `RELATION_UNSOURCED:${v.variantId}`);
      // A distractor must not also be a synonym or antonym of the word.
      if (v.options.some((o, i) => i !== v.answer && (s.words.includes(o) || antonymsOf(s).includes(o)))) flag(card.id, `AMBIGUOUS_RELATION:${v.variantId}`);
    } else flag(card.id, `UNKNOWN_VOCAB_TASK:${v.variantId}`);
    if ((v.accept || []).some(a => !s.words.includes(a))) flag(card.id, `ACCEPTED_SPELLING_UNSOURCED:${v.variantId}`);
  }
}
function checkWordSet(unit, block) {
  for (const w of block.words) {
    const s = factFor(w.word);
    if (!s || s.definition !== w.meaning || (w.example && !s.examples.includes(w.example)) || (w.synonym && !s.words.includes(w.synonym)) || (w.opposite && !antonymsOf(s).includes(w.opposite))) flag(unit.id, `WORD_SET_NOT_VERBATIM:${w.word}`);
  }
}

// ---------- NCERT and syllabus reconciliation ----------
const PDF_CHECKS = {
  'accountancy-sacrificing-gaining': [['ncert-admission', 5, ['Old Share of Profit – New Share of Profit']], ['ncert-admission', 6, ['the sacrificing ratio is to be worked out by deducting each partner’s new share']], ['ncert-admission', 3, ['it may be assumed that he gets it from them in their profit sharing ratio']], ['ncert-retirement', 3, ['Gaining Ratio']]],
  'accountancy-revaluation': [['ncert-admission', 30, ['2.7 Revaluation of Assets and Reassessment of Liabilities', 'partners in their old profit sharing ratio']], ['ncert-admission', 31, ['account is credited with increase in the value of each asset and decrease in its', 'Similarly unrecorded assets are credited and unrecorded liabilities are', 'To Old Partners Capital A/cs (Old ratio)']]],
  'economics-what-gdp-counts': [['ncert-macro-national-income', 3, ['These are intermediate goods, mostly used as raw material or inputs for', 'Counting them separately will lead to the error of double']], ['ncert-macro-national-income', 10, ['If we include depreciation in value added', 'consumption of fixed capital']], ['ncert-macro-national-income', 23, ['Non-monetary exchanges', 'barter']]],
  'economics-nominal-real': [['ncert-macro-national-income', 21, ['NOMINAL AND REAL GDP', 'Real GDP is calculated in', 'This is called GDP Deflator']]],
  'business-studies-delegation-decentralisation': [['ncert-bst-organising', 20, ['Flow Flows downward Flows upward from Flows upward from', 'Delegation Can be delegated. Cannot be entirely Cannot be delegated', 'it may lead to misuse', 'may make a person ineffective']], ['ncert-bst-organising', 26, ['Delegation is a compulsory', 'Decentralisation is an optional', 'More control by superiors Less control over executives', 'It has narrow scope as it is It has wide scope as it implies', 'To lessen the burden of the To increase the role of']]],
  'business-studies-planning-controlling': [['ncert-bst-controlling', 5, ['planning involves looking ahead and', 'both backward-looking as well as a', 'prescriptive whereas, controlling is', '1. Setting performance standards']], ['ncert-bst-controlling', 6, ['4. Analysing deviations', '5. Taking corrective action']], ['ncert-bst-controlling', 8, ['Critical Point Control', 'Management by Exception']]],
};
const PDF_FILES = { 'ncert-admission': 'ncert-leac102.pdf', 'ncert-retirement': 'ncert-retirement.pdf', 'ncert-macro-national-income': 'ncert-leec102.pdf', 'ncert-bst-organising': 'ncert-lebs105.pdf', 'ncert-bst-controlling': 'ncert-lebs108.pdf',...Object.fromEntries(['lebs104','lebs106','lebs107','leec103','leec105','leac201','leac205'].map(id=>[`ncert-${id}`,`ncert-${id}.pdf`])) };
const pdfPages = {};
function pages(sourceId) {
  if (pdfPages[sourceId]) return pdfPages[sourceId];
  const path = `data/study/sources/${PDF_FILES[sourceId]}`;
  if (!existsSync(path)) throw new Error('SOURCE_PDF_MISSING');
  if (sha(readFileSync(path)) !== registry.sources[sourceId]?.sha256) throw new Error('SOURCE_PDF_HASH_CHANGED');
  const out = execFileSync('python', ['-c', 'import pdfplumber,json,sys\nwith pdfplumber.open(sys.argv[1]) as p: print(json.dumps([(x.extract_text() or "") for x in p.pages]))', path], { maxBuffer: 64 << 20, encoding: 'utf8' });
  return (pdfPages[sourceId] = JSON.parse(out).map(t => t.replace(/­\s*/g, '').replace(/\s+/g, ' ')));
}
function checkSources(unit) {
  for (const ref of unit.sourceRefs) if (!registry.sources[ref.id]?.permission || registry.sources[ref.id].url !== ref.url) flag(unit.id, `UNREGISTERED_SOURCE:${ref.id}`);
  const checks=PDF_CHECKS[unit.id] || unit.sourceEvidence;
  if(checks && (!Array.isArray(checks) || checks.some(c=>!Array.isArray(c) || !unit.sourceRefs.some(r=>r.id===c[0]) || !Number.isInteger(c[1]) || c[1]<1 || !Array.isArray(c[2]) || !c[2].length || c[2].some(s=>typeof s!=='string' || s.length<(PDF_CHECKS[unit.id]?3:8))))) {flag(unit.id,'INVALID_SOURCE_EVIDENCE');return;}
  for (const [sourceId, page, phrases] of skipSources ? [] : checks || []) {
    try { const text = pages(sourceId)[page - 1] || ''; for (const phrase of phrases) if (!text.includes(phrase.replace(/\s+/g, ' '))) flag(unit.id, `SOURCE_PHRASE_NOT_FOUND:${sourceId}:p${page}:${phrase}`); }
    catch (error) { flag(unit.id, `${error.message}:${sourceId}`); }
  }
  if (unit.sourceRefs.some(r => r.id.startsWith('ncert-')) && !checks?.length) flag(unit.id, 'NO_SOURCE_RECONCILIATION');
  if (unit.sourceRefs.some(r => r.id === 'cuet-2026-english-syllabus')) {
    const path = '../../../data/CUET 2026/english.pdf';
    const local = existsSync('data/CUET 2026/english.pdf') ? 'data/CUET 2026/english.pdf' : path;
    if (!existsSync(local) || sha(readFileSync(local)) !== registry.sources['cuet-2026-english-syllabus'].sha256) flag(unit.id, 'SYLLABUS_SOURCE_UNAVAILABLE');
  }
}

// ---------- Run ----------
const packets=JSON.parse(readFileSync('data/study/authored/expansion.json','utf8'));
const compiled=packets.map(compilePacket);
for(const packet of compiled) {
  const expected=packet.units[0],actual=content.units.find(u=>u.id===expected.id);
  if(actual && digest(actual)!==digest(expected)) flag(actual.id,'PACKET_UNIT_CHANGED');
  for(const card of packet.cards){const actualCard=content.cards.find(c=>c.id===card.id);if(actualCard && digest(actualCard)!==digest(card)) flag(card.id,'PACKET_CARD_CHANGED');}
}
if (!licenseOk) flag('wordnet', 'LICENSE_UNAVAILABLE');
const recoveryFamilies = new Set(JSON.stringify(JSON.parse(readFileSync('data/recovery_pathways.json', 'utf8'))).match(/"familyId":"[^"]+"/g)?.map(x => x.slice(12, -1)) || []);
const seenIds = new Set();
for (const unit of content.units) {
  if (!content.syllabus.some(s => s.subject === unit.subject && s.chapters.some(c => c.title === unit.chapter))) flag(unit.id, 'CHAPTER_NOT_IN_SYLLABUS');
  if (!Number.isInteger(unit.version) || unit.version < 1 || !unit.conceptId || !unit.blocks?.length || !unit.objectives?.length || !unit.estimatedMinutes) flag(unit.id, 'INVALID_UNIT_IDENTITY');
  if (new Set(unit.blocks.map(b => b.id)).size !== unit.blocks.length) flag(unit.id, 'DUPLICATE_BLOCK_ID');
  if (unit.checks || unit.probes) flag(unit.id, 'ASSESSMENT_CONTENT_IN_TEACHING');
  for (const block of unit.blocks) {
    if (!KINDS.includes(block.kind)) flag(unit.id, `INVALID_KIND:${block.id}`);
    checkItem(unit.id, block);
    if (block.kind === 'word_set') checkWordSet(unit, block);
    if (block.type === 'reading' && block.calc) checkCalc(unit.id, block);
  }
  checkSources(unit);
}
for (const card of content.cards) {
  if (seenIds.has(card.id)) flag(card.id, 'DUPLICATE_CARD_ID'); seenIds.add(card.id);
  const unit = content.units.find(u => u.id === card.unitId);
  if (!unit) { flag(card.id, 'UNIT_MISSING'); continue; }
  if (!card.familyId.startsWith('study:') || recoveryFamilies.has(card.familyId) || !card.objective || !card.title || !card.sourceRefs?.length) flag(card.id, 'INVALID_TEACHING_IDENTITY');
  const variants = card.variants || [card];
  for (let i = 0; i < variants.length; i++) checkItem(card.id, cardItem(card, i), { card: true });
  if (card.unitId.startsWith('english-vocabulary')) checkVocabCard(card);
}

const blocked = id => problems.has(id) || problems.has('wordnet') && id.startsWith('english-vocabulary');
const report = { version: 2, validator: 'study-content-contract-v2', createdAt: new Date().toISOString(), units: {}, cards: {}, quarantined: [],
  scope: 'Self-study teaching and recall only. No formal recovery assessment, mastery claim or full-syllabus claim.', paidCalls: 0 };
const VALIDATION = {
  english: unit => unit.chapter === 'Vocabulary' ? 'WordNet 3.0 senses, examples and relations re-derived from hashed source lines; licence retained' : 'Original practice passages; evidence, not-stated and key structure checked mechanically',
  default: () => 'NCERT reference phrases found on the cited pages; every number recomputed independently; no formal recovery certification',
};
for (const unit of content.units) {
  const unitCards = content.cards.filter(c => c.unitId === unit.id);
  const bad = blocked(unit.id) || unitCards.some(c => blocked(c.id));
  if (bad) { report.quarantined.push({ id: `${unit.id}@${unit.version}`, reasons: [...(problems.get(unit.id) || []), ...unitCards.flatMap(c => problems.get(c.id) || []), ...(problems.get('wordnet') || [])] }); continue; }
  report.units[`${unit.id}@${unit.version}`] = { contentHash: digest(unit), sourceIdentity: unit.sourceRefs.map(r => r.id).join(','), validation: (VALIDATION[unit.subject] || VALIDATION.default)(unit) };
  for (const card of unitCards) report.cards[`${card.id}@${card.version}`] = { contentHash: digest(card), sourceIdentity: card.sourceFact ? `WordNet3.0:adj:${card.sourceFact}` : card.sourceRefs.map(r => r.id).join(',') };
}
mkdirSync('artifacts/study-suite', { recursive: true });
const write = process.argv.includes('--write');
const imports = { units: content.units.filter(u => report.units[`${u.id}@${u.version}`]).map(u => ({ id: u.id, version: u.version, subject: u.subject, chapter: u.chapter, concept_id: u.conceptId, content: u, content_hash: digest(u), publication_state: 'published' })),
  cards: content.cards.filter(c => report.cards[`${c.id}@${c.version}`]).map(c => ({ id: c.id, version: c.version, unit_id: c.unitId, unit_version: content.units.find(u => u.id === c.unitId).version, content: c, content_hash: digest(c) })) };
if (write && contentPath !== 'data/study/pilot.json') throw new Error('Refusing to write release proof for a non-canonical content file');
if (write) {
  writeFileSync('data/study/release.json', JSON.stringify(report, null, 2) + '\n');
  writeFileSync('artifacts/study-suite/content-v2-dry-run.json', JSON.stringify({ ...report, problems: Object.fromEntries(problems) }, null, 2) + '\n');
  writeFileSync('artifacts/study-suite/content-v2-import-dry-run.json', JSON.stringify(imports, null, 2) + '\n');
}
console.log(JSON.stringify({ releasedUnits: Object.keys(report.units).length, releasedCards: Object.keys(report.cards).length, quarantined: report.quarantined, problems: Object.fromEntries(problems), wrote: write, productionWrites: 0, paidCalls: 0 }, null, 1));
if (report.quarantined.length && process.argv.includes('--strict')) process.exit(1);
