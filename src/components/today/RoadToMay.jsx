"use client";

// "The road to May": how far the expected CUET window is, and where registration and boards fall on the way.
// Calendar arithmetic only (todayModel.mjs roadToMay): no projection of marks or chances, and every date is
// tagged Expected because NTA has not published the 2027 bulletin. Each stop is drawn by its real dates
// between today and the end of the window, so the overlap of boards and registration is visible.
// One authored moment: the bars grow in as the section scrolls into view (about 320 ms, ease-out). Reduced
// motion shows them at once, and nothing loops.
import { useEffect, useMemo, useState } from 'react';
import { useInView } from '@/lib/motion/useInView';
import { useMobiPrefs } from '@/lib/mobiPrefs';
import { roadToMay } from './todayModel.mjs';
import './today.css';

export default function RoadToMay() {
  const { reduced } = useMobiPrefs();
  const [ref, inView] = useInView({ threshold: 0.2 });
  // The device clock is read after mount so the server and the first client render agree.
  const [now, setNow] = useState(null);
  useEffect(() => { const timer = window.setTimeout(() => setNow(Date.now()), 0); return () => window.clearTimeout(timer); }, []);
  const road = useMemo(() => (now === null ? null : roadToMay(now)), [now]);
  if (!road) return null;
  const armed = inView || reduced;
  return (
    <section ref={ref} className="road" aria-labelledby="road-title" data-armed={armed ? 'true' : 'false'}>
      <h2 id="road-title" className="today__h">The road to May</h2>
      <p className="road__line">{road.headline}</p>
      <ol className="road__stops">
        {road.stops.map((stop, i) => (
          <li key={stop.id} className="road__stop" data-current={stop.current ? 'true' : 'false'} data-next={stop.id === road.nextId ? 'true' : 'false'}>
            <div className="road__text">
              <b>{stop.title}</b>
              <span>{stop.when}</span>
            </div>
            <div className="road__track" role="img" aria-label={`${stop.title}, ${stop.when}, expected, ${stop.eta === 'On now' ? 'on now' : stop.eta}`}>
              <span className="road__bar" style={{ left: `${stop.left}%`, width: `${stop.width}%`, '--road-i': i }} />
            </div>
            <div className="road__eta">
              <span>{stop.eta}</span>
              <small>{stop.tag}</small>
            </div>
          </li>
        ))}
      </ol>
      <p className="road__note">{road.note}</p>
    </section>
  );
}
