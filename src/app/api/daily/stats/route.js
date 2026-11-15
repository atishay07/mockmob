import { dailyHandlers } from '@/lib/server/dailyFiveDeps';

// GET /api/daily/stats?day=<n>: how everyone did on today's five, per question: the share of signed-in students who got it
// right, only from 30 students up (null below). Public (guests see it too), aggregate only, never a rank. Counted on the
// server at most every five minutes and cached by the CDN for five (src/lib/server/dailyFiveAccount.js).
export const dynamic = 'force-dynamic';

export const GET = (request) => dailyHandlers().getStats(request);
