
// ---------- D.5-4: the plan row id, and a set that takes several chapters ----------
// ---------- D.5-5: "Do these next" counted against what the bank holds per chapter ----------

function untriedScenario() {
  const past = [1, 2, 3].map((d) => makeAttempt({ id: `ut-q${d}`, mode: 'quick', day: d, version: 'server_practice_v1', qs: paper(`ut${d}`, [['Partnership Fundamentals', 'RRRRR']]) }));
  const cur = makeAttempt({ id: 'ut-mock', day: 6, telemetry: false, qs: paper('utm', [['Accounting Ratios', 'RRRW'], ['Share Capital', 'RRRW'], ['Debentures', 'RRRW'], ['Cash Flow Statement', 'RRRW'], ...filler()]) });
  const inRecord = new Set([...cur.questionsSnapshot.map((q) => q.chapter), 'Partnership Fundamentals']);
  const open = getCanonicalChapters('accountancy').filter((c) => !inRecord.has(c));
  return { cur, all: [cur, ...past], open };
}

test('without a read of the bank nothing changes: the untried row is one chapter, as before', () => {
  const { cur, all, open } = untriedScenario();
  const s = buildSwot({ attempt: cur, allAttempts: all, now: at(7) });
  const row = s.plan.find((p) => p.practice.chapter === open[0]);
  assert.deepEqual(row.practice.chapters, [open[0]]);
  assert.ok(!('inventory' in row));
  assert.equal(row.reason, 'No answers in this chapter in your last 4 Accountancy papers.');
  assert.deepEqual(buildSwot({ attempt: cur, allAttempts: all, now: at(7), inventory: null }), s);
  assert.deepEqual(buildSwot({ attempt: cur, allAttempts: all, now: at(7), inventory: {} }), s, 'a read that covered nothing is no read');
});

test('untried, counted against the bank: a row takes several chapters, never promises more new questions than exist', () => {
  const { cur, all, open } = untriedScenario();
  const [a, b, c, d] = open;
  // a holds 4 and all 4 are new; b holds 12, 7 new; c holds 30, none new; d holds 20, all new.
  const inventory = { [a]: { bank: 4, unseen: 4 }, [b]: { bank: 12, unseen: 7 }, [c]: { bank: 30, unseen: 0 }, [d]: { bank: 20, unseen: 20 } };
  const s = buildSwot({ attempt: cur, allAttempts: all, now: at(7), inventory });
  const row = s.plan.find((p) => p.practice.chapters.includes(a));
  assert.deepEqual(row.practice.chapters, [a, b, d], 'chapters with new questions first, in syllabus order, up to 3; the exhausted chapter waits');
  assert.equal(row.practice.chapter, a);
  assert.equal(row.practice.count, 10);
  assert.deepEqual(row.inventory, { bank: 36, unseen: 31 });
  assert.equal(row.label, `Practise 10 across ${a}, ${b} and ${d}`);
  assert.equal(row.reason, 'No answers in these chapters in your last 4 Accountancy papers. 31 questions in these chapters are new to you, enough for the whole set.');
  assert.equal(row.href, `/dashboard?subject=accountancy&mode=quick&count=10&chapters=${encodeURIComponent([a, b, d].join(','))}&planAttemptId=ut-mock&planItemId=${row.id}`);
  const item = s.quadrants.flatMap((q) => q.items).find((i) => i.kind === 'untried');
  assert.equal(item.planId, row.id);
  assert.deepEqual(item.evidence.inventory[a], { bank: 4, unseen: 4 });
});

test('untried: 4 new questions are said to be 4, and the rest of the set is said to be met before', () => {
  const { cur, all, open } = untriedScenario();
  const inventory = { [open[0]]: { bank: 9, unseen: 4 } };
  const row = buildSwot({ attempt: cur, allAttempts: all, now: at(7), inventory }).plan.find((p) => p.practice.chapter === open[0]);
  assert.deepEqual(row.practice.chapters, [open[0]]);
  assert.equal(row.practice.count, 5, 'the bank holds 9, so the largest set it can fill is 5');
  assert.equal(row.label, `Practise 5 on ${open[0]}`);
  assert.equal(row.reason, 'No answers in this chapter in your last 4 Accountancy papers. The bank holds 9 questions in this chapter, so this set is 5. Only 4 questions in this chapter are new to you, so the rest of the set will be questions you have met before.');
  assert.ok(!/\b10\b/.test(row.reason + row.label), 'never 10 fresh where 4 exist');
});

test('untried: a chapter the student has seen in full is used only when nothing else is left, and says so', () => {
  const { cur, all, open } = untriedScenario();
  const inventory = Object.fromEntries(open.map((c) => [c, { bank: 15, unseen: 0 }]));
  const row = buildSwot({ attempt: cur, allAttempts: all, now: at(7), inventory }).plan.find((p) => p.practice.chapter === open[0]);
  assert.equal(row.practice.chapters.length, 1, '15 questions cover a set of 10, so one chapter is enough');
  assert.equal(row.practice.count, 10);
  assert.equal(row.reason, 'No answers in this chapter in your last 4 Accountancy papers. You have already seen every question the bank holds in this chapter, so this set repeats some.');
});

