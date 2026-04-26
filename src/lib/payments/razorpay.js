import 'server-only';
import crypto from 'node:crypto';
import Razorpay from 'razorpay';

let client = null;

export function getRazorpayClient() {
  if (client) return client;

  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    throw new Error('Missing RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET in .env.local');
  }

  client = new Razorpay({
    key_id: keyId,
    key_secret: keySecret,
  });

  return client;
}

export function getRazorpayKeyId() {
  if (!process.env.RAZORPAY_KEY_ID) {
    throw new Error('Missing RAZORPAY_KEY_ID in .env.local');
  }
  return process.env.RAZORPAY_KEY_ID;
}

export function verifyRazorpayPaymentSignature({
  orderId,
  paymentId,
  signature,
}) {
  if (!orderId || !paymentId || !signature) return false;

  const expected = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');

  const actualBuffer = Buffer.from(signature, 'hex');
  const expectedBuffer = Buffer.from(expected, 'hex');

  return actualBuffer.length === expectedBuffer.length &&
    crypto.timingSafeEqual(actualBuffer, expectedBuffer);
}

export function verifyRazorpaySubscriptionSignature({
  subscriptionId,
  paymentId,
  signature,
}) {
  if (!subscriptionId || !paymentId || !signature) return false;

  const expected = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(`${paymentId}|${subscriptionId}`)
    .digest('hex');

  const actualBuffer = Buffer.from(signature, 'hex');
  const expectedBuffer = Buffer.from(expected, 'hex');

  return actualBuffer.length === expectedBuffer.length &&
    crypto.timingSafeEqual(actualBuffer, expectedBuffer);
}

export function verifyRazorpayWebhookSignature({ body, signature }) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret || !signature || !body) return false;

  const expected = crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest('hex');

  const actualBuffer = Buffer.from(signature, 'hex');
  const expectedBuffer = Buffer.from(expected, 'hex');

  return actualBuffer.length === expectedBuffer.length &&
    crypto.timingSafeEqual(actualBuffer, expectedBuffer);
}
