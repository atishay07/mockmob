// Creates the Rs 99 monthly Razorpay plan once and prints the plan ID to put in
// RAZORPAY_PLAN_ID_PRO_MONTHLY_99 (local .env.local and Vercel). Works with test or live keys:
// a test key creates a test plan, a live key a live plan, so run it once per mode.
// Idempotent by name: if a plan named below already exists with the same amount, it is reused.
//
//   node --env-file=.env.local scripts/payments/create-razorpay-plan.mjs
import Razorpay from 'razorpay';

const keyId = process.env.RAZORPAY_KEY_ID;
const keySecret = process.env.RAZORPAY_KEY_SECRET;
if (!keyId || !keySecret) {
  console.error('Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET first.');
  process.exit(1);
}
const mode = keyId.startsWith('rzp_live_') ? 'LIVE' : 'TEST';
const NAME = 'MockMob Pro monthly';
const AMOUNT = 9900;

const rz = new Razorpay({ key_id: keyId, key_secret: keySecret });
const existing = await rz.plans.all({ count: 100 });
const match = (existing.items || []).find((p) => p.item?.name === NAME && p.item?.amount === AMOUNT && p.period === 'monthly' && p.interval === 1);
const plan = match || await rz.plans.create({
  period: 'monthly',
  interval: 1,
  item: { name: NAME, amount: AMOUNT, currency: 'INR', description: 'MockMob Pro, billed monthly. Cancel anytime.' },
  notes: { planId: 'pro_monthly_99' },
});
console.log(`${match ? 'Reusing' : 'Created'} ${mode} plan.`);
console.log(`RAZORPAY_PLAN_ID_PRO_MONTHLY_99=${plan.id}`);
