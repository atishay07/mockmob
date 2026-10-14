# UI blitz, motion track: the motion and interaction foundation

14 October 2026. Branch `ui/motion`. Owner: the motion track (lib/core/motion, lib/core/widgets except brand, lib/core/router except the splash). Authority: `design-2026-10-13/BUILD-BRIEF.md` (sections 5 to 7 and 10), `directions-final.md` A.5 and A.8, the owner's feedback of 13 October (OWNER-FEEDBACK-1110.md) and of 14 October ("the animations, the UI/UX, the high-end graphics ... nothing of that has been done yet"), and the owner's UI standards (section 8, motion; his MockMob direction overrides the generic "no glass, no gradient" lines).

## 1. What is wrong now (device shots, r3 and r4)

- **Every screen is the same box.** Today (r4 `06-today-scrolled`), Review (r4 `19-review-top`) and the Start sheet (r3 `07-quickstart`) stack rounded dark rectangles with the same 1 dp hairline, the same 24 dp radius and the same 20 dp padding. A card inside a card (the minutes segmented control inside the hero, r3 `02-today-top`) has a third border. Nothing says "this is the one thing"; the hero only differs by a volt top edge.
- **The Start sheet is a list of identical rows.** Quick 10, Full mock, NTA mode, Repair and Ask are five boxes of equal weight with equal glyph tiles. The recommended move is not visibly the recommended move.
- **Things appear; they do not arrive.** Pages fade in with a 12 dp slide, tabs cross-fade, sheets rise, and every child of a screen is simply there on the first frame. There is no choreography: no order, no lead element, nothing that tells the eye where to go first.
- **Taps feel flat.** `MmPressable` scales to 0.96, but most surfaces give no haptic, no highlight and no release; the dock's active tile slides as a rigid block; the Start button never acknowledges anything.
- **Numbers do not count.** `MonumentalNumber` rolls every digit from 0 on each change, so 171 to 183 replays from 000.
- **Loading is a grey block.** `Skeleton` is a flat well with no life, so a slow network reads as a frozen screen.
- **No scroll life.** Headers do not collapse, art does not move against the content, the top of a long list never changes as you scroll.

## 2. The motion language (tokens in `lib/core/motion/motion.dart`)

Kept from the brief: Glide (enter) `cubic-bezier(0.15, 0.5, 0.5, 1)` 300 ms; Exit `cubic-bezier(0.4, 0.3, 0.8, 0.6)` 200 ms; Emphasized `cubic-bezier(0.16, 1, 0.3, 1)` 420 ms; springs nearly critical (bounce at most 0.12) except the dock (0.18).

Added:

| Token | Value | Use |
| --- | --- | --- |
| `Motion.staggerStep` | 45 ms | Gap between staggered items |
| `Motion.staggerCap` | 8 items | Items after the eighth arrive with the eighth (a long list never takes long) |
| `Motion.enterRise` | 14 dp | How far an entering item rises |
| `Motion.enterScale` | 0.97 | Where an entering item starts (never from 0, standards section 8) |
| `Motion.axisTravel` | 28 dp | Shared-axis travel of a pushed page |
| `Motion.recede` | 0.22 of the travel, ground scrim to 0.45 | What the covered page does |
| `Motion.fadeThroughOut` / `In` | 90 ms / 210 ms | Tab switch |
| `Motion.countUp` | 720 ms, Emphasized | Count-ups |
| `Motion.shimmerSweep` | 1400 ms then 600 ms rest, at most 4 sweeps | Skeleton light |
| `Springs.release` | 300 ms, bounce 0.1 | A pressed surface coming back: a small, physical give |
| `Springs.edgeLead` / `edgeTrail` | 260 ms b0.12 / 440 ms b0.04 | The dock pill's two edges (liquid morph) |

Rules: only transform and opacity animate, inside a RepaintBoundary; nothing re-lays out per frame; every effect has a reduced-motion form (an instant change or a 120 ms fade) that keeps the same information; nothing loops forever (the Start breath and the shimmer both stop by themselves); the question text, options, timer and explanation body never move.

