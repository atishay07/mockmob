"use client";

import React, { useState, useEffect, useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, PointElement, LineElement,
  Title, Tooltip, Filler, RadialLinearScale, RadarController,
} from 'chart.js';
import { Line, Radar } from 'react-chartjs-2';
import { SkeletonCard, ErrorState, PageSpinner } from '@/components/ui/Skeleton';
import { apiGet } from '@/lib/fetcher';
import { useAuth } from '@/components/AuthProvider';

ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement,
  Title, Tooltip, Filler, RadialLinearScale, RadarController,
);
ChartJS.defaults.color = '#71717a';
ChartJS.defaults.font.family = '"Space Grotesk", sans-serif';

export default function AnalyticsPageClient() {
  const { user, status: authStatus } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (authStatus === 'loading') return;
    if (!user?.id) return;
    let alive = true;
    apiGet(`/api/analytics?userId=${user.id}`)
      .then(d => { if (alive) setData(d); })
      .catch(e => { if (alive) setError(e.message); });
    return () => { alive = false; };
  }, [user, authStatus]);

  const lineData = useMemo(() => data && ({
    labels: data.timeline.map(t => t.test),
    datasets: [{
      label: 'Score %',
      data: data.timeline.map(t => t.score),
      borderColor: '#d2f000',
      backgroundColor: 'rgba(210, 240, 0, 0.1)',
      borderWidth: 2,
      pointBackgroundColor: '#d2f000',
      fill: true,
      tension: 0.4,
    }],
  }), [data]);

  const radarData = useMemo(() => data && ({
    labels: data.subjects.map(s => s.name),
    datasets: [
      {
        label: 'Avg Score',
        data: data.subjects.map(s => s.avg),
        borderColor: '#d2f000',
        backgroundColor: 'rgba(210, 240, 0, 0.15)',
        borderWidth: 2,
        pointBackgroundColor: '#d2f000',
      },
      {
        label: 'Accuracy',
        data: data.subjects.map(s => s.accuracy ?? 0),
        borderColor: 'rgba(255,255,255,0.5)',
        backgroundColor: 'rgba(255,255,255,0.06)',
        borderWidth: 1,
        borderDash: [4, 4],
        pointBackgroundColor: 'rgba(255,255,255,0.6)',
      },
    ],
  }), [data]);

  const lineOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: { min: 0, max: 100, grid: { color: 'rgba(255,255,255,0.05)' } },
      x: { grid: { display: false } },
    },
    plugins: { legend: { display: false } },
  };

  const radarOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      r: {
        min: 0, max: 100,
        ticks: { display: false },
        grid: { color: 'rgba(255,255,255,0.1)' },
        angleLines: { color: 'rgba(255,255,255,0.1)' },
        pointLabels: { color: '#a1a1aa', font: { size: 11, family: '"Lexend", monospace' } },
      },
    },
    plugins: { legend: { display: true, labels: { color: '#a1a1aa', font: { size: 10 } } } },
  };

  if (error) return <div className="container-std pt-8"><ErrorState message={error} /></div>;
  if (authStatus === 'loading' || !data) {
    return (
      <div className="container-std pb-20">
        <div className="mb-8">
          <div className="eyebrow mb-2">{'// Weakness Radar'}</div>
          <div className="h-10 w-72 skeleton mb-2" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
          <div className="lg:col-span-2"><SkeletonCard className="h-[340px]" lines={8} /></div>
          <SkeletonCard className="h-[340px]" lines={6} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SkeletonCard lines={4} />
          <SkeletonCard lines={4} />
        </div>
      </div>
    );
  }

  const { timeline, weakChapters, subjects, totals, totalAttempts } = data;
  const totalQ = totals.correct + totals.wrong + totals.unattempted;
  const lifetimeAccuracy = totalQ ? Math.round((totals.correct / totalQ) * 100) : 0;

  return (
    <div className="container-std pb-20 view">
      <div className="mb-8 flex items-end justify-between flex-wrap gap-3">
        <div>
          <div className="eyebrow mb-2">{'// Weakness Radar'}</div>
          <h1 className="display-md text-white">Your Performance</h1>
          <p className="text-sm text-zinc-500 mt-1">Across {totalAttempts} test{totalAttempts === 1 ? '' : 's'} · {totalQ} question{totalQ === 1 ? '' : 's'} answered</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        <div className="lg:col-span-2 glass p-6 h-[340px] flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h3 className="heading">Score Trajectory</h3>
            {timeline.length > 1 && (
              <span className="mono-label" style={{ fontVariantNumeric: 'tabular-nums' }}>
                {timeline[0].score} → {timeline[timeline.length - 1].score}
              </span>
            )}
          </div>
          <div className="flex-1 relative">
            {timeline.length > 0
              ? <Line data={lineData} options={lineOptions} />
              : <div className="text-zinc-500 absolute inset-0 flex items-center justify-center">Drop your first test.</div>}
          </div>
        </div>

        <div className="glass p-6 h-[340px] flex flex-col">
          <h3 className="heading mb-4 text-center">Subject Mastery</h3>
          <div className="flex-1 relative">
            {subjects.length > 0
              ? <Radar data={radarData} options={radarOptions} />
              : <div className="text-zinc-500 absolute inset-0 flex items-center justify-center">Not enough data</div>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="glass p-6">
          <h3 className="heading mb-4 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500" /> Kill list · weak chapters
          </h3>
          {weakChapters.length === 0 ? (
            <p className="text-zinc-500 text-sm">Play more tests to generate this list.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {weakChapters.map((w, i) => (
                <div key={`${w.subject}::${w.chapter}::${i}`} className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm truncate">{w.chapter}</div>
                    <div className="mono-label">{w.subject} · {w.correct}/{w.total} correct</div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="w-24 h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full" style={{ width: `${w.acc}%`, background: w.acc < 40 ? '#f87171' : w.acc < 70 ? '#fbbf24' : 'var(--volt)' }} />
                    </div>
                    <div className="mono-label w-10 text-right" style={{ fontVariantNumeric: 'tabular-nums' }}>{w.acc}%</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="glass p-6">
          <h3 className="heading mb-4 text-white">Lifetime stats</h3>
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-zinc-400">Overall accuracy</span>
            <span className="font-display font-bold text-white" style={{ fontVariantNumeric: 'tabular-nums' }}>{lifetimeAccuracy}%</span>
          </div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-zinc-400">Total correct</span>
            <span className="font-display font-bold text-volt" style={{ fontVariantNumeric: 'tabular-nums' }}>{totals.correct}</span>
          </div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-zinc-400">Total wrong</span>
            <span className="font-display font-bold text-red-400" style={{ fontVariantNumeric: 'tabular-nums' }}>{totals.wrong}</span>
          </div>
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-zinc-400">Total skipped</span>
            <span className="font-display font-bold text-zinc-500" style={{ fontVariantNumeric: 'tabular-nums' }}>{totals.unattempted}</span>
          </div>

          {subjects.length > 0 && (
            <div className="mt-4 pt-4 border-t border-white/5">
              <div className="mono-label mb-2">By subject</div>
              <div className="flex flex-col gap-2">
                {subjects.map(s => (
                  <div key={s.id} className="flex items-center justify-between text-sm">
                    <span className="text-zinc-300">{s.name}</span>
                    <span className="text-xs text-zinc-500" style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {s.tests} test{s.tests === 1 ? '' : 's'} · {s.accuracy}% acc · avg {s.avg}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
