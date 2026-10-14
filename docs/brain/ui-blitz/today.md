# UI blitz: Today (14 Oct 2026)

Track owner: the Today builder (branch `ui/today`). Scope: `flutter_app/lib/features/today/**`, `test/golden/today`, `test/unit/today`. Authority: `design-2026-10-13/BUILD-BRIEF.md`, then `OWNER-FEEDBACK-1110.md`, `directions-final.md` A.7, the HIGH, Revolut and FamApp teardowns, and the owner's UI standards (his MockMob direction overrides the generic "no glass, no gradient" lines).

## 1. What is wrong now

Evidence: device shots `tmp/app-shots/r4/02-today-top-night.png`, `03-today-bottom-night.png`, `06-today-scrolled-night.png`, and the golden `today_ready_full_night.png`.

1. **Five boxes in a column.** The week, the move, Recent papers, the road and the colleges are each a rounded dark panel of the same radius, tint and edge. Nothing tells the eye which one matters; the hero only wins by a faint volt edge. The owner's words: "spacing ... can be improved", "everything needs finish".
2. **The hero is timid.** The subject object is 88 dp in a corner, the number is the same size as on the road card, the subject name is a 20 sp label. HIGH and Revolut make the one number that matters huge and let art bleed off the frame; ours reads as a form.
3. **The week strip is a box of dots.** Seven bubbles with no key and no sense of progress through the week. The owner asked twice whether the dots are useful ("how useful are they is the question").
4. **The road to May is a chart plus a legend list.** A thin line with grey bands, then the same stops again as a list with little coloured key chips. No progress, no "what is next", no distance to each stop. It is the screen the owner called out by name.
5. **Colleges are a table** of three rows with scores, inside its own box. Nothing glanceable: you cannot see at a glance how far apart SRCC and Deshbandhu closed.
6. **No choreography.** Everything appears at once; only the number rolls.
7. **Spacing**: 20 dp between header and hero, 32 dp between boxes, 20 dp card padding everywhere: an even rhythm with no grouping.

## 2. Target

Editorial, cinematic, one dominant action. Two layers as HIGH does: the **moment layer** (the hero stage) carries art, light and monumental type; the **work layer** (week, papers, road, colleges) sits on the ground as typeset sections with hairlines, not boxes. Exactly one surface on Today is a raised panel: the hero. No box inside a box anywhere.

Type scale on Today (all existing roles, no new fonts):
- Greeting: `screenTitle` 26/30 Bricolage, date line `caption` above it.
- Section titles: `title` 22/27 Bricolage, with a one-line `caption` beside or under.
- Hero subject: `headline` 28/31 Bricolage. Hero number: `hero` 112 sp condensed. Number meaning: Bricolage title cut 20/24.
- Road countdown: condensed 64 sp (between `figure` and `figureHero`). Paper marks: condensed 30 sp. College scores: condensed 26 sp.
- Body 16/24, captions 13/18. Tabular figures everywhere.

Spacing: 4-point scale. Header to week 16; week to hero 24; hero to first section 40; between sections 40 with a hairline rule and the title 16 below it; inside a section 12 to 16.

### 2.1 Masthead and week

