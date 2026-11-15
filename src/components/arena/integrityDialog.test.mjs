import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldReopenIntegrityDialog } from './integrityDialog.mjs';

test('a dialog closed by Back while a warning is set comes back', () => {
  assert.equal(shouldReopenIntegrityDialog({ alert: { phase: 'warning', count: 1 }, open: false }), true);
  assert.equal(shouldReopenIntegrityDialog({ alert: { phase: 'entry', count: 0 }, open: false }), true);
});
test('nothing reopens once the warning is resumed, or while the dialog is open', () => {
  assert.equal(shouldReopenIntegrityDialog({ alert: null, open: false }), false);
  assert.equal(shouldReopenIntegrityDialog({ alert: { phase: 'warning' }, open: true }), false);
});
