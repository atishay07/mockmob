# Today: the road as a plain readout (pass 1017, night, owner item N1)

Supersedes section 4.4 of TODAY-1017.md (the strip and its tuners). Everything else in TODAY-1017 stands: the move card, its why line and its one volt key, Last paper and Your colleges.

## What he said (17 Oct, about 11 pm, N1, top priority)

- The calendar/road strip is "very confusing and very cluttered". When many weeks remain, only a few are in focus.
- The mock-count slider is "very poor": "I am not able to properly understand what exactly to do here".
- He does not want this layout for Today in the app either. "Think of something more intuitive."

## Why the strip failed

- **It was a chart to decode.** 29 weeks squeezed into one width gave 13 px columns of 4 px pips, with three label lanes (flag, bands, months) on top. A student had to work out the scale before reading anything. The numbers that matter ("29 weeks", "102 study days", "14 mocks") were already in text beside it, so the chart added load and no answer.
- **The controls hid their job.** "4 a week ↕" and "14 full mocks ↕" were tokens that opened tuners inline. The mock tuner was a 1-60 range slider: a bare number, no meaning per position, and no visible effect.
- **Evidence:** one primary action per screen and value before label (R7, R9); progressive disclosure only for rare controls (R10, S014); a recommendation shows its basis (R24). The slop paper's CUET example asks for "one current exam state" and "a single next-best-move", not a dashboard of equal blocks (T001, T003).

## The decision

**Road to May becomes one readout, read top to bottom, with one Change plan sheet.**

```
Road to May
29 weeks                                  (the big figure)
to your exam, Sat 8 May
102 study days left at 4 a week.
─────────────────────────────────────────
This week                  3 of 4 study days
( ) ( ) (✓) ( ) (✓) (✓) ( )   Mon..Sun
Today is counted. 1 more to meet 4.
─────────────────────────────────────────
Full mocks                         0 of 14
[==============················]   one bar, ink, no volt
14 to go: about one a fortnight gets you there.
─────────────────────────────────────────
Coming up                       in 15 weeks
CUET registration is expected to open, Mon 1 Feb
Boards follow from 15 Feb; your plan eases to 2 study days a week then.
─────────────────────────────────────────
[ Change plan ]
```

- **One big number answers "how long have I got".** It is weeks, or days under 22 days, and the date is in words. "Expected" is stated until NTA publishes.
- **This week stays as seven marks.** A Duolingo-style week reads instantly, and it was not part of the complaint. It is now the readout's first row, under the countdown, so the week sits inside the road instead of beside it. The Mobi cheer, the repair receipt and the link to Progress are unchanged.
- **Full mocks is "done of target" with one bar and the pace in words.** The pace is plain arithmetic ("about one a fortnight gets you there"). It is never a prediction of marks.
- **Coming up names the next dated step only:** registration, then boards (with the 2-days-a-week ease said in words), then the boards' end, then the exam. This replaces the Registration and Boards bands on the strip.
- **Change plan opens one sheet with three plain questions.** Each choice saves on tap, and the status line says "Saving…", "Saved." or "Not saved." with the old value kept:
  1. **When is your exam?** "The expected date" or "My own date" (a date field and Save this date). This replaces dragging the flag.
  2. **How many days a week can you study?** Seven 44 px stops. Under them is what the choice leaves: "124 study days before your date. Board weeks count as 2." The Change days link opens the weekday picker in Account.
  3. **How many full mocks before your exam?** Three plain choices, each with its count and what it means: One a week (the most practice), One a fortnight (suggested), One a month (lighter). A fourth, "Your own number", gives a − / + stepper from 1 to 60. **No slider.** The line under the choices states the unlimited bank truthfully: "Every one is a fresh paper from the bank, so there is no limit on how many you sit."
  - **See every week to your exam** opens the 1016 week-by-week rail inside the sheet (48 px weeks, boards weeks shaded, with a readout for the week tapped).

### Nothing is deleted (fold or move)

| Was on the strip | Now |
|---|---|
| Weeks-to-exam figure | The big countdown |
| Dragging the CUET flag; the date sheet | Question 1 in Change plan |
| "102 study days at [4 a week]" token and the pace tuner | The sub-line under the countdown, and question 2 |
| "[14 full mocks] before your date, 7 taken" token and the 1-60 slider | The Full mocks row, and question 3 (three choices plus a stepper) |
| Registration and Boards bands | The Coming up row |
| Month labels and the pips per week | The rail under "See every week" in the sheet |
| Tap a week to open the rail | The same, in the sheet |
| Not on the account yet ("set on the app for now") | The same words; the choices show but are disabled |

### Colour, type, motion and theme

- **Volt:** only the move's key in page content, plus the counted day marks as small data (accepted in TODAY-1017). The mock bar is ink, and the selected stops and choices are ink-outlined. None of them is volt.
- **Type:** the countdown is 64 px display at 1440 and 390, with a 24 px unit. Row labels are 16 px display and row figures 26 px display, all with tabular numerals. Labels are sentence case, with no eyebrows and no pills.
- **Motion:** the readout rises 8 px over 240 ms ease-out. The bar fills from 0 over 700 ms ease-out once on arrival. Sheet choices press at 0.96-0.98. Under reduced motion there is a fade only and no bar fill.
- **Night and Day** use the same arena tokens, and both were captured.
- **Targets:** every control is at least 44 px; choices are 74 px rows.

## The same design for the app (Flutter, `flutter_app/lib/features/today/`)

Build the same readout and sheet, replacing the road board in the v13 Today:

- **Countdown:** BricolageCondensed 64 with a 24 unit, the date line (14, ink2) and "N study days left at G a week" with N in ink 600.
- **Rows** are separated by hairlines (`line`): This week (the existing week marks widget), Full mocks (`LinearProgressIndicator`-style 8 dp ink bar on `raised2`, radius 4), and Coming up.
- **The pure helpers are mirrored.** Port `inWords`, `nextMilestone`, `mockPace` and `mockChoices` from `src/lib/today/road.mjs` into `road_board.dart` so both platforms say the same words. The tests in `data/tests/today_1017.test.mjs` (the "readout:" cases) are the contract.
- **Change plan** is an outlined 44 dp pill that opens one modal bottom sheet (`MmSheet`, drag handle, liquid-glass backdrop per GLASS-1017) with the three questions. The stops are a 7-segment row with an ink selected state. The mock choices are `MmChoiceRow` radios with the count on the right, plus "Your own number" with a −/+ stepper and a light haptic per step. "See every week" expands `road_rail.dart` in place.
- **Saving** works as on the web: optimistic selection, then "Saved." or "Not saved." with a spring back.

## Verified (web)

- Headless captures at 390x844 and 1440x900, Night and Day, through `/preview/arena?view=today&road=set` and `&road=off`. Real-pointer clicks opened Change plan, picked 5 days and "One a week", closed the sheet, and the readout updated ("124 study days left at 5 a week", "0 of 29"). The rail opened and centred on the tapped week. Escape closed the sheet. No horizontal overflow in any capture, and no page errors.
- `npm run test:today`: 32 pass, including four new readout cases.

## Anti-slop check (12 parts, short)

There are no eyebrow pills or dots, no glow, no gradient text, no icon grid and no nested cards. The readout is rows on the ground; the only card is the move. There are no arrows on buttons, no ALL-CAPS, no hype, no emoji and no build talk. There is one volt key per viewport. Every number has its unit and denominator ("0 of 14", "3 of 4 study days", "29 weeks"). Dates are "expected" until NTA publishes. Nothing predicts marks.
