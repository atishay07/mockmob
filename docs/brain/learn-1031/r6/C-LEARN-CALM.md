# C-LEARN-CALM: a calmer, stronger Learn on the app (LK52, LK53 first pass)

Packet App C of `R6-SPEC.md` (3 Nov 2026). Branch `ui/1103-learn-calm` off 06b65ff46 (1.0.19+17). Scope: Learn home and the chapter page
(`lib/features/learn2/home`, `lib/features/learn2/chapter`). Out of scope: the stage's behaviour (keys, stamps, Explore door: another
packet) and the Practice door switch (App B). Written before the code.

His words (3 Nov, about 1:30 pm): "the Learn section is still a bit cluttered ... can be a bit stronger and a bit more premium, something
in the direction of Duolingo". Standing rules: refine, don't rebuild; never cut a feature; Night stays subtle; he judges the live prototype.

## 1. Audit (emulator, AVD mockmob_budget, 360 x 800 dp, demo build on the web engine at origin/main 2152e0b74, Pro returning, Night and Day)

Shots: `tmp/learn-calm/before/` (`home_night_1..3`, `home_day_1..2`, `chapter_night_1..3`, `chapter_day_1..2`).

### Learn home, first screen (under Practice's own head and door switch)

| What | Count | Note |
|---|---|---|
| Blocks before the roadmap | 7 | picker box, headline, "6 of 16 done", track, volt key, 2 Or rows, search box |
| Bordered boxes stacked | 3 | door switch, subject picker, search field: three same-weight outlines in 560 dp |
| Hairlines | 4 | above, between and under the Or rows, under the search |
| Chevrons | 3 | picker, two Or rows |
| Type sizes | 6 | 28, 17, 16, 15, 13.5 and the 16 placeholder |
| Things as loud as the key | 2 | Or row labels are 15 w700 ink, the same ink and nearly the weight of the key's label |
| Mobi | 0 | Learn is the one study place with no companion; the subject object is the only art |

The offer is "type on the page": the headline, track and key float between the picker box and the Or rows, so nothing groups them as
the one move. The eye goes picker box, headline, key, then two rows and a search box of the same weight.

### Learn home, the roadmap (Accountancy, 14 chapters drawn)

| What | Count | Note |
|---|---|---|
| Rows | 14 | each with a chevron (14) and a hairline (14), plus a hairline over each unit heading (5): 33 rules in one list |
| Lines per row | 2 to 4 | title, verdict line, meta line, 3 dp bar; heights 64 to 104 dp, so the list has no beat |
| Status shapes | 3 | volt pill "Up next" (22 dp), amber text "Needs work · from your papers", outlined part pills (36 dp, radius 18) |
| Heading levels | 5 | "Your roadmap" 20, part 17, unit 13.5 ink3, row title 16, part option line 13.5 ink3 |
| Progress | 4 of 14 rows | a thin bar under the meta line, only on started rows; the rest look unfinished rather than "not yet" |

It reads as a settings list: same row, rule, chevron, fourteen times. Nothing says "path", and the chapter the student is in is a small
pill at the end of a title.

### Chapter page (Accounting Ratios: one pile; Admission of a Partner: unfinished run)

| What | Count | Note |
|---|---|---|
| Lines of head before content | 4 | back row with object, unit, title, "Chapter 13 of 14" |
| Section headings | 3 | "How long have you got?", "First up", "Everything in this chapter" |
| Empty area | 1 | a lone pile takes half the row: a 170 x 150 dp void beside it |
| Things under Start | 3 | the note, Quick recap, First up, before the shelf |
| Shelf rows | 3 to 5 | each with a chevron and a hairline, no sign of what kind of thing it opens |
| Dead band (resume) | 1 | about 48 dp of nothing between "Start fresh instead" and "Everything in this chapter" |

Day has the same structure; on paper the hairlines and the outlined boxes read stronger than on Night.

## 2. Plan (refine, never cut; every feature and every word stays reachable)

