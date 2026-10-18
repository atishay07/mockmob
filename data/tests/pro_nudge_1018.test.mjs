// Pro nudges and the first-session Upgrade sheet (owner, 18 Oct 2026, D79 to D81; copy direction D84).
// Who sees what, the frequency caps, the first-session trigger (only after the first action, never on onboarding),
// Pro sees nothing, and personal benefit lines only when their fact is true.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  FIRST_SESSION_MS, QUIET_MS, PLACEMENTS, HEADLINE_OPTIONS, KEY_LABEL_OPTIONS, CHECKOUT_HREF,
  nudgesAllowed, emptyRecord, readRecord, noteOnboarded, inFirstSession, firstActionOpens, markFirstShown,
  inlineAllowed, quietInline, claimScreen, releaseScreen, inlineCopy, sheetHead, benefitLines, sheetPrice, keyLabel,
  practiceSpentWeek, fullMocksIn, weakestChapter, mergeFacts, triggerForReason,
} from '../../src/lib/proNudge.mjs';
import { publicOffer, priceTag } from '../../src/lib/payments/offer.js';

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const FREE = { id: 'u1', isPremium: false };
const PRO = { id: 'u1', isPremium: true };
const T0 = Date.parse('2026-10-18T13:00:00.000Z');
const S = 'session-a';
const onboarded = () => noteOnboarded(emptyRecord(), { now: T0, session: S });
const paper = (at = T0 + 10 * 60_000) => ({ kind: 'paper', at });

test('who sees anything: Free students only; Pro and signed-out see nothing', () => {
  assert.equal(nudgesAllowed(FREE), true);
  assert.equal(nudgesAllowed(PRO), false);
  assert.equal(nudgesAllowed(null), false);
  assert.equal(nudgesAllowed({ isPremium: false }), false);
  for (const placement of PLACEMENTS) assert.equal(inlineAllowed(emptyRecord(), { placement, now: T0, user: PRO }), false, placement);
  assert.equal(firstActionOpens(onboarded(), { now: T0 + 600_000, session: S, user: PRO, route: '/result/x', action: paper() }), false);
});

test('first session: opens only after the first real action, in the session that finished onboarding', () => {
  const r = onboarded();
  const at = T0 + 12 * 60_000;
  assert.equal(firstActionOpens(r, { now: at, session: S, user: FREE, route: '/result/a1', action: paper() }), true);
  // No action, or an action that is not a finished paper or move, never opens it.
  assert.equal(firstActionOpens(r, { now: at, session: S, user: FREE, route: '/result/a1', action: null }), false);
  assert.equal(firstActionOpens(r, { now: at, session: S, user: FREE, route: '/dashboard', action: { kind: 'visit', at } }), false);
  // A Today move finished on its own page counts too.
  assert.equal(firstActionOpens(r, { now: at, session: S, user: FREE, route: '/today', action: { kind: 'move', at } }), true);
});

test('first session: never on onboarding, never for an action from before onboarding, never without onboarding', () => {
  const r = onboarded();
  assert.equal(firstActionOpens(r, { now: T0 + 1000, session: S, user: FREE, route: '/onboarding', action: paper() }), false);
  assert.equal(firstActionOpens(r, { now: T0 + 1000, session: S, user: FREE, route: '/onboarding?step=days', action: paper() }), false);
  assert.equal(firstActionOpens(r, { now: T0 + 600_000, session: S, user: FREE, route: '/result/old', action: paper(T0 - 3_600_000) }), false);
  // An account that onboarded before this shipped (no record) never gets it.
  assert.equal(firstActionOpens(emptyRecord(), { now: T0, session: S, user: FREE, route: '/result/a', action: paper(T0) }), false);
});

test('first session: a later browser session or more than 6 hours later is not the first session', () => {
  const r = onboarded();
  assert.equal(inFirstSession(r, { now: T0 + 60_000, session: 'session-b' }), false);
  assert.equal(inFirstSession(r, { now: T0 + FIRST_SESSION_MS + 1, session: S }), false);
  assert.equal(inFirstSession(r, { now: T0 + FIRST_SESSION_MS, session: S }), true);
  assert.equal(inFirstSession(r, { now: T0 + 60_000, session: null }), false);
});

