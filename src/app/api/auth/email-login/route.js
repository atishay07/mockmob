import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { resend } from '@/lib/resend';

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

function checkRateLimit(request, email) {
  const now = Date.now();
  const key = rateLimitKey(request, email);
  const bucket = rateBuckets.get(key) || { lastAt: 0, attempts: [] };
  bucket.attempts = bucket.attempts.filter((time) => now - time < 60 * 60 * 1000);

  if (now - bucket.lastAt < MIN_REQUEST_INTERVAL_MS || bucket.attempts.length >= HOURLY_LIMIT) {
    rateBuckets.set(key, bucket);
    return false;
  }

  bucket.lastAt = now;
  bucket.attempts.push(now);
  rateBuckets.set(key, bucket);
  return true;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function loginEmailHtml({ link, code }) {
  const safeLink = escapeHtml(link);
  const safeCode = escapeHtml(code);

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Log in to MockMob</title>
  </head>
  <body style="margin:0;background:#080907;color:#f4f5ef;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#080907;padding:28px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;border:1px solid rgba(255,255,255,0.12);border-radius:22px;background:#10120d;padding:28px;">
            <tr>
              <td>
                <p style="margin:0 0 8px;color:#d2f000;font-size:12px;font-weight:800;letter-spacing:0.18em;text-transform:uppercase;">MockMob login</p>
                <h1 style="margin:0;color:#f8faf2;font-size:28px;line-height:1.15;">Use the button or enter this code.</h1>
                <p style="margin:14px 0 22px;color:#a1a1aa;font-size:15px;line-height:1.7;">If this email is open on another phone, keep MockMob open on the payment device and type the 6-digit code below.</p>
                <p style="margin:0 0 22px;">
                  <a href="${safeLink}" style="display:inline-block;border-radius:999px;background:#d2f000;color:#090a08;font-size:15px;font-weight:800;text-decoration:none;padding:14px 20px;">Log in to MockMob</a>
                </p>
                <div style="border:1px solid rgba(210,240,0,0.28);border-radius:18px;background:rgba(210,240,0,0.08);padding:18px;text-align:center;">
                  <p style="margin:0 0 8px;color:#a1a1aa;font-size:13px;">Your 6-digit login code</p>
                  <p style="margin:0;color:#d2f000;font-size:34px;line-height:1;font-weight:900;letter-spacing:0.28em;">${safeCode}</p>
                </div>
                <p style="margin:18px 0 0;color:#71717a;font-size:12px;line-height:1.6;">This login is one-time use. If you did not request it, you can ignore this email.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function getSiteOrigin(request) {
  return (process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin).replace(/\/$/, '');
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

    if (!checkRateLimit(request, email)) {
      return NextResponse.json({ ok: false, message: 'Please wait before requesting another login code.' }, { status: 429 });
    }

    if (!hasEmailProvider()) {
      console.error('[api/auth/email-login] RESEND_API_KEY is missing or invalid');
      return NextResponse.json({ ok: false, message: 'Login-code email is not configured yet.' }, { status: 500 });
    }

    const origin = getSiteOrigin(request);
    const redirectTo = `${origin}/auth/callback`;
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

    const loginUrl = new URL('/auth/callback', origin);
    loginUrl.searchParams.set('token_hash', tokenHash);
    loginUrl.searchParams.set('type', verificationType);

    const sendResult = await resend.emails.send({
      from: process.env.AUTH_EMAIL_FROM || 'MockMob <support@mockmob.in>',
      to: email,
      subject: 'Your MockMob login link and code',
      html: loginEmailHtml({ link: loginUrl.toString(), code }),
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
