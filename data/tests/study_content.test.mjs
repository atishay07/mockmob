import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { checkAnswer, parseRatio, cardItem, publicStudyItem, studyTransition, createStudyRun, guidedSequence } from '../study_engine.js';
import { taughtRecallCards,recallQueue } from '../study_engine.js';
import { studyHelpEvidence,studyHelpReplay } from '../study_help.js';

const pilot = JSON.parse(readFileSync(new URL('../study/pilot.json', import.meta.url)));
const event = (type, extras = {}, revision = 0, itemId = 'c') => ({ type, itemId, expectedRevision: revision, requestKey: 'request-key-12345', ...extras });
test('a saved explanation replays only for its bound run and step, with no repeat charge',()=>{
  const saved={reply:'Published contrast explained',study:{runId:'r',revision:3,itemId:'contrast'},charge:{kind:'prepos_credit',creditUnits:1,amount:1}};
  const bound={runId:'r',revision:3,itemId:'contrast'};
  assert.equal(studyHelpReplay(saved,bound).reply,saved.reply);
  assert.equal(studyHelpReplay(saved,bound).charge.amount,0);
  for(const override of [{runId:'another-owner-run'},{revision:4},{itemId:'unanswered-card'}]) assert.equal(studyHelpReplay(saved,{...bound,...override}),null);
  assert.equal(studyHelpReplay(null,bound),null);
});
test('new students learn before new recall, while due reviews survive preferences',()=>{
  const cards=[{id:'a',unitId:'first',version:1},{id:'b',unitId:'second',version:1}];
  assert.deepEqual(taughtRecallCards(cards,[],[]),[]);
  const queue=recallQueue(taughtRecallCards(cards,[],[]),[]);
  const sequence=guidedSequence({primary:{kind:'ordinary_practice',href:'/dashboard'}},{queue,nextUnit:{id:'first',title:'First lesson'}});
  assert.equal(sequence[0].kind,'learn');
  assert.deepEqual(taughtRecallCards(cards,[],['first']).map(c=>c.id),['a']);
  const states=[{card_id:'b',content_version:1,schedule:{due:new Date(0).toISOString()}}];
  assert.deepEqual(taughtRecallCards(cards,states,['first']).map(c=>c.id),['a','b']);
  assert.deepEqual(taughtRecallCards(cards,[{...states[0],content_version:0}],[]),[]);
});
test('AI study help cannot see hidden answers, future items or assessment keys',()=>{
  const row={content:{title:'Lesson',units:[{id:'u',version:2}],items:[{type:'choice',prompt:'Current',answer:0,explanation:'Why'},{type:'choice',answer:'future secret'}]},projection:{state:'active',cursor:0,revealed:false}};
  assert.throws(()=>studyHelpEvidence(row),/ANSWER_FIRST/);
  const revealed={...row,projection:{...row.projection,revealed:true,feedback:{answer:'Current answer'}}};
  assert.equal(studyHelpEvidence(revealed).teaching.prompt,'Current');
  assert.equal(JSON.stringify(studyHelpEvidence(revealed)).includes('future secret'),false);
  const reading={...row,content:{...row.content,items:[{type:'reading',body:'Published explanation'}]}};
  assert.equal(studyHelpEvidence(reading).teaching.body,'Published explanation');
  assert.throws(()=>studyHelpEvidence({...row,projection:{...row.projection,state:'invalidated'}}),/UNAVAILABLE/);
});

test('numeric and ratio answers accept equivalent forms and reject near misses', () => {
  const numeric = { type: 'numeric', answer: '3/20' };
  for (const ok of ['3/20', '6/40', ' 0.15 ', '3 / 20'.replace(/ /g, '')]) assert.equal(checkAnswer(numeric, ok), true, ok);
  for (const bad of ['3/2', '-3/20', '15%', '', 'abc', '3/0']) assert.equal(checkAnswer(numeric, bad), false, bad);
  assert.equal(checkAnswer({ type: 'numeric', answer: '3000' }, '₹3,000'), true);
  assert.equal(checkAnswer({ type: 'numeric', answer: '-1/12' }, '−1/12'), true);
  const ratio = { type: 'ratio', answer: '2:1' };
  for (const ok of ['2:1', '4:2', '1/5:1/10']) assert.equal(checkAnswer(ratio, ok), true, ok);
  for (const bad of ['1:2', '2', '2:1:1', '']) assert.equal(checkAnswer(ratio, bad), false, bad);
  assert.deepEqual(parseRatio('6:4:2'), [3, 2, 1]);
  const text = { type: 'text', answer: 'sceptical', accept: ['skeptical'] };
  assert.equal(checkAnswer(text, ' Skeptical '), true); assert.equal(checkAnswer(text, 'sceptic'), false);
  assert.throws(() => checkAnswer(text, 'x'.repeat(201)), /INVALID_ANSWER/);
});

test('a wrong choice explains itself only after answering, and secrets never reach an unanswered item', () => {
  const item = { id: 'c', type: 'choice', prompt: 'p', options: ['a', 'b'], answer: 0, optionNotes: [null, 'b is the other idea'], explanation: 'why', accept: ['x'], variants: [{}], sourceRefs: [{ license: 'long' }] };
  const hidden = publicStudyItem(item);
  for (const key of ['answer', 'explanation', 'optionNotes', 'accept', 'variants', 'sourceRefs']) assert.equal(hidden[key], undefined, key);
  const run = createStudyRun({ id: 'r', mode: 'recall', unitIds: ['u'], cardIds: ['c'] });
  const { projection, rating } = studyTransition(run, item, event('answer', { value: 1 }));
  assert.equal(rating, 1); assert.equal(projection.feedback.chosen, 'b'); assert.equal(projection.feedback.whyChosen, 'b is the other idea');
  assert.equal(studyTransition(run, item, event('answer', { value: -1 })).projection.feedback.skipped, true);
  const gap = publicStudyItem({ id: 'g', type: 'text', word: 'candid', answer: 'candid', context: 'my _____ opinion' });
  assert.equal(gap.word, undefined); assert.equal(gap.context, 'my _____ opinion');
});

