# The home hero: "CUET 2027.", the ways in and even lines (5 Nov 2026)

Night refinement packet P1, branch `web/1105-hero`. Owner items LK82 (the "CUET 2027." line's font and colours look weird),
LK83 and LK88 (sign up and log in lead; the dock must not change its words while you scroll), LK84 (even lines, no link
falling onto a line of its own), LK85 (the hero's rhythm). Decisions D1, D2 and D3 of `docs/brain/night-1105/SPEC.md`.

## User task

A 16-17-year-old, often new to CBT, lands on mockmob.in on a phone. In one glance: what MockMob is, that it is free to start,
and one obvious way in. A returning student finds "Log in" without hunting. Someone not ready to sign up can still try the
five sample questions first. Success test: the first key read is "Sign up free"; "Log in" is on the first screen and in the
dock; no key changes its words while reading; no line of copy trails a single word.

## D2: the "CUET 2027." line

### Three renders (same build, same copy; only the brand line differs)

| | Night 390x844 | Day 390x844 | Night 1440x900 | Night 360x640 |
|---|---|---|---|---|
| Sheets | `web-1105-hero/d2-390-night.jpg` | `web-1105-hero/d2-390-day.jpg` | `web-1105-hero/d2-1440-night.jpg` | `web-1105-hero/d2-360-night.jpg` |

Full-size originals (git-ignored): `tmp/night-1105/p1-hero/shots/d2/brand-{a,b,c}-hero-{390x844-night,390x844-day,1440x900-night,360x640-night}.png`.

- **A, volt tag.** "CUET 2027." in ink `#0B1000` on a `#D2F000` fill, a small radius, the line a step smaller (0.78 em).
- **B, true-volt text.** "CUET 2027." in `#D2F000` in Night and the deep olive `#3F5200` in Day; lining tabular figures;
  the line's tracking opened from -0.035/-0.04 em to -0.022 em.
- **C, ink with a short volt bar.** The line in ink like the other two, with a 1.25 em `#D2F000` bar under "CU".

### Scored against the four criteria

| Criterion | A tag | B true volt | C ink + bar |
|---|---|---|---|
| (a) reads as MockMob's own mark, not a coloured word | Reads as a sticker or highlighter label, and as button chrome (the owner's L-018: "CUET 2027" must not look like a button). Puts a second volt fill a few px above the volt "Sign up free" key, against one volt per screen (W-075). | The exact volt of Mobi, the logo's dot and the key: the line reads as the brand's own colour, one family with the key, where the old `#CDDD5A` read as a different, muddy lime. | The headline loses the brand colour the owner asked for in L-017; the bar under "CU" reads as a link underline or a tab marker (most of all at 1440). |
| (b) exactly the volt family | Yes (`#D2F000` fill, `#0B1000` ink) | Yes: `#D2F000` text in Night (14.6:1 on `#12110E`), `#3F5200` in Day (7.6:1 on `#F3EFE6`, 8.5:1 on raised paper) | Night yes; in Day the `#D2F000` bar on paper is 1.13:1 and nearly vanishes |
| (c) numerals look deliberate | Smaller line, figures fine | Lining tabular figures, tracking tuned so "2027" does not crowd | Same figures as B |
| (d) one line at 360 px | Yes | Yes (measured 1 line, 317 px column) | Yes, but the bar adds 0.16 em under line 1 and opens the h1's rhythm |

On (c): Bricolage's figures are lining by default and proportional; the font ships `tnum` (its GSUB features, read from
`src/app/fonts/BricolageGrotesque-Variable.woff2`: ccmp dnom frac locl numr pnum tnum), so `tabular-nums` really sets
"2027" on equal advances, and `lining-nums` only states the intent. The figures stay the display face's own (LK73 keeps the
fonts); what read as odd was the proportional fitting squeezed by the h1's -0.035/-0.04 em tracking.

**Picked: B.** It is the only one that keeps the owner's L-017 ask (the line in the brand colour) while removing what he
called weird: the colour is now the real brand volt (and its AA olive in Day), the figures are set, the line keeps the
display font and the three-line h1 (LK73). A fails (a) and the one-volt rule; C fails (a) and L-017, and fails (b) in Day.
Trade-off: true volt text is brighter than the old lamp-lit tone in Night. It is one line, the same colour as the key under
it, and the same rule the statement's accent words follow tonight (D4), so the page carries one green, not two.

