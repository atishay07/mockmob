// Pure rules for self-hosted app crash reports. No I/O here; the handler, the store and the admin page call these.
// What may leave the phone is already small (message, stack, screen, coarse device facts). What reaches the
// database is smaller still: the server scrubs every text field itself, trims it, and hashes it. Nothing here
// reads or keeps a user id, an IP address or a user agent.
import { createHash } from 'node:crypto';
import { canCollect } from './usage.js';

export const MAX_BATCH = 10;
export const MAX_BODY_BYTES = 80_000;
export const MAX_MESSAGE_CHARS = 500;
export const MAX_STACK_BYTES = 4096;
export const MAX_SCREEN_CHARS = 64;
export const MAX_COUNT_PER_ERROR = 1000;
export const APP_ERRORS_RATE_LIMIT = { route: 'app-errors', limit: 30, windowMs: 60_000 };

export const KINDS = ['flutter', 'platform', 'zone', 'other'];
export const PLATFORMS = ['android', 'ios', 'web', 'other'];
export const DEVICE_CLASSES = ['phone', 'tablet', 'other'];

// Kill switch. Reporting runs unless APP_ERRORS_ENABLED is exactly "off".
export function appErrorsEnabled(env = process.env) {
  return env.APP_ERRORS_ENABLED !== 'off';
}

// Cap on what the scrubber looks at. A report is never this long once trimmed; the cap keeps the regular
// expressions below from working on a megabyte of text.
const SCRUB_INPUT_CAP = 10_000;

const UUID = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;

// Order matters: the most specific shapes first, so a token is not half eaten by a looser rule.
export function scrubText(value) {
  if (typeof value !== 'string' || !value) return '';
  let text = value.slice(0, SCRUB_INPUT_CAP);
  // JSON web tokens (three dot separated parts, the first starts with eyJ).
  text = text.replace(/\beyJ[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{6,}(?:\.[A-Za-z0-9_-]*)?/g, '[token]');
  // Authorization values and key=value / key: value pairs that carry a secret.
  text = text.replace(/\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]{6,}/gi, '$1 [token]');
  text = text.replace(
    /((?:access_?token|refresh_?token|id_?token|token|apikey|api_?key|secret|password|passwd|pwd|authorization|otp|signature)["']?\s*[=:]\s*)["']?[^\s&"',;)<>]{3,}/gi,
    '$1[token]',
  );
  text = text.replace(/[A-Z0-9._%+-]{1,64}@[A-Z0-9.-]{1,255}\.[A-Z]{2,24}/gi, '[email]');
  text = text.replace(UUID, '[id]');
  // Provider key prefixes (sb_..., sk-..., rzp_live_..., ghp_..., xoxb-...).
  text = text.replace(/\b(?:sb|sk|pk|rzp|re|ghp|gho|ghs|xox[a-z]|AIza|ya29)[-_.]?[A-Za-z0-9_-]{12,}/g, '[token]');
  // IPv4 before phone numbers: 192.168.1.100 has ten digits too.
  text = text.replace(/(?<![\w.])(?:\d{1,3}\.){3}\d{1,3}(?![\w.])/g, '[ip]');
  // IPv6 in its common long forms.
  text = text.replace(/(?<![\w:])(?:[0-9a-f]{1,4}:){3,7}[0-9a-f]{1,4}(?![\w:])/gi, '[ip]');
  // Indian mobile numbers (with or without +91 / 0091 / spaces / dashes), international numbers with a plus,
  // and any bare run of 10 to 13 digits.
  text = text.replace(/(?<![\w.:/-])(?:(?:\+|00)?91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}(?![\w])/g, '[phone]');
  text = text.replace(/(?<![\w.])\+\d{1,3}[\s-]?\(?\d{2,4}\)?[\s-]?\d{3,4}[\s-]?\d{3,4}(?!\w)/g, '[phone]');
  text = text.replace(/(?<![\w.])\d{10,13}(?![\w.])/g, '[phone]');
  // Home folders on a developer machine.
  text = text.replace(/([A-Za-z]:\\Users\\)[^\\\s]+/g, '$1[user]');
  text = text.replace(/(\/(?:Users|home)\/)[^/\s]+/g, '$1[user]');
  // Long opaque strings (hex digests, base64, random ids): 24 or more characters of one unbroken run with a
  // digit in it. Identifiers made only of letters (class and function names) stay readable.
  text = text.replace(/[A-Za-z0-9_+/=-]{24,}/g, (run) => (/\d/.test(run) && /[A-Za-z]/.test(run) ? '[token]' : run));
  return text;
}

