"use client";

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Icon } from '@/components/ui/Icons';
import { Button } from '@/components/ui/Button';
import { PageSpinner, ErrorState } from '@/components/ui/Skeleton';
import { apiGet, apiPost } from '@/lib/fetcher';
import ScoreRecoveryLab from '@/components/ScoreRecoveryLab';
import MistakeReplay from '@/components/MistakeReplay';
import MistakeRepair from '@/components/recovery/MistakeRepair';
import SessionReadout from '@/components/ai/SessionReadout';
import { computePrepOSInsights } from '@/../data/prepos_insights';
import { AppIcon } from '@/components/ui/Glyph';
import { Mascot } from '@/components/brand/Mascot';
import ArenaHead from '@/components/arena/ArenaHead';

function displayValue(value, fallback = '') {
  if (value == null) return fallback;
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (typeof value === 'object') return value.text ?? value.label ?? value.name ?? value.key ?? fallback;
  return String(value);
}

function optionText(option) {
  return displayValue(option, 'Option');
}

/**
 * Result page — shows verdict, breakdown, and per-question review.
 * Fetches a single attempt by ID instead of pulling all user attempts.
 */
export default function ResultPageClient({ previewId = null }) {
  const params = useParams();
  const id = previewId || params.id;
  const router = useRouter();
  const [attempt, setAttempt] = useState(null);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all'); // all | correct | wrong | skipped
  const [reporting, setReporting] = useState({});
  const [reported, setReported] = useState({});
  const [reportError, setReportError] = useState(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let alive = true;
    queueMicrotask(() => { if (alive) { setAttempt(null); setError(null); setFilter('all'); setReporting({}); setReported({}); setReportError(null); } });
    apiGet(`/api/attempts/${id}`)
      .then(data => { if (alive) setAttempt(data); })
      .catch(e => { if (alive) setError(e.message); });
    return () => { alive = false; };
  }, [id, retry]);

  const filtered = useMemo(() => {
    if (!attempt) return [];
    return (attempt.questionsSnapshot || []).map((q) => {
      const d = (attempt.details || []).find(x => x.qid === q.id);
      const verdict = d?.isCorrect === true ? 'correct'
                    : d?.isCorrect === false ? 'wrong'
                    : 'skipped';
      return { q, d, verdict };
    }).filter(row => filter === 'all' || row.verdict === filter);
  }, [attempt, filter]);

  if (error)    return <div className="container-narrow student-page student-page--result pt-8"><ErrorState mascot message="This session did not load. Try again to see your recorded result." onRetry={() => { setError(null); setRetry((count) => count + 1); }} /></div>;
  if (!attempt) return <PageSpinner label="Loading your recorded result…" />;

  const isPass = attempt.score >= 40;
  const isStrong = attempt.score >= 70;
  const accuracy = attempt.total ? Math.round((attempt.correct / attempt.total) * 100) : 0;

  async function handleReport(row) {
    const qid = row?.q?.id;
    if (!qid || reporting[qid] || reported[qid]) return;
    const note = window.prompt('What looks wrong? Example: answer key, option text, explanation, or unclear wording.');
    if (note === null) return;

    setReportError(null);
    setReporting((current) => ({ ...current, [qid]: true }));
    try {
      await apiPost(`/api/questions/${encodeURIComponent(qid)}/interact`, {
        interaction_type: 'report',
        flow_context: 'review',
        session_id: attempt.id,
        metadata: {
          source: 'result_analysis',
          attempt_id: attempt.id,
          subject: attempt.subject,
          verdict: row.verdict,
          note: note.trim(),
          given_index: row.d?.givenIndex ?? null,
          correct_index: row.q?.correctIndex ?? null,
        },
      });
      setReported((current) => ({ ...current, [qid]: true }));
    } catch (e) {
      setReportError(e.message || 'Failed to report question.');
    } finally {
      setReporting((current) => {
        const next = { ...current };
        delete next[qid];
        return next;
      });
    }
  }

  return (
    <div className="container-narrow student-page student-page--result pb-20">
      <ArenaHead eyebrow="Result · recorded session" title="Your session, in detail." lede="Check the answers, read the reasoning and choose what to practise next." />
      <ScoreRecoveryLab attempt={attempt} />
      <MistakeReplay attemptId={attempt.id} />
      {/* ---------- Verdict hero ---------- */}
      <div className="text-center mb-10 pt-6 relative">
        <div className={`absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 rounded-full blur-[80px] opacity-10 ${isPass ? 'bg-volt' : 'bg-red-500'}`} />
        <div className="relative z-10">
          <div className="mono-label mb-4">Session complete</div>
          <div className="pip-drill-result"><Mascot pose={isPass ? 'celebrating' : 'encouraging'} alt={isPass ? 'Pip celebrating a finished session.' : 'Pip encouraging you after a hard session.'} /></div>
          <p className="display-xl mb-3 leading-none" style={{ color: isPass ? 'var(--a-accent-text, var(--volt))' : 'var(--a-bad-text, #f87171)', fontVariantNumeric: 'tabular-nums' }}>
            {attempt.score}%
          </p>
          <div className="text-zinc-400 text-lg">
            {isStrong ? 'A strong session. Check what still cost you marks below.'
              : isPass ? 'A solid session. The chapters below show where to push next.'
              : 'A hard one. The review below shows exactly where it went.'}
          </div>
        </div>
      </div>

      {/* ---------- Breakdown ---------- */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8 text-center">
        <div className="glass p-4">
          <div className="text-2xl font-display font-bold text-volt mb-1" style={{ fontVariantNumeric: 'tabular-nums' }}>{attempt.correct}</div>
          <div className="mono-label">Correct</div>
        </div>
        <div className="glass p-4">
          <div className="text-2xl font-display font-bold text-red-400 mb-1" style={{ fontVariantNumeric: 'tabular-nums' }}>{attempt.wrong}</div>
          <div className="mono-label">Wrong</div>
        </div>
        <div className="glass p-4">
          <div className="text-2xl font-display font-bold text-zinc-400 mb-1" style={{ fontVariantNumeric: 'tabular-nums' }}>{attempt.unattempted}</div>
          <div className="mono-label">Skipped</div>
        </div>
        <div className="glass p-4">
          <div className="text-2xl font-display font-bold text-white mb-1" style={{ fontVariantNumeric: 'tabular-nums' }}>{accuracy}%</div>
          <div className="mono-label">Accuracy</div>
        </div>
      </div>

      <SessionReadout attempt={attempt} />

      {/* ---------- One next step, from this session's record only ---------- */}
      {(() => {
        // Same pure engine as the readout above and PrepOS, so this page never contradicts
        // itself: a chapter is named only once it has enough answered questions to rank.
        const top = computePrepOSInsights([attempt]).chapters?.ranked?.[0];
        const topChapter = top?.chapter;
        const practise = (chapter) => router.push(`/test?subject=${encodeURIComponent(attempt.subject)}&count=10&mode=quick${chapter ? `&chapter=${encodeURIComponent(chapter)}` : ''}&generationKey=${crypto.randomUUID()}`);
        const reason = topChapter
          ? `${top.wrong} wrong and ${top.skip} blank out of ${top.n} questions in ${topChapter}: the most marks open in this session. A short set there is the most direct next step.`
          : attempt.wrong + attempt.unattempted > 0
            ? 'One session is too short to rank chapters, so the next step is another short set in the same subject. Your record ranks chapters once each has 4 or more answers.'
            : 'Every question in this session was answered correctly. Another set keeps the record growing.';
        return (
          <section className="result-next" aria-labelledby="result-next-title">
            <div className="result-next__copy">
              <p className="eyebrow">Next step</p>
              <h2 id="result-next-title">{topChapter ? `Practise ${topChapter}` : 'Practise another set'}</h2>
              <p>{reason}</p>
            </div>
            <div className="result-next__actions">
              <Button variant="volt" onClick={() => practise(topChapter)}>
                <AppIcon name="practice" size={18} /> {topChapter ? 'Practise this chapter' : 'Practise 10 more'}
              </Button>
              {attempt.wrong > 0 ? <Link href="/review" className="result-next__link"><AppIcon name="review" size={16} />Review mistakes</Link> : null}
              <Link href="/saved" className="result-next__link"><AppIcon name="saved" size={16} />Saved questions</Link>
              <Link href="/analytics" className="result-next__link"><AppIcon name="radar" size={16} />Open Radar</Link>
              <Link href="/dashboard" className="result-next__link result-next__link--back"><AppIcon name="practice" size={16} />Back to Practice</Link>
            </div>
          </section>
        );
      })()}

      {reportError && (
        <div role="alert" className="mb-5 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {reportError}
        </div>
      )}

      {/* ---------- Filter tabs ---------- */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="eyebrow">{'Post-match review'}</div>
        <div className="flex gap-1.5 flex-wrap" role="group" aria-label="Filter session review">
          {[
            { id: 'all',     label: `All ${attempt.total}` },
            { id: 'correct', label: `Correct ${attempt.correct}` },
            { id: 'wrong',   label: `Wrong ${attempt.wrong}` },
            { id: 'skipped', label: `Skipped ${attempt.unattempted}` },
          ].map(t => (
            <button
              key={t.id}
              type="button"
              aria-pressed={filter === t.id}
              onClick={() => setFilter(t.id)}
              className={`count-btn ${filter === t.id ? 'active' : ''}`}
              style={{ width: 'auto', padding: '0 14px', whiteSpace: 'nowrap' }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <p className="mb-4 text-xs text-zinc-500">
        If a question looks wrong, report the specific issue. Uncertain questions stay held while their checks are resolved.
      </p>

      {/* ---------- Review list ---------- */}
      <div className="flex flex-col gap-4">
        {filtered.length === 0 ? (
          <div className="glass p-8 text-center text-zinc-500 text-sm">
            Nothing in this bucket.
          </div>
        ) : filtered.map(({ q, d, verdict }, i) => {
          const isCorrect = verdict === 'correct';
          const isWrong   = verdict === 'wrong';
          const isReporting = !!reporting[q.id];
          const isReported = !!reported[q.id];

          return (
            <div
              key={q.id}
              className="glass p-6"
              style={{
                borderColor: isCorrect ? 'rgba(210,240,0,0.3)'
                          : isWrong   ? 'rgba(248,113,113,0.3)'
                          :             'rgba(255,255,255,0.08)',
              }}
            >
              <div className="flex items-start gap-4 mb-4 flex-wrap">
                <div className={`w-8 h-8 shrink-0 rounded-full flex items-center justify-center font-bold text-black ${isCorrect ? 'bg-volt' : isWrong ? 'bg-red-400' : 'bg-zinc-600'}`}>
                  {isCorrect ? <Icon name="check" /> : isWrong ? <Icon name="x" /> : '—'}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex gap-2 items-center mb-1 flex-wrap">
                    <span className="mono-label">Q{i + 1}</span>
                    <span className="pill subtle">{displayValue(q.chapter, 'Chapter')}</span>
                    {q.difficulty && <span className="pill subtle">{displayValue(q.difficulty)}</span>}
                  </div>
                  <p className="text-lg leading-relaxed">{displayValue(q.question ?? q.body, 'Question unavailable')}</p>
                </div>
                <button
                  type="button"
                  className="btn-outline sm shrink-0"
                  disabled={isReporting || isReported}
                  onClick={() => handleReport({ q, d, verdict })}
                >
                  {isReported ? 'Reported' : isReporting ? 'Sending...' : 'Report'}
                </button>
              </div>

              <div className="pl-12 flex flex-col gap-2">
                {q.options.map((opt, j) => {
                  const isSelected = d?.givenIndex === j;
                  const isActuallyCorrect = q.correctIndex === j;
                  let cls = 'bg-white/5 border-white/10';
                  if (isActuallyCorrect) cls = 'bg-volt/10 border-volt text-volt';
                  else if (isSelected) cls = 'bg-red-500/10 border-red-500 text-red-400';

                  return (
                    <div key={j} className={`p-3 rounded-lg border ${cls} flex justify-between gap-3`}>
                      <span>{optionText(opt)}</span>
                      <span className="flex gap-2 text-[10px] font-mono shrink-0">
                        {isSelected && <span className="pill subtle">YOUR PICK</span>}
                        {isActuallyCorrect && <span className="pill volt">CORRECT</span>}
                      </span>
                    </div>
                  );
                })}

                {q.explanation && (
                  <div className="mt-4 p-4 bg-black/30 rounded-lg text-sm text-zinc-300 border border-white/5 leading-relaxed">
                    <span className="text-volt font-bold mr-2 mono-label">Explanation</span>
                    <div className="mt-2">{displayValue(q.explanation)}</div>
                  </div>
                )}
                {isWrong && Number.isInteger(d?.givenIndex) ? <MistakeRepair key={q.id} attemptId={attempt.id} questionId={q.id} /> : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