Not changed here (other packets' files): `--brand-word` in `marketing-theme.css` still colours the tour's "MockMob" in the
position band (L-030) in the old `#CDDD5A` / `#526700`, and that sheet's own `.lp-title__brand` rule is now outranked by the
hero's. Moving `--brand-word` to `#D2F000` / `#3F5200` would put the page on one green; it is left to the integration.

Shipped in `src/app/hero-scene.css` (`.lp-hero .lp-title__brand`). Tests: L-017 in `data/tests/landing_checklist_1104.test.mjs`
(Night `#D2F000`, Day `#3F5200`, tabular figures, never `#CDDD5A`/`#526700`), `homeHero.test.mjs` LK70, and
`night_calm_1104.test.mjs` (C1 "volt is never a text colour" now excepts this one line, owner decision LK82).

## D1: the ways in

- Hero, guest: the volt **Sign up free** (`/signup`, or `/signup?next=%2Frecovery` once recovery is released), under it the
  secondary **Try 5 questions first** (same-page `/#try-practice`; DemoJump lands it on the sample), then one quiet line
  **Have an account? Log in** (the link's own box is 52x45 px on phones, 55x46 at 1440; keyboard Tab reaches it and shows the ring). Phones stack the keys at full width (56 px and 50 px);
  from 960 px they sit in a row at 58 px with the line under them. Signed in: one key, "Go to Practice" (or "Find my first
  gap"), nothing else. After the first sample answer the volt key still steps down to the secondary weight so the sample's
  "Next question" is the one volt in view (release 9); its words never change.
- Phone dock, guest: ghost **Log in** beside volt **Sign up free** (the volt key 1.5x wider), from the hero to the footer.
  `wayIn()` takes no sample state at all, and `LandingDock` subscribes to nothing but the signed-in state, so the dock cannot
  relabel (test: "the guest dock label never depends on the sample" in `landingWayIn.test.mjs`). No note line. It still
  waits for the hero's keys to leave (HeroDockGate), steps aside for the demo, the panels, the DU bar and the close band, and
  leaves at the footer. Day glass is near-solid paper (92 %, no saturation boost) so a dark card under it never greys the
  ghost key.
- Close band, guest: **Sign up free** and **Log in** (full width on phones, a row on desktop), "Free to start. No card
  needed." under them. Its words follow the actions: "Ready for your first mock?" / "Sign up free to keep every score and
  see what to fix next." (the old "Five questions. Your move." pointed at a sample the band no longer offers).
- The sample card's note: **No sign-up for these five.** (one line, no link). After the fifth answer the card's own end
  state still offers sign-up ("Start practising free", `/signup`), unchanged.

Alternatives considered: keeping "Try a CUET question" as the dock key until the five were answered (the 4 Nov rule) is
what LK88 rejects; one key "Sign up free" without "Log in" would hide the returning student's door on phones.

## D3: even lines

`landing.css` gives every paragraph and list line `text-wrap-style: pretty` and headings, subs, card notes and captions
`balance`, at zero specificity (`:where`), so a section's own rule still wins and `white-space: nowrap` lines stay single.
The hero lead and the fact lines are balanced ("MockMob is CUET UG mock tests / with a review that finds the chapter /
behind every mark you lose."), and every section sub (`.lp-sub`) is balanced. A word-by-word line scan of the whole page
(`tmp/night-1105/p1-hero/shoot.mjs scan`) found 12, 14, 14, 12 and 8 single-word last lines or link-alone lines at 360, 375,
390, 412 and 1440 before; after, 1, 0, 0, 1 and 0 real ones (plus one false hit at every width on the pricing "₹99 once",
mixed sizes on one baseline). The two left are inside other packets' sections: "Saved on this device." in the exam screen's
59 px status box at 360 (the exam screen is being rebuilt tonight, D6), and the Mistake Lab's repair rule "No deed: capital
earns nothing, a partner's loan earns 6%." at 412, which ends "6%." alone while its scene is on screen (303 px) although its
computed text-wrap-style is balance (at rest, 262 px, it breaks evenly): a question for whoever owns lab-cinema.css.

## Evidence and checks

- Owner: LK82-LK85, LK88 (5 Nov, `OWNER-FEEDBACK-2026-10-31-LEARN.md` on feat/app-and-web); L-017, L-018 (17 Oct ledger).
- UI standards: one dominant action (section 3), one volt per screen (W-075), no button chrome on a word (L-018), 44 px
  targets (section 9), no tracked all-caps label (the sample's readout head is now sentence case, section 4).
- Real Chrome (playwright-core, the shared lock), dev server on 3521, Night and Day: 360x640, 375x667, 390x844, 412x915,
  1440x900. The h1 starts at 9-11 % on phones; the lead ends at 41.7 % at 360x640 (LK70 limit 48 %) and 34.3 % at 390x844
  (limit 40 %); the volt key ends at 43.0 % at 390x844 (limit 46 %). Every hero key and the Log in link pass a hit-test at
  their centres; no sideways scroll. A real tap on "Try 5 questions first" brings the card on screen; after five real
  answers the dock still reads "Log in" and "Sign up free".
- Before and after: `web-1105-hero/after-390.jpg` (before Night, after Night and Day, the Day dock) and
  `web-1105-hero/after-1440.jpg`; full sets in `tmp/night-1105/p1-hero/shots/before/` and `.../shots/final/` (git-ignored).
- Not verified: the signed-in states (no sign-in on this machine; covered by source tests only).
