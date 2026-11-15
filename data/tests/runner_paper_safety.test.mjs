// The runner keeps a student's paper (15 Nov 2026, bugs-core B1, B2, B3, B5, B6, B8, B12). Production holds every practice
// paper on the device, so the runner's draft is the only copy of the answers until the submit lands. These drive the real
// runner (src/app/(app)/test/TestPageClient.jsx through data/tests/runner_harness.mjs) as a student does: answer, lose the
// page past the deadline, press the phone's Back, open the paper twice, start one with too few credits.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as h from './runner_harness.mjs';

const KEY = 'generation-safety-000001';
const quick = (over = {}) => ({ mode: 'quick', questions: h.paper(5), durationMs: 300000, params: { generationKey: KEY }, ...over });
const fail = (message, extra = {}) => Object.assign(new Error(message), extra);
const drafts = () => Object.fromEntries([...Array(localStorage.length).keys()].map((i) => localStorage.key(i)).filter((k) => k.startsWith('mm:test:')).map((k) => [k, JSON.parse(localStorage.getItem(k))]));
const draftOf = (key = KEY) => drafts()[`mm:test:student-1:paper:g.${key}`];
const page = (s) => h.text(s.container);
const CODE = /\b[A-Z][A-Z0-9]*_[A-Z0-9_]+\b|Unauthorized|Request failed/;

async function answer(n) {
  for (let i = 0; i < n; i += 1) {
    await h.advance(3000);
    await h.click(h.find('.nta-option')[(i + 1) % 4]);
    await h.click(h.one('.nta-nav-button', 'Next'));
  }
}

test('B1: the page lost just before time-up and reopened inside the grace sends the answers it held, not an empty paper', async (t) => {
  const first = await h.mount(quick());
  let open = first;
  t.after(() => open.unmount());
  await answer(3);
  assert.equal(Object.keys(draftOf().answers).length, 3);
  // The phone discards the tab at 4:40 and the student comes back 30 s after the deadline.
  await h.advance(280000 - 9000, { coarse: true });
  await first.unmount({ keepStorage: true });
  h.clock.now = first.startedAt + 300000 + 30000;
  const second = await h.mount(quick());
  open = second;
  assert.equal(second.requests.filter((r) => r.url === '/api/sessions').length, 0, 'the draft reopened; the server was not asked for an empty copy');
  const [sent] = second.submitted();
  assert.ok(sent, 'the time-up submit went');
  assert.equal(Object.keys(sent.body.answers).length, 3, 'with the three answers');
  assert.equal(sent.body.events.at(-1).reason, 'time_up');
  await h.advance(500);
  assert.deepEqual(second.router.replaced, ['/result/attempt-1']);
});

test('B1: a paper served again after its time with no draft here is never sent empty', async (t) => {
  const s = await h.mount(quick({ startedAt: h.clock.now - 330000 }));
  t.after(() => s.unmount());
  assert.equal(s.submitted().length, 0);
  assert.match(page(s), /Time is up on this paper/);
  assert.match(page(s), /Go to Practice/);
});

test('B8: reopened days after the grace, the paper is sent as a late paper and its result opens', async (t) => {
  const first = await h.mount(quick());
  let open = first;
  t.after(() => open.unmount());
  await answer(2);
  await first.unmount({ keepStorage: true });
  // Offline at the hostel; back online three days later, the student opens the paper again (Practice's Send row links it).
  h.clock.now = first.startedAt + 300000 + 3 * 24 * 60 * 60 * 1000;
  const second = await h.mount(quick());
  open = second;
  await h.advance(500);
  assert.equal(second.requests.filter((r) => r.url === '/api/sessions').length, 0, 'the draft reopened, kept on the device');
  const [sent] = second.submitted();
  assert.ok(sent, 'sent once');
  assert.equal(Object.keys(sent.body.answers).length, 2);
  assert.ok(sent.body.events.every((e) => e.at <= 300000), 'only what happened before the timer ended');
  assert.deepEqual(second.router.replaced, ['/result/attempt-1']);
});

test('B8: a late paper the server still refuses (more than 7 days after its timer) says plainly it could not be saved and never offers a retry', async (t) => {
  const replies = (url) => { if (url === '/api/attempts') throw fail('SESSION_EXPIRED', { status: 422 }); };
  const first = await h.mount(quick());
  let open = first;
  t.after(() => open.unmount());
  await answer(2);
  await first.unmount({ keepStorage: true });
  // The device's clock says 6 days; the server's says more than 7.
  h.clock.now = first.startedAt + 300000 + 6 * 24 * 60 * 60 * 1000;
  const second = await h.mount(quick({ replies }));
  open = second;
  await h.advance(500);
  assert.equal(second.submitted().length, 1, 'tried once');
  assert.match(page(second), /This paper could not be saved/);
  assert.match(page(second), /within 7 days of its timer ending/);
  assert.match(page(second), /Your 2 answers are still/);
  assert.match(page(second), /Start a new paper/);
  assert.doesNotMatch(page(second), /Try sending again|Try again|SESSION_EXPIRED|!/);
  assert.equal(Object.keys(draftOf().answers).length, 2, 'the answers stay on the device');
});