test('first session: once ever; a second onboarding (editing subjects) never restarts it', () => {
  const shown = markFirstShown(onboarded(), T0 + 600_000);
  assert.equal(firstActionOpens(shown, { now: T0 + 700_000, session: S, user: FREE, route: '/result/b', action: paper() }), false);
  const again = noteOnboarded(shown, { now: T0 + 900_000, session: 'session-c' });
  assert.equal(again.onboardedAt, T0);
  assert.equal(firstActionOpens(again, { now: T0 + 900_000, session: 'session-c', user: FREE, route: '/result/c', action: paper(T0 + 900_000) }), false);
});

test('the stored record is read defensively', () => {
  assert.deepEqual(readRecord(null), emptyRecord());
  assert.deepEqual(readRecord({ v: 99, onboardedAt: 5 }), emptyRecord());
  assert.deepEqual(readRecord({ v: 1, onboardedAt: 'x', quiet: { bogus: 1, result: 'no', start_sheet: 7 } }).quiet, { start_sheet: 7 });
});

test('inline nudges: a dismissed one stays quiet for 7 days, per placement', () => {
  const r = quietInline(emptyRecord(), 'result', T0);
  assert.equal(inlineAllowed(r, { placement: 'result', now: T0 + QUIET_MS - 1, user: FREE }), false);
  assert.equal(inlineAllowed(r, { placement: 'result', now: T0 + QUIET_MS, user: FREE }), true);
  assert.equal(inlineAllowed(r, { placement: 'start_sheet', now: T0 + 1, user: FREE }), true);
  assert.equal(inlineAllowed(r, { placement: 'not_a_place', now: T0, user: FREE }), false);
});

test('inline nudges: at most one per screen', () => {
  const claims = new Map();
  assert.equal(claimScreen(claims, '/result/a', 'result'), true);
  assert.equal(claimScreen(claims, '/result/a', 'result'), true, 'a re-render keeps its claim');
  assert.equal(claimScreen(claims, '/result/a', 'practice_cost'), false);
  assert.equal(claimScreen(claims, 'start-sheet', 'start_sheet'), true, 'the Start sheet is its own screen');
  releaseScreen(claims, '/result/a', 'result');
  assert.equal(claimScreen(claims, '/result/a', 'practice_cost'), true);
});

test('inline copy: one line and one action; credits_low only when the balance is known and under a Full mock', () => {
  assert.equal(inlineCopy('credits_low', { balance: null }), null);
  assert.equal(inlineCopy('credits_low', { balance: 50 }), null);
  assert.match(inlineCopy('credits_low', { balance: 40 }).text, /^Only 40 practice credits left, not enough for a Full mock/);
  assert.match(inlineCopy('credits_low', { balance: 1 }).text, /^Only 1 practice credit left/);
  for (const placement of PLACEMENTS) {
    const c = inlineCopy(placement, { balance: 10 });
    assert.ok(c && c.text && c.action && c.trigger, placement);
  }
  assert.match(inlineCopy('start_sheet').text, /unlimited mocks/i);
  assert.match(inlineCopy('practice_cost').text, /without counting credits/i);
});

test('dynamic benefits: personal lines only when their fact is true; never an invented number', () => {
  const plain = benefitLines('first_session', {});
  assert.equal(plain.length, 4);
  assert.ok(plain.every((l) => !l.personal));
  assert.ok(plain.every((l) => !/\byou have\b|\byour \d|\bspent\b/i.test(l.text)), 'no personal claims without facts');

  const mine = benefitLines('first_session', { fullMocks: 3, subjects: ['accountancy', 'economics', 'english'], weakChapter: 'Partnership Fundamentals', spentWeek: 42 });
  const text = mine.map((l) => l.text).join(' | ');
  assert.match(text, /You have sat 3 full mocks/);
  assert.match(text, /You spent 42 practice credits this week/);
  assert.match(text, /NTA mode in all 3 of your subjects/);
  assert.match(text, /Partnership Fundamentals cost you the most/);

  // Zero, unknown and junk are never shown as facts.
  const zero = benefitLines('first_session', { fullMocks: 0, sessions: 0, spentWeek: 0, weakChapter: '  ', subjects: [], balance: null });
  assert.ok(zero.every((l) => !l.personal));
  // A known balance at or above a Full mock is not "only N left".
  assert.ok(!benefitLines('credits', { balance: 120 })[0].personal);
  assert.match(benefitLines('credits', { balance: 12 })[0].text, /Only 12 practice credits left/);
  // One subject is named.
  assert.match(benefitLines('nta', { subjects: ['accountancy'] })[0].text, /^NTA mode in Accountancy/);
});

