import io

# ---- daily-row.css: yesterday's pair goes, the calendar card comes
p = 'src/components/daily/daily-row.css'
s = io.open(p, encoding='utf-8', newline='').read()
a = s.index("/* ---------- The pair (owner, 24 Nov 2026")
s = s[:a].rstrip('\n') + "\n" + r"""
/* ---------- One calendar card (owner, 26 Nov 2026: "this Daily 5 and Sunday mock, I really don't like its implementation
   right now"; the council's verdict) ----------
   The calendar-page form he approved on 16 Nov, as ONE card: two dated rows of one weight, parted by a tear line. Each row
   is a leaf of the calendar, the feature's name, one line, its state now and one key. A phone stacks the rows (about half a
   screen with the head); from 720 px they stand side by side. Nothing here moves. */
.mm.lp .dcal {
  display: grid; min-width: 0; border: 1px solid var(--line-strong); border-radius: 22px; background: var(--paper-raised);
  box-shadow: 0 1px 2px rgb(42 32 16 / 0.05), 0 18px 40px -24px rgb(42 32 16 / 0.22);
}
html[data-theme='dark'] .mm.lp .dcal { box-shadow: 0 1px 2px rgb(0 0 0 / 0.3), 0 20px 44px -26px rgb(0 0 0 / 0.6); }
.mm.lp .dcal__row { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 14px; align-items: start; min-width: 0; padding: 18px; }
.mm.lp .dcal__row + .dcal__row { border-top: 2px dashed var(--line-strong); }
.mm.lp .dcal__body { display: grid; gap: 4px; align-content: start; min-width: 0; }
.mm.lp .dcal .dwk-name { font-size: 1.5rem; }
.mm.lp .dcal__line { margin: 0; color: var(--ink-2); font: 500 0.9375rem/1.4 var(--font-body); text-wrap: pretty; }
.mm.lp .dcal .dwk-figs { margin-top: 2px; }
.mm.lp .dcal .dwk-state { margin-top: 4px; }
.mm.lp .dcal .dt-omr { margin-top: 6px; }
.mm.lp .dcal__row > .dwk-key { grid-column: 1 / -1; min-height: 48px; margin: 0; }
/* The leaf: the day on its band, the date, the month. Today's band is solid ink; a day still to come is an outline. */
.mm.lp .dcal__leaf {
  display: grid; grid-template-rows: auto 1fr auto; justify-items: center; width: 60px; min-height: 80px; padding-bottom: 7px;
  border: 1.5px solid var(--ink); border-radius: 12px; background: var(--paper); overflow: hidden; text-align: center;
}
.mm.lp .dcal__leaf-day { width: 100%; padding: 3px 0 4px; border-bottom: 1.5px solid var(--ink); color: var(--ink); font: 700 0.8125rem/1.2 var(--font-body); }
.mm.lp .dcal__leaf[data-live] .dcal__leaf-day { background: var(--ink); color: var(--paper); }
.mm.lp .dcal__leaf-date { align-self: center; color: var(--ink); font: 800 1.75rem/1 var(--font-display); letter-spacing: -0.03em; font-variant-numeric: tabular-nums; }
.mm.lp .dcal__leaf-month { color: var(--ink-2); font: 600 0.8125rem/1.2 var(--font-body); }
@media (min-width: 720px) {
  .mm.lp .dcal { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .mm.lp .dcal__row { grid-template-rows: 1fr auto; gap: 18px; padding: 26px 28px; }
  .mm.lp .dcal__row + .dcal__row { border-top: 0; border-left: 2px dashed var(--line-strong); }
  .mm.lp .dcal .dwk-name { font-size: 1.875rem; }
  .mm.lp .dcal__line { font-size: 1rem; }
  .mm.lp .dcal__row > .dwk-key { width: 100%; max-width: 20rem; min-width: 0; justify-self: start; }
  .mm.lp .dcal__leaf { width: 68px; min-height: 88px; }
  .mm.lp .dcal__leaf-date { font-size: 2rem; }
}
"""
io.open(p, 'w', encoding='utf-8', newline='').write(s)

