"use client";
// The public page's one live part: when the next Sunday Mock opens, or that it is open now, in IST from this device's clock
// (src/lib/sundayMock.mjs; the window is the server's own rule). Drawn as the day on ink that the home page's calendar pages
// wear (16 Nov 2026; DailyParts.jsx CalendarDay): the Sunday's date large and a clock to 10:00 AM, or to 10:00 PM while it is
// open. The line under it says the same in words (and is what a screen reader hears). The page itself is static, so every
// part holds its size until the clock is read and never says a stale date.
import { CalendarDay, DailyClock, useDailyNow } from '@/components/daily/DailyParts';
import { sundayState, sundayWindow, timeLabel, windowLine } from '@/lib/sundayMock.mjs';

// The site writes a time of day in lower case ("10:00 am"); the shared helpers print AM and PM for the app.
const lower = (text) => text.replace(/(AM|PM)/g, (m) => m.toLowerCase());
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
      <CalendarDay
        solo
        on={open}
        status={open ? 'Open now' : 'Next one'}
        date={date}
        clock={<DailyClock ms={wait} label={open ? 'Closes in' : 'Opens in'} size="l" days />}
      />
      <p className="sm-next" aria-live="polite">{st ? lineAt(st) : ' '}</p>
    </div>
  );
}
