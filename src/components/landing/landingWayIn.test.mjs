// The landing's ways in (owner decision LK83/LK88, 5 Nov 2026; SPEC night-1105 D1). Supersedes the 4 Nov rules (the dock
// "Try a CUET question" that turned into "Sign up free" after the sample's five): sign up and log in lead, the five
// questions are the sample, and no key changes its label while the reader scrolls or answers.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DESK_NOTE } from './heroTaps.mjs';
import { DOCK_GO, SAMPLE, demoFinished, resetDemoSignal, sendDemoState, wayIn } from './demoSignal.mjs';

const read = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const code = (src) => src.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

test('D1 dock: a guest gets the ghost "Log in" beside the volt "Sign up free" (its true line inside); a signed-in student gets one key back in', () => {
  // Round 4 (owner LK135, 5 Nov 2026: "the CTA is a bit weak"): the dock's volt key carries "No card needed" inside it, on
  // the home page and every public page (PublicDock). R8 SEC-15, HERO-04 (8 Nov 2026): one label per action, so the key says
  // the hero's and the close band's own "Sign up free" (LK83/LK88), not a second name ("Start free"); every guest key still
  // goes to /signup.
  assert.deepEqual({ ...DOCK_GO }, { label: 'Sign up free', sub: 'No card needed' });
  assert.deepEqual(wayIn({}).dock, { primary: { href: '/signup', label: 'Sign up free' }, secondary: { href: '/login', label: 'Log in' }, sub: 'No card needed' });
  assert.deepEqual(wayIn({ released: true }).dock.primary, { href: '/signup?next=%2Frecovery', label: 'Sign up free' });
  assert.deepEqual(wayIn({ signedIn: true }).dock, { primary: { href: '/dashboard', label: 'Go to Practice' }, secondary: null, sub: null });
  assert.deepEqual(wayIn({ signedIn: true, released: true }).dock.primary, { href: '/recovery', label: 'Find my first gap' });
  const dock = code(read('./LandingDock.jsx'));
  assert.match(dock, /label=\{dock\.primary\.label\}/);
  assert.match(dock, /secondary=\{dock\.secondary\}/);
  assert.match(dock, /note=\{null\}/, 'no note line beside the keys');
  assert.match(dock, /sub=\{dock\.sub\}/, 'the true line inside the volt key');
  const pub = code(read('../PublicDock.jsx'));
  assert.match(pub, /label=\{isAuthenticated \? undefined : DOCK_GO\.label\}/, 'the public pages say the same');
  assert.match(pub, /sub=\{isAuthenticated \? null : DOCK_GO\.sub\}/);
  const mobile = code(read('../MobileDock.jsx'));
  assert.match(mobile, /className="mm-btn mm-dock__ghost"/, 'the second key is the ghost');
  assert.ok(mobile.indexOf('mm-dock__ghost') < mobile.indexOf('mm-btn mm-btn--primary'), 'Log in sits before (left of) Sign up free');
  assert.match(read('../../app/page.js'), /<LandingDock \/>/);
});

test('D1 the guest dock label never depends on the sample: answering, finishing or restarting the five changes nothing', () => {
  resetDemoSignal();
  const before = JSON.stringify(wayIn({}));
  for (const [state, answered] of [['right', 1], ['miss', 3], ['five', 5], ['load', 0]]) {
    sendDemoState(state, answered, null);
    assert.equal(JSON.stringify(wayIn({})), before, `after ${state} (${answered})`);
    // Even a caller that still passes the old flag gets the same keys.
    assert.equal(JSON.stringify(wayIn({ finished: demoFinished() })), before);
  }
  resetDemoSignal();
  // The dock, the close band and the hero's words do not listen to the sample's state at all.
  for (const file of ['./LandingDock.jsx', './CloseActions.jsx', '../LandingActions.jsx']) {
    assert.doesNotMatch(code(read(file)), /subscribeDemoState|demoFinished|DEMO_STATE_EVENT|mm:demo-state/, `${file} reads the sample's state`);
  }
  assert.doesNotMatch(code(read('./demoSignal.mjs')).slice(read('./demoSignal.mjs').indexOf('export function wayIn')), /finished|demoAnswered/, 'wayIn takes no sample state');
});

test('D1 hero: a guest gets "Sign up free", then "Try 5 questions first", then "Have an account? Log in"; signed in, one key', () => {
  const actions = code(read('../LandingActions.jsx'));
  assert.equal(wayIn({}).signup.label, 'Sign up free');
  assert.deepEqual({ ...SAMPLE }, { href: '/#try-practice', label: 'Try 5 questions first' });
  assert.match(actions, /const primary = isAuthenticated \? way\.home : way\.signup;/, 'L-006: never "Sign up free" for a signed-in student');
  assert.match(actions, /if \(mode === 'primary' \|\| isAuthenticated\) \{/, 'signed in: one key, no secondary, no log-in line');
  const guest = actions.slice(actions.indexOf('return (\n    <>'));
  const order = ['{primary.label}', '{SAMPLE.label}', 'Have an account? <Link href={way.login.href}>{way.login.label}</Link>'];
  let at = -1;
  for (const mark of order) { const i = guest.indexOf(mark); assert.ok(i > at, `${mark} in order`); at = i; }
  assert.match(guest, /<Link href=\{SAMPLE\.href\} prefetch=\{false\} className="mm-btn mm-btn--secondary">/, 'the sample is the secondary key');
  assert.match(actions, /className=\{heroKey\}/, 'the volt key steps down (weight only) while the sample\'s own key is in play');
});

test('D1 close band: a guest gets "Sign up free" and "Log in", never the sample; signed in, one key', () => {
  const close = code(read('./CloseActions.jsx'));
  assert.match(close, /isAuthenticated \? homeHref : signupHref/);
  assert.match(close, /\{isAuthenticated \? null : <Link href=\{way\.login\.href\} className="mm-btn mm-btn--secondary">\{way\.login\.label\}<\/Link>\}/);
  assert.doesNotMatch(close, /try-practice|Try a CUET question/);
});

test('D1 the sample card\'s note is one even line with no link', () => {
  const page = read('../../app/page.js');
  // Round 4 (owner LK122): the note is DESK_NOTE (heroTaps.mjs), rewritten from a marketing angle, still one line, no link.
  assert.match(page, /<DemoDrill note=\{DESK_NOTE\} \/>/);
  assert.equal(DESK_NOTE, 'Free, no sign-up. Every answer shows its reason.');
  assert.doesNotMatch(page, /Pick yours free|Other subjects\?/);
});
