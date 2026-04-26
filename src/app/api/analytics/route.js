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
    const scores = timeline.map((row) => row.score);
    const latestScore = scores.at(-1) || 0;
    const firstScore = scores[0] || 0;
    const bestScore = scores.length ? Math.max(...scores) : 0;
    const recentScores = scores.slice(-3);
    const previousScores = scores.slice(-6, -3);
    const recentAverage = recentScores.length
      ? Math.round(recentScores.reduce((sum, score) => sum + score, 0) / recentScores.length)
      : 0;
    const previousAverage = previousScores.length
      ? Math.round(previousScores.reduce((sum, score) => sum + score, 0) / previousScores.length)
      : firstScore;
    const scoreRange = scores.length ? Math.max(...scores) - Math.min(...scores) : 0;
    const momentum = recentAverage - previousAverage;
    const consistency = scores.length > 1
      ? Math.max(0, 100 - Math.round(scores.reduce((sum, score) => sum + Math.abs(score - latestScore), 0) / scores.length))
      : 0;

    // -------- Totals --------
    const totals = attempts.reduce((acc, a) => {
      acc.correct += a.correct || 0;
      acc.wrong += a.wrong || 0;
      acc.unattempted += a.unattempted || 0;
      return acc;
    }, { correct: 0, wrong: 0, unattempted: 0 });

    const totalQuestions = totals.correct + totals.wrong + totals.unattempted;
    const lifetimeAccuracy = totalQuestions ? Math.round((totals.correct / totalQuestions) * 100) : 0;
    const completionRate = totalQuestions ? Math.round(((totals.correct + totals.wrong) / totalQuestions) * 100) : 0;
    const negativePressure = totalQuestions ? Math.round((totals.wrong / totalQuestions) * 100) : 0;
    const focusScore = Math.max(0, Math.min(100, Math.round((lifetimeAccuracy * 0.55) + (consistency * 0.3) + (completionRate * 0.15))));
    const rankReadiness = Math.max(0, Math.min(100, Math.round((recentAverage * 0.45) + (lifetimeAccuracy * 0.25) + (consistency * 0.2) + (completionRate * 0.1))));

    const weakest = weakChaptersFallback[0];
    const strongest = [...chapterRows].sort((a, b) => b.acc - a.acc)[0];
    const secondWeakest = weakChaptersFallback[1];
    const lowConfidenceSubjects = subjects
      .filter((subject) => subject.tests >= 1)
      .sort((a, b) => a.accuracy - b.accuracy)
      .slice(0, 2);
    const recommendations = [
      weakest ? `Revise ${weakest.chapter} first; current accuracy is ${weakest.acc}%.` : 'Take two more mocks to unlock chapter recommendations.',
      strongest ? `Keep ${strongest.chapter} warm with a short mixed drill.` : 'Mix subjects to build a stronger radar profile.',
      latestScore < 60 ? 'Prioritize accuracy before speed in the next sprint.' : 'Add timed drills to convert accuracy into rank speed.',
      secondWeakest ? `Pair ${weakest.chapter} with ${secondWeakest.chapter} in one 20-question repair set.` : 'Use a mixed 15-question drill after your next full mock.',
      completionRate < 85 ? 'Reduce skips first; attempt confidence is currently limiting your real score.' : 'Your completion rate is strong. Push difficulty one level higher for the next drill.',
    ];
    const advanced = {
      readinessScore: rankReadiness,
      focusScore,
      recentAverage,
      momentum,
      scoreRange,
      completionRate,
      negativePressure,
      priorityStack: [
        weakest ? `${weakest.chapter}: highest recovery impact` : 'Generate chapter data with two more mocks',
        lowConfidenceSubjects[0] ? `${lowConfidenceSubjects[0].name}: lowest subject accuracy` : 'Add one more subject mock for comparison',
        scoreRange > 25 ? 'Score volatility is high; use shorter controlled drills' : 'Score volatility is stable enough for timed mocks',
      ],
      premiumMoves: [
        weakest ? `Ask Radar: why do I miss ${weakest.chapter} questions?` : 'Ask Radar: what should I practice today?',
        `Build a ${completionRate < 85 ? 'confidence-first' : 'speed-first'} mock recipe for the next session.`,
        lowConfidenceSubjects[0] ? `Compare ${lowConfidenceSubjects[0].name} mistakes against your strongest subject.` : 'Unlock subject-vs-subject trap analysis.',
      ],
    };

    return NextResponse.json({
      weakChapters: weakChaptersFallback,
      subjects,
      timeline,
      totals,
      totalAttempts: attempts.length,
      insights: {
        latestScore,
        bestScore,
        scoreDelta: latestScore - firstScore,
        consistency,
        recentAverage,
        momentum,
        scoreRange,
        completionRate,
        negativePressure,
        focusScore,
        rankReadiness,
        weakestChapter: weakest || null,
        strongestChapter: strongest || null,
        recommendations,
        advanced,
      },
    });
  } catch (e) {
    console.error('[api/analytics] GET failed:', e);
    return NextResponse.json({ error: 'Failed to load analytics' }, { status: 500 });
  }
}