Home
1. **The subject is the page's heading, not a box.** Same 56 dp target and the same sheet; the object (40), the name in display type (22),
   the chevron. One outline fewer.
2. **The offer is the one hero.** It moves onto the app's focal surface (`MmSurface.hero`, the tier Today's "Up next" uses): Mobi (64 dp,
   in a reserved box at the top right, the headline wraps beside him; still under reduced motion), the headline at 30, the line, the
   track (6 dp, round), the volt key. The Or rows move inside the hero under one hairline, quieter (label 15 w600, line ink3), so the
   key leads and the rows read as "or". Same words, same order, same keys.
3. **Search is quieter.** Filled, no outline until focus. Same field, same behaviour.
4. **The roadmap is a path.** Each row gets a 36 dp node with the chapter's place number; the coverage the 3 dp bar showed (cards seen of
   the chapter's cards) becomes the node's arc, so a started row is two lines, not three. The chapter the student is in has a volt node.
   Nodes are joined by a 2 dp rail inside a unit; the 33 hairlines go (spacing groups instead). Every row: title (with its tag beside
   it), one meta line, a quiet chevron.
5. **One pill family.** "Up next" / "Start here" (volt), "Needs work" (warm tint, words kept: "Needs work · from your papers"), and the
   part option pills (chosen: ink fill with a check) share one shape: stadium, 28 dp visual (48 dp touch for buttons), 13 w700.
6. **Headings by rhythm.** Part title 20 display; unit heading a quiet 13 label with no rule; 28 dp between parts.
7. **Press states.** Rows press to 0.98 with the veil and a node squeeze; Or rows the same; the hero key stays the keycap.

Chapter page
8. **Head:** "Chapter 13 of 14" and "Needs work" become pills of the same family on one line under the title (one line fewer).
9. **A lone pile is not half a row.** One pile draws centred at the two-column width with its words beside it (fills the row);
   two to four piles as now.
10. **The resume state loses its dead band**; "Start fresh instead" sits under its key.
11. **Shelf rows say what they open**: a 36 dp tinted tile with one icon per kind (cards, questions, mistakes, lesson, sheet) and spacing
    in place of hairlines. Names and lines unchanged (App B renames the sheet row; this packet does not touch its words).

Kept exactly: every word from the server, all keys and links, sort, Find, sets, part choice and its save states, Free's lines and See
Pro, piles and their taps, the sticky Start, Quick recap, First up, the skeletons and error states.

Checks: unit tests and goldens for home and chapter (Night, Day, 360 x 800, text 1.3), every changed golden looked at; the emulator
walk after, same states; the UI standards done check; the demo APK as `tmp/learn-app-1101/apk/demo-learn-calm.apk`.

## 3. Result (3 Nov, about 2:30 pm, commit 9e26dfcca)

Built as planned (items 1 to 11). Emulator walk on the after demo (same student, Night and Day, 360 x 800): `tmp/learn-calm/after/`
(`home_*`, `chapter_*`, `chapter_resume_*`, and real-touch checks `tap_picker_sheet`, `tap_hero_key`, `tap_or_row`, `tap_roadmap_row`:
each opened the sheet, the run, the Revise run and the chapter page). First screen of home: 4 blocks before the roadmap (was 7),
1 outlined control (was 3), the key the only volt; the roadmap has no hairlines (was 33) and rows of 2 lines plus a wrapped title (was 2
to 4). Tests: learn2 unit + practice 1,650+ pass; 5 new (`test/unit/learn2/learn2_pill_test.dart`); 70 home and chapter goldens
re-recorded and looked at. Demo APK: `wt-1101-learn-app/tmp/learn-app-1101/apk/demo-learn-calm.apk` (Pro returning; its Learn engine is
the web dev preview on port 3452, as the other demos). Not changed: the stage, the Practice door switch, the shelf row's words.
Note for walks: Mobi idles in the hero, so `uiautomator dump` (tapd, labels) may not return on Learn home; tap by coordinates or link.
