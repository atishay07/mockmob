import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  CAPTION_RULES,
  FOOTER_CAPTIONS,
  NOTICE_PRIORITY,
  NOTICE_STORAGE_KEY,
  appOnPlayNotice,
  captionHomes,
  chooseNotice,
  creditsZeroNotice,
  dismissNotice,
  featureUnavailableNotice,
  maintenanceNotice,
  parseDismissed,
  placementFor,
  proEndingNotice,
  readDismissed,
  reconcileDismissed,
  resultReportNotice,
  runnerNotices,
  sessionExpiringNotice,
  slotShows,
  validateNotice,
  writeDismissed,
} from '../notice_rules.mjs';

const member = { kind: 'member', plan: 'free' };
const NOW = Date.parse('2026-10-14T12:00:00Z');

function memoryStorage(initial = {}) {
  const data = { ...initial };
  return {
    data,
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => { data[k] = String(v); },
  };
}

// ---- One slot, one notice ----

test('a slot shows at most one notice, chosen by the priority order', () => {
  const all = [
    ...runnerNotices({ pendingSubmission: true, online: false, hasTicket: false, syncStatus: 'pending' }),
  ];
  assert.equal(all.length, 3);
  assert.equal(chooseNotice(all, { surface: 'runner' }).id, 'runner-submit-waiting');
  assert.equal(chooseNotice(all.slice(1), { surface: 'runner' }).id, 'runner-offline');
  assert.equal(chooseNotice(all.slice(2), { surface: 'runner' }).id, 'runner-syncing');
});

test('inline notices compete by priority: a failure beats a plan reminder', () => {
  const list = [
    proEndingNotice({ isPremium: true, premiumUntil: '2026-10-17T00:00:00Z', now: NOW }),
    creditsZeroNotice({ isPremium: false, creditBalance: 0 }),
    maintenanceNotice({ active: true, message: 'MockMob is being updated' }),
  ];
  assert.equal(chooseNotice(list, { surface: 'app', visitor: member }).id, 'maintenance');
  assert.equal(chooseNotice(list.slice(0, 2), { surface: 'app', visitor: member }).id, 'credits-zero');
});

test('the priority order names every notice the builders can make', () => {
  const made = [
    ...runnerNotices({ pendingSubmission: true, online: false, syncStatus: 'pending' }),
    sessionExpiringNotice({ expiresAtMs: NOW + 5 * 60000, now: NOW }),
    maintenanceNotice({ active: true, message: 'Down for a short while' }),
    featureUnavailableNotice({ feature: 'NTA mode', reason: 'No paper can be built from the current questions' }),
    creditsZeroNotice({ creditBalance: 0 }),
    proEndingNotice({ isPremium: true, premiumUntil: '2026-10-16', now: NOW }),
    appOnPlayNotice({ playListingLive: true, isAndroid: true, isMember: true }),
    resultReportNotice(),
  ];
  assert.deepEqual(made.map((n) => n.id).sort(), [...NOTICE_PRIORITY].sort());
  for (const n of made) assert.equal(n.priority, NOTICE_PRIORITY.indexOf(n.id));
});

test('a slot only shows notices for its own surface', () => {
  const list = [...runnerNotices({ online: false }), resultReportNotice()];
  assert.equal(chooseNotice(list, { surface: 'result', dismissalsReady: true }).id, 'result-report-pointer');
  assert.equal(chooseNotice(list, { surface: 'runner' }).id, 'runner-offline');
  assert.equal(chooseNotice(list, { surface: 'app', visitor: member }), null);
});

test('there is no marketing slot: a stranger is never shown a notice there', () => {
  const list = [creditsZeroNotice({ creditBalance: 0 }), resultReportNotice(), ...runnerNotices({ online: false })];
  assert.equal(chooseNotice(list, { surface: 'marketing', visitor: member }), null);
  assert.equal(chooseNotice(list, { surface: undefined }), null);
});

test('notices that belong to members are never shown to a stranger or a returning visitor', () => {
  const credits = [creditsZeroNotice({ creditBalance: 0 })];
  assert.equal(chooseNotice(credits, { surface: 'app', visitor: { kind: 'new' } }), null);
  assert.equal(chooseNotice(credits, { surface: 'app', visitor: { kind: 'returning' } }), null);
  assert.equal(chooseNotice(credits, { surface: 'app', visitor: member }).id, 'credits-zero');
});

