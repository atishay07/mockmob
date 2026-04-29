"use client";

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icons';
import { Button } from '@/components/ui/Button';
import { SkeletonCard, ErrorState } from '@/components/ui/Skeleton';
import { apiGet } from '@/lib/fetcher';
import { useAuth } from '@/components/AuthProvider';
import { buildAdmissionCompass } from '@/lib/admissionCompass';

const CATEGORIES = [
  ['general', 'General'],
  ['ews', 'EWS'],
  ['obc', 'OBC-NCL'],
  ['sc', 'SC'],
  ['st', 'ST'],
  ['pwd', 'PwD'],
];

const chanceStyles = {
  high: { color: '#d2f000', bg: 'rgba(210,240,0,.1)', border: 'rgba(210,240,0,.28)' },
  strong: { color: '#86efac', bg: 'rgba(134,239,172,.08)', border: 'rgba(134,239,172,.22)' },
  moderate: { color: '#fbbf24', bg: 'rgba(251,191,36,.08)', border: 'rgba(251,191,36,.22)' },
  reach: { color: '#fb923c', bg: 'rgba(251,146,60,.08)', border: 'rgba(251,146,60,.22)' },
  unlikely: { color: '#f87171', bg: 'rgba(248,113,113,.08)', border: 'rgba(248,113,113,.22)' },
};

function ChancePill({ chance }) {
  const style = chanceStyles[chance.tone] || chanceStyles.reach;
  return (
    <span
      className="pill"
      style={{ color: style.color, background: style.bg, border: `1px solid ${style.border}` }}
    >
      {chance.label}
    </span>
  );
}

function ProgressRow({ subject }) {
  const width = Math.min(100, Math.round((subject.completedMocks / subject.requiredMocks) * 100));
  return (
    <div className="glass p-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <div className="font-display font-bold text-white truncate">{subject.name}</div>
          <div className="mono-label mt-1">{subject.totalQuestions} question{subject.totalQuestions === 1 ? '' : 's'} attempted</div>
        </div>
        <div className={`pill ${subject.complete ? 'volt' : 'subtle'}`}>{subject.complete ? 'Done' : `${subject.mocksToUnlock} mock${subject.mocksToUnlock === 1 ? '' : 's'} left`}</div>
      </div>
      <div className="bar mb-3">
        <div className={`fill ${subject.complete ? 'fill-volt' : 'fill-amber'}`} style={{ width: `${width}%` }} />
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <div className="mono-label">Mocks</div>
          <div className="heading text-white" style={{ fontVariantNumeric: 'tabular-nums' }}>{subject.completedMocks}/{subject.requiredMocks}</div>
        </div>
        <div>
          <div className="mono-label">Avg</div>
          <div className="heading text-white" style={{ fontVariantNumeric: 'tabular-nums' }}>{subject.avgScore}%</div>
        </div>
        <div>
          <div className="mono-label">CUET</div>
          <div className="heading text-volt" style={{ fontVariantNumeric: 'tabular-nums' }}>{subject.subjectScore}/200</div>
        </div>
      </div>
    </div>
  );
}

