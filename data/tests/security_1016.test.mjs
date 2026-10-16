// Security review of 16 Oct 2026 (tmp/security-1016/REPORT.md): the fixes that ship with it.
//   1. A bad signature, or a payment that does not match the order, never rewrites a one-time order that already paid
//      (verify-payment, one-time branch; the monthly branch already had this guard).
//   2. The question bank, with its answer keys, is not readable with the public anon key: the migration removes the
//      browser roles' grant on public.questions, keeps service_role, and has an undo.
import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadBilling, resetWorld, hmac, TEST_ENV, paymentEntity, DAY, iso } from './billing_harness.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

let db;
let b;
const post = (handler, body) => handler.POST(new Request('http://localhost/x', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }));
const signIn = (id) => { globalThis.__mmSession = { user: { id } }; };

beforeEach(async () => {
  b = await loadBilling();
  db = resetWorld();
  b.rz.subscriptions.clear(); b.rz.payments.clear(); b.rz.calls.length = 0;
});

const orderBody = (over = {}) => ({
  razorpay_order_id: 'order_o1', razorpay_payment_id: 'pay_o1', userId: 'u1',
  razorpay_signature: hmac('order_o1|pay_o1', TEST_ENV.RAZORPAY_KEY_SECRET), ...over,
});
const orderRecord = (over = {}) => ({
  userId: 'u1', orderId: 'order_o1', planId: 'pro_cuet_2027', amount: 9900, status: 'created', rawOrder: { amount: 9900 }, ...over,
});
const paidOrderRecord = () => orderRecord({
  status: 'captured', paymentId: 'pay_o1', amountPaid: 9900, accessUntil: '2027-07-31T18:29:59.999Z',
});
const orderPayment = (over = {}) => paymentEntity({ id: 'pay_o1', order_id: 'order_o1', invoice_id: undefined, amount: 9900, ...over });
const orderOf = () => db._payments.find((p) => p.orderId === 'order_o1');

test('one-time verify: a forged signature never rewrites an order that already paid, and an unpaid order is still marked failed', async () => {
  db.addUser('u1', { subscription_status: 'active', is_premium: true, premium_until: '2027-07-31T18:29:59.999Z' });
  db.addPayment(paidOrderRecord());
  signIn('u1');
  const bad = orderBody({ razorpay_signature: hmac('order_o1|pay_o1', 'wrong_secret') });
  assert.equal((await post(b.verify, bad)).status, 400);
  assert.equal(orderOf().status, 'captured', 'paid evidence survives a forged call');
  assert.equal(orderOf().paymentId, 'pay_o1');
  assert.equal(orderOf().amountPaid, 9900);
  assert.equal(db.user('u1').isPremium, true);

  db = resetWorld();
  db.addUser('u1');
  db.addPayment(orderRecord());
  signIn('u1');
  assert.equal((await post(b.verify, bad)).status, 400);
  assert.equal(orderOf().status, 'failed', 'an unpaid checkout is marked failed');
  assert.equal(db.user('u1').isPremium, false);
});

test('one-time verify: a valid signature with a payment that does not match the order keeps paid evidence and grants nothing new', async () => {
  db.addUser('u1', { subscription_status: 'active', is_premium: true, premium_until: '2027-07-31T18:29:59.999Z' });
  db.addPayment(paidOrderRecord());
  signIn('u1');
  b.rz.payments.set('pay_o1', orderPayment({ amount: 100 }));
  assert.equal((await post(b.verify, orderBody())).status, 400);
  assert.equal(orderOf().status, 'captured');
  assert.equal(orderOf().amountPaid, 9900);

  db = resetWorld();
  db.addUser('u1');
  db.addPayment(orderRecord());
  signIn('u1');
  b.rz.payments.set('pay_o1', orderPayment({ amount: 100 }));
  assert.equal((await post(b.verify, orderBody())).status, 400);
  assert.equal(orderOf().status, 'failed');
  assert.equal(db.user('u1').isPremium, false, 'a short payment never turns Pro on');
});

test('one-time verify: the honest path still turns Pro on, and a student cannot verify another student\'s order', async () => {
  db.addUser('u1'); db.addUser('u2');
  db.addPayment(orderRecord());
  signIn('u1');
  b.rz.payments.set('pay_o1', orderPayment());
  assert.equal((await post(b.verify, orderBody())).status, 200);
  assert.equal(db.user('u1').isPremium, true);
  assert.equal(orderOf().status, 'captured');

  db = resetWorld();
  db.addUser('u1'); db.addUser('u2');
  db.addPayment(orderRecord());
  signIn('u2');
  assert.equal((await post(b.verify, orderBody({ userId: 'u2' }))).status, 404, 'an order of another student is not found');
  assert.equal((await post(b.verify, orderBody({ userId: 'u1' }))).status, 403, 'a client-supplied user id that is not the session is refused');
  assert.equal(db.user('u1').isPremium, false);
});

// ---------------------------------------------------------------- question bank privacy (static, on the SQL files)

const sql = (rel) => readFileSync(resolve(root, rel), 'utf8');
const code = (text) => text.split('\n').filter((l) => !l.trim().startsWith('--')).join('\n').toLowerCase();

test('migration 20261016140000: browser roles lose every grant on public.questions, service_role keeps it', () => {
  const up = code(sql('supabase/migrations/20261016141000_questions_private_to_browser_roles.sql'));
  assert.match(up, /revoke all on public\.questions from anon, authenticated;/);
  assert.match(up, /grant all on public\.questions to service_role;/);
  assert.doesNotMatch(up, /grant[^;]*\bto\b[^;]*\b(anon|authenticated|public)\b/, 'nothing is granted to a browser role');
  assert.doesNotMatch(up, /disable row level security|drop table|delete from|truncate/);
});

test('undo 20261016140000: puts the default grants back and lives outside supabase/migrations', () => {
  const down = code(sql('supabase/undo/20261016141000_questions_private_to_browser_roles.undo.sql'));
  assert.match(down, /grant all on public\.questions to anon, authenticated;/);
});

test('no browser code reads the questions table: the browser client is used for sign-in only', () => {
  const browser = sql('src/lib/supabase-browser.js');
  assert.doesNotMatch(browser, /\.from\(/);
  for (const rel of ['src/components/AuthProvider.jsx', 'src/app/auth/callback/AuthCallbackPageClient.jsx']) {
    assert.doesNotMatch(sql(rel), /\.from\(\s*['"]questions['"]/, `${rel} must not read questions with the browser client`);
  }
});

test('every new table of batches 1 to 3 is service-role only in its migration', () => {
  const files = [
    'supabase/migrations/20261015210000_trap_atlas.sql',
    'supabase/migrations/20261015210100_revise_cards.sql',
    'supabase/migrations/20261016090000_my_colleges.sql',
    'supabase/migrations/20261016100000_app_errors.sql',
  ];
  for (const rel of files) {
    const text = code(sql(rel));
    assert.match(text, /enable row level security/, `${rel}: RLS on`);
    assert.match(text, /revoke all on public\.\w+ from public, anon, authenticated;/, `${rel}: browser roles revoked`);
    assert.match(text, /grant all on public\.\w+ to service_role;/, `${rel}: service role granted`);
    assert.doesNotMatch(text, /create policy/, `${rel}: no policy opens the table`);
  }
});

test('helper values stay sane (guards the test file itself)', () => {
  assert.ok(DAY > 0 && typeof iso(Date.now()) === 'string');
});