test('the shell slot never shows on the timed test route', () => {
  assert.equal(slotShows('app', '/test'), false);
  assert.equal(slotShows('app', '/test/abc'), false);
  assert.equal(slotShows('app', '/testimonials'), true);
  assert.equal(slotShows('app', '/dashboard'), true);
  assert.equal(slotShows('runner', '/test'), true);
  assert.equal(slotShows('marketing', '/'), false);
  assert.equal(placementFor('runner'), 'toast');
  assert.equal(placementFor('app'), 'inline');
  assert.equal(placementFor('result'), 'inline');
});

// ---- Triggers are real state only ----

test('the test screen says nothing while everything is fine', () => {
  assert.deepEqual(runnerNotices({ online: true, syncStatus: 'saved', hasTicket: true }), []);
  assert.deepEqual(runnerNotices({ online: true, syncStatus: 'saved', hasTicket: false }), []);
  assert.deepEqual(runnerNotices({ online: true, syncStatus: 'pending', hasTicket: true }), []);
});

test('credits: only a free member at zero, never Pro, never an unknown balance', () => {
  assert.equal(creditsZeroNotice({ isPremium: false, creditBalance: 0 }).id, 'credits-zero');
  assert.equal(creditsZeroNotice({ isPremium: false, creditBalance: 3 }), null);
  assert.equal(creditsZeroNotice({ isPremium: true, creditBalance: 0 }), null);
  assert.equal(creditsZeroNotice({ isPremium: false, creditBalance: null }), null);
  assert.equal(creditsZeroNotice({ isPremium: false }), null);
});

test('Pro ending: only inside the window, with the date, and never for a free member', () => {
  const soon = proEndingNotice({ isPremium: true, premiumUntil: '2026-10-17T10:00:00Z', now: NOW });
  assert.match(soon.text, /^Pro ends on 17 Oct\./);
  assert.equal(soon.stateKey, 'ends:2026-10-17');
  assert.equal(proEndingNotice({ isPremium: true, premiumUntil: '2026-11-17T00:00:00Z', now: NOW }), null);
  assert.equal(proEndingNotice({ isPremium: true, premiumUntil: '2026-10-13T00:00:00Z', now: NOW }), null);
  assert.equal(proEndingNotice({ isPremium: true, premiumUntil: null, now: NOW }), null);
  assert.equal(proEndingNotice({ isPremium: true, premiumUntil: 'not a date', now: NOW }), null);
  assert.equal(proEndingNotice({ isPremium: false, premiumUntil: '2026-10-17T00:00:00Z', now: NOW }), null);
});

test('a session notice appears only in the last minutes, and counts them', () => {
  assert.equal(sessionExpiringNotice({ expiresAtMs: NOW + 60 * 60000, now: NOW }), null);
  assert.equal(sessionExpiringNotice({ expiresAtMs: NOW - 1, now: NOW }), null);
  assert.equal(sessionExpiringNotice({ expiresAtMs: undefined, now: NOW }), null);
  assert.match(sessionExpiringNotice({ expiresAtMs: NOW + 5 * 60000, now: NOW }).text, /about 5 minutes\./);
  assert.match(sessionExpiringNotice({ expiresAtMs: NOW + 20000, now: NOW }).text, /about 1 minute\./);
});

test('maintenance and unavailable features need a flag and a plain reason', () => {
  assert.equal(maintenanceNotice({ active: false, message: 'Down' }), null);
  assert.equal(maintenanceNotice({ active: true, message: '  ' }), null);
  assert.equal(featureUnavailableNotice({ feature: 'NTA mode', reason: '' }), null);
  assert.equal(featureUnavailableNotice({ feature: '', reason: 'No paper' }), null);
  const n = featureUnavailableNotice({ feature: 'NTA mode', reason: 'No paper can be built from the current questions', alternative: 'Start a full mock instead.' });
  assert.equal(n.text, 'NTA mode is not available right now. No paper can be built from the current questions. Start a full mock instead.');
});

