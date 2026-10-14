# UI blitz, art track: the subject emblem set

14 October 2026. Branch `ui/art`. Owner ask: "subject art for every subject", no pasted AI pictures, HIGH, Revolut and FamApp as the bar.

## What is wrong now

- Subjects are shown two ways that do not belong together. Large: the lamp-lit raster objects (`assets/art/obj-*.webp`, see `tmp/app-shots/r3/09-practice-tab-night.png`: a red book for Accountancy, a rubber stamp for Business Studies, a kitchen scale with an onion for Economics). Small: stock Lucide line icons (`lib/core/widgets/art/subject_glyph.dart`). The renders read as pasted pictures, several do not say their subject (the owner: "around C it makes a bit of sense; I don't know if everyone makes as much sense"), and they turn to mud under 56 dp. The Lucide row reads as a generic template.
- Nothing ties a subject to the app's own idea, the answer sheet. Every subject card is a dark box with a photo in it (`r3/02-today-top-night.png`, the Today move card shows Mobi but no subject identity at all).
- No subject art moves. Nothing reacts when a student picks a subject.

## The system: "form ink"

Real OMR sheets are printed in a drop-out ink the scanner ignores, so only the student's marks count. Each emblem is a small piece of that sheet:

1. **The tile.** A continuous-corner square (radius 30% of size) in the subject's light field (brief section 3), lit like the desk: a 168 degree two-stop body, a lamp-amber pool at the upper left, a 1 dp edge light along the top, a soft contact shadow. Optional (`framed: false`) when the emblem sits on its own art.
2. **The printed grid.** Answer bubbles, row numbers and the OMR timing track printed in the subject's form ink at 16 to 26%, fading toward the object. Only at 40 dp and up.
3. **The object.** One folded-paper object per subject in three tones (lit paper, shade, deep form ink), lit from the upper left, every main plane split by a crease like Mobi's folded body and the result's folded sheet. No outlines, no gradients on the object beyond the fold, no clip-art strokes.
4. **The mark.** Exactly one volt bubble per emblem, placed where it means something: the equilibrium point on the supply and demand cross, the nucleus, the rising bubble in the flask, the ballot's filled choice, the missing cell of the reasoning grid, the summit on the map, the inked total in the ledger. Volt stays the only bright thing.

Level of detail (optical sizes, as type families do): **glyph** under 40 dp (silhouette, the mark, nothing else), **tile** 40 to 95 dp (grid, fold, main details), **plate** 96 dp and up (timing track, hairline highlights, fine rules).

| Subject | Object | The volt mark |
| --- | --- | --- |
| Accountancy | A ledger sheet with a T account behind a calculator | The equals key |
| Business Studies | A briefcase with a folded plan in the lid | The clasp |
| Economics | Supply and demand curves on graph paper | The equilibrium point |
| English | An open book with a fountain pen nib | The ink at the nib |
| General Test | A three by three pattern grid | The missing answer |
| Mathematics | A protractor with a set square | The compass point at the centre |
| Physics | An atom, three orbits | The nucleus, with an electron travelling |
| Chemistry | A conical flask, liquid in form ink | The rising bubble |
| Biology | A leaf folded on its midrib | A cell on the leaf |
| History | A columned hall with a pediment | The medallion |
| Political Science | A ballot box with the paper going in | The filled choice on the ballot |
| Geography | A map folded in three panels, contour lines | The summit |
| Psychology | A head in profile with a spiral of thought | The centre of the spiral |
| Sociology | Three people whose heads are a row of bubbles | One head, inked |
| Computer Science | A code window with brackets | The first title-bar bubble, a blinking cursor |

Form inks (line work only, never a button or text colour), each paired with its existing light field: amber, indigo, teal, rose, moss, steel, violet, sea green, leaf, terracotta, brick, ocean, plum, ochre, green, sepia for languages.

## Motion

- **Idle** (`animate: true`, off by default): the object floats 0 to -1.6% and rotates within 1.2 degrees over 7.2 s on a sine (HIGH's sticker drift), the contact shadow tightens as it rises, and one subject detail lives (the electron travels its orbit, the flask bubble rises and resets, the cursor blinks at 1.06 s, the summit pin bobs, the heads nod in sequence, the spiral turns). Emblems in a row are phase-shifted by subject so they never move together.
- **Marking** (`marked`): unmarked shows the volt bubble as a form-ink ring; marking inks it from the centre in 260 ms (Motion.ink, emphasized curve) with a 1.25x overshoot ring that fades. This is the subject picker's selection feedback; the caller adds `HapticFeedback.selectionClick`.
- **Reduced motion** (system or in-app): no idle ticker at all, marking snaps.
- Cost: the tile and the object are recorded once per subject, theme, detail level and mark state into a cached `ui.Picture`; each frame draws two pictures and a few shapes under a transform, inside a RepaintBoundary. One ticker per animated emblem, only while animating. No BackdropFilter, no saveLayer, no per-frame layout.

## States

Marked, unmarked, marking (animated), unknown subject (initials on the subject's tile, never a wrong object), language papers (speech bubbles), Night and Daylight, text scale independent (emblems are decorative and excluded from semantics unless a label is given).

## API

```dart
SubjectEmblem(subject: 'accountancy', size: 56, animate: false, marked: true, framed: true, semanticLabel: null)
SubjectIdentity.of('business_studies') // name, short name, formInk(brightness), field(brightness), hasEmblem
```

## Where to wire it (for the merge)

- Today, Tonight's move card: 72 to 96 dp emblem, `animate: true`, beside the subject name, replacing the empty space next to Mobi.
- Practice, Choose your own: the subject tiles become 112 dp emblems (framed false on the tile's field, or framed true on ground); `marked` follows selection with `selectionClick`.
- Review chapters and mistake threads: 32 to 40 dp glyph level as the row avatar (replaces `SubjectGlyphTile`).
- Onboarding subjects step: 56 dp, `marked` follows the pick.
- Result header: 120 to 160 dp plate over the light field.
- You, subjects list and edit subjects: 40 dp.