export default function AdmissionCompassPageClient() {
  const { user, status: authStatus } = useAuth();
  const [subjects, setSubjects] = useState([]);
  const [attempts, setAttempts] = useState([]);
  const [category, setCategory] = useState('general');
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState(null);

  useEffect(() => {
    if (authStatus === 'loading' || !user?.id) return;
    let alive = true;
    async function load() {
      try {
        const [subs, atts] = await Promise.all([
          apiGet('/api/subjects'),
          apiGet(`/api/attempts?userId=${user.id}`),
        ]);
        if (!alive) return;
        setSubjects(Array.isArray(subs) ? subs : []);
        setAttempts(Array.isArray(atts) ? atts : []);
        setStatus('ready');
      } catch (e) {
        if (!alive) return;
        setError(e.message);
        setStatus('error');
      }
    }
    load();
    return () => { alive = false; };
  }, [authStatus, user]);

  const compass = useMemo(() => buildAdmissionCompass({ user, subjects, attempts, category }), [user, subjects, attempts, category]);
  const selectedSubjectId = compass.subjects.find((subject) => !subject.complete)?.id || compass.subjects[0]?.id;

  if (status === 'loading' || authStatus === 'loading') {
    return (
      <div className="view flex flex-col gap-3 md:gap-5">
        <div>
          <div className="eyebrow mb-2">{'// Admission Compass'}</div>
          <div className="h-7 md:h-10 w-64 md:w-80 max-w-full skeleton mb-2" />
          <div className="h-3 md:h-4 w-72 md:w-96 max-w-full skeleton" />
        </div>
        <SkeletonCard lines={4} />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <SkeletonCard lines={3} />
          <SkeletonCard lines={3} />
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return <ErrorState message={error} onRetry={() => window.location.reload()} />;
  }

  if (!compass.isPremium) {
    return (
      <div className="view">
        <div className="glass p-6 md:p-8 border-volt/20 relative overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-8 items-center">
            <div>
              <div className="eyebrow mb-3">{'// Premium predictor'}</div>
              <h1 className="display-md mb-3">Admission Compass is built for premium users.</h1>
              <p className="text-zinc-400 max-w-2xl leading-relaxed mb-5">
                Unlock DU college matching, mock CUET score bands, subject-course eligibility checks, category-aware targets, and AI-style improvement moves from your mock history.
              </p>
              <Link href="/pricing">
                <Button variant="volt" size="lg"><Icon name="zap" /> Go Premium</Button>
              </Link>
            </div>
            <div className="admission-preview">
              <div className="mono-label mb-3">Locked preview</div>
              <div className="preview-score">872<span>/1000</span></div>
              <div className="preview-card"><span>SRCC · B.Com (Hons)</span><b>Reach</b></div>
              <div className="preview-card"><span>Hansraj · Economics</span><b>Moderate</b></div>
              <div className="preview-card"><span>Venky · B.Com</span><b>High</b></div>
            </div>
          </div>
        </div>
        <style>{previewStyles}</style>
      </div>
    );
  }

  if (!compass.eligible) {
    return (
      <div className="view flex flex-col gap-5">
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <div className="eyebrow mb-2">{'// Admission Compass'}</div>
            <h1 className="display-md">Unlock your mock CUET predictor.</h1>
            <p className="text-sm text-zinc-500 mt-2">
              Complete at least {compass.requiredMocksPerSubject} mocks in each of your five selected subjects. Your current unlock progress is {compass.readiness}%.
            </p>
          </div>
          <Link href={`/test?subject=${selectedSubjectId || ''}&count=5`}>
            <Button variant="volt" size="md"><Icon name="play" /> Continue mocks</Button>
          </Link>
        </div>

        <div className="glass p-5 md:p-6">
          <div className="flex items-center justify-between mb-4 gap-3">
            <div>
              <div className="mono-label mb-1">Unlock progress</div>
              <div className="heading text-2xl text-white">{compass.completedSubjects}/{compass.requiredSubjects} subjects ready</div>
            </div>
            <div className="display-md text-volt" style={{ fontVariantNumeric: 'tabular-nums' }}>{compass.readiness}%</div>
          </div>
          <div className="bar">
            <div className="fill fill-volt" style={{ width: `${compass.readiness}%` }} />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
          {compass.subjects.map((subject) => <ProgressRow key={subject.id} subject={subject} />)}
        </div>

        <div className="glass p-5">
          <div className="eyebrow mb-2">{'// Why locked'}</div>
          <p className="text-sm text-zinc-400 leading-relaxed">
            The predictor needs a small mock history in every selected subject before it can estimate an out-of-1000 score. Once all five subjects reach 5 completed mocks, this page will switch into college and course matching.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="view flex flex-col gap-5">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div className="eyebrow mb-2">{'// Admission Compass'}</div>
          <h1 className="display-md">Your DU college predictor is live.</h1>
          <p className="text-sm text-zinc-500 mt-2">
            A transparent estimate from your mock history, subject fit, and course eligibility rules. Treat it as guidance, not an official cutoff.
          </p>
        </div>
        <label className="min-w-[210px]">
          <span className="mono-label mb-2 block">Category</span>
          <select className="select" value={category} onChange={(event) => setCategory(event.target.value)}>
            {CATEGORIES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4">
        <div className="glass p-5 md:p-6 border-volt/20">
          <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-6 items-center">
            <div>
              <div className="mono-label mb-2">Mock CUET score</div>
              <div className="compass-score">{compass.estimatedScore}<span>/{compass.maxScore}</span></div>
              <div className="mt-3 inline-flex pill" style={{ color: compass.scoreBand.color, background: 'rgba(255,255,255,.04)', border: `1px solid ${compass.scoreBand.color}55` }}>
                {compass.scoreBand.label} · {compass.scoreBand.range}
              </div>
            </div>
            <div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {compass.scoreBands.map((band) => (
                  <div key={band.id} className="score-band">
                    <span style={{ background: band.color }} />
                    <div>
                      <b>{band.label}</b>
                      <p>{band.range}</p>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-zinc-500 mt-4 leading-relaxed">
                Each selected subject contributes up to 200 marks. Volatility and recent trend slightly adjust the estimate so one lucky mock does not dominate the guidance.
              </p>
            </div>
          </div>
        </div>

        <div className="glass p-5 md:p-6">
          <div className="mono-label mb-3">AI analysis</div>
          <div className="flex flex-col gap-3">
            {compass.improvementMoves.map((move, index) => (
              <div key={move} className="flex gap-3">
                <span className="move-index">{index + 1}</span>
                <p className="text-sm text-zinc-300 leading-relaxed">{move}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
        {compass.subjects.map((subject) => (
          <div key={subject.id} className="glass p-4">
            <div className="mono-label mb-2 truncate">{subject.short || subject.name}</div>
            <div className="heading text-2xl text-white mb-3" style={{ fontVariantNumeric: 'tabular-nums' }}>{subject.subjectScore}/200</div>
            <div className="bar mb-3">
              <div className="fill fill-volt" style={{ width: `${Math.round((subject.subjectScore / 200) * 100)}%` }} />
            </div>
            <div className="text-xs text-zinc-500">{subject.accuracy}% accuracy · {subject.volatility} volatility</div>
          </div>
        ))}
      </div>

      <div className="glass p-5 md:p-6">
        <div className="flex items-start justify-between gap-3 mb-5 flex-wrap">
          <div>
            <div className="eyebrow mb-2">{'// Top 10 matches'}</div>
            <h2 className="heading text-[24px] text-white">College and course possibilities</h2>
          </div>
          <div className="pill volt">Subject fit + category targets</div>
        </div>

        <div className="grid grid-cols-1 gap-3">
          {compass.recommendations.map((item, index) => (
            <div key={`${item.college}-${item.course}`} className="college-row">
              <div className="rank">{index + 1}</div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="heading text-white text-lg">{item.college}</h3>
                  <span className="mono-label">{item.tier}</span>
                </div>
                <p className="text-sm text-zinc-400 mt-1">{item.course} · {item.stream}</p>
                <div className="flex items-center gap-2 flex-wrap mt-3">
                  <span className="pill subtle">Target {item.target}/1000</span>
                  <span className="pill subtle">Subject fit {item.subjectFit}%</span>
                  <span className="pill subtle">{item.scoreGap > 0 ? `${item.scoreGap} marks gap` : `${Math.abs(item.scoreGap)} marks over target`}</span>
                </div>
              </div>
              <div className="row-chance">
                <ChancePill chance={item.chance} />
                <div className="text-xs text-zinc-500 mt-2">{item.chance.range} band</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <style>{styles}</style>
    </div>
  );
}

const previewStyles = `
  .admission-preview { border: 1px solid rgba(255,255,255,.08); border-radius: 14px; background: rgba(0,0,0,.28); padding: 18px; }
  .preview-score { font-family: var(--font-display); font-weight: 900; font-size: 56px; line-height: 1; color: var(--volt); }
  .preview-score span { font-size: 18px; color: #71717a; }
  .preview-card { display: flex; justify-content: space-between; gap: 12px; padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,.06); color: #d4d4d8; font-size: 13px; }
  .preview-card:last-child { border-bottom: 0; }
  .preview-card b { color: var(--volt); }
`;

const styles = `
  .compass-score { font-family: var(--font-display); font-weight: 900; font-size: clamp(56px, 8vw, 86px); line-height: .9; color: var(--volt); letter-spacing: -0.03em; font-variant-numeric: tabular-nums; }
  .compass-score span { font-size: 22px; color: #71717a; letter-spacing: 0; }
  .score-band { display: flex; gap: 10px; align-items: center; padding: 10px; border: 1px solid rgba(255,255,255,.07); border-radius: 10px; background: rgba(255,255,255,.018); }
  .score-band span { width: 9px; height: 34px; border-radius: 999px; flex-shrink: 0; }
  .score-band b { display: block; color: #fff; font-size: 13px; font-family: var(--font-display); }
  .score-band p { color: #71717a; font-size: 11px; margin: 0; }
  .move-index, .rank { width: 28px; height: 28px; border-radius: 8px; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; background: rgba(210,240,0,.1); border: 1px solid rgba(210,240,0,.22); color: var(--volt); font-family: var(--font-display); font-weight: 900; font-size: 12px; }
  .college-row { display: grid; grid-template-columns: 34px 1fr auto; gap: 14px; align-items: center; padding: 14px; border-radius: 12px; border: 1px solid rgba(255,255,255,.07); background: rgba(255,255,255,.015); }
  .row-chance { min-width: 178px; text-align: right; }
  @media (max-width: 720px) {
    .college-row { grid-template-columns: 32px 1fr; }
    .row-chance { grid-column: 2; text-align: left; min-width: 0; }
  }
`;
