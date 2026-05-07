import 'server-only';

const BOT_UA_RE = /\b(bot|crawler|spider|slurp|headless|facebookexternalhit|twitterbot|linkedinbot|whatsapp|gptbot|ccbot|claudebot|perplexitybot|bytespider|semrush|ahrefs|mj12|dotbot)\b/i;
const SCRIPT_UA_RE = /\b(curl|wget|python|httpclient|postman|insomnia|go-http-client|java|node-fetch|axios)\b/i;
const MOBILE_UA_RE = /\b(android|iphone|ipad|mobile)\b/i;

export function getClientIp(request) {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || request.headers.get('cf-connecting-ip')
    || 'unknown';
}

function maskIp(ip) {
  if (!ip || ip === 'unknown') return 'unknown';
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) {
    const parts = ip.split('.');
    return `${parts[0]}.${parts[1]}.x.x`;
  }
  if (ip.includes(':')) {
    return `${ip.split(':').slice(0, 3).join(':')}:x`;
  }
  return 'masked';
}

function classifyUserAgent(userAgent) {
  if (!userAgent) return 'unknown';
  if (BOT_UA_RE.test(userAgent)) return 'bot';
  if (SCRIPT_UA_RE.test(userAgent)) return 'script';
  if (MOBILE_UA_RE.test(userAgent)) return 'mobile-browser';
  if (/\b(chrome|safari|firefox|edg|opr)\b/i.test(userAgent)) return 'desktop-browser';
  return 'other';
}

function baseFields(request, route) {
  const userAgent = request.headers.get('user-agent') || '';
  return {
    route,
    method: request.method,
    requestId: request.headers.get('x-request-id') || null,
    vercelId: request.headers.get('x-vercel-id') || null,
    ip: maskIp(getClientIp(request)),
    uaClass: classifyUserAgent(userAgent),
  };
}

export function startRequestDiagnostics(request, route) {
  const context = {
    startedAt: Date.now(),
    fields: baseFields(request, route),
  };
  console.info(JSON.stringify({
    level: 'info',
    event: 'request_start',
    ...context.fields,
  }));
  return context;
}

export function finishRequestDiagnostics(context, { status, extra } = {}) {
  console.info(JSON.stringify({
    level: 'info',
    event: 'request_done',
    ...context.fields,
    status,
    durationMs: Date.now() - context.startedAt,
    ...(extra || {}),
  }));
}

export function failRequestDiagnostics(context, error, { status = 500, extra } = {}) {
  console.error(JSON.stringify({
    level: 'error',
    event: 'request_error',
    ...context.fields,
    status,
    durationMs: Date.now() - context.startedAt,
    error: error?.message || String(error || 'unknown_error'),
    ...(extra || {}),
  }));
}
