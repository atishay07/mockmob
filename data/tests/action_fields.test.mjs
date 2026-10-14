import test from 'node:test';
import assert from 'node:assert/strict';
import { actionFromHref, withAction, withPlanActions } from '../../src/lib/server/actionFields.js';

test('test paths: practice, mock, resume, recovery replay', () => {
  assert.deepEqual(actionFromHref('/test?subject=accountancy&mode=quick&count=5&chapter=Partnership+Fundamentals&recoveryFrom=att-1'),
    { type: 'practice', subject: 'accountancy', chapter: 'Partnership Fundamentals', mode: 'quick', count: 5, attemptId: 'att-1' });
  assert.deepEqual(actionFromHref('/test?subject=physics&mode=full'), { type: 'mock', subject: 'physics', mode: 'full' });
  assert.deepEqual(actionFromHref('/test?subject=physics&mode=quick&sessionId=s-9&experience=practice'),
    { type: 'resume', subject: 'physics', mode: 'quick', sessionId: 's-9' });
});

test('dashboard, result, review, learn, study, recovery, pricing', () => {
  assert.deepEqual(actionFromHref('/dashboard?mode=quick&count=10&subject=physics&chapter=Optics'), { type: 'practice', subject: 'physics', chapter: 'Optics', mode: 'quick', count: 10 });
  assert.deepEqual(actionFromHref('/dashboard'), { type: 'practice' });
  assert.deepEqual(actionFromHref('/result/abc%20d'), { type: 'result', attemptId: 'abc d' });
  assert.deepEqual(actionFromHref('/review'), { type: 'review' });
  assert.deepEqual(actionFromHref('/learn/unit-1'), { type: 'learn', unitId: 'unit-1' });
  assert.deepEqual(actionFromHref('/learn?recall=due'), { type: 'learn' });
  assert.deepEqual(actionFromHref('/study/sess-2'), { type: 'learn', sessionId: 'sess-2' });
  assert.deepEqual(actionFromHref('/recovery?episode=e1'), { type: 'recovery', unitId: 'e1' });
  assert.deepEqual(actionFromHref('/recovery?episode=e1', { kind: 'repair' }), { type: 'repair', unitId: 'e1' });
  assert.deepEqual(actionFromHref('/pricing?reason=credits'), { type: 'pricing' });
});

test('unknown, absolute, malformed or oversized input is none', () => {
  for (const h of [undefined, null, 42, '', '/nope', '/result', '/result/a/b', 'https://evil.example/test', '//evil.example/test', '/' + String.fromCharCode(92) + 'evil', '/learn/a/b', '/study', 'javascript:alert(1)', '/pricing/x'.padEnd(3000, 'x')])
    assert.deepEqual(actionFromHref(h), { type: 'none' }, String(h).slice(0, 40));
  assert.deepEqual(actionFromHref('/result/%E0%A4%A'), { type: 'none' });
});

test('withAction and withPlanActions only add fields', () => {
  const item = { kind: 'repair', title: 't', href: '/recovery?episode=e1' };
  assert.deepEqual(withAction(item), { ...item, action: { type: 'repair', unitId: 'e1' } });
  assert.equal(withAction({ title: 'x' }).action, undefined);
  const plan = { primary: { href: '/dashboard?mode=quick&count=10' }, alternatives: [{ href: '/review' }, { href: '/x' }], minutes: 10 };
  const out = withPlanActions(plan);
  assert.equal(out.minutes, 10);
  assert.equal(out.primary.href, '/dashboard?mode=quick&count=10');
  assert.equal(out.primary.action.count, 10);
  assert.deepEqual(out.alternatives.map(a => a.action.type), ['review', 'none']);
  assert.equal(plan.primary.action, undefined);
});