test('the Play notice stays off until the listing is live (D13), and is for Android members only', () => {
  assert.equal(appOnPlayNotice({ playListingLive: false, isAndroid: true, isMember: true }), null);
  assert.equal(appOnPlayNotice({ playListingLive: true, isAndroid: false, isMember: true }), null);
  assert.equal(appOnPlayNotice({ playListingLive: true, isAndroid: true, isMember: false }), null);
  assert.equal(appOnPlayNotice(), null);
  assert.equal(appOnPlayNotice({ playListingLive: true, isAndroid: true, isMember: true }).id, 'app-on-play');
});

// ---- Dismissal ----

test('a dismissed notice stays dismissed until the state behind it changes', () => {
  const zero = creditsZeroNotice({ creditBalance: 0 });
  let map = dismissNotice({}, zero);
  assert.deepEqual(map, { 'credits-zero': 'zero' });
  assert.equal(chooseNotice([zero], { surface: 'app', visitor: member, dismissed: map }), null);

  // Pro extended to a later date is a new state, so the reminder returns.
  const first = proEndingNotice({ isPremium: true, premiumUntil: '2026-10-16', now: NOW });
  map = dismissNotice(map, first);
  assert.equal(chooseNotice([first], { surface: 'app', visitor: member, dismissed: map }), null);
  const later = proEndingNotice({ isPremium: true, premiumUntil: '2026-10-18', now: NOW });
  assert.equal(chooseNotice([later], { surface: 'app', visitor: member, dismissed: map }).id, 'pro-ending');
});

test('when the state ends the dismissal is forgotten, so the same state later shows again', () => {
  const map = { 'credits-zero': 'zero', 'result-report-pointer': 'v1' };
  const stillZero = reconcileDismissed(map, ['credits-zero', 'pro-ending'], ['credits-zero']);
  assert.equal(stillZero, map);
  const back = reconcileDismissed(map, ['credits-zero', 'pro-ending'], []);
  assert.deepEqual(back, { 'result-report-pointer': 'v1' });
  assert.deepEqual(map, { 'credits-zero': 'zero', 'result-report-pointer': 'v1' }, 'the input is not changed');
});

test('a notice on the timed test cannot be dismissed, and a dismissal for it is ignored', () => {
  const offline = runnerNotices({ online: false })[0];
  assert.equal(offline.dismissible, false);
  assert.deepEqual(dismissNotice({}, offline), {});
  assert.equal(chooseNotice([offline], { surface: 'runner', dismissed: { 'runner-offline': 'offline' } }).id, 'runner-offline');
});

test('a dismissible notice waits until dismissals are read, so it never flashes in and vanishes', () => {
  const note = creditsZeroNotice({ creditBalance: 0 });
  assert.equal(chooseNotice([note], { surface: 'app', visitor: member, dismissalsReady: false }), null);
  assert.equal(chooseNotice([note], { surface: 'app', visitor: member, dismissalsReady: true }).id, 'credits-zero');
  // Notices the person must act on do not wait.
  assert.equal(chooseNotice(runnerNotices({ online: false }), { surface: 'runner', dismissalsReady: false }).id, 'runner-offline');
});

test('stored dismissals tolerate anything: corrupt text, wrong shapes, blocked storage', () => {
  assert.deepEqual(parseDismissed('not json'), {});
  assert.deepEqual(parseDismissed(null), {});
  assert.deepEqual(parseDismissed('[1,2]'), {});
  assert.deepEqual(parseDismissed('{"a":"b","c":4,"d":{}}'), { a: 'b' });
  assert.deepEqual(parseDismissed(`{"${'x'.repeat(61)}":"b"}`), {});
  const big = Object.fromEntries(Array.from({ length: 100 }, (_, i) => [`n${i}`, 'k']));
  assert.equal(Object.keys(parseDismissed(big)).length, 40);

  const blocked = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } };
  assert.deepEqual(readDismissed(blocked), {});
  assert.equal(writeDismissed(blocked, { a: 'b' }), false);
  assert.deepEqual(readDismissed(null), {});
  assert.equal(writeDismissed(null, { a: 'b' }), false);
});

test('dismissals round trip through storage under the versioned key', () => {
  const store = memoryStorage();
  assert.equal(writeDismissed(store, dismissNotice({}, creditsZeroNotice({ creditBalance: 0 }))), true);
  assert.deepEqual(JSON.parse(store.data[NOTICE_STORAGE_KEY]), { 'credits-zero': 'zero' });
  assert.deepEqual(readDismissed(store), { 'credits-zero': 'zero' });
  assert.match(NOTICE_STORAGE_KEY, /:v1$/);
});

