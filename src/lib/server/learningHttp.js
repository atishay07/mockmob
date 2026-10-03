import 'server-only';
import { auth } from '@/lib/auth';
import { checkPersistentRateLimit } from '@/lib/server/rateLimit';
export async function learningHttp(request, fn, write = false) {
  const headers = { 'Cache-Control': 'no-store' };
  try {
    const session = await auth(request);
    if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401, headers });
    if (!(await checkPersistentRateLimit(request, { route: '/api/learning', limit: 60, keyParts: [session.user.id] })).allowed) return Response.json({ error: 'Please wait a moment and try again.' }, { status: 429, headers });
    let body = null;
    if (write) { const text = await request.text(); if (text.length > 8000) return Response.json({ error: 'Response too large' }, { status: 413, headers }); body = JSON.parse(text); if (!body || typeof body!=='object' || Array.isArray(body)) throw new Error('INVALID_RESPONSE'); }
    return Response.json(await fn(session.user.id, body), { headers });
  } catch (error) {
    const message = error.message || 'LEARNING_UNAVAILABLE';
    const status = /NOT_FOUND/.test(message) ? 404 : /UNAVAILABLE|FAILED|AWAITING|CHANGED/.test(message) ? 503 : /CONFLICT/.test(message) ? 409 : 422;
    return Response.json({ error: message, message: /AWAITING|CONTENT|STORAGE/.test(message) ? 'This activity is temporarily unavailable. Your credits have not been used. Review your mistakes or choose ordinary practice.' : message.replaceAll('_', ' ') }, { status, headers });
  }
}
