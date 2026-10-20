// The public invite page on Mob v3 (/join/<code>, 20 Oct 2026): the codes it accepts (6 characters, and the older 8), the
// preview it draws (the Mob's name, its subject, the seats taken, never a member), the right next step signed out and
// signed in, the honest states (invalid, expired, full, paused, did not load), the invite surviving a new account's
// onboarding, and the copy and style lint over the new files.
// Run: node --test data/tests/mob_join_v3_1020.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JoinCopy, SEATS, SILHOUETTE_FOLDS, codeFromParam, isV3Invite, joinView, seatPlan, takenSeats } from '../../src/lib/mob/v3/joinModel.mjs';
import { isInvitePath, postSignInPath, rememberNextPath, signupPathFor, loginPathFor } from '../../src/lib/auth-redirect.js';
import { ERRORS } from '../../src/lib/mob/model.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const read = (rel) => readFileSync(resolve(root, rel), 'utf8');
const lookup = JSON.parse(read('data/tests/fixtures/mob_v3/lookup.json'));

const FILES = ['src/components/mob/JoinMob.jsx', 'src/components/mob/join/JoinV3.jsx', 'src/components/mob/join/JoinStage.jsx', 'src/lib/mob/v3/joinModel.mjs'];

function visibleText(source) {
  const noComments = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
  const out = [];
  for (const m of noComments.matchAll(/(?<![=-])>([^<>{}=;()]+)</g)) out.push(m[1]);
  for (const m of noComments.matchAll(/(['"`])((?:\\.|(?!\1)[^\\\n])*?)\1/g)) out.push(m[2]);
  return out.map((t) => t.trim()).filter((t) => /[A-Za-z]/.test(t) && !/^[\w./:@#?&=${}()[\]-]+$/.test(t) && !t.startsWith('/') && !/\$\{[^}]*\}\//.test(t));
}

test('the page reads a 6-character code, an old 8-character code, a spaced, hyphenated or lower-case one, and a pasted link', () => {
  assert.equal(codeFromParam('MR1SNQ'), 'MR1SNQ');
  assert.equal(codeFromParam('mr1snq'), 'MR1SNQ');
  assert.equal(codeFromParam('K7P 2M9'), 'K7P2M9');
  assert.equal(codeFromParam('K7P-2M9'), 'K7P2M9');
  assert.equal(codeFromParam('7KQ2M9XR'), '7KQ2M9XR', 'the old 8-character code keeps working');
  assert.equal(codeFromParam('7kq2-m9xr'), '7KQ2M9XR');
  assert.equal(codeFromParam('MRISNO'), 'MR1SN0', 'Crockford reading: I and L are 1, O is 0');
  assert.equal(codeFromParam('https://www.mockmob.in/join/MR1SNQ'), 'MR1SNQ');
  assert.equal(codeFromParam('K7P2M'), null, 'five characters is not a code');
  assert.equal(codeFromParam('K7P2M9U'), null, 'seven is not a code, and U is not in the alphabet');
  assert.equal(codeFromParam(''), null);
});

test('a Mob v3 invite is the one the server answers with the Mob\'s name; its preview is the name, subject and seats, no member', () => {
  assert.equal(isV3Invite(lookup), true);
  assert.equal(isV3Invite({ ...lookup, name: undefined }), false, 'no name: the weekly-paper page stays');
  assert.equal(isV3Invite(null), false);
  const keys = Object.keys(lookup).sort();
  assert.deepEqual(keys, ['code', 'expiresAt', 'name', 'seatsLeft', 'size', 'status', 'subject', 'subjectName', 'valid']);
  assert.equal(takenSeats({ size: 3, seatsLeft: 2 }), 3);
  assert.equal(takenSeats({ seatsLeft: 4 }), 1);
  assert.equal(takenSeats({ size: 9 }), SEATS);
  assert.equal(takenSeats({ size: -1 }), 0);
  assert.equal(JoinCopy.seatsLine('Accountancy', 3), 'Accountancy, 3 of 5 seats taken');
});

test('five seats: taken ones are neutral silhouettes, your seat follows them, open seats after; full draws five taken; a dead invite draws none', () => {
  const kinds = (o) => seatPlan(o).map((s) => s.kind);
  assert.deepEqual(kinds({ taken: 3 }), ['taken', 'taken', 'taken', 'yours', 'open']);
  assert.deepEqual(kinds({ taken: 3, signedIn: true }), ['taken', 'taken', 'taken', 'you', 'open']);
  assert.deepEqual(kinds({ taken: 1 }), ['taken', 'yours', 'open', 'open', 'open']);
  assert.deepEqual(kinds({ taken: 4, signedIn: true }), ['taken', 'taken', 'taken', 'taken', 'you']);
  assert.deepEqual(kinds({ taken: 5 }), ['taken', 'taken', 'taken', 'taken', 'yours'], 'a full invite never reaches the page as valid; the plan still keeps a seat to sit in');
  assert.deepEqual(kinds({ mode: 'full' }), Array(5).fill('taken'));
  assert.deepEqual(seatPlan({ mode: 'empty' }), []);
  assert.ok(SILHOUETTE_FOLDS.length >= 4);
});

test('the right next step: signed out signs up, signed in joins, and each failure is its own state', () => {
  assert.equal(joinView({ status: 'valid', signedIn: false }), 'out');
  assert.equal(joinView({ status: 'valid', signedIn: true }), 'in');
  assert.equal(joinView({ status: 'valid', signedIn: true, authLoading: true }), 'loading-auth');
  for (const s of ['loading', 'invalid', 'expired', 'full', 'paused', 'error']) assert.equal(joinView({ status: s, signedIn: true }), s);
  assert.equal(JoinCopy.outTitle('Steady Kites'), 'A friend saved you a seat in Steady Kites.');
  assert.equal(JoinCopy.inTitle('Steady Kites', 'Riya'), 'Riya saved you a seat in Steady Kites.');
  assert.equal(JoinCopy.inTitle('Steady Kites', null), 'You are invited to Steady Kites.');
  assert.equal(JoinCopy.signUpKey('Steady Kites'), 'Sign up to join Steady Kites');
  assert.equal(JoinCopy.joinKey('Steady Kites'), 'Join Steady Kites');
  assert.notEqual(JoinCopy.expiredTitle, JoinCopy.invalidTitle, 'expired and invalid are not the same state');
  assert.match(JoinCopy.expiredLine, /7 days/);
  assert.match(JoinCopy.fullLine, /5 members/);
  assert.match(JoinCopy.pausedLine, /try it again later/);
});

test('the page wires each state: sign-up first, the Fold and name sent with the join, expired apart from invalid, the lookup never shows a name', () => {
  const page = read('src/components/mob/JoinMob.jsx');
  assert.match(page, /router\.push\(signupPathFor\(`\/join\/\$\{code\}`\)\)/, 'the first key signs up and returns to the invite');
  assert.match(page, /loginPathFor\(`\/join\/\$\{code\}`\)/, 'the sign-in link returns to the invite');
  assert.match(page, /body: v3 \? \{ code, name: checked\.name, colour: 0, fold \}/, 'v3 sends the Fold');
  assert.match(page, /r\.code === 'INVITE_EXPIRED'\) setInvite\(\{ status: 'expired'/);
  assert.match(page, /r\.code === 'INVITE_INVALID'\) setInvite\(\{ status: 'invalid'/);
  assert.match(page, /status: 'full'/);
  assert.match(page, /status: 'paused'/);
  assert.match(page, /isV3Invite\(invite\.data\)/);
  assert.match(page, /onJoined/);
  assert.match(page, /rememberJoin\(code\)/, 'the code waits on this device through sign-up');
  assert.match(page, /forgetJoin\(\)/);
  for (const f of ['src/components/mob/join/JoinV3.jsx', 'src/components/mob/join/JoinStage.jsx']) {
    assert.doesNotMatch(read(f), /\bmembers\b|memberId|\.inviter\.name/, `${f} never reads a member`);
  }
  // The signed-out preview has no inviter (the server names who made the link only for a signed-in viewer).
  assert.match(read('src/components/mob/join/JoinV3.jsx'), /JoinCopy\.outTitle\(info\.name\)/);
  assert.match(read('src/components/mob/join/JoinV3.jsx'), /JoinCopy\.inTitle\(info\.name, info\.inviter\)/);
});

test('the server\'s own sentences for a dead invite still say what the page says: no claim beyond the truth', () => {
  assert.match(ERRORS.INVITE_EXPIRED[1], /can't be used/);
  assert.equal(ERRORS.INVITE_EXPIRED[0], 410);
  assert.equal(ERRORS.MOB_FULL[0], 409);
  assert.equal(ERRORS.JOIN_PAUSED[0], 503);
});

test('a new student who signed up from an invite opens it before onboarding; every other saved page still waits for onboarding', () => {
  assert.equal(isInvitePath('/join/MR1SNQ'), true);
  assert.equal(isInvitePath('/join/7KQ2M9XR'), true);
  assert.equal(isInvitePath('/join/K7P%202M9'), true);
  assert.equal(isInvitePath('/join/MR1SNQ?ref=wa'), true);
  assert.equal(isInvitePath('/join/'), false);
  assert.equal(isInvitePath('/join/../admin'), false);
  assert.equal(isInvitePath('/today'), false);
  assert.equal(isInvitePath(null), false);
  assert.equal(signupPathFor('/join/MR1SNQ'), '/signup?next=%2Fjoin%2FMR1SNQ');
  assert.equal(loginPathFor('/join/MR1SNQ'), '/login?next=%2Fjoin%2FMR1SNQ');
  assert.equal(signupPathFor('https://evil.example'), '/signup');
  const store = new Map();
  const mem = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v), removeItem: (k) => store.delete(k) };
  rememberNextPath('/join/MR1SNQ', { store: mem, now: 1 });
  assert.equal(postSignInPath({ needsOnboarding: true, store: mem, now: 2 }), '/join/MR1SNQ', 'a new account lands on the invite');
  rememberNextPath('/join/MR1SNQ', { store: mem, now: 1 });
  assert.equal(postSignInPath({ needsOnboarding: false, store: mem, now: 2 }), '/join/MR1SNQ', 'a returning student too');
  rememberNextPath('/today', { store: mem, now: 1 });
  assert.equal(postSignInPath({ needsOnboarding: true, store: mem, now: 2 }), '/onboarding', 'onboarding still comes first for any other page');
  rememberNextPath('/join/MR1SNQ?x=1\\evil', { store: mem, now: 1 });
  assert.equal(postSignInPath({ needsOnboarding: true, store: mem, now: 2 }), '/onboarding', 'a tampered path is not kept');
});

test('/signup and /login know a visit that came from an invite', () => {
  for (const name of ['signup', 'login']) {
    const page = read(`src/app/${name}/page.js`);
    assert.match(page, /isInvitePath\(safeNextPath\(/);
    assert.match(page, /invite=\{/);
  }
  assert.match(read('src/app/signup/SignupPageClient.jsx'), /Create your account, then take your seat\./);
  assert.match(read('src/app/login/LoginPageClient.jsx'), /Sign in to take your seat\./);
});

test('the invite copy is plain: no arrows, exclamation marks, emoji, price, 24-hour time, pressure or ranking', () => {
  for (const file of FILES) {
    for (const t of visibleText(read(file))) {
      if (/never ranked|never a ranking/i.test(t)) continue; // the Mob's own promise, not pressure
      assert.doesNotMatch(t, /[→⟶»←↗↘]|&rarr;|&larr;|->/, `${file}: ${t}`);
      assert.doesNotMatch(t, /[A-Za-z0-9.'’)]!(?!=)/, `${file}: an exclamation mark in "${t}"`);
      assert.doesNotMatch(t, /\b([01]\d|2[0-3]):[0-5]\d\b(?!\s?(AM|PM))/, `${file}: 24-hour time in "${t}"`);
      assert.doesNotMatch(t, /\p{Extended_Pictographic}/u, `${file}: emoji in "${t}"`);
      assert.doesNotMatch(t, /₹|\bRs\.?\s?\d|\brupees?\b|\bprice\b|per month/i, `${file}: a price in "${t}"`);
      assert.doesNotMatch(t, /hurry|last chance|only \d+ (seats|days|hours)|falling behind|everyone else|not played|waiting on you|\blost\b|leaderboard|\brank(s|ed|ing)?\b/i, `${file}: pressure or ranking in "${t}"`);
      assert.doesNotMatch(t, /\b(staging|localhost|supabase|MOB_ENABLED|MOB_V3_ENABLED|api\/|undefined|null)\b/i, `${file}: build talk in "${t}"`);
    }
  }
  const all = Object.values(JoinCopy).filter((v) => typeof v === 'string').join(' ');
  assert.doesNotMatch(all, /weekly paper|every Monday|Sunday/i, 'the v3 invite does not describe the old weekly paper');
});

test('the invite styles: no banned looks, reduced motion for every animation, targets of 44 px or more', () => {
  const css = read('src/components/mob/join/join.css');
  assert.doesNotMatch(css, /text-transform:\s*uppercase/i);
  assert.doesNotMatch(css, /transition:\s*all\b/i);
  assert.doesNotMatch(css, /backdrop-filter/i);
  assert.doesNotMatch(css, /text-shadow|drop-shadow/i);
  assert.doesNotMatch(css, /background-clip:\s*text/i);
  assert.doesNotMatch(css, /gradient/i, 'the room\'s own light is the den\'s; this file adds none');
  assert.doesNotMatch(css, /border-(left|right)(-width)?:\s*[2-9]px/i);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /:root\[data-motion='reduced'\]/);
  assert.match(css, /\.join-key \{[^}]*min-height:\s*5\d px|\.join-key \{[^}]*min-height:\s*52px/);
});

test('the preview fixture draws every state: expired, full, paused, invalid, did not load, one member, and v3 off', () => {
  const stub = read('src/app/preview/mob-den/previewDen.js');
  for (const [code, what] of [['000000', 'INVITE_EXPIRED'], ['111111', 'MOB_FULL'], ['222222', 'JOIN_PAUSED'], ['333333', 'INVITE_INVALID'], ['444444', 'UNAVAILABLE']]) {
    assert.match(stub, new RegExp(`code === '${code}'[^\\n]*'${what}'`), `${code} is ${what}`);
  }
  assert.match(stub, /v3'\) === 'off'/);
  assert.match(read('src/app/preview/mob-den/DenPreviewClient.jsx'), /JoinMob code=\{params\.get\('code'\) \|\| 'MR1SNQ'\}/);
});
