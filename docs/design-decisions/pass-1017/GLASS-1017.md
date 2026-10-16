# The app's glass: a MockMob material that lenses, lifts and bounces (F3)

17 Oct 2026. Design decision for the Flutter app only. The website is out of scope (see section 11). This document covers the material and its motion. It does not decide how many slots the bar has, because F1 and F2 belong to the navigation pass. Everything here is computed from `BarGeometry`, so it works for any count from 4 to 6 slots.

Mock captures (412 x 915 dp, rendered at 2x, Night and Day) are in `tmp/design-1017/glass/captures/`. They are listed in section 12.

---

## 1. The problem, in the owner's words

**F3 (17 Oct, about 12:45 am, the newest words):**

> "I know it's difficult in Android because it stretches instead of bouncing, but the liquid glass design and how it interacts with everything, I really love it in the Apple system. I just want some of that taste to be carried forward in the app also, on the app level, not the Android UI."

His older words point the same way:

- **13 Oct** (memory, mockmob-design-direction): the tab bar is plain. He wants "glassmorphism and interactive navigation". The references are HIGH, Revolut and Fampay, and his other projects use "liquid glass used physically".
- **13 Oct 02:30** (L31): "a good navbar wouldn't look like this ... not interactive at all."
- **15 Oct 20:20** (L33): "You have added a general blur, that's good, and it can be made a bit stronger." Section 6 explains why this document changes that blur.
- **13 to 16 Oct** (L34): "what matters is, while using it, the animations, motion design, graphics, motion graphics." He has asked for motion "beyond Duolingo", judged in use.
- **17 Oct** (F16): some UI elements are "really nice". Keep what works and never simplify by cutting.

**What he is asking for, read plainly:**

1. The app's own chrome should behave like a physical material: it bends what is behind it, catches light and answers the finger.
2. Where the app owns scrolling, it should bounce, not stretch.
3. Android's own system UI is out of scope. He accepts that.

---

## 2. What Apple's Liquid Glass actually does (research)

These sources are external supporting sources (S). They are not in `EVIDENCE_INDEX.csv` yet, so they are tagged LG-1 to LG-4 here. The orchestrator can add them as S019 to S022.

