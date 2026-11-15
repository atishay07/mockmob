import { dailyHandlers } from '@/lib/server/dailyFiveDeps';

// The Daily Five on the student's account (src/lib/server/dailyFiveAccount.js has the rules). Signed in.
//   GET   today's record on the account (or null), its keys and reasons once all five are answered, and the days played.
// There is no write here: the account's five is built only from the first check of each question (POST /api/daily/check).
export const dynamic = 'force-dynamic';

export const GET = (request) => dailyHandlers().getMe(request);