test('dynamic benefits: the tapped feature leads, personal lines rise, four at most', () => {
  assert.equal(benefitLines('nta', {})[0].id, 'nta');
  assert.equal(benefitLines('smart', {})[0].id, 'smart');
  assert.equal(benefitLines('difficulty', {})[0].id, 'difficulty');
  const lines = benefitLines('nta', { weakChapter: 'Money and Banking' });
  assert.deepEqual(lines.map((l) => l.id).slice(0, 2), ['nta', 'smart']);
  for (const t of ['generic', 'first_session', 'result', 'credits', 'nta', 'smart', 'difficulty', 'review', 'compass', 'saves', 'bogus']) {
    assert.ok(benefitLines(t, { fullMocks: 2 }).length <= 4, t);
  }
});

test('facts from pages: credits spent this week, mocks taken, weakest chapter', () => {
  const now = Date.parse('2026-10-18T12:00:00.000Z');
  const history = [
    { at: '2026-10-17T10:00:00.000Z', pool: 'practice', delta: -10 },
    { at: '2026-10-15T10:00:00.000Z', pool: 'practice', delta: -50 },
    { at: '2026-10-16T10:00:00.000Z', pool: 'ai', delta: -1 },
    { at: '2026-10-16T09:00:00.000Z', pool: 'practice', delta: 10 },
    { at: '2026-10-01T10:00:00.000Z', pool: 'practice', delta: -50 },
  ];
  assert.equal(practiceSpentWeek(history, now), 60);
  assert.equal(practiceSpentWeek(null, now), null);
  assert.equal(fullMocksIn([{ mode: 'full' }, { selectionMeta: { mode: 'nta' } }, { mode: 'quick' }]), 2);
  assert.equal(fullMocksIn([{ id: 'a' }, { id: 'b' }]), null, 'attempts that do not say their mode are unknown, not 0');
  assert.equal(fullMocksIn([]), 0);
  assert.equal(weakestChapter([{ chapter: 'A', count: 1 }, { chapter: 'B', count: 3 }]), 'B');
  assert.equal(weakestChapter([]), null);
  assert.deepEqual(mergeFacts({ balance: 40, subjects: ['x'] }, { balance: null, subjects: [] }, { fullMocks: 2 }), { balance: 40, subjects: ['x'], fullMocks: 2 });
  assert.equal(triggerForReason('credits'), 'credits');
  assert.equal(triggerForReason('nope'), null);
});

test('price and key follow offer.js: the one framing on sale today', () => {
  const live = publicOffer();
  const p = sheetPrice(live);
  assert.equal(p.figure, priceTag(live).price);
  assert.equal(p.cycle, priceTag(live).cycle);
  const once = { purchasable: 'one_time', oneTime: { rupees: 99, expires: '31 July 2027' } };
  assert.deepEqual(sheetPrice(once), { figure: '₹99', cycle: 'once', terms: 'One payment covers you through 31 July 2027. No auto-renewal.' });
  assert.equal(keyLabel(once), 'Get Pro for ₹99');
  const monthly = { purchasable: 'monthly', monthly: { rupees: 99 } };
  assert.equal(sheetPrice(monthly).cycle, 'a month');
  assert.equal(keyLabel(monthly), 'Start Pro for ₹99/month');
  assert.equal(sheetPrice(null), null);
  assert.equal(CHECKOUT_HREF, '/pricing#plans');
});

