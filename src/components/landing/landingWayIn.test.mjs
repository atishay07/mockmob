import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { demoFinished, resetDemoSignal, sendDemoState, wayIn } from './demoSignal.mjs';

const read = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8');

test('L-008 the dock is one button whose label follows the visitor', () => {
  assert.deepEqual(wayIn({}).dock, { href: '/#try-practice', label: 'Try a CUET question' });
  assert.deepEqual(wayIn({ finished: true }).dock, { href: '/signup', label: 'Sign up free' });
  assert.deepEqual(wayIn({ signedIn: true }).dock, { href: '/dashboard', label: 'Go to Practice' });
  assert.equal(wayIn({ signedIn: true, finished: true }).state, 'signed-in', 'a signed-in student is never asked to sign up');
  assert.equal(wayIn({ signedIn: true }).note, 'Welcome back.');
  assert.deepEqual(wayIn({ signedIn: true, released: true }).dock, { href: '/recovery', label: 'Find my first gap' });
  const dock = read('./LandingDock.jsx');
  assert.doesNotMatch(dock, /lp-docklink|<Link/, 'the line beside the button is words only');
  assert.match(read('../../app/page.js'), /<LandingDock \/>/);
});

test('L-009 all five answered: the guest is offered sign-up, and a restart does not take it back', () => {
  resetDemoSignal();
  assert.equal(demoFinished(), false);
  sendDemoState('right', 4, null);
  assert.equal(demoFinished(), false);
  sendDemoState('five', 5, null);
  assert.equal(demoFinished(), true);
  sendDemoState('load', 0, null);
  assert.equal(demoFinished(), true);
  assert.match(read('./CloseActions.jsx'), /!isAuthenticated && finished \? null/, 'the close band drops the sample key after all five');
  resetDemoSignal();
});

test('L-006 a signed-in student is never offered "Start free practice" in the hero', () => {
  const actions = read('../LandingActions.jsx');
  assert.match(actions, /isAuthenticated \? 'Go to Practice' : 'Start free practice'/);
});
