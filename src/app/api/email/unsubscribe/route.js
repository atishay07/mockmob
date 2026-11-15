import { emailSecret, verifyUnsubscribe } from '@/lib/email/studentMailModel.mjs';
import { unsubscribePage } from '@/lib/email/studentMailWords.mjs';
import { optOutStudent } from '@/lib/email/studentMailServer';
import { getSiteOrigin } from '@/lib/server/emailLoginPolicy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// The one-click unsubscribe of the welcome and day-2 emails (src/lib/email). The address is signed for one student
// (?u=<user id>&t=<HMAC>), so nobody can turn another student's emails off. It works whether the emails are switched on or not.
//   GET   the link in the email: turns the emails off and shows a plain page saying so
//   POST  RFC 8058 one-click (List-Unsubscribe-Post): a mail app's own Unsubscribe button; answers 200 with no page
// Sign-in codes are not affected.

const HEADERS = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex', 'Referrer-Policy': 'no-referrer' };

async function turnOff(request) {
  const url = new URL(request.url);
  const userId = url.searchParams.get('u') || '';
  const token = url.searchParams.get('t') || '';
  if (!verifyUnsubscribe(userId, token, emailSecret())) return 'invalid';
  try {
    await optOutStudent(userId);
    return 'done';
  } catch {
    console.warn('[api/email/unsubscribe] the opt-out could not be saved');
    return 'error';
  }
}

export async function GET(request) {
  const state = await turnOff(request);
  const html = unsubscribePage(state, { retry: request.url, origin: getSiteOrigin(request) });
  const status = state === 'done' ? 200 : state === 'invalid' ? 400 : 503;
  return new Response(html, { status, headers: { ...HEADERS, 'Content-Type': 'text/html; charset=utf-8' } });
}

export async function POST(request) {
  const state = await turnOff(request);
  const status = state === 'done' ? 200 : state === 'invalid' ? 400 : 503;
  return Response.json({ ok: state === 'done' }, { status, headers: HEADERS });
}
