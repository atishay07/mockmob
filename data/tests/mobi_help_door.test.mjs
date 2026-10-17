// Ask Mobi in place and the Help door (N9, N17; owner feedback 17 Oct night).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { ASK_MOBI_EVENT, askRequestFromHref, openAskMobi, isPlainClick } from '../../src/components/ai/askMobi.mjs';
import { HELP_DOOR, HELP_DOOR_ROWS } from '../../src/lib/helpDoor.mjs';
import { askHrefFor } from '../repair_check_client.mjs';

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

test('a repair link opens Mobi on the same question, and nothing else is accepted', () => {
  assert.deepEqual(askRequestFromHref(askHrefFor('att_1', 'q-9')), { tab: 'ask', questionRef: 'att_1:q-9' });
  assert.deepEqual(askRequestFromHref('/mentor?tab=ask'), { tab: 'ask', questionRef: null });
  assert.deepEqual(askRequestFromHref('/mentor?tab=record'), { tab: 'record', questionRef: null });
  assert.deepEqual(askRequestFromHref('/mentor?tab=nope'), { tab: 'plan', questionRef: null });
  assert.equal(askRequestFromHref('https://evil.example/mentor?tab=ask'), null);
  assert.equal(askRequestFromHref('/mentorx?tab=ask'), null);
  assert.equal(askRequestFromHref(null), null);
  // A malformed reference is dropped, never forwarded to the context route.
  assert.deepEqual(askRequestFromHref('/mentor?tab=ask&q=a:b:c'), { tab: 'ask', questionRef: null });
});

test('openAskMobi reports whether a host took the request', () => {
  const heard = [];
  const host = new EventTarget();
  host.addEventListener(ASK_MOBI_EVENT, (event) => { heard.push(event.detail); event.preventDefault(); });
  assert.equal(openAskMobi({ tab: 'ask', questionRef: 'a1:q2' }, host), true);
  assert.deepEqual(heard[0], { tab: 'ask', questionRef: 'a1:q2', origin: null });
  assert.equal(openAskMobi({ tab: 'bogus', questionRef: '<script>' }, host), true);
  assert.deepEqual(heard[1], { tab: 'plan', questionRef: null, origin: null });
  // No host mounted (a public page, the timed runner): the caller keeps its plain link.
  assert.equal(openAskMobi({ tab: 'ask' }, new EventTarget()), false);
  assert.equal(isPlainClick({ button: 0 }), true);
  assert.equal(isPlainClick({ button: 0, metaKey: true }), false);
  assert.equal(isPlainClick({ button: 1 }), false);
});

test('the Help door copy is plain sentence case with no hype, arrows or caps labels', () => {
  const words = [HELP_DOOR.label, HELP_DOOR.hint, HELP_DOOR.title, ...HELP_DOOR_ROWS.flatMap((row) => [row.label, row.note])];
  for (const line of words) {
    assert.ok(line && line.length < 70, line);
    assert.doesNotMatch(line, /[!→←↗»]|\b[A-Z]{4,}\b/, line);
  }
  assert.deepEqual(HELP_DOOR_ROWS.map((row) => row.id), ['ask', 'tour', 'faq', 'write']);
  assert.ok(HELP_DOOR_ROWS.every((row) => row.action || row.href), 'every row does something');
});

test('the floating orb is retired; Mobi lives in the shell and opens in place', () => {
  assert.equal(existsSync(new URL('../../src/components/ai/AssistantLauncher.jsx', import.meta.url)), false);
  assert.doesNotMatch(read('src/app/layout.js'), /AssistantLauncher/);
  const shell = read('src/app/(app)/AppLayoutClient.jsx');
  assert.match(shell, /<AskMobiHost \/>/);
  assert.match(shell, /<HelpMenu/);
  assert.match(shell, /className="arena-help-door"/);
  assert.match(shell, /data-tour="nav-more"/);
  assert.doesNotMatch(shell, /shadow-\[0_0_/, 'no glow in the tour');
  assert.match(read('src/components/recovery/RepairAsk.jsx'), /openAskMobi\(/);
  const orb = read('src/components/ui/prepos-orb.css');
  // The orb is an object: no outer halo (a zero-offset box-shadow with blur) leaves its edge.
  assert.doesNotMatch(orb, /box-shadow:[^;]*\b0 0 calc/);
  assert.match(orb, /prefers-reduced-motion/);
});
