import test from 'node:test';
import assert from 'node:assert/strict';
import { contributionErrors, contributionState, removeContributionOption } from '../contribution_ui.js';

test('removing an earlier option preserves the actual answer while relabelling', () => {
  const options = ['first', 'second', 'third'].map((text, i) => ({ key: 'ABC'[i], text }));
  assert.deepEqual(removeContributionOption(options, 'C', 0), { options: [{ key: 'A', text: 'second' }, { key: 'B', text: 'third' }], correctKey: 'B' });
  assert.equal(removeContributionOption(options, 'B', 1).correctKey, '');
});
test('blank correct options cannot be submitted after filtering', () => {
  const errors = contributionErrors({ subject: 'accountancy', chapter: 'Partnership', body: 'A complete original question', correct_answer: 'C' }, [{ key: 'A', text: 'one' }, { key: 'B', text: 'two' }, { key: 'C', text: '' }]);
  assert.ok(errors.correct_answer);
});
test('quarantine is held, unknown states never pretend to be live', () => {
  assert.equal(contributionState('quarantined'), 'held');
  assert.equal(contributionState('live'), 'live');
  assert.equal(contributionState('pending_moderation'), 'pending');
  assert.equal(contributionState('unknown_future_state'), 'pending');
});