## 3. Components (opt-in, documented APIs)

All of these are additive. Existing call sites keep working unchanged; feature tracks adopt them.

### 3.1 `MmPressable` (lib/core/widgets/pressable.dart)
- New: `haptic: MmPressHaptic.none | selection | light | medium` fired on activation (tap, Enter or Space), through `hapticsProvider` (so the Touch feedback switch is honoured; works without a ProviderScope too).
- New: `highlight: true` paints a press veil (ink 6% Night, 5% Daylight) in the `focusRadius` shape while the finger is down. No layer, no ripple.
- New: `captureLaunch: true` records the surface's global rect for the container transform (see 3.5).
- Release now springs back on `Springs.release` (bounce 0.1), so a press gives a short physical settle instead of a flat return.
- Default haptic is `none`: many features already fire their own haptic on tap and tests count them. Adopt with `haptic:` where the feature does not.

### 3.2 Entrances (lib/core/motion/entrance.dart)
- `MmStagger(child, driver: MmStaggerDriver.self | route, delay, enabled)`: one controller for a whole group. `self` plays once when first built (content that loaded); `route` rides the enclosing route's own transition and does nothing once the route has finished, so a screen that is already up never moves.
- `MmStaggerItem(index, child, rise, scale)`: fades in and rises 14 dp from 0.97, at `index * 45 ms`, capped at the eighth.
- `MmEntrance(child, delay)`: one item without a group.
- Choreography per screen (for adoption): lead element first (the hero or the monumental number), then its meaning, then the action, then the list below in order. Never more than one authored entrance per screen; lists that load later stagger once, scrolling never re-triggers.

### 3.3 Count-ups (MonumentalNumber and `MmCountUp`)
- `MonumentalNumber` now rolls each digit from the digit it showed before (171 to 183 rolls three slots by a little, not from 000), takes `delay` (to land after its card arrives) and `onLanded` (for a selection tick at the landing). Unchanged: fixed slots, unit at 55%, reduced motion shows the final value, nothing moves after landing.
- `MmCountUp(value, from, format, style, duration, onLanded)`: a plain tabular count for inline figures ("36 right"), Emphasized 720 ms, TalkBack hears the final value only.

### 3.4 Scroll effects (lib/core/motion/scroll_effects.dart)
- `MmParallax(factor, child)`: moves art against the scroll (a `Flow`, so a scroll repaints and never re-lays out). Default factor 0.18. Off under reduced motion.
- `MmCollapsingTitle` (sliver): the large title (Bricolage title cut) shrinks into a compact bar as the list scrolls; the bar's ground fills in with a hairline under it once the large title has gone. Transform only. Use instead of `TabRootHeader` when a screen moves to slivers.
- `MmScrollFadeHeader(child, distance)`: a non-sliver header that drifts up at 0.5 speed and fades over its first `distance` of scroll (for a hero sitting at the top of a list).

