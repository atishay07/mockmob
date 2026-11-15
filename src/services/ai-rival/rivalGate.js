// L6, L9 (15 Nov 2026): Rival (the Shadow Benchmark) is off unless RIVAL_ENABLED is exactly 'true' (unset in production).
// Nothing links to it, nobody used it in 30 days, and its AI lines never ran. Off: /rival sends the student to /dashboard and
// POST /api/ai/rival/start and /submit answer 404 before any read. The code is kept, so the owner can turn it back on.
export const rivalEnabled = (env = process.env) => env.RIVAL_ENABLED === 'true';
