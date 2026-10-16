#!/usr/bin/env node
// Sends one signed Razorpay webhook to a LOCAL MockMob dev server, for verifying monthly billing in
// Razorpay TEST mode. Razorpay cannot reach localhost, so this stands in for it.
//
//   node scripts/billing/simulate-razorpay-webhook.mjs --event subscription.charged --subscription sub_XXX [--payment pay_XXX] [--port 3101]
//   node scripts/billing/simulate-razorpay-webhook.mjs --file path/to/fake-event.json [--port 3101]
//
// Safety, all enforced below:
//   - the key id must start with rzp_test_, so live keys are refused;
//   - the target is always http://127.0.0.1:<port>/webhook, never another host;
//   - the secret comes from RAZORPAY_WEBHOOK_SECRET in the environment and is never printed.
// With --subscription it reads the real TEST-mode subscription (and payment) from Razorpay and wraps them
// in the event envelope. With --file it sends your own JSON, with no Razorpay call at all.
import crypto from 'node:crypto';
import { readFileSync } from 'node:fs';

const args = Object.fromEntries(process.argv.slice(2).reduce((pairs, token, i, all) => {
  if (token.startsWith('--')) pairs.push([token.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : true]);
  return pairs;
}, []));

const fail = (message) => { console.error(message); process.exit(1); };
const port = Number(args.port || 3101);
if (!Number.isInteger(port) || port < 1024 || port > 65535) fail('Pass a local --port between 1024 and 65535.');
const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
if (!secret) fail('Set RAZORPAY_WEBHOOK_SECRET (the TEST webhook secret the local server uses).');

let event;
if (args.file) {
  event = JSON.parse(readFileSync(String(args.file), 'utf8'));
} else {
  const name = args.event;
  const subscriptionId = args.subscription;
  if (!name || !subscriptionId) fail('Pass --event <name> --subscription <sub_id>, or --file <json>.');
  const keyId = process.env.RAZORPAY_KEY_ID || '';
  const keySecret = process.env.RAZORPAY_KEY_SECRET || '';
  if (!keyId.startsWith('rzp_test_')) fail('RAZORPAY_KEY_ID must be a TEST key (rzp_test_...). Live keys are refused.');
  if (!keySecret) fail('Set RAZORPAY_KEY_SECRET to the matching TEST secret.');
  const { default: Razorpay } = await import('razorpay');
  const rz = new Razorpay({ key_id: keyId, key_secret: keySecret });
  const subscription = await rz.subscriptions.fetch(String(subscriptionId));
  const payload = { subscription: { entity: subscription } };
  let paymentId = args.payment && args.payment !== true ? String(args.payment) : null;
  if (!paymentId && /charged|activated|captured|failed/.test(name)) {
    const invoices = await rz.invoices.all({ subscription_id: String(subscriptionId) });
    paymentId = (invoices.items || []).map((inv) => inv.payment_id).find(Boolean) || null;
  }
  if (paymentId) payload.payment = { entity: await rz.payments.fetch(paymentId) };
  event = { entity: 'event', account_id: 'acc_test_local', event: name, contains: Object.keys(payload), payload, created_at: Math.floor(Date.now() / 1000) };
}

const body = JSON.stringify(event);
const signature = crypto.createHmac('sha256', secret).update(body).digest('hex');
const eventId = `evt_local_${Date.now().toString(36)}_${crypto.randomBytes(3).toString('hex')}`;
const response = await fetch(`http://127.0.0.1:${port}/webhook`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', 'x-razorpay-signature': signature, 'x-razorpay-event-id': args['event-id'] ? String(args['event-id']) : eventId },
  body,
});
console.log(`${event.event}  ->  HTTP ${response.status}  ${await response.text()}`);
process.exit(response.ok ? 0 : 1);
