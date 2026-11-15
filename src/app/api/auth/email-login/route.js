import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { checkPersistentRateLimit, rateLimitWait } from '@/lib/server/rateLimit';
import { resend } from '@/lib/resend';
import {
  EMAIL_LOGIN_LIMITS, emailLimitOptions, emailLimitReply, emailLoginSiteLimit, getSiteOrigin, isAppClient, loginLinkPath, pruneLocalBuckets,
} from '@/lib/server/emailLoginPolicy';
import { INVITE_COOKIE, decodeInviteCookie, normaliseInviteCode, referralsLive } from '@/lib/referrals/friendInvite.mjs';

export const runtime = 'nodejs';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_REQUEST_INTERVAL_MS = 60_000;
const HOURLY_LIMIT = 5;
const rateBuckets = new Map();

function getClientIp(request) {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || 'unknown';
}

function rateLimitKey(request, email) {
  return `${getClientIp(request)}:${email.toLowerCase()}`;
}

// Returns 0 when a code may be sent now, else the seconds to wait (shown as a countdown).
function checkRateLimit(request, email) {
  const now = Date.now();
  pruneLocalBuckets(rateBuckets, now);
  const key = rateLimitKey(request, email);
  const bucket = rateBuckets.get(key) || { lastAt: 0, attempts: [] };
  bucket.attempts = bucket.attempts.filter((time) => now - time < 60 * 60 * 1000);

  if (now - bucket.lastAt < MIN_REQUEST_INTERVAL_MS) {
    rateBuckets.set(key, bucket);
    return Math.ceil((MIN_REQUEST_INTERVAL_MS - (now - bucket.lastAt)) / 1000);
  }
  if (bucket.attempts.length >= HOURLY_LIMIT) {
    rateBuckets.set(key, bucket);
    return Math.ceil((bucket.attempts[0] + 60 * 60 * 1000 - now) / 1000);
  }

  bucket.lastAt = now;
  bucket.attempts.push(now);
  rateBuckets.set(key, bucket);
  return 0;
}

// F5 (15 Nov): the reply names the limit that refused (emailLimitReply), so the card opens the code field only when a code
// really went to this inbox.
function rateLimited(scope, retryAfterSeconds) {
  const reply = emailLimitReply(scope, retryAfterSeconds);
  return NextResponse.json(
    { ok: false, ...reply },
    { status: 429, headers: { 'Retry-After': String(reply.retryAfterSeconds) } },
  );
}

