// "Where you stand" (free, no model), "What should I revise tonight?" (free, no model) and Mobi's context reading the
// student's colleges inside the size cap (C-dec 3, 20 Oct 2026).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildStanding, standingForModel, closeFastest, collegeRow, practiceLink, STANDING_NOTE } from '../mobi_standing.js';
import { tonightPack, asksTonight } from '../mobi_tonight.js';
import { computePrepOSInsights } from '../prepos_insights.js';
import { capContextBytes, CONTEXT_DROP_ORDER, MAX_CONTEXT_BYTES } from '../../src/services/ai/contextBudget.js';

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const offerings = JSON.parse(read('public/du/2026/offerings/b-com-hons.json'));
const SRCC = offerings.rows.find((r) => /^Shri Ram College of Commerce/.test(r[0]));

/** One attempt per subject: n questions, `right` of them right, `wrong` wrong, the rest blank, spread over chapters. */
function attempt(subject, { n = 40, right = 28, wrong = 8, chapters = ['A', 'B'] } = {}) {
  const details = Array.from({ length: n }, (_, i) => ({ qid: `${subject}-${i}`, isCorrect: i < right ? true : i < right + wrong ? false : null, givenIndex: i < right + wrong ? 0 : null }));
  const questionsSnapshot = details.map((d, i) => ({ id: d.qid, chapter: chapters[i % chapters.length], subject }));
  return { id: `att-${subject}`, subject, details, questionsSnapshot, completedAt: Date.parse('2026-10-18T10:00:00Z'), mode: 'quick', total: n };
}
const four = [attempt('english'), attempt('accountancy', { chapters: ['Share Capital', 'Debentures'] }), attempt('economics'), attempt('business_studies')];
const colleges = [{ programmeId: 'b-com-hons', programme: 'B.Com. (Hons.)', college: SRCC[0] }, { programmeId: 'b-com-hons', programme: 'B.Com. (Hons.)', college: 'Not a DU college' }];
const offeringsFor = (id) => (id === 'b-com-hons' ? offerings : null);
const ranked = (attempts) => computePrepOSInsights(attempts).chapters?.ranked || [];

test('ready: a band out of 1000 against the first college with a 2026 Round 1 cutoff, the gap, the chapters that close it', () => {
  const s = buildStanding({ attempts: four, colleges, offeringsFor, ranked: ranked(four) });
  assert.equal(s.status, 'ready');
  assert.equal(s.band.max, 1000);
  assert.equal(s.band.complete, true);
  assert.ok(s.band.low <= s.band.mid && s.band.mid <= s.band.high);
  assert.equal(s.first.college, SRCC[0]);
  assert.equal(s.first.cutoff, SRCC[2][0], 'UR Round 1 closing marks, as DU published them');
  assert.equal(s.gap, Math.round((s.first.cutoff - s.band.mid) * 10) / 10);
  assert.ok(['above', 'within', 'below'].includes(s.first.position));
  assert.equal(s.colleges[1].cutoff, null, 'a college with no row has no cutoff, never a guess');
  assert.equal(s.colleges[1].position, 'none');
  assert.ok(s.closeFastest.length >= 1 && s.closeFastest.length <= 3);
  for (const c of s.closeFastest) { assert.ok(c.marks > 0); assert.equal(c.href, practiceLink(c.subject, c.chapter)); }
  assert.equal(s.note, STANDING_NOTE);
  assert.match(STANDING_NOTE, /Not a prediction\./);
});

test('partial: fewer than four papers are never compared with a cutoff out of 1000', () => {
  const two = four.slice(0, 2);
  const s = buildStanding({ attempts: two, colleges, offeringsFor, ranked: ranked(two) });
  assert.equal(s.status, 'partial');
  assert.equal(s.band.max, 500);
  assert.equal(s.first.position, 'none');
  assert.equal(s.gap, null);
});

test('thin and empty: honest states, no band', () => {
  const thin = buildStanding({ attempts: [attempt('accountancy', { n: 10, right: 6, wrong: 2 })], colleges, offeringsFor });
  assert.equal(thin.status, 'thin');
  assert.equal(thin.band, null);
  assert.deepEqual(thin.thin.map((t) => [t.subject, t.needed]), [['accountancy', 20]]);
  const empty = buildStanding({ attempts: [], colleges: [], offeringsFor });
  assert.equal(empty.status, 'empty');
  assert.equal(standingForModel(empty), null);
});

test('closeFastest: chapters ranked by their share of the paper open marks, only in counted papers', () => {
  const papers = [{ subject: 'accountancy', status: 'ready', open: 60 }];
  const r = [
    { subject: 'accountancy', chapter: 'Share Capital', wrong: 3, skip: 1 },
    { subject: 'accountancy', chapter: 'Debentures', wrong: 1, skip: 1 },
    { subject: 'physics', chapter: 'Optics', wrong: 9, skip: 9 },
  ];
  const out = closeFastest({ papers, ranked: r });
  assert.deepEqual(out.map((c) => [c.chapter, c.marks]), [['Share Capital', 40], ['Debentures', 20]]);
});

