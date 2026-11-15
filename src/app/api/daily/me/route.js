import { dailyHandlers } from '@/lib/server/dailyFiveDeps';

// The Daily Five on the student's account (src/lib/server/dailyFiveAccount.js has the rules).
//   GET   today's record on the account (or null) and the days played. Signed in.
//   POST  { day, date, tokens: [5], answers: ['A'..'D' x5], ms }: save today's finished five. Signed in, same origin, a
//         persistent limit; today (IST) only; the five must be the tokens served today; scored by the server; the first
//         finished run stands (a reload, a second tab or a second phone never adds or changes a row).
export const dynamic = 'force-dynamic';

export const GET = (request) => dailyHandlers().getMe(request);
export const POST = (request) => dailyHandlers().postMe(request);
