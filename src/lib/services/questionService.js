// ─── Question Service — Phase 1 API Integration Layer ───────────────────────
// All API calls for the feed, upload, and interaction surfaces live here.

// Session ID persisted for the lifetime of the browser tab.
let _sessionId = null;
function getSessionId() {
  if (_sessionId) return _sessionId;
  if (typeof window !== 'undefined') {
    let id = sessionStorage.getItem('mm_session_id');
    if (!id) {
      id = 'sess_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
      sessionStorage.setItem('mm_session_id', id);
    }
    _sessionId = id;
  }
  return _sessionId ?? 'ssr-session';
}

// ─── Upload ──────────────────────────────────────────────────────────────────
/**
 * POST /api/questions/upload
 * @param {{ subject, chapter, body, options, correct_answer, explanation, difficulty, tags }} payload
 * @returns {{ question_id, job_id, status, rule_violations }}
 */
export async function uploadQuestion(payload) {
  const res = await fetch('/api/questions/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw Object.assign(new Error(data.error || 'Upload failed'), { data, status: res.status });
  return data;
}

// ─── Explore Feed ─────────────────────────────────────────────────────────────
/**
 * GET /api/questions/explore
 * @param {{ subject: string, chapter?: string, limit?: number, cursors?: { easy, medium, hard } }} opts
 * @returns {{ questions: any[], next_cursors: { cursor_easy, cursor_medium, cursor_hard } }}
 */
export async function fetchFeed({ subject, chapter = '', limit = 15, cursors = {} }) {
  const p = new URLSearchParams({ subject, limit: String(limit) });
  if (chapter) p.set('chapter', chapter);
  if (cursors.easy   != null) p.set('cursor_easy',   String(cursors.easy));
  if (cursors.medium != null) p.set('cursor_medium', String(cursors.medium));
  if (cursors.hard   != null) p.set('cursor_hard',   String(cursors.hard));

  const res = await fetch(`/api/questions/explore?${p.toString()}`);
  const data = await res.json();
  if (!res.ok) throw Object.assign(new Error(data.error || 'Feed fetch failed'), { status: res.status });
  return data; // { questions, next_cursors }
}

// ─── Interact ─────────────────────────────────────────────────────────────────
/**
 * POST /api/questions/:id/interact
 * @param {string} questionId
 * @param {{ interaction_type: string, flow_context?: string, dwell_ms?: number, metadata?: object }} opts
 */
export async function interactWithQuestion(questionId, {
  interaction_type,
  flow_context = 'explore',
  dwell_ms = null,
  metadata = {},
}) {
  const body = {
    interaction_type,
    session_id: getSessionId(),
    flow_context,
    metadata,
  };
  // dwell_ms is REQUIRED for skip/shallow_bounce
  if (dwell_ms !== null) body.dwell_ms = dwell_ms;

  const res = await fetch(`/api/questions/${questionId}/interact`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) {
    // Swallow non-critical errors silently to not break UX
    console.warn('[interact] failed:', data.error ?? res.status);
    return null;
  }
  return data;
}

/**
 * POST /api/questions/:id/vote
 * @param {string} questionId
 * @param {'up'|'down'} voteType
 */
export async function voteOnQuestion(questionId, voteType) {
  const res = await fetch(`/api/questions/${questionId}/vote`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ vote_type: voteType }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw Object.assign(new Error(data.error || 'Vote failed'), { status: res.status, data });
  }
  return data;
}
