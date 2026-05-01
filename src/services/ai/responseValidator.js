import { ALLOWED_ACTIONS, ALLOWED_CARD_TYPES } from './systemPrompt';

/**
 * Sanitise a mentor response so the UI never crashes on a malformed
 * model reply. We intentionally accept partial output and patch missing
 * fields rather than reject; fallback UX beats error UX.
 */
export function sanitizeMentorResponse(parsed, { fallbackReply } = {}) {
  const safe = {
    reply:
      typeof parsed?.reply === 'string' && parsed.reply.trim()
        ? parsed.reply.trim()
        : fallbackReply || 'I could not produce a clean recommendation just now. Try again in a moment.',
    confidence: clampInt(parsed?.confidence, 0, 100, 40),
    cards: [],
    actions: [],
  };

  if (Array.isArray(parsed?.cards)) {
    for (const raw of parsed.cards.slice(0, 4)) {
      if (!raw || typeof raw !== 'object') continue;
      const type = ALLOWED_CARD_TYPES.includes(raw.type) ? raw.type : 'recommendation';
      const title = typeof raw.title === 'string' ? raw.title.slice(0, 80).trim() : '';
      const body = typeof raw.body === 'string' ? raw.body.slice(0, 400).trim() : '';
      if (!title && !body) continue;
      safe.cards.push({
        type,
        title: title || 'Note',
        body,
        metadata: raw.metadata && typeof raw.metadata === 'object' && !Array.isArray(raw.metadata) ? raw.metadata : {},
      });
    }
  }

  if (Array.isArray(parsed?.actions)) {
    for (const raw of parsed.actions.slice(0, 4)) {
      if (!raw || typeof raw !== 'object') continue;
      if (!ALLOWED_ACTIONS.includes(raw.action)) continue;
      const label = typeof raw.label === 'string' ? raw.label.slice(0, 60).trim() : '';
      if (!label) continue;
      safe.actions.push({
        label,
        action: raw.action,
        params: raw.params && typeof raw.params === 'object' && !Array.isArray(raw.params) ? raw.params : {},
        creditCost: clampInt(raw.creditCost, 0, 99, 0),
        requiresPaid: Boolean(raw.requiresPaid),
      });
    }
  }

  return safe;
}

function clampInt(value, min, max, fallback) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(min, Math.min(max, Math.round(num)));
}

/**
 * Deterministic safe fallback used when AI completely fails.
 * Keeps the UI usable even with no model at all.
 */
export function buildFallbackMentorResponse({ context, mode = 'mentor', error } = {}) {
  const recentCount = context?.recentMockSummary?.attemptCount || 0;
  const reply =
    recentCount === 0
      ? "I don't have any mock data on you yet. Take one Quick Practice or Full Mock so I can read your speed and accuracy leaks, then ask me again."
      : `I'm temporarily unable to reach the model. Based on your last ${recentCount} attempt(s), the safest next move is to replay your weakest subject and run a short benchmark.`;

  const actions = [];
  if (recentCount === 0) {
    actions.push({
      label: 'Start a Quick Practice',
      action: 'create_next_mock',
      params: { mode: 'quick' },
      creditCost: 0,
      requiresPaid: false,
    });
  } else {
    actions.push({
      label: 'Run Daily Benchmark',
      action: 'launch_ai_rival',
      params: { rivalType: 'NORTH_CAMPUS_RIVAL' },
      creditCost: 0,
      requiresPaid: false,
    });
  }

  return {
    reply,
    confidence: 25,
    cards: [
      {
        type: 'warning',
        title: 'PrepOS degraded mode',
        body: error
          ? 'AI provider unreachable. You can still use benchmarks, mocks, and revision tools while we retry.'
          : 'I am running on a deterministic fallback. Refresh in a minute for a full diagnosis.',
        metadata: { mode, error: error || null },
      },
    ],
    actions,
  };
}
