"use client";

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';

const QUICK_COST = 10;
const FULL_COST = 50;

export function CreditsRemainingModal({ open, credits, onClose }) {
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    // Lock background scroll without causing layout shift from the disappearing
    // scrollbar (matters on desktop; mobile already has overlay scrollbars).
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    const prevOverflow = document.body.style.overflow;
    const prevPaddingRight = document.body.style.paddingRight;
    document.body.style.overflow = 'hidden';
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      document.body.style.paddingRight = prevPaddingRight;
    };
  }, [open, onClose]);

  if (!open) return null;

  const safe = Math.max(0, Number.isFinite(credits) ? credits : 0);
  const quickRuns = Math.floor(safe / QUICK_COST);
  const fullRuns = Math.floor(safe / FULL_COST);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="credits-modal-title"
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(4, 6, 10, 0.72)',
        backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '24px',
        animation: 'mm-fade-in 160ms ease-out',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: '420px',
          background: 'linear-gradient(180deg, rgba(22,26,34,0.96), rgba(14,17,22,0.96))',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '20px',
          padding: '28px',
          boxShadow: '0 30px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(212,255,0,0.06) inset',
          animation: 'mm-pop-in 200ms cubic-bezier(.2,.9,.3,1.2)',
          fontFamily: 'var(--font-sans)',
          color: '#fff',
        }}
      >
        <div style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          marginBottom: '18px',
        }}>
          <span style={{
            display: 'inline-block',
            width: 6, height: 6, borderRadius: 999,
            background: '#d4ff00',
          }} aria-hidden />
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.18em',
            textTransform: 'uppercase', color: 'rgba(212,255,0,0.85)',
          }}>
            {'// wallet'}
          </div>
        </div>

        <h2
          id="credits-modal-title"
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 26, fontWeight: 700, lineHeight: 1.15,
            margin: 0, marginBottom: 6,
          }}
        >
          Credits Remaining
        </h2>

        <p style={{
          fontSize: 15, color: 'rgba(255,255,255,0.78)',
          margin: 0, marginBottom: 14,
        }}>
          You have <span style={{
            color: '#d4ff00', fontWeight: 700,
            fontVariantNumeric: 'tabular-nums',
          }}>{safe}</span> credits left.
        </p>

        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8,
          marginBottom: 18,
        }}>
          <div style={{
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 10, padding: '10px 12px',
            background: 'rgba(255,255,255,0.02)',
          }}>
            <div style={{
              fontFamily: 'var(--font-mono)', fontSize: 9,
              letterSpacing: '0.14em', textTransform: 'uppercase',
              color: '#71717a', marginBottom: 4,
            }}>Quick Practice · {QUICK_COST} cr</div>
            <div style={{
              fontFamily: 'var(--font-display)', fontSize: 20, color: '#fff',
              fontVariantNumeric: 'tabular-nums',
            }}>{quickRuns} run{quickRuns === 1 ? '' : 's'}</div>
          </div>
          <div style={{
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 10, padding: '10px 12px',
            background: 'rgba(255,255,255,0.02)',
          }}>
            <div style={{
              fontFamily: 'var(--font-mono)', fontSize: 9,
              letterSpacing: '0.14em', textTransform: 'uppercase',
              color: '#71717a', marginBottom: 4,
            }}>Full Mock · {FULL_COST} cr</div>
            <div style={{
              fontFamily: 'var(--font-display)', fontSize: 20, color: '#fff',
              fontVariantNumeric: 'tabular-nums',
            }}>{fullRuns} run{fullRuns === 1 ? '' : 's'}</div>
          </div>
        </div>

        <div style={{
          height: 8, borderRadius: 999,
          background: 'rgba(255,255,255,0.06)',
          overflow: 'hidden', marginBottom: 18,
        }}>
          <div style={{
            width: `${Math.min(100, (safe / 100) * 100)}%`,
            height: '100%',
            background: 'linear-gradient(90deg, #d4ff00, #b8e600)',
            transition: 'width 400ms ease',
          }} />
        </div>

        <p style={{
          fontSize: 13, color: 'rgba(255,255,255,0.6)',
          margin: 0, marginBottom: 22, lineHeight: 1.5,
        }}>
          Upgrade to Premium for <span style={{ color: '#fff', fontWeight: 600 }}>unlimited mocks</span>, Smart Practice, and NTA Mode.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Button
            variant="volt"
            size="md"
            onClick={() => { onClose?.(); router.push('/pricing'); }}
            style={{ width: '100%' }}
          >
            Upgrade Now
          </Button>
          <Button
            variant="outline"
            size="md"
            onClick={onClose}
            style={{ width: '100%' }}
          >
            Continue
          </Button>
        </div>
      </div>

      <style jsx global>{`
        @keyframes mm-fade-in {
          from { opacity: 0 } to { opacity: 1 }
        }
        @keyframes mm-pop-in {
          from { opacity: 0; transform: translateY(8px) scale(0.96) }
          to   { opacity: 1; transform: translateY(0)   scale(1) }
        }
      `}</style>
    </div>
  );
}
