import io

p = 'src/components/daily/DailyFiveRow.jsx'
raw = io.open(p, encoding='utf-8', newline='').read()
crlf = '\r\n' in raw
s = raw.replace('\r\n', '\n')

a = s.index("  // One volt key in the block: the Sunday Mock's while a paper can be started")
b = s.index("function TodayRow() {")
new_block = r"""  // One volt key in the block: the Sunday Mock's while a paper can be started (12 hours a week), else the Daily Five's.
  // 26 Nov 2026 (owner: "this Daily 5 and Sunday mock, I really don't like its implementation right now"; the council's
  // verdict, tmp/council/2026-11-26-landing/verdict.md): ONE card in the calendar-page form he approved on 16 Nov, two
  // dated rows of one weight, no openers. Each row is a leaf of the calendar (its day and date), what it is in one line,
  // its state now, and one key. How each works lives on its own page (/daily, /sunday-mock).
  return (
    <div className="dwk dwk--cal" ref={ref}>
      <article className="dcal" aria-label="Daily Five and Sunday Mock">
        <section className="dcal__row" data-kind="daily" data-state={daily.state} aria-labelledby="dwk-daily">
          <Leaf date={today?.date || null} live />
          <div className="dcal__body">
            <h3 className="dwk-name" id="dwk-daily">Daily Five</h3>
            <p className="dcal__line">{CAL_COPY.daily}</p>
            {COLLEGE_DAILY ? <PlayingFor team={team} onOpen={() => setSheet(true)} /> : null}
            {/* The bubbles carry this device's state: shown once a question is answered (open, they would only repeat the 5). */}
            {marks ? <OmrFive marks={marks} current={current} label={omrLabel(marks, current)} /> : null}
            <p className="dwk-state">
              <StateMark mark={daily.state === 'played' ? 'done' : today ? 'open' : 'none'} />
              <span className="dwk-status">{daily.status || ' '}</span>
              <span className="dwk-when">{daily.when}</span>
            </p>
          </div>
          <Link href={daily.href} prefetch={false} className="dwk-key" data-lead={!sunday.open ? 'true' : 'false'}>{daily.go}</Link>
        </section>
        <section className="dcal__row" data-kind="sunday" data-state={sunday.phase} aria-labelledby="dwk-sunday">
          <Leaf date={sunday.week || null} />
          <div className="dcal__body">
            <h3 className="dwk-name" id="dwk-sunday">Sunday Mock</h3>
            <p className="dcal__line">{CAL_COPY.sunday}</p>
            <ul className="dwk-figs">
              {sunday.figures.map((f) => <li key={f.figure + f.unit}><b>{f.figure}</b>{f.unit ? <span>{f.unit}</span> : null}</li>)}
            </ul>
            <p className="dwk-state">
              <StateMark mark={sunday.open ? 'open' : sunday.phase === 'unknown' ? 'none' : 'soon'} />
              <span className="dwk-status">{sunday.status || ' '}</span>
              <span className="dwk-when">{sunday.when}</span>
            </p>
          </div>
          <Link href={sunday.href} prefetch={false} className="dwk-key" data-lead={sunday.open ? 'true' : 'false'}>{sunday.go}</Link>
        </section>
      </article>
      {COLLEGE_DAILY ? <CollegeSheet open={sheet} onClose={() => setSheet(false)} onChoose={(id) => { team.pick(id); setSheet(false); }} current={team.college} /> : null}
    </div>
  );
}

"""
s = s[:a] + new_block + s[b:]

# The leaf, before HomeBlock.
leaf = r"""const LEAF_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const LEAF_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** One leaf of a tear-off calendar for an IST date ("2026-11-26"): the day's name on its band, the date, the month. Before
 *  the clock is read (the server's page) the leaf stands at its full size with nothing written, so nothing moves when the
 *  date arrives. Decorative: the row's own words say the day. */
function Leaf({ date, live = false }) {
  const m = typeof date === 'string' ? date.match(/^(\d{4})-(\d{2})-(\d{2})$/) : null;
  const day = m ? new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))).getUTCDay() : null;
  return (
    <span className="dcal__leaf" data-live={live ? '' : undefined} aria-hidden="true">
      <span className="dcal__leaf-day">{m ? LEAF_DAYS[day] : ' '}</span>
      <b className="dcal__leaf-date">{m ? Number(m[3]) : ' '}</b>
      <span className="dcal__leaf-month">{m ? LEAF_MONTHS[Number(m[2]) - 1] : ' '}</span>
    </span>
  );
}

"""
c = s.index("function HomeBlock({ how = null }) {")
s = s[:c] + leaf + s[c:]
s = s.replace("function HomeBlock({ how = null }) {", "function HomeBlock() {")
s = s.replace("  return where === 'today' ? <TodayRow /> : <HomeBlock how={how} />;", "  return where === 'today' ? <TodayRow /> : <HomeBlock />;")
s = s.replace("export default function DailyFiveRow({ where = 'home', how = null }) {", "export default function DailyFiveRow({ where = 'home' }) {")
s = s.replace("import { COLLEGE_DAILY, DAILY_EG, DAILY_PRINT, HOW_OPEN, SUNDAY_HOW, SUNDAY_LINE_SHORT, dailyRow,", "import { CAL_COPY, COLLEGE_DAILY, dailyRow,")
s = s.replace("import { CalendarClock, ChevronDown, ChevronRight } from 'lucide-react';", "import { CalendarClock, ChevronRight } from 'lucide-react';")
io.open(p, 'w', encoding='utf-8', newline='').write(s.replace('\n', '\r\n') if crlf else s)
print('ok')
