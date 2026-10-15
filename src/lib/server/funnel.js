// Pure rules for the aggregate landing funnel. No I/O here; the route and the store call these.
import { FUNNEL_STAGES, FUNNEL_SIDE_STEPS, isFunnelStep } from '../funnelSteps.js';

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

// Obvious bots only. A missing or very short user agent counts as a bot. The user agent is read for
// this check and then dropped: it is never stored or logged.
export function isBotUserAgent(userAgent) {
  const ua = typeof userAgent === 'string' ? userAgent.trim() : '';
  if (ua.length < 12) return true;
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

// Decide what to do with a request. Returns { ok: true, step } to count, or { ok: false, reason }.
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
  return { ok: true, step };
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

// rows: [{ day: 'YYYY-MM-DD', step, count }]. The table only holds a row once something happened, so
// a missing day or step is a real zero.
export function summariseFunnel(rows, { today = istDay(), days = 14 } = {}) {
  const dayList = windowDays(today, days);
  const inWindow = new Set(dayList);
  const totals = new Map();
  const perDay = new Map(dayList.map((d) => [d, {}]));
  for (const row of Array.isArray(rows) ? rows : []) {
    const day = typeof row?.day === 'string' ? row.day.slice(0, 10) : '';
    const count = Number(row?.count);
    if (!inWindow.has(day) || !isFunnelStep(row.step) || !Number.isFinite(count) || count < 0) continue;
    totals.set(row.step, (totals.get(row.step) || 0) + count);
    perDay.get(day)[row.step] = (perDay.get(day)[row.step] || 0) + count;
  }
  const total = (step) => totals.get(step) || 0;
  const stages = FUNNEL_STAGES.map((stage, i) => ({
    ...stage,
    count: total(stage.step),
    ofPrevious: i === 0 ? null : { ...rate(total(stage.step), total(FUNNEL_STAGES[i - 1].step)), againstLabel: FUNNEL_STAGES[i - 1].label },
    ofLanding: i === 0 ? null : { ...rate(total(stage.step), total(FUNNEL_STAGES[0].step)), againstLabel: FUNNEL_STAGES[0].label },
  }));
  const side = FUNNEL_SIDE_STEPS.map((s) => ({ ...s, count: total(s.step), ofLanding: { ...rate(total(s.step), total('landing_view')), againstLabel: FUNNEL_STAGES[0].label } }));
  const daily = dayList.map((day) => ({ day, landing_view: perDay.get(day).landing_view || 0, signup_complete: perDay.get(day).signup_complete || 0 }));
  return { from: dayList[0], to: dayList[dayList.length - 1], days, stages, side, daily, empty: stages.every((s) => s.count === 0) && side.every((s) => s.count === 0) };
}