### 3.5 Page transitions (lib/core/router/transitions.dart)
- `MmTransition.push` is now a **shared-axis push**: the new page arrives 28 dp from the trailing edge, fading in over the first 60% on Glide; the page underneath recedes (moves 6 dp the other way and a ground scrim rises to 0.45) so the eye reads depth. Back reverses it on Exit.
- `MmTransition.rise` (new): a focus page rises 24 dp from 0.97 with a fade. For results, repair endings and You.
- `MmTransition.container` (new): grows from the tapped surface (a rect captured by `MmPressable(captureLaunch: true)` or `MmLaunchRect.capture`) into the page with Emphasized 420 ms, the rounded corners opening to square; falls back to `rise` when no rect was captured in the last second.
- `MmTransition.fade`: unchanged (runner).
- Tabs: **fade-through**. The outgoing tab fades out in 90 ms, the incoming fades in over 210 ms from 0.985 scale. Branches stay mounted.
- The shell and the tab roots recede the same way when a page is pushed over them, so the dock slides away with the page under it (Revolut's "first the card, then the details").
- `MmPageTransitionsBuilder`: the same push for plain `Navigator` routes (for the theme; see "for the merge").

### 3.6 Sheets (lib/core/widgets/mm_sheet.dart)
- The handle answers the finger: while the sheet is dragged it widens from 36 to 52 dp and brightens; crossing the close threshold gives one `selectionClick` (and one back if the student changes their mind).
- The body rides in on the sheet: it fades and rises 12 dp over the last two thirds of the rise, so the glass arrives first and the content settles into it.
- Unchanged: the 420 ms Emphasized rise, the scrim, drag, back, the large-text full page, footers.

### 3.7 The dock (lib/core/widgets/dock)
- **Liquid pill.** The lit tile's two edges travel on two springs: the leading edge on a quick spring, the trailing edge on a slower one, so the pill stretches toward the new tab and then gathers itself (no fixed-width block sliding). Scrubbing still works.
- **Icon micro-animations** on arrival: the icon pops from 0.82 on the dock spring, with a per-tab gesture: Today's sun-moon turns in from -28 degrees, Practice's pen writes a short stroke (a tilt and a 2 dp slide), Review's checks drop in from above. Reduced motion: the outline swaps to filled, nothing moves.
- **Start**: the volt disc presses deeper (0.9) than the ring, and on release a volt ring spreads out from the disc and fades (380 ms), the ink of a filled bubble spreading into the paper. It **breathes twice** (the glow under it swells and settles, 2 x 1.6 s) when the dock first appears and whenever there is something to resume, then rests. Never a loop.

### 3.8 Skeletons (lib/core/widgets/skeleton.dart)
- `SkeletonGroup(shimmer: true)`: one warm light band (lamp-tinted ink at 6% on Night, ink 5% on Daylight) sweeps across every skeleton in the group in one continuous field (the band crosses neighbouring blocks as one light, not one per block). No layers: each block paints its own slice of the same band. At most four sweeps, then the blocks hold still (a slow network then shows its slow-state message, not a light show). Reduced motion: static.
- `SkeletonGroup.shimmerByDefault` (static, false): flip it once in `main()` to light every existing group.
- `MmSkeletonCard` and `MmSkeletonRows`: ready-made shapes that match the hero, plain and row surfaces.

### 3.9 Surfaces: hero, plain, inset (lib/core/widgets/surfaces)
The end of "the same box everywhere": three tiers and a grouped list.
- `MmSurface.hero`: the one focal surface on a screen. Raised fill, a lamp (or subject) light pool from the upper left, film grain, the edge light, optional volt lit edge. 28 dp radius, 24 dp padding. No border.
- `MmSurface.plain`: the ordinary card. Raised fill, only a 1 dp top edge light (no full border), 24 dp radius, 20 dp padding.
- `MmSurface.inset`: content nested inside another surface. A sunken well, no border and no light, 18 dp radius, 16 dp padding. Replaces the card inside a card.
- `MmRowGroup` + `MmRow`: a list inside one plain surface, rows divided by inset hairlines, each row pressable edge to edge with the highlight veil. Replaces stacks of identical boxes.
- `MmSection(title, caption, action, child)`: a group heading with the rhythm below.
- `MmRhythm` spacing: `screenTop 8`, `section 40`, `group 24`, `item 12`, `tight 6`, `heroPad 24`, `plainPad 20`, `insetPad 16`.
- Any surface with `onTap` gets the press physics, the highlight veil and a haptic.

## 4. Screens this track touches directly

- **Start sheet** (`lib/core/router/quick_start.dart`): one hero choice and the rest ranked. The first choice (Resume, else Quick 10) is a hero tile: lamp light pool, bigger glyph, a volt go-disc at the trailing edge, title at card size. Full mock and NTA mode sit side by side as two tiles. Repair and Ask sit in one grouped list with a divider. Rows arrive in order with the sheet (route-driven stagger, 45 ms apart) after the glass has opened; each choice gives a selection tick. Every behaviour (resume first, never more than five choices, costs off the sheet, push vs go, opaque surfaces, the title band) is kept.
- **Empty, error and offline states** (`StateView`): Mobi settles, then the title, message and action arrive in order (one entrance, 45 ms apart). Reduced motion: all at once.
- **The shell**: tab fade-through, the dock as above, pages receding under pushes.

Haptics map (brief section 7, unchanged verbs): selection on tab change, option, chip, threshold, a Start-sheet choice and grouped rows; light on Start and primary commits; medium on a seal or sheet opening; success only after the server acknowledges. Nothing on a wrong answer.

## 5. How this meets the references

- **HIGH**: motion kept for reveals and feedback, not lists ("rows, lists and form fields do not animate decoratively"): our stagger is one entrance per screen and never on scroll. The sheet handle and the liquid dock pill carry HIGH's physical, springy feel without its idle loops.
- **Revolut**: measured curves (Glide is Revolut's own enter curve), "first the card, then the details" (container transform, the page underneath receding with the dock), digits that animate (count-ups that roll from the old value).
- **FamApp**: sheets that rise over the content instead of replacing it, floating trays, and shadows only under floating things (the surfaces lose their borders; the dock and sheets keep the shadow).
- **Budget phones**: one controller per group, Flow for parallax, no saveLayer in scrolling content, shimmer without layers and with a stop, no new BackdropFilters.

## 6. Verification plan

Goldens in `test/golden/core` (both themes, 384 x 853): dock (three tabs, pressed Start, large text), the Start sheet (redesigned) and its morph, the sheet, the new surfaces sheet (`surfaces_*`), skeletons. Unit tests in `test/unit/core_widgets`: stagger (route-driven does nothing on a finished route; self plays once; reduced is static), press haptic and highlight, count-up landing and reduced motion, MonumentalNumber rolling from the previous value, shimmer stops by itself, sheet handle threshold haptic, fade-through keeps branches mounted, container transform falls back without a rect. `flutter analyze` on the owned folders; the existing core_ui suite stays green.

## 7. For the merge (wiring outside this track's folders)

1. **Theme** (`lib/core/theme/theme.dart`): replace `_FadeOnlyTransitionsBuilder` with `MmPageTransitionsBuilder` (from `lib/core/router/transitions.dart`) for Android and iOS, so `MaterialPageRoute` pushes share the shared-axis push and recede.
2. **main.dart**: `SkeletonGroup.shimmerByDefault = true;` once at start-up lights every existing skeleton group (tests keep the static default).
3. **The shell** (`app_shell.dart`, this track): `SplitDock(startBreatheKey: ...)` is ready; pass the open session's id (from `resumeDraftProvider`) once it is confirmed that watching it in the shell does not wake the session journal in tests.
4. **Feature tracks**: adopt per screen, in this order of payoff:
   - hero blocks to `MmSurface.hero(lit: true, light: SubjectLight.x.of(brightness))`; nested cards to `MmSurface.inset`; lists of identical boxes to `MmRowGroup` + `MmRow`; headings to `MmSection` and spacing to `MmRhythm`;
   - wrap each screen's first content in `MmStagger` with `MmStaggerItem(index: n)` in reading order (route driver for pushed pages and sheets, self for content that loads later);
   - `MmPressable(haptic: MmPressHaptic.selection, highlight: true)` on every tappable card or row that does not already fire its own haptic; `captureLaunch: true` plus `MmTransition.container` (router) for card-to-detail opens;
   - `MonumentalNumber(delay: ..., onLanded: () => haptics.selection())` on the hero number; `MmCountUp` for inline figures on recap and result cards;
   - `MmParallax` around art plates in heroes; `MmCollapsingTitle` when a tab root moves to slivers; `MmScrollFadeHeader` for a greeting above a list;
   - `SkeletonGroup(shimmer: true)` with `MmSkeletonCard` / `MmSkeletonRows` for loading.
5. **Router transitions** (this track): You, results and repair endings can switch to `MmTransition.rise`, and a card that opens a detail page to `MmTransition.container`; left as `push` here so no feature golden or flow changes underneath another track.
6. The Start morph now leaves Start's volt disc at the origin, dissolving as the glass grows (`MorphSheetRoute.volt`, default the Night volt).
