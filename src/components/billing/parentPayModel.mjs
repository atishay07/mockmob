// "Ask a parent to pay" (lane F-B, 15 Nov 2026): the words and the pure decisions behind the sheet. PURE.
//
// Every claim is the code's: the price is the offer's (pro_monthly_99, ₹99 a month, renewing, src/lib/payments/plans.js); Pro is
// granted to the student's account by the webhook a few minutes after the parent pays (src/app/webhook/route.js); the student
// cancels in Account (/api/billing/cancel, Pro stays to the end of the month paid for). We cannot cancel for the parent, so
// the sheet does not say the parent can; the link's end is Razorpay's expire_by, given by the server.

export const PARENT_PAY_COPY = Object.freeze({
  key: 'Ask a parent to pay',
  title: 'Ask a parent to pay',
  line: (rupees) => `Send this link to a parent. They pay ₹${rupees} a month on their own phone, and Pro turns on for your account within a few minutes. You can cancel any time in Account.`,
  making: 'Making your link',
  whatsapp: 'Send on WhatsApp',
  copy: 'Copy link',
  copied: 'Link copied',
  copyFailed: 'Copying did not work here. Press and hold the link to copy it.',
  linkLabel: 'Payment link',
  until: (when) => `The link works until ${when}.`,
  failedTitle: 'The link was not made',
  retry: 'Try again',
  proTitle: 'Pro is already on',
  heldTitle: 'A payment is being confirmed',
  close: 'Close',
  done: 'Done',
});

const IST = 'Asia/Kolkata';
const dayKey = (ms) => new Intl.DateTimeFormat('en-CA', { timeZone: IST, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms));
const clock = (ms) => new Intl.DateTimeFormat('en-IN', { timeZone: IST, hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date(ms))
  .replace(/\s+/g, ' ').replace(/\b(am|pm)\b/i, (m) => m.toLowerCase());

/** When a link stops taking payments, in India time and a 12-hour clock: "6:40 pm today", "6:40 pm tomorrow", "6:40 pm on 17 Nov". */
export function linkUntil(expiresAt, nowMs = Date.now()) {
  const ms = Date.parse(expiresAt);
  if (!Number.isFinite(ms)) return null;
  const at = clock(ms);
  if (dayKey(ms) === dayKey(nowMs)) return `${at} today`;
  if (dayKey(ms) === dayKey(nowMs + 86_400_000)) return `${at} tomorrow`;
  const date = new Intl.DateTimeFormat('en-IN', { timeZone: IST, day: 'numeric', month: 'short' }).format(new Date(ms));
  return `${at} on ${date}`;
}

/** The plain message a student sends a parent: their first name when the account has one, MockMob, the price and the link. */
export function parentMessage({ url, firstName = null, rupees = 99, expiresAt = null, nowMs = Date.now() }) {
  const hello = firstName ? `Hi, it's ${firstName}. Can you pay for my MockMob Pro?` : 'Hi, can you pay for my MockMob Pro?';
  const until = linkUntil(expiresAt, nowMs);
  return `${hello} It is for CUET practice, ₹${rupees} a month, and I can cancel it any time. ${until ? `This Razorpay link works until ${until}: ` : 'Pay on Razorpay here: '}${url}`;
}

/** WhatsApp's own share link: it opens WhatsApp with the message written, and the student picks who gets it. */
export function whatsappHref(text) {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

const GENERIC_FAILURE = 'We could not make the link. Try again in a minute. Nothing was charged.';

/**
 * What the sheet shows for the server's answer. `ready` carries the link; `pro` and `held` are not failures and offer no retry
 * (the account already has Pro, or a payment on its checkout is being confirmed); `failed` offers a retry unless retrying
 * cannot help (switched off, monthly not on sale, signed out).
 */
export function sheetStateFor(status, body = {}) {
  const data = body && typeof body === 'object' ? body : {};
  if (status === 200 && typeof data.url === 'string' && /^https:\/\//.test(data.url)) {
    return {
      kind: 'ready',
      url: data.url,
      expiresAt: data.expiresAt || null,
      firstName: typeof data.firstName === 'string' && data.firstName ? data.firstName : null,
      rupees: Number.isFinite(Number(data.amount)) && Number(data.amount) > 0 ? Math.round(Number(data.amount) / 100) : null,
    };
  }
  const message = typeof data.error === 'string' && data.error.trim() ? data.error.trim() : GENERIC_FAILURE;
  if (data.code === 'already_active') return { kind: 'pro', message };
  if (data.code === 'subscription_open') return { kind: 'held', message };
  const noRetry = ['parent_pay_off', 'monthly_not_ready', 'signed_out', 'no_user'].includes(data.code) || status === 401;
  return { kind: 'failed', message, retry: !noRetry };
}

/**
 * Development previews only (/pricing?offer=monthly&parent=… and the arena preview's &parent=…): the route's answers, so every
 * state of the sheet can be seen without a session or a payment. `making` never answers.
 */
export function previewParentReply(kind = 'ready', nowMs = Date.now()) {
  switch (kind) {
    case 'making': return null;
    case 'fail': return { status: 500, body: { error: GENERIC_FAILURE, code: 'failed' } };
    case 'pro': return { status: 409, body: { error: 'Pro access is already active on this account through 16 December 2026.', code: 'already_active' } };
    case 'held': return { status: 409, body: { error: 'Your earlier payment for monthly Pro is being confirmed, so a second plan was not started. Pro turns on within a few minutes, and you do not need to pay again.', code: 'subscription_open' } };
    case 'off': return { status: 404, body: { error: 'Asking a parent to pay is not open right now. Nothing was charged.', code: 'parent_pay_off' } };
    default: return { status: 200, body: { url: 'https://rzp.io/i/Pr3vIew', expiresAt: new Date(nowMs + 23 * 3600_000 + 50 * 60_000).toISOString(), amount: 9900, currency: 'INR', interval: 'month', firstName: kind === 'noname' ? null : 'Asha', reused: false } };
  }
}
