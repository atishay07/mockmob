import { NextResponse } from 'next/server';
import { Database } from '@/../data/db';
import { SUBJECTS } from '@/../data/subjects';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    const attempts = await Database.getAttempts(userId);

    // -------- Chapter-wise accuracy --------
    const byChapter = {};
    attempts.forEach(a => {
      (a.questionsSnapshot || []).forEach(q => {
        const d = a.details?.find(x => x.qid === q.id);
        if (!d) return;
        const key = `${a.subject}::${q.chapter}`;
        if (!byChapter[key]) {
          byChapter[key] = { subject: a.subject, chapter: q.chapter, correct: 0, total: 0 };
        }
        byChapter[key].total++;
        if (d.isCorrect === true) byChapter[key].correct++;
      });
    });

    const chapterRows = Object.values(byChapter).map(x => ({
      ...x,
      acc: x.total ? Math.round((x.correct / x.total) * 100) : 0,
    }));

    // Weakest chapters: need at least 3 attempts on that chapter to be meaningful.
    const weakChapters = chapterRows
      .filter(c => c.total >= 3)
      .sort((a, b) => a.acc - b.acc)
      .slice(0, 6);

    // Fallback if not enough data: show whatever we have.
    const weakChaptersFallback = weakChapters.length
      ? weakChapters
      : chapterRows.sort((a, b) => a.acc - b.acc).slice(0, 6);

    // -------- Subject-wise accuracy --------
    const bySubject = {};
    attempts.forEach(a => {
      if (!bySubject[a.subject]) bySubject[a.subject] = { total: 0, count: 0, correct: 0, totalQ: 0 };
      bySubject[a.subject].total += a.score;
      bySubject[a.subject].count += 1;
      bySubject[a.subject].correct += a.correct || 0;
      bySubject[a.subject].totalQ += a.total || 0;
    });

    const subjects = Object.entries(bySubject).map(([k, v]) => {
      const s = SUBJECTS.find(subj => subj.id === k);
      return {
        id: k,
        name: s ? s.short : k,
        avg: Math.round(v.total / v.count),
        accuracy: v.totalQ ? Math.round((v.correct / v.totalQ) * 100) : 0,
        tests: v.count,
      };
    });

    // -------- Timeline (chronological, oldest → newest) --------
    // DB returns desc order; reverse to chronological so T1 is the earliest test.
    const chronological = [...attempts].reverse();
    const timeline = chronological.map((a, i) => ({
      test: `T${i + 1}`,
      score: a.score,
      at: a.completedAt,
    }));

    // -------- Totals --------
    const totals = attempts.reduce((acc, a) => {
      acc.correct += a.correct || 0;
      acc.wrong += a.wrong || 0;
      acc.unattempted += a.unattempted || 0;
      return acc;
    }, { correct: 0, wrong: 0, unattempted: 0 });

    return NextResponse.json({
      weakChapters: weakChaptersFallback,
      subjects,
      timeline,
      totals,
      totalAttempts: attempts.length,
    });
  } catch (e) {
    console.error('[api/analytics] GET failed:', e);
    return NextResponse.json({ error: 'Failed to load analytics' }, { status: 500 });
  }
}
