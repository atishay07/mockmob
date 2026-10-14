import test from 'node:test';
import assert from 'node:assert/strict';
import { pickTrend, deltaWords, layoutPoints } from '../../src/lib/paperTrend.js';

const item = (id, marks, at, extra = {}) => ({ id, subject: 'accountancy', mode: 'full', total: 50, marks, maxMarks: 250, completedAt: at, formatId: 'full:accountancy:q50:server_snapshot_v1', ...extra });

test('needs three papers of the same kind and length', () => {
  assert.equal(pickTrend([item('a', 100, 3), item('b', 90, 2)]), null);
  assert.equal(pickTrend([item('a', 100, 3), item('b', 90, 2), item('c', 80, 1, { formatId: 'full:accountancy:q25:server_snapshot_v1' })]), null);
  assert.equal(pickTrend(null), null);
});

test('takes the newest six of the newest paper kind, oldest first', () => {
  const items = Array.from({ length: 8 }, (_, i) => item(`p${i}`, 100 + i, 100 - i));
  const t = pickTrend(items);
  assert.equal(t.points.length, 6);
  assert.deepEqual(t.points.map((p) => p.id), ['p5', 'p4', 'p3', 'p2', 'p1', 'p0']);
  assert.equal(t.newest.id, 'p0');
  assert.equal(t.delta, 100 - 101);
  assert.equal(t.subject, 'Accountancy');
  assert.equal(t.kind, 'full mocks');
});

test('device-scored papers never count', () => {
  const dev = (id, at) => item(id, 50, at, { formatId: 'full:accountancy:q50:historical_device' });
  assert.equal(pickTrend([dev('a', 3), dev('b', 2), dev('c', 1)]), null);
});

test('words and layout are truthful', () => {
  assert.equal(deltaWords(8), '8 marks above the paper before.');
  assert.equal(deltaWords(-1), '1 mark below the paper before.');
  assert.equal(deltaWords(0), 'The same as the paper before.');
  const pts = layoutPoints([{ marks: 10 }, { marks: 30 }, { marks: 20 }]);
  assert.equal(pts[1].y, 88);
  assert.equal(pts[0].y, 12);
  assert.equal(layoutPoints([{ marks: 5 }, { marks: 5 }, { marks: 5 }])[0].y, 50);
});
