// Pure rules for the aggregate landing funnel. No I/O here; the route and the store call these.
import {
  FUNNEL_PLATFORMS, FUNNEL_PLATFORM_LABELS, FUNNEL_STAGES, FUNNEL_PRODUCT_STAGES, FUNNEL_SIDE_STEPS, SERVER_ONLY_STEPS, isFunnelPlatform, isFunnelStep,
} from '../funnelSteps.js';

export const MAX_BODY_BYTES = 200;
export const FUNNEL_RATE_LIMIT = { route: 'funnel', limit: 40, windowMs: 60_000 };

// Kill switch. Counting runs only when FUNNEL_ENABLED is exactly "true"; unset or anything else is off.
export function funnelEnabled(env = process.env) {
  return env.FUNNEL_ENABLED === 'true';
}

// Names that appear glued to others (Googlebot, HeadlessChrome) match as substrings; the rest need word
// boundaries. (?<!cu)bot\b keeps the CUBOT phone brand from being read as a bot.
const BOT_UA_RE = /(?<!cu)bot\b|bot[\/;)]|crawl|spider|slurp|headless|lighthouse|pagespeed|phantomjs|puppeteer|playwright|selenium|webdriver|uripreview|linkpreview|\b(facebookexternalhit|facebot|whatsapp|discordbot|gptbot|ccbot|claudebot|perplexity|bytespider|semrush|ahrefs|mj12|dotbot|gtmetrix|pingdom|uptimerobot|statuscake|prerender|monitor|scanner)\b/i;
const SCRIPT_UA_RE = /\b(curl|wget|python|requests|httpclient|okhttp|libwww|postman|insomnia|go-http-client|java|node-fetch|undici|axios|scrapy|aiohttp)\b/i;

// The Android app's own requests: a MockMob token, the Dart HTTP client, or okhttp as the first token.
const APP_UA_RE = /\bMockMob\b|^\s*Dart\/\d|^\s*okhttp\//i;
const FIRST_PARTY_UA_RE = /\bMockMob\b/i;

// Which of five fixed categories a request came from, read from the User-Agent at request time. Only
// the category leaves this function; the User-Agent is not kept, logged or returned. The app is told
// apart first (it can carry "Android" too), then iPhone and iPad, then Android browsers, then desktop
// systems; anything else, including an empty header, is "other".
export function platformFromUserAgent(userAgent) {
  const ua = typeof userAgent === 'string' ? userAgent.slice(0, 512) : '';
  if (!ua) return 'other';
  if (APP_UA_RE.test(ua)) return 'android_app';
  if (/\b(iPhone|iPad|iPod)\b/.test(ua)) return 'ios_web';
  if (/\bAndroid\b/i.test(ua)) return 'android_web';
  if (/\b(Windows NT|Macintosh|X11|CrOS)\b|Linux (x86_64|i686)/.test(ua)) return 'desktop';
  return 'other';
}

// Obvious bots only. A missing or very short user agent counts as a bot. The user agent is read for
// this check and then dropped: it is never stored or logged.
export function isBotUserAgent(userAgent) {
  const ua = typeof userAgent === 'string' ? userAgent.trim() : '';
  if (ua.length < 12) return true;
  // The app's own token is not a script (it also carries okhttp); everything else is checked.
  if (FIRST_PARTY_UA_RE.test(ua)) return BOT_UA_RE.test(ua);
  return BOT_UA_RE.test(ua) || SCRIPT_UA_RE.test(ua);
}

function hostOf(value) {
  try { return new URL(value).host.toLowerCase(); } catch { return ''; }
}

// A beacon from our own pages is same-origin. Reject a request that says it came from elsewhere.
export function isSameOriginRequest(headers) {
  const site = headers.get('sec-fetch-site');
  if (site && site !== 'same-origin') return false;
  const origin = headers.get('origin');
  if (origin) {
    const host = (headers.get('x-forwarded-host') || headers.get('host') || '').split(',')[0].trim().toLowerCase();
    if (!host || hostOf(origin) !== host) return false;
  }
  return true;
}

// Decide what to do with a request. Returns { ok: true, step, platform } to count, or { ok: false, reason }.
// The route answers 204 for every non-rate-limit reason, so a caller cannot probe the bot filter.
export function evaluateFunnelRequest({ headers, bodyText }) {
  if (headers.get('dnt') === '1' || headers.get('sec-gpc') === '1') return { ok: false, reason: 'privacy_signal' };
  if (isBotUserAgent(headers.get('user-agent'))) return { ok: false, reason: 'bot' };
  if (!isSameOriginRequest(headers)) return { ok: false, reason: 'cross_origin' };
  if (typeof bodyText !== 'string' || bodyText.length === 0 || bodyText.length > MAX_BODY_BYTES) return { ok: false, reason: 'bad_body' };
  let parsed;
  try { parsed = JSON.parse(bodyText); } catch { return { ok: false, reason: 'bad_body' }; }
  const step = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed.step : null;
  if (!isFunnelStep(step)) return { ok: false, reason: 'unknown_step' };
  if (SERVER_ONLY_STEPS.includes(step)) return { ok: false, reason: 'server_only' };
  return { ok: true, step, platform: platformFromUserAgent(headers.get('user-agent')) };
}

