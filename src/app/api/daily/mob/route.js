import { dailyHandlers } from '@/lib/server/dailyFiveDeps';

// GET /api/daily/mob?mob=<id>: the Mob den's Daily Five strip: which members played today's five, each as five right or wrong
// marks (no question), "not yet" for the others, in the den's member order. Signed in, a member of that Mob only; behind
// MOB_ENABLED like every Mob route (src/lib/server/dailyFiveAccount.js).
export const dynamic = 'force-dynamic';

export const GET = (request) => dailyHandlers().getMob(request);