# ---- r19-home-b.css: the phone page says each thing once
p = 'src/app/r19-home-b.css'
s = io.open(p, encoding='utf-8', newline='').read()
s = s.rstrip('\n') + "\n" + r"""
/* ---- 26 Nov 2026: the phone page says each thing once (owner: "the website is a lot cluttered ... people on phones might
   be facing this a bit more"; the council's verdict, tmp/council/2026-11-26-landing/verdict.md). Counted on the page: the
   six features were named four times, the price three times. Under 720 px the hero keeps one line under the film, the
   colleges' emblems stand in DU Compass, the Statement is not drawn (OnlyWide.jsx takes it out), and DU Compass and
   pricing lose the lines that repeated each other. Wide screens are as they were. ---- */
.mm.lp .lp-hero__links > .lp-hero__fact { display: none; }
.mm.lp .lp-colleges--in { display: none; }
.mm.lp .lp-try__claim { display: none; }
.mm.lp .cl__all { display: none; }
@media (max-width: 719.98px) {
  .mm.lp .lp-hero .lp-strip { display: none; }
  .mm.lp .lp-hero__links > .lp-hero__tool { display: none; }
  .mm.lp .lp-hero__links > .lp-hero__fact {
    display: block; min-height: 44px; padding: 10px 0; color: var(--ink-2); font: 500 1rem/1.45 var(--font-body);
    text-decoration: none; text-wrap: pretty; -webkit-tap-highlight-color: transparent;
  }
  .mm.lp .lp-hero__links > .lp-hero__fact b { color: var(--ink); font-weight: 750; white-space: nowrap; }
  .mm.lp .lp-hero__links > .lp-hero__fact:focus-visible { outline: 2px solid var(--focus-ring, var(--ink)); outline-offset: 2px; border-radius: 6px; }
  .mm.lp #colleges { display: none; }
  .mm.lp .lp-colleges--in { display: block; margin: 0 calc(-1 * var(--gutter, 20px)) 0.875rem; }
  .mm.lp .lp-colleges--in .lp-colleges__note { margin: 0.5rem var(--gutter, 20px) 0; }
  .mm.lp .lp-statement { display: none; }
  .mm.lp .lp-try__claim { display: block; margin: 0.875rem 0 0; color: var(--ink-2); font: 500 0.9375rem/1.45 var(--font-body); text-align: center; text-wrap: balance; }
  /* DU Compass: five colleges across the list's range, the rest behind one key; the Pro lines live in pricing. */
  .mm.lp .cl__list[data-all='false'] > li:nth-child(even) { display: none; }
  .mm.lp .cl__all {
    display: inline-flex; align-items: center; justify-content: center; min-height: 44px; margin: 4px 0 0; padding: 0 2px; border: 0; background: none;
    color: var(--ink); font: 700 0.9375rem/1.2 var(--font-body); text-decoration: underline; text-decoration-color: var(--line-strong); text-underline-offset: 4px; cursor: pointer;
  }
  .mm.lp .cl__all:focus-visible { outline: 2px solid var(--focus-ring, var(--ink)); outline-offset: 2px; border-radius: 6px; }
  .mm.lp .lp-cpro { display: none; }
  /* Pricing: the price is said once (no "opens soon" second price), and one way to the full list (the opener). */
  .mm.lp #pricing .plan-stage__word { display: none; }
  .mm.lp #pricing .pro-plan__soon, .mm.lp #pricing .lp-price__soon { display: none; }
  .mm.lp #pricing .lp-plan__more { display: none; }
}
"""
io.open(p, 'w', encoding='utf-8', newline='').write(s)

# ---- CompassLadder.jsx: five rows on a phone, the rest behind one key
p = 'src/components/landing/CompassLadder.jsx'
raw = io.open(p, encoding='utf-8', newline='').read()
crlf = '\r\n' in raw
s = raw.replace('\r\n', '\n')
old = "  const [score, setScore] = useState(INITIAL_SCORE);\n"
assert old in s
s = s.replace(old, old + "  // Phones show every other college (five across the list's range) until the reader asks for all (26 Nov 2026).\n  const [all, setAll] = useState(false);\n", 1)
old = "          <ul className=\"cl__list\" style={{ '--fill': pct(INITIAL_SCORE) / 100 }}>"
assert old in s
s = s.replace(old, "          <ul className=\"cl__list\" data-all={all ? 'true' : 'false'} style={{ '--fill': pct(INITIAL_SCORE) / 100 }}>")
old = "          </ul>\n          <figcaption>"
assert old in s
s = s.replace(old, "          </ul>\n          {rows.length > 5 ? <button type=\"button\" className=\"cl__all\" aria-expanded={all} onClick={() => setAll((v) => !v)}>{all ? 'Show fewer colleges' : `Show all ${rows.length} colleges`}</button> : null}\n          <figcaption>")
io.open(p, 'w', encoding='utf-8', newline='').write(s.replace('\n', '\r\n') if crlf else s)
print('ok')
