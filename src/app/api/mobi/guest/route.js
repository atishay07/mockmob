import { checkPersistentRateLimit, giveBackRateLimit } from '@/lib/server/rateLimit';
import { callProviderOnce, LUNA_MODEL } from '@/services/ai/providers';
import { modelRepliesOpen } from '@/services/prepos/replyDeps';
import { publicOffer } from '@/lib/payments/offer';
import { COOKIE_NAME, SITE_LIMIT_DEFAULT, buildFactSheet, createGuestMobi, limitOptions } from '@/lib/server/guestMobi';

// POST /api/mobi/guest: Ask Mobi for visitors who have not signed up (AskMobiSheet.jsx on the home page). Three real answers per
// visitor, one model call each, behind the runtime guard and three persistent buckets. The rules, the prompt and the worst-case
// cost arithmetic are in src/lib/server/guestMobi.js. Never cached. No visitor text is logged.
//
// Off when: GUEST_MOBI_ENABLED=false (the kill switch), signed-in model replies are closed (modelRepliesOpen)
// (in production its limits are always the database limiter, rateLimit.js `persistent`), or there is no secret to sign the visitor cookie with.

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' };
const BODY_MAX_BYTES = 8_192;
// The client gives up at 20 s; the provider call stops before that (the SDK timeout plus providerCore's 3 s hard stop).
const CALL_TIMEOUT_MS = 15_000;
// The app's auth secret (the same one the preview cookie and the Mob ids fall back to), else the server-only service key.
const cookieSecret = () => process.env.NEXTAUTH_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const PROD = process.env.NODE_ENV === 'production';

function guestState() {
  if (process.env.GUEST_MOBI_ENABLED === 'false') return 'off';
  if (!modelRepliesOpen()) return 'off';
  if (!cookieSecret()) return 'off';
  return 'on';
}

function readCookie(request) {
  const direct = request.cookies?.get?.(COOKIE_NAME)?.value;
  if (direct) return direct;
  const header = request.headers.get('cookie') || '';
  const match = header.match(new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]+)`));
  return match ? match[1] : null;
}

export async function POST(request) {
  let body = null;
  try {
    const text = await request.text();
    if (Buffer.byteLength(text, 'utf8') <= BODY_MAX_BYTES) body = JSON.parse(text);
  } catch { body = null; }

  const siteLimit = Number(process.env.GUEST_MOBI_DAILY_CALLS) || SITE_LIMIT_DEFAULT;
  const options = (scope, visitorId) => limitOptions(scope, { visitorId, siteLimit });
  const guest = createGuestMobi({
    state: guestState,
    secret: cookieSecret(),
    secure: process.env.NODE_ENV === 'production',
    // No `fallback: 'memory'`: when the database cannot answer, the call is refused (a paid model sits behind these).
    // In production the limits are the database's whatever PERSISTENT_LIMITS_ENABLED says (rateLimit.js `persistent`);
    // a development server keeps the in-memory counter unless that switch is on.
    take: (scope, visitorId) => checkPersistentRateLimit(request, { ...options(scope, visitorId), persistent: PROD }),
    giveBack: (scope, visitorId) => giveBackRateLimit(request, { ...options(scope, visitorId), persistent: PROD }),
    callModel: async ({ requestKey, systemPrompt, userMessage, maxTokens }) => {
      const result = await callProviderOnce({
        requestKey, provider: 'openai', model: LUNA_MODEL, systemPrompt, userMessage, context: null,
        jsonMode: false, maxTokens, reasoningEffort: 'none', timeoutMs: CALL_TIMEOUT_MS,
      });
      return { ...result, dispatched: result?.dispatched === true };
    },
    facts: buildFactSheet({ offer: publicOffer(), keyCards: process.env.KEY_CARDS_ENABLED === 'true' }),
  });

  let outcome;
  try {
    outcome = await guest.handle({ body, cookie: readCookie(request) });
  } catch {
    outcome = { status: 503, body: { state: 'unavailable' } };
  }
  const headers = new Headers(NO_STORE);
  if (outcome.setCookie) headers.append('Set-Cookie', outcome.setCookie);
  return Response.json(outcome.body, { status: outcome.status, headers });
}
