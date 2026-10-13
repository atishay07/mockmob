"use client";

import ArenaPreviewClient from '../ArenaPreviewClient';

// Layered over the Arena preview's stub: only the two session endpoints leave the page, to the local
// test backend (?backend=http://localhost:3108, ?as=free|anon to change the student). Everything else
// stays with the stub, so nothing real is reached. ?e2eSeconds=N shortens the on-screen clock for
// time-up checks (the sealed session on the backend still allows 60 minutes). window.__ntaOffline = true
// makes those two calls fail like a dropped connection; window.__ntaLog records each call.
const FORWARD = new Set(['/api/sessions', '/api/attempts']);

function xhrFetch(url, { method, headers, body, signal }) {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open(method, url);
    for (const [name, value] of Object.entries(headers || {})) request.setRequestHeader(name, value);
    request.onload = () => resolve(new Response(request.responseText, { status: request.status, headers: { 'Content-Type': 'application/json' } }));
    request.onerror = () => reject(new TypeError('Failed to fetch'));
    signal?.addEventListener('abort', () => { request.abort(); reject(new DOMException('Aborted', 'AbortError')); }, { once: true });
    request.send(body);
  });
}

if (typeof window !== 'undefined' && !window.__ntaBackendFetch) {
  window.__ntaBackendFetch = true;
  window.__ntaLog = [];
  const stub = window.fetch.bind(window);
  window.fetch = async (input, init = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.url, window.location.origin);
    if (!FORWARD.has(url.pathname) || !window.location.pathname.startsWith('/preview/arena/nta')) return stub(input, init);
    const page = new URLSearchParams(window.location.search);
    const method = (init.method || 'GET').toUpperCase();
    const entry = { method, path: url.pathname, at: Date.now(), request: init.body ? JSON.parse(init.body) : null };
    window.__ntaLog.push(entry);
    if (window.__ntaOffline) { entry.offline = true; throw new TypeError('Failed to fetch'); }
    const as = page.get('as');
    const response = await xhrFetch(`${page.get('backend') || 'http://localhost:3108'}${url.pathname}${as ? `?as=${as}` : ''}`, { method, headers: init.headers, body: init.body, signal: init.signal });
    const text = await response.clone().text();
    entry.status = response.status;
    try { entry.response = JSON.parse(text); } catch { entry.response = text; }
    const seconds = Number(page.get('e2eSeconds'));
    if (method === 'POST' && url.pathname === '/api/sessions' && response.ok && (seconds > 0 || page.get('e2ePassage'))) {
      const body = JSON.parse(text);
      // ?e2ePassage=1 puts the first four questions under one real passage so the passage layout can be
      // inspected (the engine serves no passage set today); it changes what is shown, not what is scored.
      if (page.get('e2ePassage')) {
        const passage = JSON.parse(await xhrFetch(`${page.get('backend') || 'http://localhost:3108'}/__passage`, { method: 'GET', headers: {} }).then((r) => r.text()));
        body.questions.slice(0, 4).forEach((question, index) => Object.assign(question, { passageGroupId: passage.id, passageText: passage.text, passageTitle: passage.title, orderIndex: index + 1 }));
      }
      const started = Date.now();
      if (seconds > 0) {
        body.startedAt = new Date(started).toISOString();
        body.expiresAt = new Date(started + seconds * 1000).toISOString();
        body.serverNow = started;
      }
      return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    return response;
  };
}

export default function NtaBackendPreview() {
  return <ArenaPreviewClient candidatePathway={null} />;
}