// ---- Truth and copy rules ----

const everyNotice = () => [
  ...runnerNotices({ pendingSubmission: true, online: false, syncStatus: 'pending' }),
  sessionExpiringNotice({ expiresAtMs: NOW + 90000, now: NOW }),
  maintenanceNotice({ active: true, message: 'MockMob is being updated' }),
  featureUnavailableNotice({ feature: 'NTA mode', reason: 'No paper can be built from the current questions' }),
  creditsZeroNotice({ creditBalance: 0 }),
  proEndingNotice({ isPremium: true, premiumUntil: '2026-10-16', now: NOW }),
  appOnPlayNotice({ playListingLive: true, isAndroid: true, isMember: true }),
  resultReportNotice(),
];

test('every notice the site can make follows the copy and truth rules', () => {
  for (const n of everyNotice()) assert.deepEqual(validateNotice(n), [], n.id);
});

test('the rules catch what they are meant to catch', () => {
  const base = creditsZeroNotice({ creditBalance: 0 });
  const bad = (patch) => validateNotice({ ...base, ...patch });
  assert.ok(bad({ text: 'Out of credits!' }).includes('exclamation mark'));
  assert.ok(bad({ text: 'Out of credits — top up.' }).includes('em dash'));
  assert.ok(bad({ text: 'Out of credits \u{1F622}' }).includes('emoji'));
  assert.ok(bad({ text: 'Top up →' }).includes('arrow in text'));
  assert.ok(bad({ text: 'A seamless way to top up.' }).includes('banned word'));
  assert.ok(bad({ text: 'Staging is down.' }).includes('build talk'));
  assert.ok(bad({ why: '' }).includes('missing reason'));
  assert.ok(bad({ tone: 'warn', next: '', text: 'Something broke.' }).includes('a warning or error needs a next step'));
  assert.ok(bad({ tone: 'ok', text: 'Your answers are saved.', next: '', acknowledged: false }).includes('success wording without an acknowledgement'));
  assert.deepEqual(bad({ tone: 'ok', text: 'Your answers are saved.', next: '', acknowledged: true }), []);
  assert.ok(bad({ surface: 'runner', dismissible: true }).includes('a notice on the timed test cannot be dismissed'));
  assert.ok(bad({ action: { label: 'Open ↗', href: '/x' } }).includes('arrow in action label'));
  assert.ok(bad({ text: 'x'.repeat(221), next: '' }).includes('text is longer than 220 characters'));
});

test('the offline and waiting copy keeps its meaning after the move onto notices', () => {
  const [waiting, offline, syncing] = runnerNotices({ pendingSubmission: true, online: false, syncStatus: 'pending' });
  assert.equal(waiting.text, 'Not submitted yet. Your answers are safe on this device. Reconnect soon: they send on their own while the submission window is open.');
  assert.equal(offline.text, 'You are offline. Keep answering: answers stay on this device and the timer keeps running. Reconnect before you submit.');
  assert.equal(syncing.text, 'Reconnecting. Your answers are kept on this device until they sync.');
});

// ---- Captions (D8) ----

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

test('every caption has a home, and only the homes the rules allow', () => {
  const allowed = new Set(['footer', 'at-the-date', 'demo-label', 'at-the-claim', 'cut']);
  const ids = new Set();
  for (const rule of CAPTION_RULES) {
    assert.ok(!ids.has(rule.id), `duplicate ${rule.id}`);
    ids.add(rule.id);
    assert.ok(rule.homes.length > 0);
    for (const home of rule.homes) assert.ok(allowed.has(home), `${rule.id}: ${home}`);
    assert.equal(rule.text.includes('!'), false);
    assert.equal(rule.text.includes('—'), false);
  }
  assert.deepEqual(captionHomes('non-affiliation'), ['footer']);
  assert.deepEqual(captionHomes('nope'), []);
});

test('the provisional-2027 caption is never lost: one wording, and at least one home carries it', () => {
  const rule = CAPTION_RULES.find((r) => r.id === 'provisional-2027');
  assert.equal(FOOTER_CAPTIONS.provisional2027, rule.text);
  const squash = (text) => text.replace(/\s+/g, ' ');
  const carriers = rule.carriedBy.filter((file) => squash(read(file)).includes(rule.text));
  assert.ok(carriers.length > 0, 'neither the footer nor Today carries the provisional-2027 caption');
});

