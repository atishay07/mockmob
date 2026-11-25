import io, json

# ---- page.js
page = [
 ["import { Statement } from '@/components/landing/Statement';",
  "import { Statement } from '@/components/landing/Statement';\nimport { OnlyWide } from '@/components/landing/OnlyWide';"],
 ["        <DesktopNote />\n",
  "        {/* 26 Nov 2026 (council verdict, tmp/council/2026-11-26-landing): the \"works best on a laptop\" note is gone from the\n            home page. It was the first line a phone visitor read, and every sign-up comes from a phone. */}\n"],
 ["""              <Link href="/cuet-cutoff-calculator" prefetch={false} className="lp-hero__tool">Free DU eligibility and cutoff calculator</Link>""",
  """{/* Phones (26 Nov 2026, the council's verdict): the six features and the price sum under the film repeated what the
                  film, "One place" and pricing show. One line says the two facts a newcomer asks for; the strip and the
                  calculator link stay from 720 px. */}
              {PRICE_HOOK ? <a href={PRICE_HOOK.href} className="lp-hero__fact">Free to start. Unlimited mocks on Pro: <b>{PRICE_HOOK.line}</b></a> : null}
              <Link href="/cuet-cutoff-calculator" prefetch={false} className="lp-hero__tool">Free DU eligibility and cutoff calculator</Link>"""],
 ["        <Later><Statement text={STATEMENT} shelf={SHELF} note={`${SUBJECT_CLAIM.long}.`} /></Later>",
  "        {/* Wide screens only (26 Nov 2026): on a phone it was 1.7 screens restating the hero; its one fact, the subjects\n            claim, sits under the five questions there (lp-try__claim). */}\n        <Later><OnlyWide><Statement text={STATEMENT} shelf={SHELF} note={`${SUBJECT_CLAIM.long}.`} /></OnlyWide></Later>"],
 ["              <Reveal delay={100}><CompassLadder data={SHOWCASE} /></Reveal>",
  "              {/* Phones: the colleges' emblems stand here, beside the cutoffs that give them a reason (the strip under the\n                  hero is for wide screens). */}\n              <CollegeStrip place=\"compass\" />\n              <Reveal delay={100}><CompassLadder data={SHOWCASE} /></Reveal>"],
]
io.open('tmp/1126-final/e-page.json', 'w', encoding='utf-8').write(json.dumps(page))

# ---- CollegeStrip.jsx
strip = [
 ["""export function CollegeStrip({ rows = COLLEGE_ROWS }) {
  return (""",
  """export function CollegeStrip({ rows = COLLEGE_ROWS, place = 'top' }) {
  // Inside DU Compass (phones, 26 Nov 2026): the Delhi University colleges' row alone, under that section's own heading.
  if (place === 'compass') {
    const row = rows.find((r) => r.key === 'colleges') || rows[rows.length - 1];
    return (
      <div className="lp-colleges lp-colleges--in">
        <PauseOffscreen className="lp-colleges__rows">
          <div className={`lp-colleges__marquee lp-colleges__marquee--${row.key}`}>
            <div className="lp-colleges__track">
              {COPIES.map((copy) => (
                <ul key={copy} className="lp-colleges__list" aria-label={copy ? undefined : row.label} aria-hidden={copy ? 'true' : undefined}>
                  {row.items.map((college) => <Chip key={college.file} college={college} copy={copy} />)}
                </ul>
              ))}
            </div>
          </div>
        </PauseOffscreen>
        <p className="lp-colleges__note">{COLLEGE_NOTE}</p>
      </div>
    );
  }
  return ("""],
]
io.open('tmp/1126-final/e-strip.json', 'w', encoding='utf-8').write(json.dumps(strip))
