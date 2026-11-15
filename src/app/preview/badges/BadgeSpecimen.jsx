"use client";

// The specimen sheet (development only): the sixteen marks in their three states, at 40 px (a row) and 56 px (a strip), and
// one of each path at 152 px (a badge on its own). ?size=152 draws every badge large. Fixtures only.
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { BadgeStamp } from '@/components/Medal';
import { BADGE_PATHS, BADGE_STEPS } from '@/lib/studyBadges';
import '@/app/(app)/arena.css';
import '@/components/study-badges.css';

const SHARE = { sessions_10: 0.7, full_mocks_5: 0.6, repairs_5: 0.6, repairs_10: 0.3, repairs_25: 0.12, weeks_met_4: 0.25, run_weeks_3: 0.34, four_subjects: 0.75 };

function Sheet() {
  const params = useSearchParams();
  const big = params.get('size') === '152';
  return (
    <div className="app-shell" style={{ minHeight: '100vh', background: 'var(--a-bg)', color: 'var(--a-ink)', padding: '20px 16px 40px', fontFamily: 'var(--font-body)' }}>
      <h1 style={{ margin: '0 0 4px', font: '700 22px/1.2 var(--font-display)' }}>Badges: three states</h1>
      <p style={{ margin: '0 0 20px', fontSize: 13, color: 'var(--a-ink-3)' }}>Earned, next (with its count where one exists), not yet. Development preview.</p>
      {BADGE_PATHS.map((path) => (
        <section key={path.id} style={{ borderTop: '1px solid var(--a-line)', padding: '14px 0 18px' }}>
          <h2 style={{ margin: '0 0 10px', font: '700 16px/1.3 var(--font-display)' }}>{path.title}</h2>
          <div style={{ display: 'grid', gridTemplateColumns: big ? 'repeat(auto-fill, minmax(170px, 1fr))' : 'repeat(auto-fill, minmax(150px, 1fr))', gap: '14px 10px' }}>
            {BADGE_STEPS.filter((s) => s.path === path.id).map((s) => (
              <div key={s.id} style={{ display: 'grid', gap: 6 }}>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                  <BadgeStamp id={s.id} status="earned" size={big ? 'xl' : 'md'} />
                  <BadgeStamp id={s.id} status="next" size={big ? 'xl' : 'md'} fraction={SHARE[s.id] ?? null} />
                  <BadgeStamp id={s.id} status="later" size={big ? 'xl' : 'md'} />
                </div>
                {big ? null : (
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <BadgeStamp id={s.id} status="earned" size="lg" />
                    <BadgeStamp id={s.id} status="next" size="lg" fraction={SHARE[s.id] ?? null} />
                    <BadgeStamp id={s.id} status="later" size="lg" />
                  </div>
                )}
                <span style={{ fontSize: 12.5, color: 'var(--a-ink-2)' }}>{s.name}</span>
              </div>
            ))}
          </div>
        </section>
      ))}
      {big ? null : (
        <section style={{ borderTop: '1px solid var(--a-line)', paddingTop: 14 }}>
          <h2 style={{ margin: '0 0 10px', font: '700 16px/1.3 var(--font-display)' }}>On their own, 152 px</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            {['full_mocks_5', 'repairs_5', 'run_weeks_3', 'new_best'].map((id) => (
              <div key={id} style={{ display: 'flex', gap: 8 }}>
                <BadgeStamp id={id} status="earned" size="xl" />
                <BadgeStamp id={id} status="next" size="xl" fraction={SHARE[id] ?? null} />
                <BadgeStamp id={id} status="later" size="xl" />
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

export default function BadgeSpecimen() {
  return <Suspense fallback={null}><Sheet /></Suspense>;
}