test('collegeRow: above, within and below the band', () => {
  const band = { low: 600, mid: 640, high: 680, complete: true };
  const entry = { college: 'X', programmeId: 'p' };
  assert.equal(collegeRow(entry, { cutoff: 590, category: 'UR' }, band).position, 'above');
  assert.equal(collegeRow(entry, { cutoff: 650, category: 'UR' }, band).position, 'within');
  assert.deepEqual([collegeRow(entry, { cutoff: 712.4, category: 'UR' }, band).position, collegeRow(entry, { cutoff: 712.4, category: 'UR' }, band).gap], ['below', 72.4]);
});

test('Where you stand is free on every plan and never calls a model', () => {
  const route = read('src/app/api/mobi/standing/route.js');
  const service = read('src/services/mobi/standing.js');
  assert.doesNotMatch(route + service, /isPremium|isPaidUser|locked|generateAIResponse|reserve/);
  assert.match(read('next.config.mjs'), /'\/api\/mobi\/standing': \['\.\/public\/du\/2026\/offerings\/\*\.json'\]/, 'the DU files are traced into the function');
});

test('Mobi context: the colleges and the standing are read, and kept inside the size cap after lower-value parts', () => {
  const ctx = read('src/services/ai/getStudentAIContext.js');
  assert.doesNotMatch(ctx, /TODO: replace with real targets table/);
  assert.match(ctx, /readStanding\(userId, \{ attempts: attempts\.slice\(0, 60\) \}\)/);
  assert.match(ctx, /targetColleges,\r?\n\s*collegeStanding:/);
  const s = buildStanding({ attempts: four, colleges, offeringsFor, ranked: ranked(four) });
  const view = standingForModel(s);
  const { colleges: targetColleges, ...collegeStanding } = view;
  assert.equal(targetColleges[0].cutoff2026Round1, SRCC[2][0]);
  const big = (n) => 'x'.repeat(n);
  const context = {
    generatedAt: 1, targetCourses: ['B.Com. (Hons.)'], aiConfidence: { e: big(3000) }, limits: { e: big(2000) }, revisionPriority: { e: big(3000) },
    mistakeDNA: { e: big(3000) }, weaknessSummary: { e: big(2500) }, recordInsights: { n: 40 }, targetColleges, collegeStanding,
  };
  const capped = capContextBytes(context);
  assert.ok(capped.bytes <= MAX_CONTEXT_BYTES);
  assert.deepEqual(capped.context.targetColleges, targetColleges, 'the colleges stay');
  assert.ok(capped.context.collegeStanding?.band, 'the range stays');
  assert.ok(capped.dropped.includes('aiConfidence'), 'lower-value parts go first');
  assert.ok(!capped.dropped.some((d) => d.startsWith('collegeStanding') || d === 'targetColleges'), 'nothing of the standing was needed to fit');
  // The order: the standing's detail goes before the older summaries, the colleges themselves last of all.
  const at = (k) => CONTEXT_DROP_ORDER.indexOf(k);
  assert.ok(at('collegeStanding.band.papers') < at('mistakeDNA'));
  assert.ok(at('aiCredits') < at('collegeStanding'));
  assert.equal(CONTEXT_DROP_ORDER[CONTEXT_DROP_ORDER.length - 1], 'targetColleges');
  assert.equal(context.collegeStanding.band.papers.length > 0, true, 'the caller context is never changed');
});

test('Mobi is told the cutoffs are published Round 1 marks and never to say a student will or will not get in', () => {
  const rules = read('src/services/prepos/replyDeps.js');
  assert.match(rules, /cutoff2026Round1/);
  assert.match(rules, /Never say they will or will not get in\./);
});

test('tonight: free, from the record; says what is due, the costliest chapters, the kept rules and the traps', () => {
  const insights = computePrepOSInsights([attempt('accountancy', { chapters: ['Share Capital', 'Debentures'] })]);
  const p = tonightPack({
    insights, reviseDue: 3, now: new Date('2026-10-20T15:00:00Z'),
    rules: [{ text: 'Premium goes to Securities Premium, never to Share Capital.' }],
    traps: [{ trapType: 'missed_not_except', label: 'A missed NOT or EXCEPT', caught: 4, of: 6 }],
  });
  assert.equal(p.tonight.when, 'tonight', '8:30 pm in India');
  assert.match(p.reply, /^For tonight, from your own record:/);
  assert.match(p.reply, /3 cards are due/);
  assert.match(p.reply, /Securities Premium/);
  assert.match(p.reply, /it caught you 4 of 6 times/);
  assert.doesNotMatch(p.reply, /!/);
  assert.deepEqual(p.actions.map((a) => a.route.split('?')[0]), ['/review/revise', '/test']);
  const empty = tonightPack({ insights: { state: 'empty' }, now: new Date('2026-10-20T05:00:00Z') });
  assert.match(empty.reply, /nothing in your record to revise today yet/);
});

test('tonight: the old app text is caught too; the chat route answers it free before any model', () => {
  assert.ok(asksTonight('What should I revise tonight?'));
  assert.ok(asksTonight('What should I revise today?'));
  assert.ok(!asksTonight('Explain revision of a contract'));
  const chat = read('src/app/api/ai/mentor/chat/route.js');
  const tonightAt = chat.indexOf("payload.replyKind === 'tonight'");
  assert.ok(tonightAt > 0 && tonightAt < chat.indexOf('runModelReply({'), 'answered before any model path');
  assert.match(chat, /tonight: pack\.tonight, mode, charge: NO_CHARGE/);
});
