import { NextResponse } from 'next/server';
import { Database } from '@/../data/db';

const PRACTICE_RIVALS = [
  ['Aarav Sharma', 68, 2815],
  ['Ananya Iyer', 64, 2630],
  ['Vivaan Gupta', 61, 2485],
  ['Meera Nair', 59, 2320],
  ['Kabir Singh', 58, 2245],
  ['Ishita Verma', 56, 2110],
  ['Reyansh Patel', 55, 2040],
  ['Saanvi Rao', 54, 1965],
  ['Arjun Mehta', 53, 1890],
  ['Diya Chatterjee', 52, 1785],
  ['Rohan Das', 51, 1660],
  ['Tara Kapoor', 50, 1545],
].map(([name, tests, totalScore], index) => ({
  userId: `practice_rival_${index + 1}`,
  name,
  image: null,
  tests,
  totalScore,
  avg: Math.round(totalScore / tests),
  isSynthetic: true,
  label: 'Practice rival',
}));

function withPracticeRivals(rows = []) {
  const realRows = Array.isArray(rows) ? rows : [];
  return [...realRows, ...PRACTICE_RIVALS]
    .sort((a, b) => b.totalScore - a.totalScore);
}

export async function GET() {
  try {
    const leaderboard = await Database.getLeaderboard();
    return NextResponse.json(withPracticeRivals(leaderboard));
  } catch (e) {
    console.error('[api/leaderboard] GET failed:', e);
    return NextResponse.json({ error: 'Failed to load leaderboard' }, { status: 500 });
  }
}