test('a chapter the bank holds nothing in is not an untried opportunity, and a chapter too thin for the smallest set gets no row', () => {
  const { cur, all, open } = untriedScenario();
  const empty = Object.fromEntries(open.map((c) => [c, { bank: 0, unseen: 0 }]));
  const s = buildSwot({ attempt: cur, allAttempts: all, now: at(7), inventory: empty });
  assert.ok(!s.quadrants.flatMap((q) => q.items).some((i) => i.kind === 'untried'), 'no chapter to try, so no item');
  assert.ok(s.plan.every((p) => !p.practice.chapters.some((c) => open.includes(c))));
  // A weak chapter whose bank holds 3 cannot fill the smallest set (5): no row.
  const three = FIX.three_mocks_repeat_loss;
  assert.equal(swotOf(three).plan[0].practice.chapter, 'Accounting Ratios');
  const out = buildSwot({ attempt: three.attempt, allAttempts: three.allAttempts, missedBefore: three.missedBefore, now: three.now, inventory: { 'Accounting Ratios': { bank: 3, unseen: 3 }, Debentures: { bank: 8, unseen: 1 } } });
  assert.ok(!out.plan.some((p) => p.practice.chapter === 'Accounting Ratios'));
  const debentures = out.plan.find((p) => p.practice.chapter === 'Debentures');
  assert.equal(debentures.practice.count, 5);
  assert.equal(debentures.label, 'Practise 5 on Debentures');
  assert.match(debentures.reason, /The bank holds 8 questions in this chapter, so this set is 5\.$/);
  assert.deepEqual(debentures.inventory, { bank: 8, unseen: 1 });
  assert.deepEqual(out.plan.map((p) => p.id), ['p1', 'p2', 'p3'].slice(0, out.plan.length), 'ids stay in order when a chapter is skipped');
});

test('the bank counts are asked for exactly the chapters the plan may use, none when the paper has no read', () => {
  const { cur, all } = untriedScenario();
  const chapters = swotPlanChapters({ attempt: cur, allAttempts: all });
  assert.ok(chapters.length >= 4 && chapters.length <= 8);
  assert.equal(new Set(chapters).size, chapters.length);
  assert.ok(chapters.every((c) => isValidTopSyllabusPair('accountancy', c)));
  const three = FIX.three_mocks_repeat_loss;
  assert.deepEqual(swotPlanChapters({ ...three }).slice(0, 3), ['Accounting Ratios', 'Debentures', 'Share Capital']);
  assert.deepEqual(swotPlanChapters({ attempt: FIX.practice_not_available.attempt, allAttempts: FIX.practice_not_available.allAttempts }), []);
  assert.deepEqual(swotPlanChapters({ ...FIX.first_mock, answerReviewState: 'unavailable' }), []);
});

test('fitCount: the largest quick set the bank can fill', () => {
  assert.equal(fitCount(10, 4), null);
  assert.equal(fitCount(10, 5), 5);
  assert.equal(fitCount(10, 9), 5);
  assert.equal(fitCount(10, 10), 10);
  assert.equal(fitCount(10, 400), 10);
  assert.equal(fitCount(20, 17), 15);
  assert.equal(fitCount(20, 400), 20);
});

test('a set started from a plan row is the one its follow-through line names', () => {
  const s = FIX.three_mocks_repeat_loss;
  const quick = (id, day, chapter, pattern, planItem) => {
    const a = makeAttempt({ id, mode: 'quick', day, version: 'server_practice_v1', qs: paper(id, [[chapter, pattern]]) });
    return planItem ? { ...a, selectionMeta: { ...a.selectionMeta, planItem } } : a;
  };
  const debs = quick('from-p2', 16, 'Debentures', 'RRRWW', { attemptId: 'mock-3', itemId: 'p2', chapters: ['Debentures'] });
  const out = buildSwot({ attempt: s.attempt, allAttempts: [...s.allAttempts, debs], missedBefore: s.missedBefore, now: s.now });
  const p2 = out.plan.find((p) => p.id === 'p2');
  assert.equal(p2.practice.chapter, 'Debentures');
  assert.deepEqual(p2.later, { at: at(16), right: 3, of: 5, line: 'A set on this chapter on 16 Oct: 3 right of 5.', fromPlan: true });
  // The Accounting Ratios row still reads the earlier chapter-only set, with no claim that it came from the row.
  const p1 = out.plan.find((p) => p.id === 'p1');
  assert.equal(p1.later.fromPlan, undefined);
  assert.equal(p1.later.line, 'A set on this chapter on 16 Oct: 7 right of 10.');
  // A set that carries another paper's plan row is not this row's set: found by chapter, as before, or not at all.
  const otherPaper = quick('other-paper', 16, 'Debentures', 'RRRRW', { attemptId: 'mock-2', itemId: 'p2', chapters: ['Debentures'] });
  const again = buildSwot({ attempt: s.attempt, allAttempts: [...s.allAttempts, otherPaper], missedBefore: s.missedBefore, now: s.now }).plan.find((p) => p.id === 'p2');
  assert.equal(again.later.fromPlan, undefined);
  // Before the paper, or under 5 questions: never a follow-through.
  const early = quick('early', 10, 'Debentures', 'RRRWW', { attemptId: 'mock-3', itemId: 'p2', chapters: ['Debentures'] });
  const short = quick('short', 16, 'Debentures', 'RRW', { attemptId: 'mock-3', itemId: 'p2', chapters: ['Debentures'] });
  const none = buildSwot({ attempt: s.attempt, allAttempts: [...s.allAttempts, early, short], missedBefore: s.missedBefore, now: s.now }).plan.find((p) => p.id === 'p2');
  assert.equal(none.later, null);
});