test('the cut caption stays cut, and Today carries no other caption', () => {
  const today = read('src/app/(app)/today/page.jsx');
  for (const rule of CAPTION_RULES.filter((r) => r.homes.includes('cut'))) {
    for (const file of rule.notInPageBody || []) assert.equal(read(file).includes(rule.text), false, `${rule.id} is still in ${file}`);
  }
  assert.doesNotMatch(today, /credits are preserved/i);
});

test('non-affiliation lives in the footer and About, as D8 decided', () => {
  const squash = (text) => text.replace(/\s+/g, ' ');
  const footer = squash(read('src/components/MarketingFooter.jsx'));
  const about = squash(read('src/app/about/page.js'));
  assert.match(footer, /not affiliated with NTA, Delhi University, or any official examining body/);
  assert.match(about, /not affiliated with NTA, Delhi University, or any exam body/);
  assert.match(FOOTER_CAPTIONS.nonAffiliation, /not affiliated with NTA, Delhi University/);
  assert.match(FOOTER_CAPTIONS.provisional2027, /provisional/);
});

test('the test screen and the result page use the shared notice slot, not their own strips', () => {
  const runner = read('src/app/(app)/test/RunnerNotice.jsx');
  assert.match(runner, /surface: 'runner'/);
  assert.match(runner, /notices\/NoticeSlot/);
  // The toast is chosen during render: no provider and no effect between a state change and the toast.
  assert.match(runner, /RunnerToast/);
  assert.doesNotMatch(runner, /<Notices/);
  const result = read('src/app/(app)/result/[id]/ResultPageClient.jsx');
  assert.match(result, /<Notices surface="result"/);
  assert.doesNotMatch(result, /className="rp-note"/);
});

test('dismissing hands focus to the slot, and the shared component owns its stylesheet', () => {
  const slot = read('src/components/notices/NoticeSlot.jsx');
  assert.match(slot, /tabIndex=\{-1\}/);
  assert.match(slot, /\.focus\(\)/);
  assert.doesNotMatch(slot, /@\/app\//);
  // The empty slot shows a focus line while it holds focus, so focus never disappears after a dismiss.
  assert.match(read('src/components/notices/notices.css'), /\.notice-slot:not\(\[data-tone\]\):focus\s*\{[^}]*outline: 2px solid/);
});

test('the live region holds only the notice text, never the buttons or links', () => {
  const slot = read('src/components/notices/NoticeSlot.jsx');
  const live = slot.match(/<div role="status" className="notice__live">([\s\S]*?)<\/div>/);
  assert.ok(live, 'the inline slot has a live region');
  assert.match(live[1], /notice__text/);
  assert.doesNotMatch(live[1], /<button|<Link|NoticeControls/);
  assert.equal((slot.match(/role="status"/g) || []).length, 2, 'one for the toast, one for the inline slot');
});

test('the Play notice never links back to this site and has no action without a listing address', () => {
  const on = { playListingLive: true, isAndroid: true, isMember: true };
  assert.equal(appOnPlayNotice(on).action, null);
  assert.equal(appOnPlayNotice({ ...on, playUrl: '/app' }).action, null);
  assert.equal(appOnPlayNotice({ ...on, playUrl: 'http://play.example/x' }).action, null);
  const url = 'https://play.google.com/store/apps/details?id=x';
  assert.equal(appOnPlayNotice({ ...on, playUrl: url }).action.href, url);
});

test('the result pointer stays on the page as it did before, with no dismissal', () => {
  const note = resultReportNotice();
  assert.equal(note.dismissible, false);
  assert.deepEqual(dismissNotice({}, note), {});
  assert.equal(chooseNotice([note], { surface: 'result', dismissalsReady: false }).id, 'result-report-pointer');
});

test('a slot that is not allowed to show returns nothing, and an unknown path is allowed', () => {
  assert.equal(slotShows('result', '/test'), true);
  assert.equal(slotShows('app', '/today'), true);
  assert.equal(slotShows('app', null), true);
  assert.equal(slotShows('app', '/test'), false);
});