- Avatar, date line and greeting as now (the header Mobi stays: it points at the move card, cheers, yawns).
- **The week as a ledger on the ground**, not in a glass box:
  - Left: the count as a condensed figure, "1" in 40 sp with "of 4 study days" beside it; right: the outlook ("3 more by Sunday") and a chevron. The figure is real (server-counted study days against the student's own goal).
  - Under it, seven day columns on a **rail**: a 2 dp hairline runs Monday to Sunday behind the bubbles; the stretch from Monday to today is drawn in ink, so the week visibly fills as it goes. Each bubble is a state: counted (volt filled), planned (bright ring), rest (dashed with a bar), passed without study (dim ring). Today stands on a small lit tile (white 8% with a 1.5 dp volt top edge) instead of a double ring.
  - A one-line key under the rail names only the marks on screen ("Counted, Planned, Rest"), so every dot is explained.
  - Motion: counted bubbles ink in left to right on open (Fill, 320 ms, 50 ms apart, `Cubic(0.2, 0.9, 0.3, 1)`), the rail's ink draws from Monday to today in 420 ms emphasized. Press: the whole ledger sinks to 0.985 on the shared spring; release opens the week sheet with `selectionClick`.
  - States: no plan (all open rings, no key entry for planned), goal met (outlook in accent text "Goal met"), paused (outlook "Paused", rail dim).

### 2.2 Hero: tonight's move

- A taller stage (radius 28) with the subject's light field and the lamp. The subject object grows from 88 to 156 dp and bleeds off the top-right corner (HIGH's corner props, Revolut's art-led hero), over the subject light pool. Nothing read sits under it.
- Reading order, left aligned: overline ("Tonight's move", caption ink 2) then the subject in `headline` 28 sp; the monumental number at 112 sp with its two-line meaning beside it on the baseline; the evidence sentence; "Show me" with its real bubbles; the length chooser; the volt key; the quiet alternative.
- Mobi at the human moments (day one, coming back, late night) stays inside the stage with its line in a bubble.
- Lit edge plus a single **light sweep** along the top edge once on open (700 ms, `sweepCurve`), the room's one light catching the card.
- Entrance: the stage rises 20 dp and fades in (420 ms emphasized), the object glides in from 24 dp right and 0.92 scale (600 ms emphasized, starting at 80 ms), the number rolls (existing 500 ms), the sentence and keys fade up 8 dp at 160 ms and 220 ms. Never moves after landing.
- Haptics: the key's `lightImpact` on commit (existing), `selectionClick` on a length chip (existing segmented control).
- States: ready, practice, day one (first check, Mobi), returning (Mobi, 10/20/30), late night (sleepy Mobi), repaired, stale, thin, error (Could not load, Try again), offline (disabled key with "Connect to start."), loading skeleton at the same height, sealed result (the folded sheet takes over), resume (answered count), ended. Each keeps its copy and data; only the stage changes.

### 2.3 Recent papers

- On the ground. Title "Recent papers" with "Your last 4" beside it. Rows separated by hairlines, no container.
- Each row: a **paper spine** on the left (a 6 by 44 dp vertical bar split right, wrong, blank in proportion, the same encoding as before, rotated so the row reads as a stack of papers), the label and "Accountancy, 11 October", and the marks in condensed 30 sp with "of 250" and the change under it ("+33 on Mock 6" with a small up or down triangle; level shows a dash). Sealed rows show the seal glyph and "Sealed", no marks.
- Press sinks the row (0.985) and opens the result.

### 2.4 The road to May

The owner named it. It becomes a real timeline with progress and the next milestone.
- Title "The road to May". The countdown: "28" condensed 64 sp with "weeks to the expected CUET window, May 2027" beside it (days under a week; "Exam window open" with days left during the window).
- **The road** (CustomPainter, one RepaintBoundary, paths cached by size): a 10 dp rounded track from the start of this month to the month after the window. The stretch already travelled this month is solid ink; ahead, the track is a quiet groove marked with one small tick per week, so the 28 weeks are countable. Registration and boards ride as labelled lanes above the track; the expected exam window is the one volt block at the end. "Now" is an ink disc with a halo, and a hairline flag with the date ("Now, 13 Oct").
- **The stops** as a vertical timeline under it: a rail with a node per stop (its key mark), the title, its dates, its note, and on the right how far it is ("in 16 weeks", "on now" while inside it). The first stop still ahead is marked "Next" and drawn at full ink; later ones are quieter. "Expected dates" stays as one caption when every date is expected.
- The sessions line ("About 100 study sessions at 4 a week.") closes the section.
- Motion: on first paint the travelled ink draws to Now (420 ms emphasized), the Now halo blooms once (300 ms); reduced motion shows it drawn.
- Integrity: calendar arithmetic and the student's own goal only. No marks, chances or ranks.

### 2.5 Your colleges

- On the ground, right after the road. Title "Your colleges" with "Change" as a quiet key.
- **A closing-score scale**: one horizontal axis, its range fitted to the picks (rounded to 50 below the lowest pick, up to 1000), ticks every 50 with labels. Each pick is a numbered bubble (1, 2, 3) sitting at its closing score; the dream pick is the filled bubble. The gaps between colleges are visible at a glance.
- Under the scale, the numbered rows: bubble number, the college (never truncated, two lines allowed), the course, and the score in condensed 26 sp with "of 1000".
- The caption keeps the category in words ("Last year's DU closing scores, unreserved").
- "Target vs score": Today has no honest CUET score for the student (a short check is never projected to a CUET score), so the scale shows the targets against each other and the 1000 scale, and nothing pretends to place the student on it. Empty state: one line and "Choose your colleges".

### 2.6 Choreography of the whole screen

On the first build with data (not on every rebuild, not on tab reselect): header 0 ms, week 60 ms, hero 120 ms, the sections 220 ms and 280 ms. Each: opacity 0 to 1 and 16 dp rise, 420 ms `emphasized`. All transform and opacity, in one controller, each piece in a RepaintBoundary. Reduced motion (system or in-app): everything in place at once. Total under 800 ms; every control is live from the first frame.

## 3. Budget phone

No new BackdropFilter (the hero and the week use fake glass or none). Painters cache their paths per size and repaint only when their data changes; the entrance uses one controller. Art decoded at display size by `ArtImage`.

## 4. How it meets the references

- HIGH: display type is huge or absent (112 sp number, no middle sizes on the hero); props bleed off the frame corner; zoned density (loud stage at the top, quiet dense rows below); tiny section dividers (hairline rules).
- Revolut: art, one number, one pill; entrance staging "first the card, then the details"; 300 ms glide, 200 ms exit.
- FamApp: open on the next move; point-of-action progress with real denominators (1 of 4 study days, in 16 weeks).
- Owner: every dot is a state and is named; the road shows progress and the next stop; spacing groups by meaning.

## 5. For the merge

See the branch report.
