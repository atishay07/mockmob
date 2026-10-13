import test from 'node:test';
import assert from 'node:assert/strict';
import { runnerNotice } from '../runner_notice.mjs';

test('while everything is fine there is no banner, only a quiet save state', () => {
  const ticketed = runnerNotice({ online: true, hasTicket: true, syncStatus: 'saved' });
  assert.equal(ticketed.banner, null);
  assert.deepEqual(ticketed.save, { tone: 'ok', text: 'Answers saved on this device' });
  const account = runnerNotice({ online: true, hasTicket: false, syncStatus: 'saved' });
  assert.equal(account.banner, null);
  assert.equal(account.save.text, 'Answers saved to your account');
});

test('the practice-bank audit is never part of the test screen', () => {
  for (const state of [{}, { hasTicket: true }, { online: false, hasTicket: true }, { pendingSubmission: true, hasTicket: true }, { syncStatus: 'pending' }]) {
    assert.doesNotMatch(JSON.stringify(runnerNotice(state)), /audit/i);
  }
});

test('offline shows a banner that says what to do and keeps the timer honest', () => {
  const { banner, save } = runnerNotice({ online: false, hasTicket: true });
  assert.equal(banner.tone, 'warn');
  assert.match(banner.text, /offline/i);
  assert.match(banner.text, /timer keeps running/i);
  assert.match(banner.text, /reconnect before you submit/i);
  assert.match(save.text, /reconnect to submit/i);
});

test('a submission waiting for the connection wins over every other state', () => {
  const { banner, save } = runnerNotice({ pendingSubmission: true, online: false, hasTicket: true, syncStatus: 'pending' });
  assert.match(banner.text, /not submitted yet/i);
  assert.match(banner.text, /submission window/i);
  assert.equal(save.text, 'Waiting to submit');
});

test('an account session that is waiting to sync says so; a device-saved one does not nag', () => {
  assert.match(runnerNotice({ syncStatus: 'pending', hasTicket: false }).banner.text, /reconnecting/i);
  assert.equal(runnerNotice({ syncStatus: 'pending', hasTicket: true }).banner, null);
});
