import { dailyHandlers } from '@/lib/server/dailyFiveDeps';

// POST /api/daily/check { token, pick: 'A'..'D', ms? }: one answer of today's Daily Five, checked on the server against the
// key sealed in the question's token (GET /api/daily sends no key). Answers { n, pick, right, correct, why, recorded }.
// Guests too (nothing is stored for them). Same origin, rate-limited, today (IST) only. Signed in, the first check of each
// question is recorded and stands: a retry or a second tab gets that first pick back (src/lib/server/dailyFiveAccount.js).
export const dynamic = 'force-dynamic';

export const POST = (request) => dailyHandlers().postCheck(request);