test('copy is true and in house style: no "!", no emoji, no countdown or scarcity, no AI cliches', () => {
  const triggers = ['generic', 'first_session', 'result', 'credits', 'nta', 'smart', 'difficulty', 'review', 'compass', 'saves'];
  const all = [
    ...HEADLINE_OPTIONS, ...KEY_LABEL_OPTIONS,
    ...triggers.flatMap((t) => [sheetHead(t).title, sheetHead(t).lede, ...benefitLines(t, { fullMocks: 2, spentWeek: 10, subjects: ['accountancy'], weakChapter: 'X' }).map((l) => l.text)]),
    ...PLACEMENTS.map((p) => inlineCopy(p, { balance: 5 }).text),
  ];
  for (const line of all) {
    assert.ok(!line.includes('!'), line);
    assert.ok(!/\p{Extended_Pictographic}/u.test(line), line);
    assert.ok(!/hurry|limited time|only today|ends soon|last chance|countdown|elevate|seamless|unleash|game.?changer|guarantee/i.test(line), line);
    assert.ok(!/—/.test(line), `no em dash: ${line}`);
  }
  assert.equal(HEADLINE_OPTIONS.length, 3);
  assert.equal(KEY_LABEL_OPTIONS.length, 3);
  assert.equal(sheetHead('generic').title, HEADLINE_OPTIONS[0]);
  // NTA papers are original practice content, said wherever NTA mode is sold on its own.
  assert.match(sheetHead('nta').lede, /not official/);
});

test('wiring: Pro renders nothing; every Pro tap opens the sheet; onboarding never shows it', () => {
  const host = read('src/components/pro/ProNudgeHost.jsx');
  assert.match(host, /if \(!allowed \|\| !state\.open\) return null;/);
  assert.match(host, /if \(!allowed\) return undefined;[\s\S]*addEventListener\('click'/);
  assert.match(host, /firstActionOpens\(record, \{ now, session, user, route: window\.location\.pathname/);
  assert.match(host, /saveRecord\(userId, markFirstShown\(record, now\)\)/, 'marked once before it opens');
  const nudge = read('src/components/pro/InlineNudge.jsx');
  assert.match(nudge, /inlineAllowed\(loadRecord\(userId\)/);
  assert.match(nudge, /claimScreen\(claims, key, placement\)/);
  const shell = read('src/app/(app)/AppLayoutClient.jsx');
  assert.match(shell, /<ProNudgeHost offer=\{offer\}/);
  assert.match(shell, /data-pro-feature="credits"/);
  assert.match(read('src/app/(app)/layout.js'), /offer=\{publicOffer\(\)\}/);
  const practice = read('src/app/(app)/dashboard/DashboardPageClient.jsx');
  assert.match(practice, /if \(badge\.tone === 'locked'\) openUpgrade\(\{ trigger: id/);
  assert.match(practice, /data-pro-feature="difficulty"/);
  assert.match(practice, /placement="practice_cost"/);
  const sheet = read('src/components/start/StartSheet.jsx');
  assert.match(sheet, /row\.cost\?\.tone !== 'locked' \|\| pro/);
  assert.match(sheet, /placement="start_sheet"/);
  assert.match(read('src/app/(app)/result/[id]/ResultPageClient.jsx'), /reportFirstAction\(\{ kind: 'paper'/);
  assert.match(read('src/app/(app)/result/[id]/ResultPageClient.jsx'), /placement="result"/);
  assert.match(read('src/components/review/ReviewChapters.jsx'), /placement="review_chapter"/);
  assert.match(read('src/components/profile/CreditsSection.jsx'), /placement="credits_low"/);
  const onboarding = read('src/app/onboarding/OnboardingPageClient.jsx');
  assert.match(onboarding, /if \(!edit && !preview\) noteOnboardedNow\(user\?\.id\)/);
  assert.doesNotMatch(onboarding, /openUpgrade|reportFirstAction|ProNudgeHost/);
  const upgrade = read('src/components/pro/UpgradeSheet.jsx');
  assert.match(upgrade, /href=\{linkFor\(CHECKOUT_HREF\)\} data-pro-checkout=""/);
  assert.match(upgrade, />Not now</);
});
