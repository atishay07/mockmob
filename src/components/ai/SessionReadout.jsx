"use client";

// The result page's readout: where this session's marks went. Computed in the browser from
// the attempt already on screen with the same pure engine Your record uses. No request, no credits.
import { useMemo } from 'react';
import Link from 'next/link';
import { computePrepOSInsights, readout } from '../../../data/prepos_insights';
import { AppIcon } from '@/components/ui/Glyph';
import { RECORD_HREF } from '@/lib/navigation';
import './prepos.css';

const signed = (n) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '0');

export default function SessionReadout({ attempt }) {
  const { insights, findings } = useMemo(() => {
    const result = computePrepOSInsights([attempt]);
    return { insights: result, findings: readout(result, { limit: 3 }) };
  }, [attempt]);
  if (insights.state !== 'ready') return null;
  const { ledger } = insights;
  const right = ledger.gained / 5;
  const blank = ledger.openSkipped / 5;

  return (
    <section className="sr" aria-labelledby="sr-title">
      <div className="sr__head">
        <h2 id="sr-title"><AppIcon name="prepos" size={18} />Where your marks went</h2>
        <Link href={RECORD_HREF} className="sr__link">Open your record</Link>
      </div>
      <p className="sr__ledger">
        <b>{signed(ledger.net)} marks</b>
        <span>{right} right at +5, {ledger.penalty} wrong at −1{blank ? `, ${blank} blank` : ''}.</span>
      </p>
      {findings.length > 0 ? (
        <ul className="sr__list">
          {findings.map((f) => (
            <li key={f.id}><b>{f.headline}</b><span>{f.detail}</span></li>
          ))}
        </ul>
      ) : (
        <p className="sr__note">One session is too short to rank chapters. Finish a few more and your record will show the biggest leak.</p>
      )}
      <p className="sr__note">From this session only. Free to read, no credits used.</p>
    </section>
  );
}