test('card variants rotate with review count and keep the card identity that the scheduler stores', () => {
  const card = pilot.cards.find(c => c.id === 'english-word-candid');
  assert.ok(card.variants.length >= 3);
  const tasks = [0, 1, 2, 3].map(reps => cardItem(card, reps));
  assert.deepEqual(tasks.map(t => t.task), ['meaning', 'gap_fill', 'synonym', 'meaning']);
  assert.ok(tasks.every(t => t.id === card.id && t.version === card.version && t.familyId === card.familyId));
  assert.equal(tasks[1].type, 'text'); assert.equal(publicStudyItem(tasks[1]).answer, undefined);
});

test('setting a session aside keeps its history, introduces nothing and cannot be replayed', () => {
  const run = createStudyRun({ id: 'r', mode: 'learn', unitIds: ['u'] });
  const { projection, rating } = studyTransition(run, null, event('set_aside'));
  assert.equal(projection.state, 'set_aside'); assert.equal(rating, null); assert.equal(projection.cursor, 0);
  assert.throws(() => studyTransition(projection, null, event('set_aside', {}, 1)), /STEP_CONFLICT/);
  assert.throws(() => studyTransition(projection, { id: 'c', type: 'reading' }, event('continue', {}, 1)), /STEP_CONFLICT/);
});

test('lesson checks are recorded separately from scheduling and never rate a card', () => {
  const item = { id: 'c', type: 'numeric', answer: '1/10', explanation: 'x', total: 2 };
  const run = createStudyRun({ id: 'r', mode: 'learn', unitIds: ['u'] });
  const { projection, rating } = studyTransition(run, item, event('answer', { value: '1/10' }));
  assert.equal(rating, null); assert.deepEqual(projection.checks, [{ id: 'c', correct: true }]);
});

test('Today steps say what they improve, how long they take and link practice to the recommended chapter', () => {
  const study = { active: null, queue: { items: [{}, {}], dueCount: 2 }, nextUnit: { id: 'u', title: 'Revaluation', subject: 'accountancy', chapter: 'Admission of Partner', reason: 'r' } };
  const steps = guidedSequence({ primary: { kind: 'ordinary_practice', href: '/dashboard', title: 'Practice' } }, study, 20);
  assert.deepEqual(steps.map(s => s.kind), ['recall', 'learn', 'ordinary_practice']);
  assert.ok(steps.every(s => s.purpose && s.done && s.estimatedMinutes));
  assert.equal(steps[0].title, 'Review 2 due cards');
  assert.match(steps[2].href, /chapter=Admission\+of\+Partner/);
});

test('the content gate quarantines changed arithmetic, unsourced vocabulary and unsupported reading keys', () => {
  assert.throws(()=>execFileSync(process.execPath,['scripts/learning/validate-study-content.mjs','--skip-pdf','--write'],{encoding:'utf8',stdio:'pipe'}),/SOURCE_CHECK_REQUIRED/);
  const dir = mkdtempSync(join(tmpdir(), 'study-gate-'));
  const run = mutate => {
    const copy = JSON.parse(JSON.stringify(pilot)); mutate(copy);
    const path = join(dir, `c${Math.random().toString(36).slice(2)}.json`); writeFileSync(path, JSON.stringify(copy));
    return JSON.parse(execFileSync(process.execPath, ['scripts/learning/validate-study-content.mjs', `--content=${path}`, '--skip-pdf'], { encoding: 'utf8' }));
  };
  const clean = run(() => {});
  assert.equal(clean.quarantined.length, 0, JSON.stringify(clean.problems));
  const packet = run(c=>{c.cards.find(x=>x.id==='economics-budget-deficits-fact-2').variants[1].answer='999';});
  assert.match(JSON.stringify(packet.problems),/PACKET_CARD_CHANGED|ARITHMETIC_MISMATCH/);
  assert.ok(packet.quarantined.some(q=>q.id.startsWith('economics-budget-deficits')));
  const arithmetic = run(c => { c.cards.find(x => x.id === 'accountancy-ratio-sacrifice-calc').variants[0].answer = '1/20'; });
  assert.ok(arithmetic.quarantined.some(q => q.id.startsWith('accountancy-sacrificing-gaining')));
  assert.match(JSON.stringify(arithmetic.problems), /ARITHMETIC_MISMATCH/);
  const vocab = run(c => { const v = c.cards.find(x => x.id === 'english-word-lucid').variants[0]; v.options[v.answer] = 'very clear and bright'; });
  assert.match(JSON.stringify(vocab.problems), /MEANING_NOT_VERBATIM/);
  const relation = run(c => { const v = c.cards.find(x => x.id === 'english-word-candid').variants.find(x => x.task === 'synonym'); v.options[v.answer] = 'lucid'; });
  assert.match(JSON.stringify(relation.problems), /RELATION_UNSOURCED/);
  const reading = run(c => { const v = c.cards.find(x => x.id === 'english-main-idea-find').variants[0]; v.optionChecks[3].absent = ['libraries']; });
  assert.match(JSON.stringify(reading.problems), /UNSUPPORTED_OPTION_IS_SUPPORTED/);
  const key = run(c => { c.cards.find(x => x.id === 'bst-del-scenario').variants[0].answer = 5; });
  assert.match(JSON.stringify(key.problems), /INVALID_KEY/);
});