function trimChars(text, max) {
  if (text.length <= max) return text;
  return Array.from(text).slice(0, max).join('');
}

function trimBytes(text, max) {
  if (Buffer.byteLength(text) <= max) return text;
  let end = Math.min(text.length, max);
  while (end > 0 && Buffer.byteLength(text.slice(0, end)) > max) end -= 1;
  // Never end on half of a surrogate pair.
  const code = text.charCodeAt(end - 1);
  if (code >= 0xd800 && code <= 0xdbff) end -= 1;
  return text.slice(0, end);
}

// A route such as /learn/chapter/9f1c... is reduced to its shape; the query string and any fragment go.
export function cleanScreen(value) {
  if (typeof value !== 'string') return null;
  const path = value.split(/[?#]/)[0].trim();
  if (!path) return null;
  const shaped = path
    .split('/')
    .map((part) => (part && (/\d/.test(part) && part.length >= 8 ? ':id' : part)))
    .join('/');
  const clean = trimChars(scrubText(shaped), MAX_SCREEN_CHARS).trim();
  return clean || null;
}

const SAFE_VERSION = /^[0-9A-Za-z._+-]+$/;

function cleanVersion(value, max) {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  return text && text.length <= max && SAFE_VERSION.test(text) ? text : null;
}

function cleanOsVersion(value) {
  if (typeof value !== 'string') return null;
  const text = trimChars(value.replace(/[^A-Za-z0-9 ._()+-]/g, '').trim(), 32);
  return text || null;
}

// The shape of an error with the parts that change from one report to the next taken out, so the same
// failure on a thousand phones lands in one row: numbers and addresses become "#", spacing is collapsed.
function shapeOf(text) {
  return text
    .replace(/0x[0-9a-f]+/gi, '#')
    .replace(/\d+/g, '#')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function firstFrame(stack) {
  for (const line of stack.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && /[A-Za-z]/.test(trimmed)) return trimmed;
  }
  return '';
}

// message_hash: 32 hex characters over the kind, the shape of the scrubbed message and the first stack frame.
// The first frame is part of it because many framework messages ("Null check operator used on a null value")
// say nothing about where the failure is; two different places must not be merged into one row.
export function messageHash({ kind, message, stack }) {
  const frame = shapeOf(firstFrame(stack || ''));
  return createHash('sha256').update(`${kind}\n${shapeOf(message)}\n${frame}`).digest('hex').slice(0, 32);
}

// One report from the phone to one stored row, or null when it is unusable. Every text field is scrubbed and
// trimmed here, whatever the phone did.
export function normalizeError(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const rawMessage = typeof input.message === 'string' ? input.message : '';
  const message = trimChars(scrubText(rawMessage).trim(), MAX_MESSAGE_CHARS).trim();
  if (!message) return null;
  const rawStack = typeof input.stack === 'string' ? input.stack : '';
  const stack = trimBytes(scrubText(rawStack).trim(), MAX_STACK_BYTES);
  const kind = KINDS.includes(input.kind) ? input.kind : 'other';
  const platform = PLATFORMS.includes(input.platform) ? input.platform : 'other';
  const deviceClass = DEVICE_CLASSES.includes(input.device_class) ? input.device_class : 'other';
  const asked = Number(input.count);
  const count = Number.isFinite(asked) ? Math.max(1, Math.min(Math.floor(asked), MAX_COUNT_PER_ERROR)) : 1;
  return {
    message_hash: messageHash({ kind, message, stack }),
    kind,
    message,
    stack: stack || null,
    screen: cleanScreen(input.screen),
    platform,
    app_version: cleanVersion(input.app_version, 32),
    build: cleanVersion(input.build, 16),
    os_version: cleanOsVersion(input.os_version),
    device_class: deviceClass,
    count,
  };
}

// A batch to rows: unusable reports are dropped, reports with the same hash are merged (their counts add), so
// the database never sees one hash twice in a batch. Returns { rows, dropped } or { error } when the batch
// itself is unusable.
export function normalizeBatch(errors) {
  if (!Array.isArray(errors)) return { error: 'errors must be an array' };
  if (errors.length === 0) return { error: 'errors must not be empty' };
  if (errors.length > MAX_BATCH) return { error: `At most ${MAX_BATCH} errors per request` };
  const byHash = new Map();
  let dropped = 0;
  for (const item of errors) {
    const row = normalizeError(item);
    if (!row) { dropped += 1; continue; }
    const seen = byHash.get(row.message_hash);
    if (seen) seen.count = Math.min(seen.count + row.count, MAX_COUNT_PER_ERROR);
    else byHash.set(row.message_hash, row);
  }
  return { rows: [...byHash.values()], dropped };
}

// Consent, the same rule as /api/events (D183): usage data counts only when the student allowed it, has not
// withdrawn, and did not say they are under 18. "Rather not say" (age band unknown) counts as allowed when on.
export function canCollectErrors(consent) {
  return canCollect(consent);
}

const JSON_HEADERS = { 'Cache-Control': 'no-store' };
const reply = (body, status = 202, extra = {}) => Response.json(body, { status, headers: { ...JSON_HEADERS, ...extra } });

// The whole POST, with its dependencies passed in so it can be tested without a server or a database:
//   env, rateLimit(request) -> { allowed, headers }, authenticate(request) -> true when a student is signed in,
//   loadConsent(request) -> { consent } | { error }, record(rows) -> { ok, notSetUp }.
// The student's id never leaves authenticate / loadConsent: it is not passed on and not stored.
export async function handleAppErrorsPost(request, deps) {
  if (!appErrorsEnabled(deps.env)) return reply({ accepted: 0, dropped: 0, collecting: false });
  const limit = deps.rateLimit(request);
  if (!limit.allowed) return new Response(null, { status: 429, headers: { ...JSON_HEADERS, ...(limit.headers || {}) } });
  if (!(await deps.authenticate(request))) return reply({ error: 'Unauthorized' }, 401);
  const declared = Number(request.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) return reply({ error: 'Request too large.' }, 413);
  let text = '';
  try { text = await request.text(); } catch { return reply({ error: 'Invalid request.' }, 400); }
  if (text.length > MAX_BODY_BYTES) return reply({ error: 'Request too large.' }, 413);
  let body;
  try { body = JSON.parse(text); } catch { return reply({ error: 'Invalid request.' }, 400); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return reply({ error: 'Invalid request.' }, 400);
  const batch = normalizeBatch(body.errors);
  if (batch.error) return reply({ error: batch.error }, 400);
  const consent = await deps.loadConsent(request);
  if (consent.error) return reply({ error: 'Temporarily unavailable.' }, 503);
  if (!canCollectErrors(consent.consent)) return reply({ accepted: 0, dropped: batch.rows.length + batch.dropped, collecting: false });
  if (batch.rows.length === 0) return reply({ accepted: 0, dropped: batch.dropped, collecting: true });
  const stored = await deps.record(batch.rows);
  if (stored.notSetUp) return reply({ accepted: 0, dropped: batch.rows.length + batch.dropped, collecting: false });
  if (!stored.ok) return reply({ error: 'Temporarily unavailable.' }, 503);
  return reply({ accepted: batch.rows.length, dropped: batch.dropped, collecting: true });
}

// ---- admin view -----------------------------------------------------------------------------------------

export const TOP_DAYS = 7;
export const TOP_LIMIT = 50;

// Rows from app_errors_top() to what the page shows. Each error carries its share with its denominator (this
// error's reports of all reports in the window), and times are kept as ISO strings.
export function summariseTopErrors(rows) {
  const list = Array.isArray(rows) ? rows : [];
  const windowTotal = list.length ? Number(list[0].window_total) || 0 : 0;
  const distinct = list.length ? Number(list[0].distinct_errors) || list.length : 0;
  const errors = list.map((row) => {
    const total = Number(row.total) || 0;
    return {
      hash: row.message_hash,
      kind: row.kind,
      message: row.message,
      stack: row.stack || '',
      screen: row.screen || null,
      platform: row.platform,
      appVersion: row.app_version || null,
      total,
      share: { numerator: total, denominator: windowTotal },
      firstSeen: row.first_seen ? new Date(row.first_seen).toISOString() : null,
      lastSeen: row.last_seen ? new Date(row.last_seen).toISOString() : null,
    };
  });
  const shown = errors.reduce((sum, e) => sum + e.total, 0);
  return { errors, windowTotal, distinct, shown, hidden: Math.max(0, distinct - errors.length), empty: errors.length === 0 };
}
