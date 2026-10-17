'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';

// Decorative miniature of the NTA-style console in Practice's NTA mode panel. It is a picture, hidden from
// assistive tech. Owner N8 (17 Oct night): its motion must be continuous and its timer must always run, so one
// 1 s heartbeat drives both: the clock counts down from 60:00 and the current-question ring steps through the
// palette, without stopping or restarting while it is on screen. Off screen or in a hidden tab the heartbeat
// pauses where it is and carries on from there (nobody sees it pause). Reduced motion: a still 60:00 and no ring.
// Owner N7: a subject name too long for the bar uses its short form (Computer Science / Informatics Practices is
// "CS/IP"), so the bar never pushes the clock out of the picture.
const PALETTE = ['a', 'a', 'v', 'a', 'm', 'n', 'a', 'v', 'n', 'a', 'a', 'n', 'v', 'n', 'n'];
const START = 60 * 60;
const SHORT_NAMES = { computer_science: 'CS/IP', informatics_practices: 'CS/IP' };

export function consoleSubjectName(name = '', id = '') {
  if (SHORT_NAMES[id]) return SHORT_NAMES[id];
  if (/computer science/i.test(name) && /informatics/i.test(name)) return 'CS/IP';
  return name;
}

const subscribeMotion = (onChange) => {
  const query = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  query?.addEventListener?.('change', onChange);
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-motion'] });
  return () => { query?.removeEventListener?.('change', onChange); observer.disconnect(); };
};
const reduced = () => {
  if (typeof window === 'undefined') return false;
  if (document.documentElement.dataset.motion === 'reduced') return true;
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || false;
};

export default function NtaConsolePreview({ subject = 'Accountancy', subjectId = '' }) {
  const ref = useRef(null);
  const [onScreen, setOnScreen] = useState(false);
  const [pageVisible, setPageVisible] = useState(true);
  // Still on the server and in the first paint; the client's own setting takes over right after.
  const still = useSyncExternalStore(subscribeMotion, reduced, () => true);
  const [beat, setBeat] = useState(0);
  const awake = onScreen && pageVisible && !still;

  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === 'undefined') return undefined;
    // Any visible pixel keeps it running: a partial scroll never freezes the clock mid-view.
    const observer = new IntersectionObserver(([entry]) => setOnScreen(entry.isIntersecting), { threshold: 0 });
    observer.observe(node);
    const onVisibility = () => setPageVisible(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', onVisibility);
    return () => { observer.disconnect(); document.removeEventListener('visibilitychange', onVisibility); };
  }, []);

  useEffect(() => {
    if (!awake) return undefined;
    const timer = window.setInterval(() => setBeat((b) => (b + 1) % START), 1000);
    return () => window.clearInterval(timer);
  }, [awake]);

  const left = START - beat;
  const mm = String(Math.floor(left / 60)).padStart(2, '0');
  const ss = String(left % 60).padStart(2, '0');
  const current = still ? -1 : beat % PALETTE.length;
  return (
    <span ref={ref} className="pr-nta__console" aria-hidden="true" data-awake={awake}>
      <span className="pr-nta__bar"><b>{consoleSubjectName(subject, subjectId)}</b><u className="pr-nta__clock">{mm}:<span key={still ? 'still' : ss} className="pr-nta__sec">{ss}</span></u></span>
      <span className="pr-nta__body">
        <span className="pr-nta__q"><i /><i /><i data-short="true" /></span>
        <span className="pr-nta__palette">{PALETTE.map((state, k) => <em key={k} data-s={state} data-cur={k === current || undefined} />)}</span>
      </span>
    </span>
  );
}