| Id | Source | What it establishes |
|---|---|---|
| LG-1 | WWDC25 session 219, "Meet Liquid Glass", transcript via the WWDC index (https://nonstrict.eu/wwdcindex/wwdc2025/219/) and https://developer.apple.com/videos/play/wwdc2025/219/ | The material "bends, shapes, and concentrates light" instead of scattering it (lensing). It materialises by modulating the lensing, not by a fade. Touch makes it flex and fill "with light", starting under the fingertip and spreading to nearby glass. It is gel-like. Larger glass reads thicker, with deeper shadows and stronger lensing. Shadows and tint adapt to the content beneath. There are two variants, regular and clear, and they are never mixed. It belongs in the navigation layer only, never glass on glass. Scroll edge effects dissolve content under the chrome. Tint only the primary action. Shapes are concentric. |
| LG-2 | Apple HIG, Materials (https://developer.apple.com/design/human-interface-guidelines/materials) | "Don't use Liquid Glass in the content layer." Use it sparingly, on the most important functional elements. The regular variant keeps text legible by blurring and adjusting the luminosity of what is behind. The clear variant needs a dimming layer of about 35% over bright content. Reduce Transparency and Increase Contrast change both variants. |
| LG-3 | MacStories, iOS 26 review, page 3 (https://www.macstories.net/stories/ios-and-ipados-26-the-macstories-review/3) | The tab bar is a floating pill. Pressing on the selection turns it into a lifted "selection bubble" with lensing and chromatic aberration, and dragging moves the bubble over the tabs. The bar minimises on scroll. Half sheets are inset from the screen edges, and their material turns opaque when fully expanded. |
| LG-4 | Flutter docs, fragment shaders (https://docs.flutter.dev/ui/design/graphics/fragment-shaders); Flutter 3.44.6 SDK source (`ImageFilter.shader`, `ImageFilter.isShaderFilterSupported`, `BackdropFilter.grouped`, `BouncingScrollPhysics`) | A custom fragment shader can filter the backdrop (`BackdropFilter(filter: ImageFilter.shader(...))`), clipped to a shape. This works on Impeller only, and `isShaderFilterSupported` says whether it is available at run time. The engine supplies the input texture and its size. On OpenGLES the shader must flip the texture's y. `BouncingScrollPhysics` is the iOS bounce, available on any platform. |

Supporting evidence from the owner's research brain:

- **S016:** consistent navigation, identification and selected state (WCAG 2.2).
- **S014:** progressive disclosure. The lens lifts only while a finger is down, so the resting bar stays quiet.
- **S017, S018:** slop means effects without intent. Every effect below has a stated job.

Rules from the owner's standards that apply:

- **T-082:** no glass blur on content cards; blur only on fixed or floating chrome.
- **T-095:** floating UI never covers content without padding.
- **R-153:** durations by role.
- **R-155:** reduced motion.
- **R-047, R-202:** heavy effects must earn their cost on low-end phones.
- **T-103, T-105:** ease-out curves, and no entrance from scale 0.

The owner's newer direction allows glass for the app's chrome (memory, 16 Oct). That overrides the generic "no glass" line in the standards, but only for chrome.

---

## 3. What exists now (read in `wt-appux2/flutter_app`, v12 plus the UX pass)

The app already has good glass bones. What it lacks is the part that makes Liquid Glass feel liquid: lensing, light that answers touch, and bounce.

| Part | File | What it does today | Gap against F3 |
|---|---|---|---|
| Bar glass | `lib/core/widgets/bar/bar_glass.dart` | Full: `BackdropFilter.grouped` with blur sigma 32 (`MmBar.blurSigma`) and saturation 1.15, under a tint at 0.60 (Night `#1B1A16`) or 0.68 (Day `#FFFDF8`). Lite: tint at 0.92 or 0.94 plus grain. Off: solid. Static 1 dp edge light; one analytic shadow. | Frost only. It scatters and never bends. The tint does not adapt to the content beneath. **Measured: at 0.60 with no luminance control, the Night inactive label (`ink2 #BDB6A6`) falls to 2.26:1 over a large bright area** (paper-white art or a volt key under the blur). See section 6.2. |
| Lens (tab indicator) | `lib/core/widgets/bar/bar_lens.dart`, `mm_bar.dart` | A flat tint capsule on two springs: the leading edge is quick, the trailing edge is slow, and it thins 8% while stretched. A press leans it 0.18 of a slot. Scrubbing moves it 1:1. Icons fill once the lens passes 70% of its travel. | Good motion, but the lens is paint, not glass. It never lifts, magnifies or catches the finger's light. `mm_bar.dart` redefines `edgeLead` and `edgeTrail` (240/0.14 and 420/0.04), which differ from the tokens (260/0.12 and 440/0.04). |
| Start key | `lib/core/widgets/bar/start_key.dart` | Volt pill with a top highlight; presses to 0.96; morphs into the Start sheet (`morph_sheet_route.dart`). | It presses in like a content card. Glass should flex and lift. |
| Sheets | `lib/core/widgets/mm_sheet.dart`, `lib/core/widgets/materials/glass_surface.dart` | `GlassRole.sheet` has **no blur** and a 0.985 tint ("device finding 1": at 0.86 to 0.95 without blur, words behind could be read). It is attached to the bottom edge with a 32 dp top radius. It becomes a solid full page at text scale 1.5 and above. | Reads as a solid dark panel (`tmp/app-walk-1017/1A/L06-3-days-sheet.png`). No lensing, no inset, no concentric corners. |
| Quality tiers | `lib/core/theme/glass_quality.dart` | Full, Lite and Off are chosen in You > Appearance. Low-RAM phones start on Lite. A raster watch steps Full down to Lite when the 90th-percentile raster time stays above 12 ms for 2 s while scrolling. | Keep it all. It is the performance net this design leans on. |
| Content "glass" | `lib/core/widgets/materials/fake_glass.dart`, used in about 20 places (Ask, Review rows, onboarding cards, practice app bar) | A tint over art, with no blur and no backdrop read. | This is the content layer. It stays as it is (F16), but it never gets lensing or touch light (LG-2, T-082). |
| Scrolling | `lib/app.dart` (no `scrollBehavior`), plus six `ClampingScrollPhysics` sites | Android default: clamping physics plus the Material 3 stretch indicator. | This is exactly the stretch he named. |
| Pull to refresh | `lib/core/motion/pull_refresh.dart` | Already reads a bounce pull as negative `pixels`. The doc comment says "the content never moves". | It will move once bounce lands. Section 5.9 says where the ring sits. |

Evidence from tonight's walk:

- `L05-2-today-s2.png`: the bar reads as a dark slab, with "14" barely visible behind it.
- `L08-1-practice-top.png` and `L04-5-start-sheet.png`: the six-slot bar with the oval Start key (the subject of F1).
- `L06-3-days-sheet.png`: a dense, edge-attached sheet.

---

## 4. The decision

**MockMob Glass is one regular material for the navigation layer only.** It does four things Apple's does, in our warm, lamp-lit palette:

1. **It lenses.** A rim band bends the content behind it (refraction). The core is softly blurred, and its luminosity is clamped so labels always reach AA.
2. **It catches light.** A static top rim, plus a touch light that blooms under the finger and spreads across the glass.
3. **It lifts and morphs.** Under a finger, the lens and the Start key rise out of the bar as clearer, magnifying glass, then settle back on springs. Sheets and menus materialise out of their trigger.
4. **It lives on a page that bounces.** iOS bounce physics apply everywhere the app owns a scroll view. The stretch indicator goes.

### 4.1 Why this and not the alternatives

- **A. Keep the frost and add a moving highlight (rejected).** It is cheap, but it is the old "scattering" material Apple replaced (LG-1). The owner already sees this bar as a slab (`L05-2`).
- **B. A full refraction shader on every surface, cards included (rejected).** It breaks LG-2 ("not in the content layer") and T-082. Its cost on the Galaxy M06 is unbounded, and it is the decoration-as-structure slop S017 warns about.
- **C. Chosen: lensing at the rim, luminosity-clamped blur in the core, and a lift and touch light on interaction, on chrome only.** It reproduces the parts of Liquid Glass a student feels:
  - the bar comes alive under the thumb;
  - content bends as it slides under the chrome;
  - sheets float.

  Each part has a job:
  - lensing shows depth and that the chrome floats over content (spatial continuity);
  - the clamp gives legibility;
  - the lift and magnification confirm which tab is under the finger before release (feedback, which also helps scrubbing);
  - the touch light confirms the press (feedback);
  - bounce shows the edge of the content without a hard stop (direct manipulation).

  Nothing loops. At rest, nothing animates.

### 4.2 Choices that follow from the research

- **Regular variant only, never clear** (LG-1, LG-2). Our backgrounds are text and art, not video. Clear needs a dimming layer that would fight the warm lamp ground.
- **Volt is the only tint, and only on the Start key** (LG-1: "tint only primary elements"). The lens is never volt (as already decided in app-ia-1016 section 4.2).
- **No glass on glass.** A sheet over the bar drops the bar to Lite (existing rule, DOCK.md section 8). The lifted lens is drawn, not filtered (section 5.5). Menu rows on a glass bubble are plain.
- **Concentric corners.** Inner radius equals outer radius minus inset, everywhere glass nests:
  - lens 26 inside the bar's 32 with a 6 dp pad;
  - sheet bottom corners equal the device corner radius minus the 8 dp inset.
- **Lift on touch-down, not on long press** (a deliberate difference from iOS). Apple lifts the bubble on a long press. We lift on pointer-down (Apple, *Designing Fluid Interfaces*: respond on press, not release), so the bar answers at once, every time. That is the "interactive navigation" he asked for on 13 Oct. It is open question 2 in section 13.
- **No device-tilt highlights in this pass.** They would need a sensors dependency and constant sampling (battery). Students judge the app with a thumb on the glass, not by tilting it. The scroll glint (section 5.4) gives the light a reason to move instead. This is open question 4.

---

## 5. The spec

### 5.1 Material tokens (per surface, Full tier)

All sizes are dp. Tints are the existing palette colours at the alpha given.

| Surface | Core blur sigma | Rim band and bend | Luminosity clamp (shader) | Tint Night / Day | Rim light | Shadow | Radius |
|---|---|---|---|---|---|---|---|
| **Bar** (64 tall, `BarGeometry` width) | 12 (pre-blur 4, plus the shader's core blur) | 18 band, bends up to 14 at the edge, falloff t^2 | Night: luminance at most 0.14. Day: luminance at least 0.50. Hue kept. | `#1B1A16` at 0.52 / `#FFFDF8` at 0.40 | Top 1 dp: white-warm `#FFF6E4` at 30% (Night) or white at 95% (Day), fading to 6% / 35% by 42% of the height, with a 10% return along the bottom. Inner sheen: a radial at the top, 7% / 55%. | 0 10 28 black 42% (Night); 0 10 28 `#3A3020` 16% (Day); plus a 0 1 2 contact shadow | 32 (pill) |
| **Lens at rest** | none (painted) | none | none | `#F4F0E6` at 10% / white solid with a `#D8D1C2` 0.5 dp hairline (unchanged) | top 1 dp edge (unchanged) | Day 0 1 3 `#17150F` 10% (unchanged) | height / 2 |
| **Lens lifted** | none (drawn over the bar) | painted rim with a chromatic fringe: 0.5 dp cyan `#7FE3FF` and magenta `#FF7FD1` strokes at 18% × lift, offset ±0.5 dp | n/a (it redraws our icons) | `#1B1A16` at 0.30 / `#FFFDF8` at 0.35 | rim 1.6 × the bar's | 0 6 16 black 30% / `#3A3020` 18% | height / 2 |
| **Start key** | none (opaque volt) | painted inner rim: top highlight white 38% to 0 over 45% of the height; bottom inner shade `#526700` 35% | n/a | `#D2F000` solid (the one tinted glass) | top 1 dp white 55% | Night volt glow 14% 0 6 14 (unchanged); Day 0 4 10 `#526700` 18% | concentric with the lens |
| **Sheet, partial detent** | 30 (core) | 22 band, bends up to 16; rim tint 0.50 fading to core tint 0.86 between 12 and 20 dp in | Night at most 0.16; Day at least 0.50 | core `#1C1A16` at 0.86 / `#FFFDF8` at 0.88 | like the bar, 1.2 × | `colors.glassShadow` (unchanged) | top 32; bottom = max(20, device corner radius − 8); fallback 28 |
| **Sheet, full detent** | — | — | — | opaque `raised` (`#1B1A16` / `#FFFDF8`) | top only | none | top 32, bottom 0 |
| **Floating control** (header pill over scrolling content, back key over hero art) | 12 | 8 band, bends up to 6 | as for the bar | `#1B1A16` at 0.50 / `#FFFDF8` at 0.56 | as for the bar | 0 4 12 black 30% / `#3A3020` 12% | pill |
| **Menu or popover bubble** (if one exists) | 24 | 12 band, bends up to 10 | as for the sheet | as for the sheet | as for the sheet | popover shadow (stronger than a card's) | 20, concentric with its rows |
| **Live capsule** | as for the bar | as for the bar | as for the bar | as for the bar | as for the bar | as for the bar | pill |

**The other tiers.** Each one keeps the rim light, the shadow and the touch light: they are painters and cost almost nothing.

- **Full without the shader.** Used when `ImageFilter.isShaderFilterSupported` is false or the program fails to load:
  - blur sigma 12 with saturation 1.15, and no rim bend;
  - bar tint 0.82 (Night) or 0.84 (Day);
  - sheet tint 0.985, no blur (today's value).
- **Lite** (chosen, or the automatic step down):
  - no live blur;
  - bar tint 0.96 or 0.97 plus grain at 3% or 2% (up from 0.92/0.94, so glyphs behind never ghost through; seen in `tiers-*.png`);
  - sheet 0.985.
- **Off:** solid `raised` with a 1 dp hairline (`#312E27` / `#D8D1C2`). This tier is our Reduce Transparency.

### 5.2 Where glass is used, and where it never is

**Glass (navigation layer):**

- the bottom bar and its lens;
- the Start key;
- the live capsule;
- sheets, including the Start sheet and every `showMmSheet`;
- floating controls that sit over scrolling content:
  - the tab-root header pill ("Ask Mobi") once content scrolls under it;
  - a back key over hero art;
- menu or popover bubbles;
- the top scroll edge under the status bar (a blur-and-fade band, not a surface).

**Never glass (content layer; LG-2, T-082):**

- cards, rows, lists and charts;
- question text and answer options;
- the result screen;
- Today's sections, the 3D object cards and the week rail;
- every `FakeGlass` surface.

`FakeGlass` keeps its current look (F16 says keep what works), but it never gets lensing, touch light or live blur.

**The runner (exam):**

- Its chrome may stay glass, but it is static: no touch light spread, no scroll glint, no lens lift.
- The press feedback is the 100 ms brighten.
- This follows the research brain's exam rule: nothing in a timed paper distracts.

### 5.3 Lensing and legibility: the shader `mm_glass.frag`

There is one fragment shader, used as `ImageFilter.compose(outer: ImageFilter.shader(glass), inner: ImageFilter.blur(sigma 4))` inside the shell's existing `BackdropGroup`. Grouping means the bar, the capsule and the controls share one backdrop snapshot.

**Inputs:**

| Uniform | Meaning |
|---|---|
| `u_size` and `u_texture` | Set by the engine; never set from Dart. |
| `uRect` | The surface's rect in the filter input's pixel space. |
| `uRadius` | Corner radius, in px. |
| `uBand` | Rim band width, in px. |
| `uBend` | How far the rim bends at the edge, in px. |
| `uCore` | Extra core blur radius, in px. |
| `uLumMax` and `uLumMin` | The luminosity clamp. |
| `uSat` | Saturation lift: 1.15. |
| `uOpenGl` | 1 when the y-flip is needed. |

**Per pixel:**

1. `d` = distance inside the rounded-rect edge, from the same signed-distance formula the mock uses. `n` = the outward normal.
2. **Rim (d < band):** sample at `uv − n · bend · (1 − d/band)²`. The rim pulls in what lies under it, so content visibly bends as it crosses the edge (`bar-*.png`: the week rail and Mobi bend at the bottom and top rims).
3. **Core:** 12 bilinear taps on two rings (radius 0.5 × core and 1.0 × core) over the pre-blurred input, giving a smooth blur about as strong as sigma 12. The weight blends from rim to core across `band × 0.55` to `band` (a feather, so there is no seam).
4. **Saturation:** lift 1.15.
5. **Luminosity clamp** (the HIG's "adjust background luminosity", LG-2):
   - Night: if L > LumMax, scale linear RGB by LumMax / L (the hue survives, so volt still reads as volt, only darker).
   - Day: if L < LumMin, lift toward white in linear space by (LumMin − L) / (1 − L).
6. **Output:** the result. The tint, the rims and the content are drawn on top by the existing painters.

**Computed worst cases** (contrast script in this pass, every backdrop from black to paper white including volt; section 6.2):

| State | Night `ink2` / `ink` | Day `ink2` / `ink` |
|---|---|---|
| Full (clamp, tint 0.52 / 0.40) | 5.16 / 9.16 | 7.40 / 13.12 |
| Full without the shader (0.82 / 0.84) | 4.89 / 8.67 | 6.99 / 12.38 |
| Lite (0.96 / 0.97) | more than 6.9 | more than 8.8 |
| Sheet body (0.86 / 0.88, clamp 0.16 / 0.50) | 7.49 / 13.28 (`ink3` 5.34) | 9.45 / 16.76 (`ink3` 5.82) |
| Lifted lens (0.30 / 0.35, its own clamp 0.10 / 0.62) | 4.67 / 8.28 | 7.70 / 13.65 |
| **Today's code: Night 0.60, no clamp** | **2.26 / 4.02 (fails)** | 4.54 / 8.05 (Day 0.68) |

**Coordinate space.**

- The texture space of a backdrop shader filter is engine-defined. Packet G2 must first draw a debug grid through the shader on the emulator and on one device (acceptance check A4), and only then tune `uRect`.
- If the mapping cannot be made stable, G2 ships "Full without the shader" as Full and records why. The look then loses the rim bend but keeps everything else.

### 5.4 Light

- **Static rim:** the existing `EdgeLightPainter` / `_EdgePainter` stroke, with the colours of section 5.1. The bar's static sheen is new: a radial at the top centre, 7% Night, 55% Day.
- **Touch light** (new, `lib/core/widgets/materials/touch_light.dart`). This is a painter inside each glass surface's repaint boundary, clipped to the shape:
  - **On pointer-down:** a radial bloom centred on the finger, radius 56 dp. The colour is `#FFFAEC` at 20% (Night) or white at 75% (Day). It rises from 0 over 80 ms on `Motion.out`.
  - **On release:** the radius grows to 96 dp while the bloom fades to 0 over 360 ms on `Motion.out`. The light spreads across the glass as it leaves (LG-1: "the glow ... spreads").
  - **Nearby glass:** if the finger is within 80 dp of the Start key, the key's rim brightens by up to 1.4 ×, with the same timing.
  - **Lifted surfaces** (the lens or a pressed control) double the rim light while lifted.
- **Scroll glint** (new, small):
  - The bar's top rim highlight shifts sideways by `clamp(scrollVelocity × 0.004, −12, +12)` dp on a critically damped spring of 300 ms.
  - Its job: the light moves when the world under it moves, so the bar reads as a physical object.
  - It stops when scrolling stops. It is off under reduced motion and in the runner.
  - Open question 3: the owner may find it noisy.

### 5.5 The lens: lift, travel, morph, settle

**A tap on a tab (the 6-frame strip, `strip-night.png` / `strip-day.png`, Today to Practice):**

| t | What the student sees | Spec |
|---|---|---|
| 0 ms | The lens rests on Today: a quiet capsule under the icons. | `lift` 0. |
| pointer-down (frame at 70 ms) | The lens lifts out of the bar: taller (52 to 58 dp), wider (+8 dp), clearer (rest tint to lifted tint), with a stronger rim, a chromatic fringe and icons magnified 1.10 inside it. Its near edge leans 0.18 of a slot toward Practice. The touch light blooms under the finger. One `selectionClick`. | `lift` → 1 on `Springs.lensLift` (new token: 180 ms, bounce 0). Lean: the existing 120 ms `Motion.out`. Magnification = 1 + 0.10 × lift. |
| release + 80 ms (150 ms) | The leading edge runs, the tail lags. The lens stretches over both tabs and thins 8% (existing), still lifted, magnifying whatever passes under it. Today's icon empties to its outline (160 ms, existing). | Edges on the **token** springs `edgeLead` (260 ms, 0.12) and `edgeTrail` (440 ms, 0.04). The duplicates in `mm_bar.dart` are removed and both now point at `Springs.edgeLead` / `edgeTrail`. |
| 230 ms | The leading edge overshoots by about 3 dp (from the spring's bounce). The lens has passed 70%, so Practice fills (200 ms) and settles from 0.9. | Existing rule. |
| 330 ms | The tail arrives. The lens squashes slightly (width +4%, height −4%) as it lands, and the lift sinks. | `lift` → 0 on `Springs.lensDrop` (new: 320 ms, bounce 0.14), started when the trailing edge passes 85%. Squash = clamp(\|trailing velocity\| / 2000, 0, 1) × 0.05, decaying with the edge spring. |
| 480 ms | At rest on Practice. The touch light is gone. | Everything is idle. No frames are produced. |

**How the lifted lens is drawn.**

- It is not a backdrop filter (no glass on glass, and it is cheap).
- **Inside its clip**, the lens painter draws:
  - the lifted tint;
  - the bar's icons and labels again, scaled by the magnification about the lens centre (vector, crisp);
  - its rim and the chromatic fringe.
- **The bar's base icon painter** clips out the lens rect while `lift` is above 0, so there is never a double image.
- In the strip, frame 3 (150 ms) shows Today half covered. That is correct for a single 16 ms frame of a moving lens. The magnified half is inside the lens and the plain half is outside it.

**Scrub (press, then drag across the bar).**

- The lens stays lifted and follows the finger 1:1 (existing), magnifying each tab as it passes.
- A `selectionClick` fires at each boundary (existing).
- Past either end of the bar, the lens rubber-bands: offset = `(x × w × 0.55) / (w + 0.55 × |x|)`, where x is the overshoot past the end and w is the slot width.
- On release it projects by velocity (existing), then drops as above.

**Re-tapping the open tab.** The lens lifts and drops in place (lensLift then lensDrop, about 300 ms), the touch light blooms, and the page scrolls to top (existing). There is no haptic (existing).

**Collapse on scroll.** Unchanged (64 to 52 dp in 240 ms, emphasized curve). The lens and Start shrink with the bar. The rim band scales with the height: 18 dp at 64, 15 dp at 52.

### 5.6 The Start key: gel press

| Event | What happens |
|---|---|
| Pointer-down | The key squashes like gel: x scale 1.04, y scale 0.95, over 100 ms on `Motion.out`, anchored at the bottom. The touch light blooms inside it (white, 30%). One `lightImpact` (existing). |
| Release | Springs back on `Springs.dock` (360 ms, bounce 0.18), with one small wobble. Then the existing 420 ms morph into the Start sheet. |
| Drag up | Existing: the sheet follows the finger out of the key. |
| Reduced motion | A plain 0.97 press scale and the static rim brighten. |

The rule this sets for the whole app: **content presses in (scale 0.96, existing); glass lifts out or flexes.** A student learns the difference between the two layers by touch.

### 5.7 Sheets: float, then fill

**Partial detent (every `showMmSheet` that opens below full height):**

- The sheet floats 8 dp in from the sides and the bottom.
- Its bottom corners are concentric with the phone: the device corner radius minus 8.
  - The corner radius is read once from Android 12+ (`WindowInsets.getRoundedCorner(BOTTOM_LEFT).radius`) through the existing `in.mockmob.app/device` channel.
  - The fallback is 36, which gives a 28 dp radius.
- Its top corners are 32 dp.
- The glass shows a lensed rim over the page, and the body stays dense (section 5.1).
- The page behind gets the existing `sheetScrim` and **does not recede**.
- The bottom gesture area is padded inside the sheet. The main key stays pinned (existing footer) above a scroll edge that dissolves the body into the sheet over 40 dp. That replaces the hairline.

**Dragging to the full detent:**

- As progress p goes from 0 to 1 over the last 15% of travel:
  - the insets go from 8 to 0;
  - the bottom radius goes to 0;
  - the material goes from glass to the opaque `raised` colour (LG-3: "turns opaque when fully expanded").
- The page behind recedes with the existing constants (scale `1 − 0.22 × 0.27` ≈ 0.94, scrim 0.45).

**Materialise, do not fade (LG-1).**

- **Opening:** over the first 60% of the existing 420 ms rise (`Motion.emphasized`):
  - the blur sigma ramps from 0 to 30;
  - the rim bend ramps from 0 to full;
  - the tint ramps from 0.3 to the resting density, which replaces today's `sheetTintAlpha` ramp.
  - Text arrives only after the tint is at rest (existing rule).
- **Closing:** the exact reverse over 240 ms on the existing drawer curve. It closes along the path it opened (spatial consistency).

**Large text (scale 1.5 and above):** unchanged. A solid full page with a visible Close.

### 5.8 Floating controls and menus

- A floating control turns to glass only while content is scrolled under it. At scroll 0 it keeps today's look.
  - The cross-fade lasts 200 ms, driven by scroll position, not by time.
  - It presses with lift: scale 1.04 on `Springs.lensLift`, plus the touch light. Release uses `Springs.release`.
- A menu or popover bubble opens out of its trigger:
  - transform origin at the trigger;
  - scale 0.9 to 1 on `Springs.smooth`;
  - blur materialising over 160 ms;
  - closing back into the trigger over 180 ms.
- Rows on a bubble are plain text (no glass on glass).

### 5.9 Bounce everywhere the app scrolls

- **A new behaviour, `lib/core/motion/mm_scroll_behavior.dart`.** `MmScrollBehavior extends MaterialScrollBehavior`:
  - `getScrollPhysics` returns `BouncingScrollPhysics(parent: AlwaysScrollableScrollPhysics(), decelerationRate: ScrollDecelerationRate.normal)`;
  - `buildOverscrollIndicator` returns the child, so there is no stretch and no glow.
  - It is set as `MaterialApp.router(scrollBehavior: const MmScrollBehavior())` in `lib/app.dart`.
- **The six explicit clamping sites move to bouncing. Nothing is removed.**
  - `lib/core/widgets/moment_scaffold.dart:48`: bouncing.
  - `lib/features/runner/screens/submit_screen.dart:605`: bouncing. The exam's submit sheet bounce is physics, not decoration.
  - `lib/features/today/widgets/road_rail.dart:336` and `road_tuners.dart:289`: bouncing (horizontal).
  - `lib/core/widgets/controls/chip_rail.dart:431`: the `_ChipSnapPhysics` parent becomes `BouncingScrollPhysics`. Snapping is kept.
  - `lib/features/result/recap/card_page.dart:147`: this one turns `OverscrollNotification` into paging. Switch it to bouncing and compute the overscroll from `metrics.pixels` beyond `min/maxScrollExtent` in `ScrollUpdateNotification` (the same way `pull_refresh.dart` already reads a bounce pull). The paging gesture and its threshold do not change.
- **Pull to refresh** (`pull_refresh.dart`):
  - The content now moves down with the pull (the iOS rubber band).
  - The ring rides in the revealed gap: centred at `pull / 2` below the top inset, clamped to at most 36 dp.
  - On release past the threshold the content springs back to 0 and the ring moves to its resting place under the status bar (today's reading arc), so no sliver hold is needed.
  - The doc comment "the content never moves" is updated, not deleted.
- **Pages, horizontal rails, sheets' bodies and the runner's question scroll** all bounce.
- **Web views or platform views,** if any: untouched.

### 5.10 States

| State | Behaviour |
|---|---|
| **First frame (loading)** | `GlassBoot.read` (already awaited before `runApp`) also awaits `FragmentProgram.fromAsset('shaders/mm_glass.frag')`, in parallel with the preferences read. The first frame is already the right tier, with no flip from basic to Full. Impeller compiles shaders at build time, so there is no runtime compile hitch. |
| **Shader unavailable or failed (error)** | `isShaderFilterSupported` is false, or the load throws. The surface uses "Full without the shader". This never crashes and never shows a blank pane. One analytics event, `glass_shader_unavailable` (reason only). |
| **Sparse or empty ground under the glass** | The glass is nearly invisible except for its rim, sheen and shadow. That is correct, because glass is only as visible as what is behind it (LG-1). |
| **Busy content under the glass** | The rim bends it and the core blurs and clamps it. Labels stay at 4.5:1 or better (section 5.3 table). |
| **Slow phone** | The existing raster watch steps Full down to Lite. Low-RAM phones start on Lite (existing). Lite and Off keep the touch light and the lift (painters), so the bar still answers the finger. |
| **Under a sheet** | The bar drops to Lite (existing), so there is never glass on glass. |
| **Keyboard open** | The bar hides (existing). The sheet's glass stays, and its inset becomes 0 above the keyboard. |
| **Return after days** | The tier choice and the automatic Lite step persist (existing). |
| **Idle** | Nothing animates. DevTools shows no frames while the finger is off the screen and nothing is loading. |

### 5.11 Reduced motion, reduced transparency, contrast

- **Reduced motion** (`MediaQuery.disableAnimations`, which Android sets for "Remove animations", or the in-app switch through `Motion.reduced`):
  - The lens cross-fades between tabs over 120 ms: no lift, no lean, no stretch, no magnification.
  - The touch light becomes a static 100 ms rim brighten.
  - There is no scroll glint and no gel squash (the Start key presses to 0.97).
  - Sheets and menus fade over 120 ms (existing `Motion.reducedFade`). Materialising becomes a fade.
  - Bounce physics stay. They are direct manipulation that follows the finger, not an animation the app plays.
- **Reduced transparency.** Android has no system flag. The in-app Glass setting (You > Appearance: Full, Lite, Off) is our Reduce Transparency. Off is solid with hairlines. The picker's copy (`lib/core/widgets/controls/glass_quality_picker.dart`) says what each does:
  - Full: "Glass that bends what's behind it";
  - Lite: "Frosted look, lighter on battery";
  - Off: "Solid surfaces".
- **Increase contrast** (`MediaQuery.highContrast`, reported by Android's high-contrast text):
  - the tier is forced to Off;
  - hairlines become `lineStrong`;
  - bar labels use `ink` instead of `ink2`;
  - the lifted lens's fringe is dropped.
- **Text scale:**
  - labels keep the existing clamp at 1.2 with a minimum FittedBox scale of 0.85;
  - sheets become a full page at 1.5 (existing);
  - the lens grows with the label box.

---

## 6. Reasons, trade-offs and what this changes in older decisions

### 6.1 The blur goes down from sigma 32 to about sigma 12 (supersedes L33's direction)

- On 15 Oct he asked for a stronger blur.
- On 17 Oct (newer, F3) he asked for Apple's glass, where content stays recognisable and bends at the edge. At sigma 32 under a 0.60 tint, nothing shows through (`L05-2`), so the bar reads as a slab.
- Legibility used to be the blur's job. The luminosity clamp now does that job, and it does it better, because a blur alone fails over large bright areas (section 6.2).
- The core blur is one token (`MmBar.coreBlur`). If he wants more frost, raising it does not hurt legibility.
- This is open question 1 in section 13.

### 6.2 Today's Night bar can fail AA (found in this pass)

- **The calculation.** Composite the tint over a blurred field of each backdrop colour, then measure the contrast of `ink2` labels. The blur averages a large bright area into its own colour, which makes this the worst case.
- **The result.** With the current Night 0.60 tint and no luminance control, the result is 2.26:1 over paper-white content and about 2.7:1 over a volt key.
- **The fix.** The clamp in section 5.3 raises it to 5.16:1 or better. The contrast script is in the pass's scratchpad, and its results are reproduced in the section 5.3 table.
- **Proof is still owed.** G2 must confirm it on device with a screenshot over a volt key (acceptance check A3).

### 6.3 Trade-offs

- **Shader risk.** The backdrop shader is Impeller-only, and its texture space must be verified (A4). The fallback is fully specified and still looks better than today, because of the touch light, the lift, the clamp-free thicker tint and bounce.
- **Cost.**
  - The rim and core shader adds about 13 texture taps per bar pixel: about 1.3 M taps a frame for the bar.
  - The sheet uses the system blur for its core plus the shader in its rim. Its whole area never goes through the 13-tap path. G4 builds it as two grouped filters: blur sigma 30 clipped to the inner rect, and the shader clipped to the outer ring. The tint gradient over 12 to 20 dp hides the seam.
  - Budgets are in section 7.
- **Novelty fatigue.** Every effect fires only on a real event: a touch, a scroll or a state change. At rest the screen is still. The scroll glint is the one effect that could feel ambient, so it is small, it stops with the scroll, and it is open question 3.

---

## 7. Performance budget (Galaxy M06, Mali-G57, about 2.0 px per dp; the emulator first, within the RAM rule)

| Measure | Target | How it is measured |
|---|---|---|
| Bar raster cost, Full with shader, flinging Today | p90 ≤ 2.0 ms (was ≤ 1.5 ms without the shader) | Profile APK, DevTools raster timeline, auto-downgrade off |
| Whole frame raster, Today fling | p90 ≤ 8 ms (unchanged) | Same |
| Start-sheet morph (blur ramp plus rim) | p90 ≤ 12 ms; no frame over 16.7 ms in 10 runs | Same, 10 opens |
| Scrub across all tabs | 0 UI-thread rebuilds of the bar after the first frame; raster p90 ≤ 6 ms | Same, plus the rebuild counter |
| Idle | 0 frames | Frame chart flat for 5 s |
| Memory | +1 fragment program (a few KB), no new textures | `flutter build apk --analyze-size` diff |
| Automatic step down | The existing 12 ms p90 over 2 s steps Full to Lite once | Unchanged; verify it still fires |
| Battery | No sensors, no loops | Code review: no `Ticker` runs at rest |

If the M06 misses the bar target, step down in this order:

1. 8 core taps instead of 12;
2. rim band 18 → 12;
3. ship Full without the shader.

---

## 8. What moves where (nothing is deleted)

| Today | Becomes | Where it goes |
|---|---|---|
| Bar frost: sigma 32, tint 0.60 / 0.68 | Rim lensing, core blur about 12, clamp, tint 0.52 / 0.40 | `bar_glass.dart`; the sigma 32 value stays in the code as `MmBar.frostBlurSigma`, so the owner's answer to question 1 is a one-token switch |
| Flat lens capsule | Kept as the lens's **rest** state; a lifted state is added | `bar_lens.dart` |
| `mm_bar.dart`'s own `edgeLead` / `edgeTrail` copies | Point at `Springs.edgeLead` / `edgeTrail` (tokens) | `mm_bar.dart`; values in `shared/motion-tokens.json` |
| Start press at 0.96 | Gel squash and wobble; 0.97 under reduced motion | `start_key.dart` |
| Sheet: 0.985, no blur, edge-attached | Full: floating inset glass at the partial detent and opaque at the full detent. 0.985 stays for Lite and Full without the shader. | `glass_surface.dart`, `mm_sheet.dart`, `morph_sheet_route.dart` |
| Sheet tint ramp (`sheetTintAlpha`) | The materialise ramp (blur, bend and tint together) | `glass_surface.dart`, `morph_sheet_route.dart` |
| Lite tint 0.92 / 0.94 | 0.96 / 0.97 plus grain | `bar_glass.dart`, `mm_colors.dart` (`glassTintLite`) |
| Android stretch indicator and clamping physics | Bounce, app-wide | `app.dart`, the new `mm_scroll_behavior.dart`, the six sites in 5.9 |
| `pull_refresh.dart` "content never moves" | The ring rides the bounce gap | `pull_refresh.dart` |
| DOCK.md section 4 glass numbers | Superseded by section 5.1 here; DOCK.md is kept for history with a pointer | `docs/brain/ui-phase2/DOCK.md` (one line added by G2) |
| `FakeGlass` content surfaces | Unchanged; documented as content layer (no lens, light or blur) | `fake_glass.dart` doc comment |

---

## 9. Build packets

Each packet names its files (relative to `flutter_app/` unless rooted), its owner model per the subagent rule (Opus for owner-visible polish and motion, Sonnet for plumbing), and its own checks. Nothing here touches the bar's slot count or order (F1 and F2 belong to the navigation pass). G3 rebases on whatever count lands.

**Order:**

- G1 can start at once.
- G2 comes next.
- G3, G4 and G5 follow G2.
- G6 follows G2.
- G7 is last.

### G1. Bounce (Sonnet, about 2 h)

**Files:**

- `lib/core/motion/mm_scroll_behavior.dart` (new)
- `lib/app.dart` (`scrollBehavior:`)
- `lib/core/widgets/moment_scaffold.dart`
- `lib/features/runner/screens/submit_screen.dart`
- `lib/features/today/widgets/road_rail.dart`
- `lib/features/today/widgets/road_tuners.dart`
- `lib/core/widgets/controls/chip_rail.dart`
- `lib/features/result/recap/card_page.dart`
- `lib/core/motion/pull_refresh.dart`

**Tests:**

- `test/unit/motion/scroll_behavior_test.dart` (new): the physics type on Android, and no `StretchingOverscrollIndicator` in the tree.
- Update the recap paging tests and the pull-refresh tests: a bounce pull past 72 dp refreshes once, and the ring position is `pull / 2`.

**Check:** acceptance checks B1 to B4.

### G2. The glass material and shader (Opus, about 1 day)

**Files:**

- `shaders/mm_glass.frag` (new)
- `pubspec.yaml` (`flutter: shaders: - shaders/mm_glass.frag`)
- `lib/core/widgets/materials/glass_shader.dart` (new: program load, the uniform slots with `getUniformFloat`, the y-flip flag, `isShaderFilterSupported`)
- `lib/core/theme/glass_quality.dart` (`GlassBoot` loads the program; `GlassScope` exposes `shaderReady`)
- `lib/core/widgets/bar/bar_glass.dart` (Full: compose(shader, blur 4); the new `BarGlassSpec` tints; static sheen)
- `lib/core/theme/tokens.dart` (`MmBar.coreBlur = 12`, `rimBand = 18`, `rimBend = 14`, `frostBlurSigma = 32`; `MmElevation` sigmas)
- `lib/core/theme/mm_colors.dart` (`glassTint` and `glassTintLite` per section 5.1; new `glassRimTop` / `Side` / `Bottom`)
- `lib/core/widgets/materials/glass_surface.dart` (the control role uses the shader)
- `docs/brain/ui-phase2/DOCK.md` (one pointer line)

**Tests:**

- goldens `glass_bar_{full,basic,lite,off}_{night,day}` over the volt-key fixture (the shader path is goldened with `isShaderFilterSupported` faked; the golden engine falls back to basic);
- a unit test for `BarGlassSpec` alphas;
- a contrast unit test that composites `ink2` over black, paper and volt with the spec's tints and clamp, and asserts at least 4.5:1.

**Check:** A1 to A5.

### G3. Lens lift, magnification, touch light, Start gel (Opus, about 1 day)

**Files:**

- `lib/core/widgets/bar/mm_bar.dart` (the `lift` controller; scrub magnification; remove the duplicate springs and use the tokens; clip the base icons under the lens)
- `lib/core/widgets/bar/bar_lens.dart` (rest and lifted painters; fringe; squash)
- `lib/core/widgets/bar/start_key.dart` (gel squash; touch light; rim answering a nearby finger)
- `lib/core/widgets/materials/touch_light.dart` (new)
- `lib/core/motion/springs.dart` and `shared/motion-tokens.json` (new tokens: `lensLift` 180 ms bounce 0, `lensDrop` 320 ms bounce 0.14, `touchLightIn` 80 ms, `touchLightOut` 360 ms, `gelSquash` 100 ms), then regenerate `lib/core/motion/motion_tokens.g.dart`
- `lib/core/widgets/bar/bar_live.dart` (the capsule gets the touch light)

**Tests:**

- goldens of the six strip frames (fake clock at 0, 70, 150, 230, 330 and 480 ms; Night and Day);
- a reduced-motion golden (cross-fade at 60 ms);
- a unit test that `lift` returns to 0 and no ticker runs after 600 ms.

**Check:** C1 to C6.

### G4. Sheets that float, then fill (Opus, about 1 day)

**Files:**

- `lib/core/widgets/mm_sheet.dart` (partial detent with inset and concentric corners; full detent opaque; scroll edge above the footer)
- `lib/core/widgets/bar/morph_sheet_route.dart` (materialise ramp; reverse on close)
- `lib/core/widgets/materials/glass_surface.dart` (sheet role: core blur 30, rim-ring shader, tint gradient; 0.985 kept for Lite and Full without the shader)
- `android/app/src/main/kotlin/in/mockmob/app/MainActivity.kt` (the `device` channel gets a `cornerRadius` method; Android 12+; null below)
- `lib/core/platform/device_corner.dart` (new; the fallback is 36)
- `lib/core/router/app_shell.dart` (recede only at the full detent)

**Tests:**

- goldens `sheet_partial_{night,day}`, `sheet_full_{night,day}` and `sheet_largetext`;
- a unit test that the corner radius is max(20, device − 8) and the fallback is 28.

**Check:** D1 to D5.

### G5. Floating controls and menus (Sonnet, about 3 h; owner-visible polish reviewed by Opus)

**Files:**

- `lib/core/widgets/tab_root_header.dart` and `lib/core/widgets/page_header.dart` (the glass state when content is under; the lift press)
- `lib/features/practice/widgets/practice_app_bar.dart` (audit only: if it floats over scrolling content it takes the control role; otherwise it stays `FakeGlass`)
- any popover in `lib/core/widgets/controls/select_row.dart` (if it opens a bubble, apply section 5.8)

**Tests:** goldens of the header at scroll 0 and scroll 120.

### G6. Accessibility and settings (Sonnet, about 2 h)

**Files:**

- `lib/core/widgets/controls/glass_quality_picker.dart` (copy, section 5.11)
- `lib/features/you/appearance/glass_swatch.dart` (swatches show the new Full)
- `lib/core/theme/glass_quality.dart` (`highContrast` forces Off)
- `lib/core/motion/reduced_motion.dart` (the paths in 5.11)

**Tests:**

- `highContrast: true` puts the Off tier in effect;
- `disableAnimations` gives the cross-fade lens and no glint.

### G7. Device proof (Sonnet driver; the owner judges)

1. Build a profile APK.
2. On the emulator (2 to 3 GB, RAM rule), and on the M06 if one is available, run the measurements in section 7.
3. Take screenshots that pair each mock in section 12 with the same screen on the device, in Night and Day.
4. Record a 6-frame screen capture of a tab tap and put it next to `strip-*.png`.
5. Walk the owner's F3 words against the device: does it feel like glass in use?
6. Save the results to `tmp/app-walk-1017/glass/` and tick F3 in `OWNER-FEEDBACK-2026-10-17.md` only with that proof.

---

## 10. Acceptance checks (a tester can run each one)

**Glass (G2):**

- **A1.** On Today in Night, scroll the week rail slowly under the bar. Inside the bottom 18 dp of the bar, the dots and Mobi visibly bend toward the rim. In the bar's middle they are soft but recognisable as shapes. Compare with `bar-night.png`.
- **A2.** Repeat A1 in Day. Compare with `bar-day.png`.
- **A3.** Scroll a volt key (Practice "Start 10 questions", or Today "Start repair, 10 min") fully under the bar. Take a screenshot and measure the "Practice" label against the pixels around it:
  - at least 4.5:1 for inactive labels, in Night and Day;
  - the volt shows through as a dimmed olive (Night) or a pale lime (Day), never as full volt behind a label.
- **A4.** Debug grid (debug builds only, a flag in G2): a 24 dp grid drawn through the shader lines up with the screen grid within 1 px at the bar's centre, on the emulator and on one Vulkan phone. If it does not, ship Full without the shader and record the reason.
- **A5.** Force "Full without the shader" (debug flag), then Lite, then Off. Each matches its row in `tiers-*.png`. In Lite, no glyph from the content behind can be read through the bar.

**Bounce (G1):**

- **B1.** On Today, Practice, Review, You, a sheet body, a horizontal chip rail and the runner's question, pull past the top and the bottom. The content rubber-bands and springs back. Nothing stretches and there is no glow.
- **B2.** Pull to refresh on Today. The content moves down with the finger and the ring sits in the gap. Past 72 dp, one tick, and the refresh runs once. The content springs back and the arc turns under the status bar.
- **B3.** On the recap cards, pull past the last card. Paging still works with the same threshold.
- **B4.** A short page (content smaller than the screen) still bounces.

**The lens and Start key (G3):**

- **C1.** Press and hold Practice without moving. Within 80 ms (count the frames on a 60 fps capture) the lens lifts, leans toward Practice and magnifies, and the light blooms under the finger.
- **C2.** Release. The lens stretches, overshoots slightly, fills Practice once it is past 70%, squashes and settles. It is fully idle by 500 ms. Compare frame by frame with `strip-*.png`.
- **C3.** Scrub from Today to You. The lens stays lifted and magnifies each tab it passes, with one click per boundary. It rubber-bands past the end and lands on the nearest tab.
- **C4.** Tap twice quickly (Practice, then Review). The lens re-targets from its current velocity, with no jump.
- **C5.** Press Start. It squashes like gel, wobbles once on release, then morphs into the Start sheet.
- **C6.** With reduced motion on, the lens cross-fades over 120 ms, with no lift, stretch, glint or squash.

**Sheets (G4):**

- **D1.** Open "Change days" on Today. The sheet floats 8 dp in from three edges, with bottom corners concentric with the phone's. The page shows bent at the sheet's rim. Compare with `sheet-*.png`.
- **D2.** Drag the sheet to the top. It fills the screen, its material turns opaque, and the page recedes.
- **D3.** Open and close the Start sheet 10 times. It materialises (blur and bend grow) and never fades as a flat panel. It closes along the same path. No frame exceeds 16.7 ms in the profile build (section 7).
- **D4.** At text scale 1.5 the sheet is a solid full page with Close (unchanged).
- **D5.** While a sheet is open, the bar under it is on Lite (no glass on glass).

**Global:**

- **E1.** The idle frame chart is flat for 5 s on every tab root.
- **E2.** High-contrast text on: the Off tier, with labels in `ink`.
- **E3.** The slop list (ui-ux-standards section 10) is checked on the device captures. The answer to "what would be better without this?" is recorded for the scroll glint.

---

## 11. Website (parity note, not in this pass)

The owner scoped F3 to the app ("on the app level"). If the website's dock wants the same taste later, Chromium supports SVG filter references in `backdrop-filter`, which is how these mocks bend content. Safari and Firefox do not, so the web version would need a frosted fallback. That is a separate decision for the web pass and is not started here.

---

## 12. Mock captures (static HTML at 412 x 915 dp, rendered at 2x; Night and Day)

Source files: `tmp/design-1017/glass/` (`bar.html`, `sheet.html`, `strip.html`, `tiers.html`, `base.css`, `glass.js`, `today.js`, `shoot.sh`).

The captures:

| Capture | Shows |
|---|---|
| `tmp/design-1017/glass/captures/bar-night.png`, `bar-day.png` | The bar over Today's real content (the 17 Oct walk's numbers: "Start repair, 10 min", "Financial Markets is where the most marks are open", 28 weeks, 98 study days). The week rail and Mobi bend at the rims; the lens rests on Today; Start is the one tinted glass. |
| `tmp/design-1017/glass/captures/sheet-night.png`, `sheet-day.png` | "Your study days" as a floating, inset partial sheet with concentric bottom corners, over Today. A lensed rim with a dense reading core, the footer scroll edge, and the pinned main key. |
| `tmp/design-1017/glass/captures/strip-night.png`, `strip-day.png` | The 6-frame lens morph, Today to Practice: 0, 70, 150, 230, 330 and 480 ms. |
| `tmp/design-1017/glass/captures/tiers-night.png`, `tiers-day.png` | The worst case (a volt key and paper-white art under the bar) in Full, Full without the shader, Lite and Off. |

How the mocks stand in for the build:

- SVG filters stand in for the shader: a displacement map for the rim bend, and a per-channel table for the luminance clamp, which approximates the hue-keeping clamp.
- The lifted lens redraws the icons magnified, exactly as section 5.5 specifies.
- The bar uses the current six-slot geometry from app-ia-1016 section 4 only because F1 is still open. Every number scales with `BarGeometry`.

These are compositions, not device proof. G7 owes that.

---

## 13. Questions for the owner (one batch)

1. **Frost amount.** The bar's blur goes from heavy frost (sigma 32, which you asked to strengthen on 15 Oct) to the lighter Apple-style glass, where content shows through and bends (about sigma 12, with labels kept readable by the luminance clamp). Keep the lighter glass, or move it back toward frost? Changing it costs one number.
2. **Lift on touch.** The lens lifts the moment a finger lands (Apple waits for a long press). Keep it immediate?
3. **Scroll glint.** The bar's top light drifts slightly while you scroll and stops when you stop. Keep it or drop it?
4. **Tilt.** Highlights that move when the phone tilts (like the iOS lock screen) are left out for battery and focus. Do you want them later?

---

## 14. Anti-slop acceptance test (12 parts) and the 0/1/2 rubric

The design is scored here. The build is scored again on device in G7.

**12-part test:**

| # | Check | Result |
|---|---|---|
| 1 | Identity with the logo hidden | Pass: the warm lamp ground, volt on exactly one glass element, and the Bricolage/Hanken type are ours. The glass is tinted in our palette, not iOS grey. |
| 2 | One primary action | Pass: Start is the only tinted glass in the bar. A page's own volt key can share the viewport; that is a navigation-pass question for F1, recorded there. |
| 3 | True content | Pass: every mock string and number comes from the 17 Oct walk screenshots (the test account). |
| 4 | Hierarchy at first scan | Pass: the glass recedes at rest, and the content leads. |
| 5 | Intentional composition | Pass: concentric radii, and one shared material spec (section 5.1). |
| 6 | Typography by role | Pass: existing roles; no change. |
| 7 | Every state | Pass: section 5.10 (first frame, shader failure, sparse, busy, slow phone, under a sheet, keyboard, return, idle). |
| 8 | Accessible interaction | Pass on paper: AA contrast is computed (5.3), with reduced motion, reduced transparency and high contrast. The device check is owed (A3, C6, E2). |
| 9 | No pseudo-evidence | Pass: no invented numbers. The contrast figures come from a stated formula, and the performance numbers are targets, not results. |
| 10 | Motion with a reason | Pass: every motion is tied to a touch, a scroll or a state (4.1). Nothing loops, and the screen is idle at rest. |
| 11 | One leading metric plus one guardrail | Leading: the owner's in-use F3 verdict on the device (G7). Guardrail: bar raster p90 ≤ 2.0 ms, with whole-frame p90 ≤ 8 ms on the M06. |
| 12 | What would be better without this? | The scroll glint is the weakest part. It is open question 3, and the first thing to cut if it reads as decoration. The chromatic fringe is tiny and only visible while lifted. |

**0/1/2 rubric** (2 = strong, 1 = partial, 0 = missing):

| Dimension | Score | Note |
|---|---|---|
| Task fit | 2 | Faster, clearer navigation feedback, and floating sheets that keep context. |
| Information architecture | 1 | Unchanged here; F1 and F2 belong to the navigation pass. |
| Content truth | 2 | Real strings; no new numbers in the UI. |
| Readable hierarchy | 2 | The glass recedes and labels are guaranteed AA. |
| Visual specificity | 2 | Warm-tinted glass with a volt key, not stock iOS. |
| Accessibility | 2 | Section 5.11. Device proof is owed. |
| Functional states | 2 | Section 5.10. |
| Trust | 2 | No claims; nothing changes what a student is told. |
| Intentional motion | 2 | Section 5.5 timing is tied to the springs. |
| Performance | 1 | The budget and fallbacks are defined but not yet measured. |
| Responsive integrity | 2 | Everything comes from `BarGeometry` and the text-scale rules. |
| Instrumentation | 1 | One event (`glass_shader_unavailable`) plus the existing raster watch. Usage is not measured. |

Total 21 of 24. This is an internal checklist. The owner signs off.
