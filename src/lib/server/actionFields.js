// Structured action fields for the Android app: the app never parses web URLs.
// actionFromHref turns one of the web app's own relative paths into
// {type, subject?, chapter?, mode?, count?, sessionId?, attemptId?, unitId?}.
// Anything unknown becomes {type:'none'}. Pure: no I/O, safe to unit test.

const NONE = Object.freeze({ type: 'none' });
const MOCK_MODES = new Set(['full', 'nta']);
const MAX_LEN = 200;

function clean(value) {
  if (typeof value !== 'string') return undefined;
  const v = value.trim();
  return v && v.length <= MAX_LEN ? v : undefined;
}

function pick(params, map) {
  const out = {};
  for (const [field, key] of Object.entries(map)) {
    const v = clean(params.get(key));
    if (v !== undefined) out[field] = v;
  }
  const n = Number(params.get('count'));
  if (map.count === undefined && params.has('count') && Number.isInteger(n) && n > 0 && n <= 200) out.count = n;
  return out;
}

function decodeSegment(seg) {
  try { return clean(decodeURIComponent(seg)); } catch { return undefined; }
}

// hint.kind lets a caller that already knows the plan step (e.g. 'repair') refine a /recovery link.
export function actionFromHref(href, hint = {}) {
  if (typeof href !== 'string' || href.length > 2000 || !href.startsWith('/') || href.startsWith('//') || href.includes(String.fromCharCode(92))) return { ...NONE };
  let url;
  try { url = new URL(href, 'https://app.invalid'); } catch { return { ...NONE }; }
  if (url.origin !== 'https://app.invalid') return { ...NONE };
  const path = url.pathname.replace(/\/+$/, '') || '/';
  const q = url.searchParams;
  const parts = path.split('/').filter(Boolean);

  if (path === '/test') {
    const base = pick(q, { subject: 'subject', chapter: 'chapter', mode: 'mode' });
    const sessionId = clean(q.get('sessionId'));
    if (sessionId) return { type: 'resume', ...base, sessionId };
    const attemptId = clean(q.get('recoveryFrom'));
    const out = { type: MOCK_MODES.has(base.mode) ? 'mock' : 'practice', ...base };
    const n = Number(q.get('count'));
    if (Number.isInteger(n) && n > 0 && n <= 200) out.count = n;
    if (attemptId) out.attemptId = attemptId;
    return out;
  }
  if (path === '/dashboard') {
    const base = pick(q, { subject: 'subject', chapter: 'chapter', mode: 'mode' });
    const out = { type: MOCK_MODES.has(base.mode) ? 'mock' : 'practice', ...base };
    const n = Number(q.get('count'));
    if (Number.isInteger(n) && n > 0 && n <= 200) out.count = n;
    return out;
  }
  if (parts[0] === 'result' && parts.length === 2) {
    const attemptId = decodeSegment(parts[1]);
    return attemptId ? { type: 'result', attemptId } : { ...NONE };
  }
  if (path === '/review') {
    const attemptId = clean(q.get('attemptId')) || clean(q.get('attempt'));
    return { type: 'review', ...(attemptId ? { attemptId } : {}), ...pick(q, { subject: 'subject' }) };
  }
  if (parts[0] === 'learn') {
    if (parts.length === 1) return { type: 'learn' };
    if (parts.length === 2) {
      const unitId = decodeSegment(parts[1]);
      return unitId ? { type: 'learn', unitId } : { ...NONE };
    }
    return { ...NONE };
  }
  if (parts[0] === 'study' && parts.length === 2) {
    const sessionId = decodeSegment(parts[1]);
    return sessionId ? { type: 'learn', sessionId } : { ...NONE };
  }
  if (path === '/recovery') {
    const unitId = clean(q.get('episode'));
    const out = { type: hint.kind === 'repair' ? 'repair' : 'recovery', ...pick(q, { subject: 'subject', chapter: 'chapter' }) };
    if (unitId) out.unitId = unitId;
    else if (clean(q.get('concept'))) out.unitId = clean(q.get('concept'));
    return out;
  }
  if (path === '/pricing') return { type: 'pricing' };
  return { ...NONE };
}

// Adds `action` beside an existing href without touching other fields.
export function withAction(item, hint) {
  if (!item || typeof item !== 'object' || typeof item.href !== 'string') return item;
  return { ...item, action: actionFromHref(item.href, { kind: hint?.kind ?? item.kind }) };
}

export function withPlanActions(plan) {
  if (!plan || typeof plan !== 'object') return plan;
  const out = { ...plan };
  if (out.primary) out.primary = withAction(out.primary);
  if (Array.isArray(out.alternatives)) out.alternatives = out.alternatives.map(a => withAction(a));
  if (Array.isArray(out.sequence)) out.sequence = out.sequence.map(a => withAction(a));
  return out;
}
