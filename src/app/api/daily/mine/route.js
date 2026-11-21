import { mineHandler } from '@/lib/server/dailyFiveDeps';

// GET /api/daily/mine: "Your five" (21 Nov 2026), today's Daily Five built from the signed-in student's own record: questions
// they had wrong, their weak chapters, one of their subjects (src/lib/server/dailyFiveMine.js has the rules; the contract is
// tmp/1121-stories/daily/CONTRACT.md). Signed in only, never cached. Each question is sealed like the shared five's, so
// POST /api/daily/check answers it with no new input. Anything that goes wrong answers personal false (200) and the page
// plays the shared five (GET /api/daily), which this route does not change.
export const dynamic = 'force-dynamic';

export const GET = (request) => mineHandler().getMine(request);
