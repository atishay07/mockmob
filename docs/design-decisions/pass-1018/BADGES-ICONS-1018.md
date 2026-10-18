# Badges and icons, 18 Oct (D19, D8)

Design only. No product code changed. Sources: OWNER-FEEDBACK-2026-10-18-DAWN.md (D8, D19, D22), OWNER-MASTER-LEDGER.md (D19, W-053, D8, W-069).

## D19: "the badges are weird" (Progress, phone)

### What exists today
- **There is no `GET /api/me/badges` route.** Progress (web) is `RecoveryOverview view="progress"` reading `/api/recovery`. Milestones come from `/api/me/rhythm` (`src/lib/server/rhythm.js` computeMilestones: first_scored_session, first_full_mock, first_repair, repairs_5/10/25, sessions_10, first_week_met, weeks_met_4).
- **Web Progress at phone width:** the "badges" are the `pr-badge` pills (arena.css 1093-1097) on every row: "2 delayed checks", "Awaiting repeated evidence", "12 to review", "All correct". At 390 they wrap under the title, look like stickers, use system words, and the same shape carries both praise and warning.
- **App Progress in You (`/you/milestones`, rhythm):** brass coins in lamp light (`medal.dart`, `token_shelf.dart`, `earned_token.dart`) and dashed ghost coins for steps not earned (`locked_coin.dart`). A collectible-reward metaphor; the coin itself says nothing a student can act on. This is the nearest thing in the product to the "badges" he called cringe in D22.

### What a badge should mean for a CUET student
A real step with its number and its date: questions answered, full mocks done (50 questions, 60 minutes), mistakes repaired (passed a fresh check), weeks at the goal, and a subject personal best in CUET marks (+5/-1, out of 250). No names, ranks, auras, streak flames, metals or locks.

### Options (mock: `tmp/design-1018/badges/badges.html`)
- **Option A, recommended: no badges; milestones as a dated record.** One "next" line with the exact count left and a thin bar ("Full mocks, 3 of 5. 2 more full mocks to reach 5"), then plain dated rows ("12 Oct. Accountancy best: 38 of 50. +152 of 250 marks. Up from 31 on 4 Oct."), then "All milestones". Row pills become plain words in the meta column ("12 to review" in warn text; "All correct" in ink 2), so colour is never the only signal.
- **Option B: flat numbered marks.** Numerals in a plain ring (accent ring when reached, hairline when not, "2 to go" under it). No metal or locks. Risk: a grid of empty rings still reads as a collection to fill, which is D22's pattern made quieter.

**Decision (CTO, pending his look): Option A.** It answers "how far have I come and what is next" with numbers, matches the existing "never a badge wall" rule in milestones_screen.dart, and avoids D22. Brass coins and the token shelf are retired on app; pills are removed from web Progress rows.

### Build notes (for the implementing agent)
- Uses existing milestone ids now. New ids need server work in rhythm.js (not done): questions_100/500/1000/2500, full_mocks_5/10/25, weeks_met_8/12, subject_best per subject (from attempts; marks = 5 x correct - wrong).
- "Next" picks the nearest unreached step by fraction left; omit it when no record exists (no guessed progress).
- Empty state: "Your first milestone is dated the day it happens." Loading: three skeleton rows. Error: the existing load-failed line with Try again.
- Celebration stays T3: a newly reached row fades in once; no coin animation.
- Ties to W-053 (You leads with study days, milestones, personal bests).

## D8: "the icons in the UI can be improved"

### Audit
- Families: web is Lucide only (`Glyph.jsx` wrapper, stroke 1.75, plus 44 files importing `lucide-react` directly). App is Lucide (`lucide_icons_flutter`, 164 imports) **except the bottom bar**, which draws Material Rounded (`bar_icons.dart`: home, quiz, fact_check, person) and swaps to a filled glyph when active. That is the one visible mixed family, and it means Today, Practice, Review and You look different on web and app.
- Stroke: 1.75 via Glyph; 2.0 on the 44 direct imports; hand-set 2.3, 2.4, 3 in a few places; app at the package default.
- Sizes: web uses 13 (10, 11, 12, 13, 14, 15, 16, 17, 18, 20, 22, 28, 40); app 15 or more (13 to 96, where 44+ are art, not icons).

### Proposal (mock: `tmp/design-1018/badges/icons.html`)
- **One family: Lucide outline, everywhere.** Phone bar: CalendarCheck (Today), Timer (Practice), NotebookText (Review), UserRound (You), the same names as Glyph.jsx. Active = accent colour on the icon plus a bold label; no filled swap.
- **Sizes: 16, 20, 24.** 16 inline with 13-15 px text, chevrons, meta. 20 list rows, buttons, web sidebar, stat labels. 24 phone bar, top-bar actions, empty states. 32+ is not an icon: use subject art or Mobi.
- **Stroke 1.75 at every size.**
- **One wrapper per platform:** Glyph.jsx on web (lint rule: no direct `lucide-react` import outside it), one `MmIcon` widget in the app (size enum s16/s20/s24, stroke fixed). Verify how `lucide_icons_flutter` 3.x exposes weight; if it cannot render 1.75, ship the Lucide SVGs through flutter_svg.
- Colour: currentColor; ink 2 for lead icons, ink 3 for chevrons and meta, accent only for active or selected.
- Spacing: 8 gap at 16, 12 gap at 20/24, 44 touch target around any tappable icon.

Priority: lower (D8). The bar swap is the visible part; do it with the next app nav change.

## Captures (headless playwright-core, own temp profile; all opened and checked)
`tmp/design-1018/badges/captures/`:
badges-app412-night.png, badges-app412-day.png, badges-web390-night.png, badges-web390-day.png,
icons-app412-night.png, icons-app412-day.png, icons-web390-night.png, icons-web390-day.png.
Checked: no horizontal overflow at 390 or 412, no page errors, Night and Day tokens from arena.css (web) and mm_colors.dart (app). The current-state drawings are approximations of the shipped widgets, not screenshots of the live product.

## Standards check
Real numbers with units and denominators (3 of 5, 38 of 50, +152 of 250); no colour-only status; sentence case; tabular numerals; no glow, gradient or glass in the proposals; no emoji or arrows in copy; 44 px targets noted. Evidence IDs: not cited, the research brain was not opened in this short pass; the implementing agent should map these to T/S IDs in its DESIGN_DECISIONS note.
