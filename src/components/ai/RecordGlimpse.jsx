"use client";

// From the student's record, under the shared next step on Today. It never creates a second plan:
// one line that explains why the step matters (with a link to the full record), and, when there
// are at least three papers of the same kind and length, how the real marks have moved.
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import { AppIcon } from '@/components/ui/Glyph';
import { apiGet } from '@/lib/fetcher';
import { useCountUp } from '@/lib/motion/useCountUp';
import { useInView } from '@/lib/motion/useInView';
import { deltaWords, layoutPoints, pickTrend } from '@/lib/paperTrend';
import { useInsights } from './useInsights';
import './prepos.css';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const dateWords = (ms) => { const d = new Date(ms); return `${d.getDate()} ${MONTHS[d.getMonth()]}`; };

// A mark that counts up to its real value once it is on screen: the first time from 0, after that it is
// remembered (the paper's id), so coming back shows it at once (pass 1016e WA-02, the app's M15).
function Mark({ id, value }) {
  const rolled = useCountUp(value, { from: 0, memoryKey: `paper-mark:${id}` });
  return <>{rolled}</>;
}

function PaperTrend() {
  const [items, setItems] = useState(null);
  const [ref, inView] = useInView({ threshold: 0.3 });
  useEffect(() => {
    let alive = true;
    apiGet('/api/attempts/summary?limit=50')
      .then((body) => { if (alive) setItems(Array.isArray(body?.items) ? body.items : []); })
      .catch(() => { if (alive) setItems([]); });
    return () => { alive = false; };
  }, []);
  const trend = useMemo(() => (items ? pickTrend(items) : null), [items]);
  const dots = useMemo(() => (trend ? layoutPoints(trend.points) : []), [trend]);
  if (!trend) return null;
  const line = dots.map((d, i) => `${i ? 'L' : 'M'}${d.x.toFixed(2)} ${(100 - d.y).toFixed(2)}`).join('');
  const last = dots.length - 1;
  return (
    <section ref={ref} className="pt" aria-label="Your recent papers" data-seen={inView ? 'true' : 'false'}>
      <header>
        <b>Your last {dots.length} {trend.subject} {trend.kind}</b>
        <p>Same length, {trend.total} questions. Marks out of {trend.maxMarks}. {deltaWords(trend.delta)}</p>
      </header>
      <div className="pt__plot" role="img" aria-label={`Marks, oldest to newest: ${dots.map((d) => d.marks).join(', ')}`}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" focusable="false"><path d={line} className="pt__line" /></svg>
        {dots.map((d, i) => (
          <span key={d.id} className="pt__dot" data-newest={i === last ? 'true' : 'false'} style={{ left: `${d.x}%`, bottom: `${d.y}%`, '--pt-i': i }} aria-hidden="true" />
        ))}
      </div>
      <ol className="pt__marks">
        {dots.map((d, i) => (
          <li key={d.id} data-newest={i === last ? 'true' : 'false'}>
            <b>{inView ? <Mark id={d.id} value={d.marks} /> : <span className="pt__hold">{d.marks}</span>}</b>
            <span>{dateWords(d.at)}</span>
            <span className="sr-only">{d.marks} marks on {dateWords(d.at)}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

// `state` hands in a read the page already made (Today shares one); `skip` leaves out findings the page
// already shows (Today's plan carries the chapter finding as its why).
// `finding={false}` leaves the finding to Weak chapters, where it lives, and shows only the paper trend.
export default function RecordGlimpse({ state: given = null, skip = [], link = true, finding = true }) {
  const { user } = useAuth();
  const own = useInsights(given ? null : user?.id);
  const state = given || own;
  const f = finding && state.status === 'ready' ? state.findings.find((x) => !skip.includes(x.id)) || null : null;
  return (
    <>
      {f ? (
        <aside className="rg" aria-label="From your record">
          <span className="rg__icon"><AppIcon name="prepos" size={16} /></span>
          <div>
            <b>{f.headline}</b>
            <p>{f.detail}</p>
            {link ? <Link href="/mentor?tab=record">See your full record</Link> : null}
          </div>
        </aside>
      ) : null}
      {user?.id ? <PaperTrend /> : null}
    </>
  );
}