// Decide whether the server counts a finished sign-up, and under which platform. Same privacy rules as
// the beacon (kill switch, Do Not Track, Global Privacy Control) but no bot filter: the account was just
// made for a confirmed email. headers is a Headers or null (no request in scope: counted as "other").
export function evaluateSignupCount({ headers, env = process.env } = {}) {
  if (!funnelEnabled(env)) return { ok: false, reason: 'disabled' };
  if (headers?.get?.('dnt') === '1' || headers?.get?.('sec-gpc') === '1') return { ok: false, reason: 'privacy_signal' };
  return { ok: true, step: 'signup_complete', platform: platformFromUserAgent(headers?.get?.('user-agent')) };
}

// India calendar day (the day the database counts in) for an instant, as YYYY-MM-DD.
export function istDay(date = new Date()) {
  return new Date(date.getTime() + 330 * 60_000).toISOString().slice(0, 10);
}

function addDays(day, delta) {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

export function windowDays(today, days = 14) {
  return Array.from({ length: days }, (_, i) => addDays(today, i - (days - 1)));
}

export const SMALL_SAMPLE = 30;

function rate(numerator, denominator) {
  if (!Number.isFinite(denominator) || denominator <= 0) return { numerator, denominator: 0, rate: null, small: false, over: false };
  const value = numerator / denominator;
  return { numerator, denominator, rate: value, small: denominator < SMALL_SAMPLE, over: value > 1 };
}

function buildStages(total) {
  const stages = FUNNEL_STAGES.map((stage, i) => ({
    ...stage,
    count: total(stage.step),
    ofPrevious: i === 0 ? null : { ...rate(total(stage.step), total(FUNNEL_STAGES[i - 1].step)), againstLabel: FUNNEL_STAGES[i - 1].label },
    ofLanding: i === 0 ? null : { ...rate(total(stage.step), total(FUNNEL_STAGES[0].step)), againstLabel: FUNNEL_STAGES[0].label },
  }));
  const side = FUNNEL_SIDE_STEPS.map((s) => ({ ...s, count: total(s.step), ofLanding: { ...rate(total(s.step), total('landing_view')), againstLabel: FUNNEL_STAGES[0].label } }));
  return { stages, side, empty: stages.every((s) => s.count === 0) && side.every((s) => s.count === 0) };
}

// rows: [{ day: 'YYYY-MM-DD', step, platform, count }]. The table only holds a row once something
// happened, so a missing day, step or platform is a real zero. A row with a platform outside the five
// categories (or none, as in rows from before the platform column) counts in the overall totals and under
// "other".
export function summariseFunnel(rows, { today = istDay(), days = 14 } = {}) {
  const dayList = windowDays(today, days);
  const inWindow = new Set(dayList);
  const totals = new Map();
  const platformTotals = new Map(FUNNEL_PLATFORMS.map((p) => [p, new Map()]));
  const perDay = new Map(dayList.map((d) => [d, {}]));
  for (const row of Array.isArray(rows) ? rows : []) {
    const day = typeof row?.day === 'string' ? row.day.slice(0, 10) : '';
    const count = Number(row?.count);
    if (!inWindow.has(day) || !isFunnelStep(row.step) || !Number.isFinite(count) || count < 0) continue;
    const platform = isFunnelPlatform(row.platform) ? row.platform : 'other';
    totals.set(row.step, (totals.get(row.step) || 0) + count);
    const mine = platformTotals.get(platform);
    mine.set(row.step, (mine.get(row.step) || 0) + count);
    perDay.get(day)[row.step] = (perDay.get(day)[row.step] || 0) + count;
  }
  const total = (step) => totals.get(step) || 0;
  const { stages, side, empty } = buildStages(total);
  const daily = dayList.map((day) => ({ day, landing_view: perDay.get(day).landing_view || 0, signup_complete: perDay.get(day).signup_complete || 0 }));
  // Per platform: the same funnel, and each platform's share of visits and of finished sign ups. The
  // denominator of a share is the all-platform total of that step, so the shares add up to 100%.
  const byPlatform = FUNNEL_PLATFORMS.map((platform) => {
    const mine = platformTotals.get(platform);
    const own = (step) => mine.get(step) || 0;
    const funnel = buildStages(own);
    return {
      platform,
      label: FUNNEL_PLATFORM_LABELS[platform],
      ...funnel,
      visitShare: { count: own('landing_view'), ...rate(own('landing_view'), total('landing_view')), ofLabel: 'All landing views' },
      signupShare: { count: own('signup_complete'), ...rate(own('signup_complete'), total('signup_complete')), ofLabel: 'All finished sign ups' },
    };
  });
  // The in-product steps are not strictly sequential (a student can see pricing before a first repair), so
  // each is compared with finished sign ups, not with the step above it.
  const product = FUNNEL_PRODUCT_STAGES.map((stage) => ({
    ...stage,
    count: total(stage.step),
    ofSignups: { ...rate(total(stage.step), total('signup_complete')), againstLabel: 'Finished signing up' },
  }));
  return {
    from: dayList[0], to: dayList[dayList.length - 1], days, stages, side, daily, empty: empty && product.every((p) => p.count === 0), product,
    byPlatform,
    totalVisits: total('landing_view'),
    totalSignups: total('signup_complete'),
  };
}