test('B8: offline at time-up the paper is held and sends itself on reconnect, also past the grace', async (t) => {
  let offline = true;
  const replies = (url) => { if (url === '/api/attempts' && offline) throw fail('Network error — check your connection', { kind: 'network' }); };
  const s = await h.mount(quick({ replies }));
  t.after(() => { navigator.onLine = true; return s.unmount(); });
  await answer(2);
  navigator.onLine = false;
  await h.advance(300000, { coarse: true });
  assert.match(page(s), /Time is up and you are offline/);
  assert.match(page(s), /Try sending again/);
  assert.equal(draftOf().pendingSubmission, true);
  // Past the 2-minute grace the paper is still held and still sent when the connection is back (B8: late, for 7 days).
  await h.advance(130000, { coarse: true });
  assert.match(page(s), /Your paper is saved (on this phone|in this browser) and sends itself when you are back online, up to 7 days after its timer ended\./);
  assert.match(page(s), /Try sending again/);
  offline = false; navigator.onLine = true;
  await h.fire(h.document.body, 'online', { bubbles: true });
  await h.advance(500);
  assert.equal(s.submitted().length, 2, 'the time-up try, then the one on reconnect (none while offline)');
  assert.equal(Object.keys(s.submitted().at(-1).body.answers).length, 2);
});

test('B8: still offline 7 days after the timer, the banner says the paper could not be saved and offers a new one, no retry', async (t) => {
  const replies = (url) => { if (url === '/api/attempts') throw fail('Network error — check your connection', { kind: 'network' }); };
  const s = await h.mount(quick({ replies }));
  t.after(() => { navigator.onLine = true; return s.unmount(); });
  await answer(2);
  navigator.onLine = false;
  await h.advance(300000 + 7 * 24 * 60 * 60 * 1000 + 1000, { coarse: true });
  assert.match(page(s), /This paper could not be saved\. It was not sent within 7 days of its timer ending, so it has no result\./);
  assert.match(page(s), /Start a new paper/);
  assert.doesNotMatch(page(s), /Try sending again/);
  const banner = h.text(h.find('.runner-submit-error')[0]);
  assert.doesNotMatch(banner, /!/);
  assert.match(banner, /Start a new paper$/);
});

test('B2: the phone\'s Back opens the Leave sheet; Keep answering stays; the result replaces the paper and Back never traps', async (t) => {
  const s = await h.mount(quick());
  t.after(() => s.unmount());
  await answer(1);
  assert.equal(history.state?.mmPaperGuard, true, 'a guard entry after the first tap');
  await h.pressBack();
  assert.match(page(s), /Leave this practice\?/);
  assert.match(page(s), /Your answer stays (on this phone|in this browser) until the timer ends\. The timer keeps running while you are away\. You can resume from Practice\./);
  assert.equal(history.state?.mmPaperGuard, true, 'the guard is back');
  await h.click(h.one('.pr-sheet button', 'Keep answering'));
  assert.doesNotMatch(page(s), /Leave this practice\?/);
  await h.click(h.one('.nta-submit-button', 'Submit test'));
  await h.click(h.one('.pr-sheet button', 'Submit now'));
  await h.advance(500);
  assert.deepEqual(s.router.replaced, ['/result/attempt-1'], 'replace: Back from the result goes to Practice');
  assert.equal(history.state?.mmPaperGuard ?? false, false, 'the guard came off before the result');
  assert.equal(draftOf().submitted, true, 'the draft is now the small sent mark');
});

test('B5: Back to a sent paper\'s address opens its result, never SESSION_ALREADY_SUBMITTED', async (t) => {
  const first = await h.mount(quick());
  let open = first;
  t.after(() => open.unmount());
  await answer(1);
  await h.click(h.one('.nta-submit-button', 'Submit test'));
  await h.click(h.one('.pr-sheet button', 'Submit now'));
  await h.advance(500);
  await first.unmount({ keepStorage: true });
  const again = await h.mount(quick());
  open = again;
  assert.equal(again.requests.length, 0);
  assert.deepEqual(again.router.replaced, ['/result/attempt-1']);
  // No sent mark on this device: the server's code becomes a sentence, or the result when the server names it.
  await again.unmount();
  const bare = await h.mount(quick({ replies: (url) => { if (url === '/api/sessions') throw fail('SESSION_ALREADY_SUBMITTED', { status: 422, body: { error: 'SESSION_ALREADY_SUBMITTED' } }); } }));
  open = bare;
  assert.match(page(bare), /You already sent this paper/);
  assert.doesNotMatch(page(bare), CODE);
  await bare.unmount();
  const named = await h.mount(quick({ replies: (url) => { if (url === '/api/sessions') throw fail('SESSION_ALREADY_SUBMITTED', { status: 422, body: { error: 'SESSION_ALREADY_SUBMITTED', detail: { attemptId: 'att-9' } } }); } }));
  open = named;
  assert.deepEqual(named.router.replaced, ['/result/att-9']);
});

