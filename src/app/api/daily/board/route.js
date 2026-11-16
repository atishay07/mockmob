import { boardHandler } from '@/lib/server/dailyFiveDeps';

// GET /api/daily/board?day=<n>: the college board (17 Nov 2026, lane daily; src/lib/server/dailyTeam.js has the rules). Public
// and aggregate: today's colleges by how many signed-in students played for them (an average of right answers from 10 players,
// to the nearest half), the week's by days a player, the last Sunday Mock's by average marks (from 5 sitters up) and yesterday's most-picked
// wrong answer (from 30 answers up). Colleges and counts only, never a user id, a seat or one student's score. Counted on the
// server at most every five minutes and cached by the CDN for five, never past the day's end. No session is read: the page
// and the app know their own college and find its row.
export const dynamic = 'force-dynamic';

export const GET = (request) => boardHandler().getBoard(request);
