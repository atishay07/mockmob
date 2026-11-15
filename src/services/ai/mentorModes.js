// L10 (15 Nov 2026): the modes a saved Ask Mobi conversation may record (mentor_sessions.metadata.mode): the chat route's
// (src/app/api/ai/mentor/chat/route.js VALID_MODES, kept equal by data/tests/ai_route_limits.test.mjs) and the panel's own
// 'guide'. Anything else a client sends is stored as 'guide', never as given.
export const MENTOR_MODES = Object.freeze(['mentor', 'autopsy', 'trap_drill', 'mistake_replay', 'battle', 'admission', 'revision', 'comeback', 'mock_plan']);
export const savedModeOf = (value) => (value === 'guide' || MENTOR_MODES.includes(value) ? value : 'guide');

// Decision 5 and L10 (15 Nov 2026): every /api/ai route answers its per-student limit before any database read. In memory
// unless PERSISTENT_LIMITS_ENABLED, and the in-memory one if the database cannot answer (rateLimit.js).
export const AI_ROUTE_LIMITS = Object.freeze({
  local: { route: '/api/ai/mentor/local', limit: 20 },
  sessionNew: { route: '/api/ai/mentor/session/new', limit: 20 },
  history: { route: '/api/ai/mentor/history', limit: 60 },
  context: { route: '/api/ai/context', limit: 30 },
  usage: { route: '/api/ai/usage', limit: 60 },
  credits: { route: '/api/ai/credits', limit: 120 },
  creditsOrder: { route: '/api/ai/credits/order', limit: 10 },
  creditsVerify: { route: '/api/ai/credits/verify', limit: 20 },
  actions: { route: '/api/ai/actions/execute', limit: 30 },
});
export const aiLimit = (name, userId) => ({ ...AI_ROUTE_LIMITS[name], keyParts: [userId], fallback: 'memory' });