// One error line when the site-wide ceiling refuses (A1), at most every 5 minutes per server instance, so a flood is seen
// without filling the log.
const CEILING_LOG_EVERY_MS = 5 * 60_000;
let ceilingLoggedAt = 0;
function noteCeiling(limit) {
  const now = Date.now();
  if (now - ceilingLoggedAt < CEILING_LOG_EVERY_MS) return;
  ceilingLoggedAt = now;
  console.error(`[api/auth/email-login] the daily ceiling of ${limit} sign-in emails is reached; email sign-in is refused until it resets (AUTH_EMAIL_DAILY_CEILING)`);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// F8 (15 Nov 2026): the code first and largest, the button second ("Signing in on this phone?"), because a button opened from
// an in-app browser's mail lands in another browser. The subject carries the code so it can be read from the notification (it
// also shows on a lock screen; the owner accepted that). A new account (generateLink answered verification_type 'signup') is
// never told it is a "login". Plain light HTML: black on white survives Gmail's dark-mode colour inversion on Android, and
// clients that honour prefers-color-scheme get the dark version from the <style> below. The plain-text part says the same.
function signInEmailWords({ code, forApp = false, newAccount = false }) {
  const digits = String(code).length;
  return {
    subject: `Your MockMob code: ${code}`,
    label: newAccount ? `Your ${digits}-digit sign-up code` : `Your ${digits}-digit login code`,
    how: 'Type it on the page where you asked for it. If you asked more than once, only the newest code works.',
    second: 'Signing in on this phone?',
    button: 'Tap here to sign in',
    hint: forApp
      ? 'Tap the button on this phone to open the MockMob app, or type the code in the app.'
      : 'Using the MockMob app? Type this code in the app. The button opens the website.',
    // The plain-text part has a link, not a button.
    hintText: forApp
      ? 'Open the link on this phone to open the MockMob app, or type the code in the app.'
      : 'Using the MockMob app? Type this code in the app. The link opens the website.',
    footer: 'This code is one-time use. If you did not request it, you can ignore this email.',
  };
}

function signInEmail({ link, code, forApp = false, newAccount = false }) {
  const words = signInEmailWords({ code, forApp, newAccount });
  const safeLink = escapeHtml(link);
  const safeCode = escapeHtml(code);
  const e = (key) => escapeHtml(words[key]);

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light dark" />
    <meta name="supported-color-schemes" content="light dark" />
    <title>${e('subject')}</title>
    <style>
      @media (prefers-color-scheme: dark) {
        .em-page { background:#10120d !important; }
        .em-ink { color:#f4f5ef !important; }
        .em-ink2 { color:#b9bdb0 !important; }
        .em-codebox { background:#1b1e16 !important; border-color:#3b4033 !important; }
        .em-code { color:#ffffff !important; }
        .em-rule { border-color:#2c3026 !important; }
        .em-btn { background:#d2f000 !important; color:#0b0c09 !important; }
      }
    </style>
  </head>
  <body class="em-page" style="margin:0;padding:0;background:#ffffff;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${e('how')}</div>
    <table role="presentation" class="em-page" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;">
      <tr>
        <td align="center" style="padding:28px 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;font-family:Arial,Helvetica,sans-serif;">
            <tr>
              <td>
                <p class="em-ink" style="margin:0 0 20px;color:#111311;font-size:17px;font-weight:800;letter-spacing:-0.01em;">MockMob</p>
                <p class="em-ink2" style="margin:0 0 10px;color:#4a4e44;font-size:15px;line-height:1.4;">${e('label')}</p>
                <table role="presentation" class="em-codebox" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4ef;border:1px solid #d9dcd1;border-radius:14px;">
                  <tr>
                    <td align="center" style="padding:18px 12px;">
                      <p class="em-code" style="margin:0;color:#111311;font-family:'Courier New',Courier,monospace;font-size:38px;line-height:1.1;font-weight:700;letter-spacing:0.14em;">${safeCode}</p>
                    </td>
                  </tr>
                </table>
                <p class="em-ink2" style="margin:14px 0 0;color:#4a4e44;font-size:15px;line-height:1.6;">${e('how')}</p>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:26px 0 0;">
                  <tr><td class="em-rule" style="border-top:1px solid #e3e5dc;font-size:0;line-height:0;">&nbsp;</td></tr>
                </table>
                <p class="em-ink" style="margin:22px 0 12px;color:#111311;font-size:16px;font-weight:700;line-height:1.4;">${e('second')}</p>
                <p style="margin:0;">
                  <a class="em-btn" href="${safeLink}" style="display:inline-block;border-radius:999px;background:#111311;color:#ffffff;font-size:15px;font-weight:700;line-height:20px;text-decoration:none;padding:13px 22px;">${e('button')}</a>
                </p>
                <p class="em-ink2" style="margin:22px 0 0;color:#4a4e44;font-size:13px;line-height:1.6;">${e('hint')}</p>
                <p class="em-ink2" style="margin:10px 0 0;color:#6b6f64;font-size:12px;line-height:1.6;">${e('footer')}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const text = [
    `${words.label}: ${code}`,
    words.how,
    '',
    `${words.second} Open this link:`,
    link,
    '',
    words.hintText,
    '',
    words.footer,
  ].join('\n');

  return { subject: words.subject, html, text };
}

// The three limits, then the site-wide daily ceiling (emailLoginPolicy.js). A refusal carries its scope and the real wait
// from the limiter (the database's reset time when it can be read, else the limiter's own answer).
async function checkEmailLoginLimits(request, email) {
  for (const limit of [...EMAIL_LOGIN_LIMITS, emailLoginSiteLimit()]) {
    const options = emailLimitOptions(limit, email);
    const result = await checkPersistentRateLimit(request, options);
    if (!result.allowed) {
      if (limit.scope === 'site') noteCeiling(limit.limit);
      const wait = await rateLimitWait(request, options);
      return { allowed: false, scope: limit.scope, retryAfterSeconds: wait ?? result.retryAfterSeconds };
    }
  }
  return { allowed: true };
}

// Removes a password from an account whose email was never confirmed (see the migration
// 20261013150000_auth_unconfirmed_passwords.sql). Such a password can only have been set by
// someone calling the Auth API directly with this address; the student is about to confirm
// the account with the code. Best effort: sign-in still works if the function is missing.
async function clearUnconfirmedPassword(email) {
  try {
    const { error } = await supabaseAdmin().rpc('auth_clear_unconfirmed_password', { p_email: email });
    if (error) console.error('[api/auth/email-login] clearing an unconfirmed password failed:', error.code || 'unknown');
  } catch {
    console.error('[api/auth/email-login] clearing an unconfirmed password failed: unreachable');
  }
}

function hasEmailProvider() {
  const key = process.env.RESEND_API_KEY?.trim();
  return Boolean(key && key !== 're_xxxxxxxxx');
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';

    if (!EMAIL_RE.test(email)) {
      return NextResponse.json({ ok: false, message: 'Enter a valid email address.' }, { status: 400 });
    }

    const waitSeconds = checkRateLimit(request, email);
    if (waitSeconds > 0) return rateLimited('email', waitSeconds);
    const persistent = await checkEmailLoginLimits(request, email);
    if (!persistent.allowed) return rateLimited(persistent.scope, persistent.retryAfterSeconds);

    // The isolated staging app (scripts/pipeline/tools/stagingLocalApp.mjs) cannot send email.
    // It reports success without a code; scripts/dev/staging-otp.mjs prints one for test accounts.
    if (process.env.MOCKMOB_STAGING_APP === '1' && process.env.NODE_ENV !== 'production') {
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    if (!hasEmailProvider()) {
      console.error('[api/auth/email-login] RESEND_API_KEY is missing or invalid');
      return NextResponse.json({ ok: false, message: 'Login-code email is not configured yet.' }, { status: 500 });
    }

    const origin = getSiteOrigin(request);
    const redirectTo = `${origin}/auth/callback`;
    await clearUnconfirmedPassword(email);
    const { data, error } = await supabaseAdmin().auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: { redirectTo },
    });

    if (error) {
      console.error('[api/auth/email-login] generateLink failed:', error);
      return NextResponse.json({ ok: false, message: 'Could not create a login code. Please try again.' }, { status: 500 });
    }

    const props = data?.properties || {};
    const code = props.email_otp;
    const tokenHash = props.hashed_token;
    const verificationType = props.verification_type || 'magiclink';

    if (!code || !tokenHash) {
      console.error('[api/auth/email-login] generateLink missing OTP properties');
      return NextResponse.json({ ok: false, message: 'Could not create a login code. Please try again.' }, { status: 500 });
    }

    const loginUrl = new URL(loginLinkPath(body), origin);
    loginUrl.searchParams.set('token_hash', tokenHash);
    loginUrl.searchParams.set('type', verificationType);
    // A friend's invite (owner D165) rides along, so a link opened on another device keeps it: the website's pending invite
    // (mm_invite) or the app's stored code (body.invite). Only the code; the database decides later whether it counts.
    if (referralsLive()) {
      const invite = decodeInviteCookie(request.cookies?.get?.(INVITE_COOKIE)?.value)?.code
        || normaliseInviteCode(typeof body?.invite === 'string' ? body.invite : '');
      if (invite) loginUrl.searchParams.set('invite', invite);
    }

    const mail = signInEmail({ link: loginUrl.toString(), code, forApp: isAppClient(body), newAccount: verificationType === 'signup' });
    const sendResult = await resend.emails.send({
      from: process.env.AUTH_EMAIL_FROM || 'MockMob <support@mockmob.in>',
      to: email,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
    });

    if (sendResult?.error) {
      console.error('[api/auth/email-login] resend failed:', sendResult.error);
      if (sendResult.error.statusCode === 401) {
        return NextResponse.json({ ok: false, message: 'Login-code email provider rejected the API key.' }, { status: 500 });
      }
      return NextResponse.json({ ok: false, message: 'Could not send the login email. Please try again.' }, { status: 500 });
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    console.error('[api/auth/email-login] POST failed:', error);
    return NextResponse.json({ ok: false, message: 'Could not send the login email. Please try again.' }, { status: 500 });
  }
}
