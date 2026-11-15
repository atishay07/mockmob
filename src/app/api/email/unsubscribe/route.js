import { emailSecret, verifyUnsubscribe } from '@/lib/email/studentMailModel.mjs';
import { unsubscribePage } from '@/lib/email/studentMailWords.mjs';
import { optOutStudent } from '@/lib/email/studentMailServer';
import { getSiteOrigin } from '@/lib/server/emailLoginPolicy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// The unsubscribe of the welcome and day-2 emails (src/lib/email). The address is signed for one student (?u=<user id>&t=<HMAC>),
// so nobody can turn another student's emails off. It works whether the emails are switched on or not. Sign-in codes are not
// affected.
//   GET   the link in the email: changes nothing (mail scanners open links on their own) and shows one button,
//         "Turn off these emails", which posts the same signed address with page=1
//   POST  page=1 (that button): turns the emails off and shows the page saying so
//         anything else, as RFC 8058 one-click (List-Unsubscribe=One-Click from a mail app's own Unsubscribe button):
//         turns them off and answers 200 with no page
// The proxy's same-origin rule lets this one POST through from any origin (src/lib/server/sameOriginWrite.js): the HMAC is the
// protection, and the only thing it can do is turn these emails off.

const HEADERS = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex', 'Referrer-Policy': 'no-referrer' };
const BODY_MAX = 4096;

const signed = (url) => verifyUnsubscribe(url.searchParams.get('u') || '', url.searchParams.get('t') || '', emailSecret());
const statusOf = (state) => (state === 'done' || state === 'confirm' ? 200 : state === 'invalid' ? 400 : 503);

function page(request, state) {
  const url = new URL(request.url);
  const html = unsubscribePage(state, {
    origin: getSiteOrigin(request),
    action: `${url.pathname}${url.search}`,
    retry: `${url.pathname}${url.search}`,
  });
  return new Response(html, { status: statusOf(state), headers: { ...HEADERS, 'Content-Type': 'text/html; charset=utf-8' } });
}

export async function GET(request) {
  return page(request, signed(new URL(request.url)) ? 'confirm' : 'invalid');
}

export async function POST(request) {
  const url = new URL(request.url);
  let fromPage = false;
  try {
    const body = await request.text();
    fromPage = body.length <= BODY_MAX && new URLSearchParams(body).get('page') === '1';
  } catch { fromPage = false; }
  let state = 'invalid';
  if (signed(url)) {
    try {
      await optOutStudent(url.searchParams.get('u'));
      state = 'done';
    } catch {
      console.warn('[api/email/unsubscribe] the opt-out could not be saved');
      state = 'error';
    }
  }
  if (fromPage) return page(request, state);
  return Response.json({ ok: state === 'done' }, { status: statusOf(state), headers: HEADERS });
}