test('B2: Leave keeps the draft for Practice\'s resume; a second paper of the same set never touches it', async (t) => {
  const first = await h.mount(quick());
  let open = first;
  t.after(() => open.unmount());
  await answer(2);
  await h.click(h.one('.nta-icon-button'));
  await h.click(h.one('.pr-sheet button', 'Leave'));
  await h.advance(500);
  assert.deepEqual(first.router.pushed, ['/dashboard']);
  assert.ok(draftOf().paper.href.startsWith('/test?'), 'the draft carries its address for the resume row');
  assert.match(draftOf().paper.href, new RegExp(`generationKey=${KEY}`));
  await first.unmount({ keepStorage: true });
  const other = await h.mount(quick({ params: { generationKey: 'generation-safety-000002' } }));
  open = other;
  await answer(1);
  assert.equal(Object.keys(draftOf().answers).length, 2, 'the first paper is untouched');
  assert.equal(Object.keys(draftOf('generation-safety-000002').answers).length, 1);
});

test('B3: a practise-this-chapter link without a paper key opens Practice with the set chosen, never "link has expired"', async (t) => {
  const s = await h.mount(quick({ params: { generationKey: null, count: '5', chapter: 'Partnership Fundamentals', recoveryFrom: 'att-1' } }));
  t.after(() => s.unmount());
  assert.deepEqual(s.router.replaced, ['/dashboard?subject=accountancy&mode=quick&count=5&chapter=Partnership+Fundamentals']);
  assert.equal(s.requests.length, 0, 'nothing started, nothing charged');
  assert.doesNotMatch(page(s), /expired/);
});

test('B6: credits that ran out after the price give the price in Practice\'s words, the free set and Pro, never a code', async (t) => {
  const replies = (url) => {
    if (url === '/api/sessions') throw fail('INSUFFICIENT_CREDITS', { status: 402, body: { error: 'INSUFFICIENT_CREDITS' } });
    if (url.startsWith('/api/practice/quote')) {
      const q = new URLSearchParams(url.split('?')[1]);
      return q.get('count') === '10'
        ? { launchable: false, reasonCode: 'insufficient_credits', reason: 'Quick practice costs 10 credits and you have 4. Today’s included set is used.', allowance: { kind: 'daily_practice', state: 'used' }, creditCost: 10 }
        : { launchable: false, reasonCode: 'insufficient_credits', reason: 'Quick practice costs 5 credits and you have 4.', allowance: null, creditCost: 5 };
    }
  };
  const s = await h.mount(quick({ user: { id: 'student-1', isPremium: false, creditBalance: 4 }, replies }));
  t.after(() => s.unmount());
  assert.match(page(s), /Not enough credits for this set/);
  assert.match(page(s), /Quick practice costs 5 credits and you have 4\. Nothing was charged\. Tomorrow’s included 10-question set is free\./);
  assert.doesNotMatch(page(s), CODE);
  const pro = h.one('a', 'See Pro');
  assert.equal(pro.getAttribute('href'), '/pricing?reason=credits');
  assert.equal(pro.getAttribute('data-pro-feature'), 'credits');
  assert.equal(h.find('a.ui-state__action--primary').length, 1);
});

test('B12: a newer tab on the same paper stops this one, which never submits over it; a send there leads to the result', async (t) => {
  const s = await h.mount(quick());
  t.after(() => s.unmount());
  await answer(1);
  const mine = draftOf();
  const theirs = { ...mine, answers: { ...mine.answers, q4: 2 }, owner: 'other-tab', claimedAt: Date.now() + 1 };
  await h.fire(h.document.body, 'storage', { bubbles: true, key: `mm:test:student-1:paper:g.${KEY}`, newValue: JSON.stringify(theirs) });
  assert.match(page(s), /This paper is open in another tab/);
  assert.match(page(s), /Use this tab/);
  await h.advance(300000, { coarse: true });
  assert.equal(s.submitted().length, 0, 'the stopped tab never sends at time-up');
  await h.fire(h.document.body, 'storage', { bubbles: true, key: `mm:test:student-1:paper:g.${KEY}`, newValue: JSON.stringify({ submitted: true, attemptId: 'att-5', endsAt: Date.now() }) });
  assert.match(page(s), /This paper was sent from another tab/);
  assert.equal(h.one('a', 'See your result').getAttribute('href'), '/result/att-5');
});
