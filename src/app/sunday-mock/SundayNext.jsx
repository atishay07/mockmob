"use client";
// The public page's one live line: when the next Sunday Mock opens, or that it is open now, in IST from this device's clock
// (src/lib/sundayMock.mjs; the window is the server's own rule). The page itself is static, so the line holds its height
// until the clock is read and never says a stale date.
import { useEffect, useState } from 'react';
import { sundayState, timeLabel, windowLine } from '@/lib/sundayMock.mjs';

function lineAt(now) {
  const st = sundayState(now);
  if (st.phase === 'open') return `Open now, until ${timeLabel(st.closesAt)} IST today.`;
  return `Next: ${windowLine(st.phase === 'closed' ? st.next : st.week)} IST.`;
}

export default function SundayNext() {
  const [line, setLine] = useState('');
  useEffect(() => {
    const read = () => setLine(lineAt(Date.now()));
    const t = window.setTimeout(read, 0);
    const every = window.setInterval(read, 60_000);
    return () => { window.clearTimeout(t); window.clearInterval(every); };
  }, []);
  return <p className="sm-next" aria-live="polite">{line || ' '}</p>;
}