test('a set that takes several chapters is followed through by the row, and names the chapters', () => {
  const { cur, all, open } = untriedScenario();
  const [a, b] = open;
  const inventory = { [a]: { bank: 6, unseen: 6 }, [b]: { bank: 12, unseen: 12 } };
  const row = buildSwot({ attempt: cur, allAttempts: all, now: at(7), inventory }).plan.find((p) => p.practice.chapters.includes(a));
  assert.deepEqual(row.practice.chapters, [a, b]);
  const set = makeAttempt({ id: 'multi-set', mode: 'quick', day: 8, version: 'server_practice_v1', qs: paper('multi', [[a, 'RRRWW'], [b, 'RRWRR']]) });
  const tagged = { ...set, selectionMeta: { ...set.selectionMeta, planItem: { attemptId: cur.id, itemId: row.id, chapters: [a, b] } } };
  const later = buildSwot({ attempt: cur, allAttempts: [...all, tagged], now: at(9), inventory }).plan.find((p) => p.id === row.id).later;
  assert.deepEqual(later, { at: at(8), right: 7, of: 10, line: 'A set on these chapters on 8 Oct: 7 right of 10.', fromPlan: true });
  // Without the row id the same set is still found, because it lies wholly inside the row's chapters.
  const bare = buildSwot({ attempt: cur, allAttempts: [...all, set], now: at(9), inventory }).plan.find((p) => p.id === row.id).later;
  assert.equal(bare.line, 'A set on these chapters on 8 Oct: 7 right of 10.');
  assert.equal(bare.fromPlan, undefined);
});

test('the new plan and bank strings follow the same copy rules as the rest of the read', () => {
  const { cur, all, open } = untriedScenario();
  const inventories = [
    { [open[0]]: { bank: 9, unseen: 4 } },
    { [open[0]]: { bank: 9, unseen: 1 } },
    { [open[0]]: { bank: 40, unseen: 0 }, [open[1]]: { bank: 40, unseen: 0 } },
    { [open[0]]: { bank: 6, unseen: 6 }, [open[1]]: { bank: 12, unseen: 12 } },
  ];
  for (const inventory of inventories) {
    const plan = buildSwot({ attempt: cur, allAttempts: all, now: at(7), inventory }).plan;
    for (const t of strings(plan)) {
      assert.ok(!/[!—·]/.test(t), t);
      assert.equal(repair.violatesTruthRules(t), false, t);
      assert.equal(claimsAboutStudent(t), false, t);
      assert.equal(t[0], t[0].toUpperCase(), t);
    }
  }
  assert.match(SWOT_COPY.fresh(1, 10), /^1 question in this chapter is new to you/);
  assert.match(SWOT_COPY.fresh(1, 5), /^1 question in this chapter is new to you/);
});

test('the route helper: the bank is counted for the plan chapters; a failed count leaves the plan as it was', async () => {
  const s = FIX.three_mocks_repeat_loss;
  const calls = [];
  const common = { attempt: s.attempt, loadAttempts: async () => s.allAttempts, recapOf: () => null, missedBeforeOf: buildMissedBefore, now: s.now };
  const counted = await resultHistory({ ...common, inventoryOf: async (arg) => { calls.push(arg.chapters); return { 'Accounting Ratios': { bank: 6, unseen: 6 } }; } });
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].slice(0, 3), ['Accounting Ratios', 'Debentures', 'Share Capital']);
  assert.equal(counted.swot.plan[0].practice.count, 5);
  assert.deepEqual(counted.swot.plan[0].inventory, { bank: 6, unseen: 6 });
  const warned = [];
  const failed = await resultHistory({ ...common, inventoryOf: async () => { throw new Error('count down'); }, warn: (n) => warned.push(n) });
  assert.deepEqual(failed.swot.plan, swotOf(s).plan);
  assert.deepEqual(warned, ['inventory']);
  const none = await resultHistory({ ...common, inventoryOf: async () => null });
  assert.deepEqual(none.swot.plan, swotOf(s).plan);
  // No count is asked for when there is no read to plan from.
  let asked = 0;
  await resultHistory({ ...common, answerReviewState: 'unavailable', inventoryOf: async () => { asked++; return {}; } });
  await resultHistory({ ...common, swotEnabled: false, inventoryOf: async () => { asked++; return {}; } });
  assert.equal(asked, 0);
});
