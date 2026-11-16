"use client";
// The public page's one live part: when the next Sunday Mock opens, or that it is open now, in IST from this device's clock
// (src/lib/sundayMock.mjs; the window is the server's own rule). 17 Nov 2026 (owner LK293: the ink date slab read as a
// rival's): drawn as the Daily Five's admit card is, on paper with an OMR sheet's timing marks: the state, the Sunday's date,
// its hours, and a clock to 10:00 am (or to 10:00 pm while it is open). The line under it says the same in words (and is what
// a screen reader hears). The page itself is static, so every part holds its size until the clock is read and never says a
// stale date.
import { DailyClock, useDailyNow } from '@/components/daily/DailyParts';
import { dateLabel, sundayState, sundayWindow, timeLabel, windowLine } from '@/lib/sundayMock.mjs';
import { LAST_START, OPENS } from './sundayHow.mjs';

// The site writes a time of day in lower case ("10:00 am"); the shared helpers print AM and PM for the app.
const lower = (text) => text.replace(/(AM|PM)/g, (m) => m.toLowerCase());
function lineAt(st) {
  if (st.phase === 'open') return lower(`Open now, until ${timeLabel(st.closesAt)} IST today.`);
  return lower(`Next: ${windowLine(st.phase === 'closed' ? st.next : st.week)} IST.`);
}

export default function SundayNext() {
  const now = useDailyNow(true);
  const st = now === null ? null : sundayState(now);
  const open = st?.phase === 'open';
  const date = !st ? null : st.phase === 'closed' ? st.next : st.week;
  const wait = !st ? null : open ? st.closesAt - now : sundayWindow(date).opensAt - now;
  return (
    <div className="sm-when">
      <div className="sm-ticket" data-open={open ? 'true' : 'false'} aria-hidden="true">
        <p className="sm-ticket__state">{!st ? ' ' : open ? 'Open now' : 'Next one'}</p>
        <p className="sm-ticket__date">{date ? dateLabel(date) : ' '}</p>
        <p className="sm-ticket__hours">{OPENS} to {LAST_START} IST</p>
        <DailyClock ms={wait} label={open ? 'Closes in' : 'Opens in'} size="l" days />
      </div>
      {/* The ticket is a picture; this line says the same in words, for a screen reader. */}
      <p className="sm-next sr-only" aria-live="polite">{st ? lineAt(st) : ' '}</p>
    </div>
  );
}
