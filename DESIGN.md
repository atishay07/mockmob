---
name: MockMob
description: A daylight paper page with an immediately usable illustrative decision replay and a focused Score Recovery Lab.
colors:
  paper: "#f4f5f0"
  paper-raised: "#ffffff"
  paper-sunken: "#eaece3"
  ink: "#10140e"
  ink-2: "#3e453b"
  ink-3: "#5c6357"
  line: "#d9dcd0"
  line-strong: "#c1c5b6"
  volt: "#d2f000"
  volt-edge: "#9db400"
  volt-soft: "#eefbaa"
  volt-ink: "#0b1000"
  slate: "#0f130e"
  slate-2: "#1a211a"
  slate-3: "#29322a"
  slate-line: "rgba(244, 245, 240, 0.13)"
  chalk: "#f4f5f0"
  chalk-2: "#a6ae9f"
  flag: "#b93225"
  flag-soft: "#fbe9e7"
typography:
  display:
    fontFamily: "Gabarito, system-ui, sans-serif"
    fontSize: "clamp(2.3rem, 10.5vw, 4.75rem)"
    fontWeight: 800
    lineHeight: 0.98
    letterSpacing: "-0.035em"
  headline:
    fontFamily: "Gabarito, system-ui, sans-serif"
    fontSize: "clamp(1.75rem, 6.6vw, 3rem)"
    fontWeight: 800
    lineHeight: 1.03
    letterSpacing: "-0.03em"
  title:
    fontFamily: "Gabarito, system-ui, sans-serif"
    fontSize: "clamp(1.25rem, 4.4vw, 1.6rem)"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-0.02em"
  subhead:
    fontFamily: "Gabarito, system-ui, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "-0.01em"
  lead:
    fontFamily: "Hanken Grotesk, system-ui, sans-serif"
    fontSize: "clamp(1.0625rem, 3.7vw, 1.25rem)"
    fontWeight: 400
    lineHeight: 1.5
  body:
    fontFamily: "Hanken Grotesk, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.65
  small:
    fontFamily: "Hanken Grotesk, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: "Gabarito, system-ui, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0.06em"
  measure:
    fontFamily: "Geist Mono, ui-monospace, monospace"
    fontSize: "0.6875rem"
    fontWeight: 500
    letterSpacing: "0.06em"
    fontFeature: "tnum"
  recovery-display:
    fontFamily: "Gabarito, system-ui, sans-serif"
    fontSize: "clamp(44px, 5.7vw, 76px)"
    fontWeight: 800
    lineHeight: 1.02
    letterSpacing: "-0.035em"
  recovery-lead:
    fontFamily: "Hanken Grotesk, system-ui, sans-serif"
    fontSize: "clamp(21px, 2vw, 27px)"
    fontWeight: 600
    lineHeight: 1.4
  recovery-headline:
    fontFamily: "Gabarito, system-ui, sans-serif"
    fontSize: "clamp(26px, 4vw, 40px)"
    lineHeight: 1.12
    letterSpacing: "-0.025em"
rounded:
  r-1: "10px"
  r-2: "14px"
  r-3: "20px"
  r-4: "28px"
  pill: "999px"
spacing:
  gutter: "20px"
  gutter-md: "32px"
  gutter-lg: "40px"
  rhythm: "56px"
  rhythm-md: "88px"
  rhythm-lg: "112px"
components:
  button-primary:
    backgroundColor: "{colors.volt}"
    textColor: "{colors.volt-ink}"
    typography: "{typography.subhead}"
    rounded: "{rounded.r-2}"
    padding: "0.75rem 1.25rem"
    height: "54px"
  button-primary-hover:
    backgroundColor: "#dbfb14"
  button-primary-active:
    backgroundColor: "{colors.volt}"
    textColor: "{colors.volt-ink}"
  button-secondary:
    backgroundColor: "{colors.paper-raised}"
    textColor: "{colors.ink}"
    typography: "{typography.subhead}"
    rounded: "{rounded.r-2}"
    padding: "0.75rem 1.25rem"
    height: "54px"
  button-onnight:
    backgroundColor: "{colors.volt}"
    textColor: "{colors.volt-ink}"
    typography: "{typography.subhead}"
    rounded: "{rounded.r-2}"
    padding: "0.75rem 1.25rem"
    height: "54px"
  button-quiet:
    backgroundColor: "transparent"
    textColor: "{colors.ink-2}"
    typography: "{typography.subhead}"
    height: "44px"
  chip:
    backgroundColor: "{colors.paper-raised}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "0.5rem 0.875rem"
    height: "44px"
  chip-hover:
    backgroundColor: "{colors.volt-soft}"
  tag:
    backgroundColor: "{colors.paper-sunken}"
    textColor: "{colors.ink-2}"
    typography: "{typography.label}"
    rounded: "6px"
    padding: "0.25rem 0.5rem"
  tag-volt:
    backgroundColor: "{colors.volt}"
    textColor: "{colors.volt-ink}"
  panel:
    backgroundColor: "{colors.paper-raised}"
    textColor: "{colors.ink}"
    rounded: "{rounded.r-3}"
    padding: "1.25rem"
  panel-sunken:
    backgroundColor: "{colors.paper-sunken}"
    textColor: "{colors.ink}"
    rounded: "{rounded.r-3}"
    padding: "1.25rem"
  screen:
    backgroundColor: "{colors.slate}"
    textColor: "{colors.chalk}"
    rounded: "{rounded.r-3}"
    padding: "1rem 0.875rem 1.125rem"
  input:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.r-2}"
    padding: "0.75rem 0.875rem"
    height: "52px"
  nav-link:
    backgroundColor: "transparent"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.r-1}"
    padding: "0 0.75rem"
    height: "44px"
  nav-link-active:
    backgroundColor: "{colors.paper-sunken}"
    textColor: "{colors.ink}"
  drill-option:
    backgroundColor: "{colors.slate-2}"
    textColor: "{colors.chalk}"
    typography: "{typography.body}"
    rounded: "{rounded.r-2}"
    padding: "0.75rem 0.875rem"
    height: "56px"
  drill-option-correct:
    backgroundColor: "{colors.volt}"
    textColor: "{colors.volt-ink}"
  drill-option-wrong:
    backgroundColor: "#2a1614"
    textColor: "#ffc9c2"
  plan:
    backgroundColor: "{colors.paper-raised}"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.r-4}"
    padding: "1.5rem"
  plan-featured:
    backgroundColor: "{colors.paper-raised}"
    textColor: "{colors.ink}"
    rounded: "{rounded.r-4}"
    padding: "2.25rem 1.5rem 1.5rem"
  recovery-preview:
    backgroundColor: "{colors.slate}"
    textColor: "{colors.chalk}"
    rounded: "{rounded.r-2}"
  recovery-action:
    backgroundColor: "{colors.volt}"
    textColor: "#182024"
    rounded: "{rounded.r-1}"
    padding: "14px 20px"
    height: "48px"
---

# Design System: MockMob

## Overview

**Creative North Star: "Daylight Page, Night Exam."**

The marketing surface is a sheet of warm off-white paper carrying near-black ink. The homepage's interactive recovery replay is cut into that paper as a slate panel; the content-evidence band and footer share its dark register. The Score Recovery Lab extends the world with a bright reading canvas and a dark decision timeline. The page is daylight and the replay is night: the contrast separates explanations from focused examination. Volt behaves as pigment, not as a light source.

The structure is deliberately conventional: a clear promise, immediate interactive example, subject links, three recovery steps, evidence, pricing, FAQ and closing action. The approved recovery direction keeps the existing materials and the keycap signature: raised marketing controls rest above a hard bottom edge and collapse flush when pressed. The homepage primary action opens the illustrative replay without login; a separate secondary action joins the free pilot. The adjacent caption states that the diagnostic opens after content checks pass. Launch scope is English, Accountancy, Business Studies and Economics for CUET UG 2027.

The confirmed device floor is a budget Android on patchy 4G. The recovery homepage uses a simple two-state replay rather than an ambient animation or performance chart. Its headline is static. The retained count-up, headline decode and drill resolution remain patterns on other marketing surfaces; their reduced-motion alternatives remain part of the system. No canvas, WebGL or scroll-driven choreography is required by this world.

Scope boundary: marketing uses `.mm`; the recovery lab and review/progress records use the dedicated `.recovery-` components described below. The surrounding authenticated shell and in-app credits sheet retain their legacy styling. Their visual effects are not reusable recovery patterns.

**Provenance:** historical seed key `b256fb04` is inherited from the established paper/slate/volt world, not a new roll. The recovery journey was approved on October 1, 2026. The supplied finish-review disposition is **ship**, with all six material fixes resolved. This scan records the source and the four screenshots in `artifacts/recovery/`; the lab screenshots are explicitly development previews with illustrative data, not evidence of student gains or live content availability.

**Key Characteristics:**

- Paper ground, near-black ink, one accent — volt — used as a surface, never as light.
- The product's own screens invert to slate inside the bright page.
- Keys, not buttons: a resting lift over a hard bottom edge, collapsing flush on press.
- Ambient depth uses offset plus blur; keycap edges and focus rings have separate roles.
- Phone-first layouts, full-width hero actions and a thumb-zone replay shortcut.
- Gabarito for display and controls, Hanken Grotesk for reading, Geist Mono for measurement.
- Recovery replay changes only after a deliberate selection; observed marks and inferred next moves remain distinct.

## Colors

A warm paper ground with a green-cast near-black ink, one high-chroma acid accent, and an inverted slate family for focused replay, evidence and footer surfaces.

### Primary

- **Volt** (`{colors.volt}`): the action colour. It appears as a filled surface carrying near-black ink — primary keys, the correct-answer fill, step-number badges, the highlighted word in the headline, `::selection`, the live-dot, progress pips, bar fills. On slate it is also allowed to be a text and graphic colour: scores, verdict emphasis, checklist icons, footer link hover.
- **Volt Edge** (`{colors.volt-edge}`): the darker sibling. It is the physical bottom edge under a primary key, the underline colour on inline links, and volt's stand-in for any small non-text mark that has to sit on paper.
- **Volt Soft** (`{colors.volt-soft}`): a pale wash used only for the input focus ring and the chip hover state. It is a state, not a surface fill for content.
- **Volt Ink** (`{colors.volt-ink}`): the near-black that rides on top of every volt fill.

### Secondary

The night family concentrates replay and evidence against the bright reading ground.

- **Slate** (`{colors.slate}`): the homepage replay, evidence band, retained `.mm-screen` patterns and footer.
- **Slate 2** (`{colors.slate-2}`): the raised surface inside night — answer keys, readout cards, compass rows.
- **Slate 3** (`{colors.slate-3}`): borders on night surfaces, unfilled bar tracks, the key-letter chip behind A/B/C/D.
- **Slate Line** (`{colors.slate-line}`): the hairline divider on night, a translucent chalk so it survives against every slate step.
- **Chalk** (`{colors.chalk}`) and **Chalk 2** (`{colors.chalk-2}`): the two text weights on night — primary reading and secondary/caption.

### Tertiary

- **Flag** (`{colors.flag}`) and **Flag Soft** (`{colors.flag-soft}`): the daylight alert pair, used for error message text and error tags. Sparse by design; the system has one alert colour, not a status palette.

Diagnostic bands (readout fills, fit labels) run volt for strong, amber `#e0b93f` for mid, and coral `#e0685a` for low. On night, the wrong-answer state uses its own confined trio: `#2a1614` surface, `#7d3128` border, `#ffc9c2` text.

### Neutral

- **Paper** (`{colors.paper}`): the page ground and the browser theme colour. Warm, slightly green, never pure white.
- **Paper Raised** (`{colors.paper-raised}`): pure white, for panels, plan cards, chips and inputs that need to sit above the ground.
- **Paper Sunken** (`{colors.paper-sunken}`): the recessed band — alternating sections, tags, table group headers, nav link hover.
- **Ink / Ink 2 / Ink 3** (`{colors.ink}` / `{colors.ink-2}` / `{colors.ink-3}`): headings and emphasis, body copy, and captions/metadata respectively. All three clear 4.5:1 on paper.
- **Line / Line Strong** (`{colors.line}` / `{colors.line-strong}`): hairline dividers and section rules; the stronger one for control borders and the secondary key's bottom edge.

### Named Rules

**The Two Volts Rule.** On paper, volt is a fill that carries near-black ink; when volt's identity is needed as a mark rather than a surface — an underline, an edge, a small icon, the logo dot — it becomes Volt Edge. Volt is never body-text colour on paper. On slate, volt is free to be text and graphics. The system enforces this in code: the legacy `.text-volt` utility is reassigned to ink inside `.mm`.

**The No-Halo Rule.** Volt never appears as a decorative glow, blur, spread or text-shadow in the recovery world. The legacy marketing glows are explicitly zeroed inside `.mm`. A solid volt keyboard-focus outline on the dark replay is a functional state, not illumination.

**The Night-Is-Focus Rule.** The dark family concentrates attention on the interactive replay, its timeline and the evidence checklist, and anchors the footer. Reading and reflection stay on paper. The homepage evidence band is a real use of slate; slate is not restricted to product screenshots.

## Typography

**Display Font:** Gabarito (with `system-ui`, `sans-serif`) — loaded at 500/600/700/800/900
**Body Font:** Hanken Grotesk (with `system-ui`, `sans-serif`)
**Label/Mono Font:** Geist Mono (with `ui-monospace`, `monospace`) — loaded at 400/500/600

**Character:** Gabarito is a warm, wide-countered geometric sans that stays friendly at 800 weight and tight tracking — it carries the headlines, every button label, every heading, and all panel chrome, so the voice of the interface and the voice of the page are the same. Hanken Grotesk handles reading at a comfortable 1.65 line-height. Geist Mono appears only where the page is reporting a number or stamping a machine label.

Marketing surfaces run on a 16px root through `html:has(.mm)`. The legacy authenticated shell uses its own root; recovery-specific heading and control sizes are recorded directly from their styles.

### Hierarchy

- **Display** (800, `clamp(2.3rem, 10.5vw, 4.75rem)`, 0.98, -0.035em): one per page. Page headline only, balanced wrapping.
- **Headline** (800, `clamp(1.75rem, 6.6vw, 3rem)`, 1.03, -0.03em): section openers. Gets 2.5rem of clearance above it and less below.
- **Title** (700, `clamp(1.25rem, 4.4vw, 1.6rem)`, 1.15, -0.02em): feature-row and sub-section headings.
- **Subhead** (700, 1.0625rem, 1.25, -0.01em): FAQ questions, nav sheet items, card headings, drill verdicts.
- **Lead** (regular, `clamp(1.0625rem, 3.7vw, 1.25rem)`, 1.5, Ink 2): the retained `.mm-lead` treatment, held to 34ch on phones and 46ch from 768px.
- **Body** (regular, 1rem, 1.65, Ink 2): capped at 68ch. Long-form article paragraphs run 1.0625rem/1.7 at a 70ch measure.
- **Small** (regular, 0.875rem, 1.55, Ink 3): captions, footnotes, dock note, metadata.
- **Label** (Gabarito 700, 0.6875–0.8125rem, +0.06em to +0.1em, uppercase): panel titlebars, tags, footer column heads, table group heads.
- **Measure** (Geist Mono, tabular figures): compact readings, timestamps and machine measurements.
- **Recovery display** (800, `{typography.recovery-display}`): the homepage promise, with the second phrase on its own block and balanced wrapping.
- **Recovery lead** (600, `{typography.recovery-lead}`): a stronger explanatory sentence that may wrap naturally on a phone.
- **Recovery headline** (`{typography.recovery-headline}`): lab, review and progress page titles. Lab facts use tabular figures at 36px, falling to 28px at 520px and below.

### Named Rules

**The Mono-Is-Measurement Rule.** Geist Mono carries compact measurements such as replay timestamps and machine labels. Human titles and prominent homepage marks or prices use Gabarito. Lab fact figures use tabular numerals. Preserve the distinction rather than forcing every numeral into the mono face.

**The Negative-Tracking Rule.** The display face tightens as it grows: -0.035em at display, -0.03em at headline, -0.02em at title, -0.01em at subhead, and down to -0.05em on the largest figures and prices. Positive tracking on the display face is permitted only in uppercase labels at 0.8125rem and below.

**The Short-Lead Rule.** Keep the lead to one sentence and allow natural wrapping. The incumbent `.mm-lead` measure is 34ch on phones and 46ch from 768px; the recovery lead uses its own larger, semibold treatment.

## Layout

The page is a single centred column of paper. `.mm-wrap` is 1200px max with a responsive gutter, `--tight` narrows to 820px for FAQ and closing sections, and `--read` narrows to a 68ch measure for prose. The gutter also respects `env(safe-area-inset-left)`.

Two variables carry the whole spatial system and both step twice:

- **Gutter:** 20px → 32px (768px) → 40px (1080px)
- **Rhythm** (section `padding-block`): 56px → 88px (768px) → 112px (1080px)

Within a section the rhythm is small and regular: 1rem between stacked elements, 0.875rem in the hero copy stack, 2.5rem between a section intro and its content, and 2.5rem of clearance above any heading that follows content — more space above a heading than below it, always.

Breakpoints are content-driven rather than device-named. Retained marketing patterns use **640px** (action rows go horizontal), **720px** (figures and credit packs go 3-up), **760px** (contact/table patterns), **768px** (gutter, rhythm, panel padding and chip rails), **860px** (plan cards go 2-up), **900px** (dock hides and desktop nav appears), **960px** (footer goes 4-up), and **1080px** (gutter/rhythm increase). Recovery adds `max-width: 760px` for its stacked homepage and `max-width: 520px` for compact lab facts and stacked records. Both query forms exist in the built system.

The recovery homepage above 760px uses a `1.06fr / 1fr` hero with a gap of `clamp(32px, 5vw, 80px)`. The promise and two actions occupy the left side; the immediately usable illustrative replay occupies the right. Evidence and price sections use two columns; recovery steps use three. At 760px and below these sections stack with a 32px column gap, the hero begins 40px below the nav, and the headline is capped at 12ch. Subject links wrap rather than truncate. The price divider changes from a vertical rule to a horizontal one. The older `.mm-hero` split remains a separate reusable pattern, not the current homepage geometry.

Feature sections are alternating full-width rows separated by hairlines, not a card grid. The `--flip` modifier reorders the media to lead. This is a deliberate refusal of the bento layout the site previously used.

The lab is a centred reading panel (960px maximum), with `clamp(20px, 4vw, 44px)` padding, 24px outer block margin and a 20px radius. Its three fact cells remain three columns on a phone, with smaller figures and labels at 520px and below. The full-width decision range has a minimum 44px interaction height. Reflection and next action follow the replay vertically. Review and progress records are hairline-separated flex rows, stacking their label and detail at 520px and below.

### Named Rules

**The Phone-First Rule.** The promise, replay action, pilot action and content-calibration disclosure remain readable on a narrow phone. Stack sections and wrap labels before reducing their meaning. Use the breakpoint form that expresses the existing component; the recovery implementation includes both minimum- and maximum-width queries.

**The 44px Rule.** Interactive targets have a 44px floor. The homepage replay's circular timeline targets are 44×44px and its enclosing buttons include the timestamp and label. The lab range input is at least 44px high. Marketing keys are 54px, drill answers 56px, fields 52px; lab actions are at least 48px. This is a late-night one-handed product; the floor is functional, not decorative.

**The Thumb-Zone Rule.** Below 900px the homepage dock links directly to the illustrative replay without login and says so beside the action. The recovery hero retains both replay and pilot actions on mobile, so joining remains discoverable beside the calibration disclosure. The dock spacer reserves page-end clearance and `--mm-dock-lift: 74px` clears eligible floating elements. The replay anchor has 90px scroll clearance below the sticky navigation.

## Elevation & Depth

The system is layered rather than lifted, and it uses two physically distinct kinds of depth that must not be confused.

**Ambient depth** is a three-step ink shadow, always with vertical offset and blur, used to separate a surface from the paper: `--sh-1` on panels and resting cards, `--sh-2` on primary keys and the price block, `--sh-3` on the product screens and the featured plan. Slate screens carry the heaviest one because they sit deepest into the page.

**Structural depth** is the keycap edge: a zero-blur offset shadow paired with an equal upward translate, so the control genuinely rests above a physical lip. Pressing it collapses both — the translate goes to 0 and the edge goes to `0 0 0` — which is why it reads as a key rather than as a decorated rectangle.

Tonal layering does the rest. Paper → Paper Raised → Paper Sunken and Slate → Slate 2 → Slate 3 handle nearly all surface separation without any shadow at all; sunken panels and volt panels explicitly set `box-shadow: none`.

### Shadow Vocabulary

- **Ambient 1** (`box-shadow: 0 1px 2px rgba(16,20,14,0.05), 0 2px 6px rgba(16,20,14,0.05)`): panels, plan cards, chips at rest.
- **Ambient 2** (`box-shadow: 0 2px 4px rgba(16,20,14,0.05), 0 10px 24px rgba(16,20,14,0.08)`): primary keys, the price block, secondary key on hover.
- **Ambient 3** (`box-shadow: 0 6px 12px rgba(16,20,14,0.06), 0 26px 56px rgba(16,20,14,0.11)`): product screens and the featured plan.
- **Recovery preview** (`box-shadow: 0 18px 46px rgba(16,20,14,0.12)`): the homepage illustrative replay; the lab reading panel itself is flat.
- **Key edge, primary** (`box-shadow: 0 4px 0 var(--volt-edge)`, with `transform: translateY(-4px)`): the primary key's bottom lip.
- **Key edge, secondary** (`box-shadow: 0 4px 0 var(--line-strong)`, with `transform: translateY(-4px)`): the secondary key.
- **Key edge, on night** (`box-shadow: 0 3px 0 #0a0d09`, with `transform: translateY(-3px)`): drill answer keys.
- **Marketing focus** (`outline: 3px solid var(--ink); outline-offset: 2px`): paper controls. The dark homepage replay uses a solid 2px volt outline at 5px offset; lab actions use a 3px dark outline at 4px offset.
- **Field focus** (`border-color: var(--ink); box-shadow: 0 0 0 3px var(--volt-soft)`): the one deliberate zero-offset shadow in the system, and it is a focus ring rather than elevation.

### Named Rules

**The Key Rule.** A raised control rests translated up by exactly its edge height and collapses flush on `:active`. The hard offset shadow is legitimate only as a keycap edge — paired with the resting lift and the press collapse. A hard offset shadow on a surface that cannot be pressed is not part of this system.

**The Offset-And-Blur Rule.** Ambient depth always has vertical offset. No zero-offset shadow, no halo, no ring-glow, no coloured spread — the one exception is the field focus ring, and it is scoped to focus.

## Shapes

Radius scales with the weight of the thing it wraps: **10px** on small controls (nav links, compass rows), **14px** on keys, fields and answer options, **20px** on panels, product screens and the comparison table, **28px** on cards that represent a commitment — plan cards and the price block. Chips, the live dot, bar tracks and step numbers are full pills (999px). Text marks and the key-letter chips take a small 3–8px softening.

Recovery uses the same restrained rounding with specific component shapes: a 14px homepage replay, 44px circular timeline markers, a 20px lab canvas, a 12px dark replay inset, 10px lab actions and an 8px reflection field. Its steps are plain hairline-topped columns without the older numbered connector.

Borders are structural, not decorative: a 1px hairline in Line for dividers and panel edges, Line Strong for anything with a stroke that a finger will touch. On night, the hairline is a translucent chalk so it holds across all three slate steps.

Emphasis is carried by weight, not colour. A featured plan gets a 2px ink border and a deeper shadow rather than a coloured frame; a highlighted comparison row gets an inset 3px ink rule plus a 5% ink tint. Flags and badges are tabs that hang off the top edge of a card with the corners rounded only at the bottom (`border-radius: 0 0 8px 8px`), so they read as attached rather than floating.

Two shapes carry meaning on their own: the **numbered step connector**, a 2px Line Strong rule that runs vertically between step markers on phones and horizontally between them from 900px, which makes the sequence itself the information; and the **chip rail**, a horizontally snapping overflow scroller on phones that becomes a wrapped flex row at 768px.

## Components

### Buttons

Buttons in this system are keys. Character: physical, committing, and pressable.

- **Shape:** softly rounded (14px), full-width on phones and auto-width from 640px, minimum 54px tall, label in Gabarito 800 at 1rem with -0.01em tracking.
- **Primary:** volt fill, near-black ink, resting 4px above a Volt Edge lip plus Ambient 2. Pressing collapses to flush with Ambient 1.
- **Hover / Focus:** hover only lifts the fill (`#dbfb14`) — it never adds a glow, and it is wrapped in `@media (hover: hover)` so a phone tap never sticks in a hover state. Focus is a 3px ink outline at 2px offset.
- **Secondary:** white fill, ink label, 4px Line Strong lip plus Ambient 1. Hover deepens the lip to Ink 3.
- **On Night:** the primary key without the ambient shadow — inside a slate panel, ambient depth would be invisible and the lip does all the work.
- **Quiet:** transparent, Ink 2 label, 44px, no lift and no shadow. For the third-tier action only.
- **Disabled:** 45% opacity with the lift and the edge both removed — a disabled key is already pressed.
- **Icons:** inline SVG at 18px inside the key, never a glyph in a tile.
- **Lab actions:** flat volt controls, 10px corners, `14px 20px` padding and a 48px minimum height. They use a dark focus outline and do not borrow the marketing keycap lift. Preserve this existing difference between the reading workflow and marketing keys.

### Chips

- **Style:** white pill with a Line Strong hairline, Gabarito 700 at 0.875rem, 44px tall, non-wrapping.
- **State:** hover fills Volt Soft and strengthens the border to Volt Edge. Chips are navigation (subject rails, article topics), not filters — there is no selected state.

### Tags

- **Style:** a small sunken rectangle (6px) with uppercase Gabarito at 0.6875rem, +0.06em. Variants: volt fill for emphasis, Flag Soft for alerts.

### Cards / Containers

- **Corner Style:** 20px for panels and product screens; 28px for plan and price cards.
- **Background:** white for raised panels, Paper Sunken for recessed ones, Volt Soft for the rare emphasis panel, Slate for product screens.
- **Shadow Strategy:** Ambient 1 at rest for panels and plans; Ambient 3 for product screens and the featured plan. Sunken and volt panels carry no shadow at all.
- **Border:** 1px Line on panels, Line Strong on cards; 2px ink on a featured plan.
- **Internal Padding:** 1.25rem on phones, 1.75rem from 768px for panels; plan and price cards go 1.5rem → 2.5rem.

### Inputs / Fields

- **Style:** paper-filled with a Line Strong hairline, 14px radius, 52px tall, 16px body text so iOS does not zoom on focus. Placeholder in Ink 3.
- **Focus:** border darkens to ink and a 3px Volt Soft ring appears outside it. The native outline is suppressed here only because the ring replaces it.
- **Disabled:** 60% opacity.

The lab reflection field is a labelled white textarea (8px radius, 14px padding, at least 110px tall, 1,000-character maximum). Saving announces its state below the action; a failed save preserves the reflection for another attempt.

### Navigation

- **Style:** a sticky paper bar with a bottom hairline that only appears once the page has actually scrolled past 4px, so the top of the page reads as one uninterrupted sheet. 60px row with 6px of vertical padding — the headroom exists because the primary key sits 3px proud of its own edge and would otherwise be shaved by the sticky bar.
- **Links:** Gabarito 600 at 0.9375rem in Ink 2, 44px tall, 10px radius. Hover and current-page both resolve to ink on Paper Sunken.
- **Mobile:** links collapse below 900px into a 48px hamburger that opens a full-width sheet of 52px rows separated by hairlines. The nav CTA and log-in link are desktop-only; on mobile their job belongs to the dock.
- **Dock:** a fixed bottom bar at 92% paper with a 10px backdrop blur behind `@supports`, a Small note on the left, and one primary key on the right. It slides out on `translateY(120%)` rather than fading.
- **Recovery destinations:** the app journey uses Today, Practice, Review, Progress and Account. The homepage dock specifically opens `/#recovery-example`; the separate pilot action opens signup or the dashboard for an authenticated visitor.
- **Footer:** slate, with uppercase Gabarito column heads in Chalk 2, 44px link targets, and volt on link hover — one of the few places volt is a text colour, and it is on night.

### Illustrative Recovery Replay (homepage signature)

A slate figure with a titlebar, an explicit “Interactive example” label and two selectable timeline moments. Both are native buttons with `aria-pressed`; a solid volt circle, border and text identify the selected moment. Each circular target is 44×44px. The question title and decision summary stay in place while the chosen letter, outcome and marks change; the decision summary is announced through `aria-live="polite"`. Keyboard focus uses a visible volt outline on slate.

The initial example shows the first answer earning +5; selecting the revisit shows −1 and describes the six-mark change. These are illustrative values, not a visitor's score, predicted recoverable marks or demonstrated gains. The figure caption carries that distinction, while the suggested two-pass strategy is labelled “A next move, not a verdict.” No login, fetch, slider or autoplay is required to try the example. On mobile the panel follows the promise and actions; its body padding falls from 26px to 22px and its heading from 27px to 25px.

### Score Recovery Lab

Redesigned 4 October 2026 after owner feedback ("5/10, too tall, weird replay slider"). The result page
runs in one order: **summary → Score Recovery Lab → answer by answer**, all on Arena tokens (both themes).

- **Summary** (`.rp-hero`): Pip, marks as "9 / 50 marks" (not a percent), one data-driven line naming
  what cost the most, four stat tiles and a clickable question strip (green right, red wrong, outlined
  blank, amber dot = answer changed). Each cell jumps to and opens that answer.
- **Lab** (`.srl`): headline "Where your N missing marks went", a stacked bar (scored / lost on wrong at
  6 each / unearned on blanks at 5 each), then three numbered steps. **Find**: chapters ranked by marks
  lost, plus factual observations (right→wrong changes, fast wrong picks under 20 s, a concentrated
  chapter, blanks with +5/−1 guess arithmetic), each with Q chips. **Repair**: progress "n of m
  repaired", a queue of mistake chips and one CTA that jumps to the next unrepaired mistake and runs
  Mistake Repair. **Prove**: fresh verified questions when the gate has five; otherwise regular
  chapter practice, labelled as not proof. The device decision log and the playbook note sit in a
  closed `<details>` at the bottom. The old range slider is gone.
- **Answer by answer** (`.rp-q`): collapsed accordion rows (two-line question, verdict, chapter, time,
  "Answer changed", "Repaired"); only the first wrong answer opens by default. Wrong answers keep the
  book explanation folded and lead with Mistake Repair. A finished repair offers "Next mistake: Qn".
- Logic lives in `data/session_recovery.js` (pure, tested). Nothing on the page forecasts recovered marks.

### Recovery Review / Progress Records

Review, progress and the exam playbook share the paper lab canvas and hairline-separated records. Loading and fetch-error messages are visible; unavailable review queues and first-diagnostic states carry readable explanations. Progress labels distinguish fresh delayed checks from “More evidence needed.” Playbook reflections remain “awaiting repeated evidence.” Rows stack on narrow phones without truncating the subject, concept or reflection.

### The Drill (retained practice pattern)

A retained no-signup practice pattern, separate from the recovery homepage's illustrative replay: a slate `.mm-screen` with a titlebar, breathing volt dot, subject name, five progress pips, a Gabarito question at 1.1875rem (1.375rem from 768px), and four full-width 56px answer keys with mono key-letter chips on Slate 3.

This retained component carries a rehearsed answer-resolution sequence:

1. **0ms** — the chosen key settles onto the board. Correct fills volt and plays `mm-settle` (0.34s, a 1.5% overshoot); wrong goes to the confined night-error trio and plays `mm-knock` (0.36s, a ±3px lateral shake).
2. **90ms** — the unchosen options recede to 38% opacity and 98.5% scale over 0.42s.
3. **180ms** — the reason rises in above a hairline, 0.34s on a decelerating curve.
4. **260ms** — the forward key fades in on opacity only, because animating its transform would destroy its resting lift.
5. **320ms** — the panel foot is scrolled into reach, because the reveal grows the panel enough to push that key under the sticky dock on a 360×800 phone.

Under `prefers-reduced-motion` every duration inside `.mm` drops to 0.001ms and the scroll becomes instant, and the drill still works exactly the same way.

### Figures Band

Three cells in a 1px-gap grid on a Line background, so the dividers are the grid itself. Values are Gabarito 800 at `clamp(2rem, 8vw, 2.75rem)` with tabular figures; the count-up is hand-rolled on `requestAnimationFrame` over 900ms with a cubic ease-out, gated on an IntersectionObserver, and it renders the true number straight through when reduced motion is on or when JS has not run. Every figure has a truthful static floor so the band never renders empty.

This remains an incumbent pattern on other surfaces; the recovery homepage has no live figures band and makes no inventory or student-gain claim.

### Plans

Two cards from 860px. The featured one is marked with a 2px ink border, Ambient 3, and a flag tab hanging off its top-left corner in ink on paper — never a coloured "popular" glow. Feature checks are ink; on the featured plan they shift to Volt Edge. The price is Gabarito 800 at `clamp(2.75rem, 12vw, 3.5rem)` with -0.05em tracking and the cycle suffix dropped to 0.9375rem Ink 3.

The recovery homepage instead uses a ruled two-column price section, stacking on phones. Its prominent Gabarito price is followed by one-time access through July 31, 2027, no auto-renewal, and a release-gate note for the full recovery workflow. The complete comparison remains on the pricing surface.

### FAQ

Native `<details>` with the marker suppressed and replaced by a CSS chevron built from two 2.5px borders, rotating 180° over 0.2s. 60px summary rows in Gabarito 700, hairline-separated, body capped at 68ch.

### Comparison Table

Stacked and labelled on phones — each cell prints its column name from `data-label` in mono uppercase before its value — and becomes a real three-column table with an ink header band at 760px. Emphasised rows use an inset ink rule and a 5% ink tint rather than a volt wash, because volt is an action surface in this world.

## Do's and Don'ts

### Do:

- **Do** treat volt as a surface. A volt fill carries Volt Ink on top of it; a volt mark on paper becomes Volt Edge.
- **Do** give every raised control a resting lift and a matching bottom edge, and collapse both on `:active`. That press is the system's signature.
- **Do** keep focused replay and evidence surfaces dark within the paper page; keep explanation and reflection readable on paper.
- **Do** verify the phone composition with natural wrapping, stacked sections and visible replay and pilot actions.
- **Do** clear the 44px target floor, including replay markers and the lab range; use the component's established larger action height.
- **Do** keep the lead to a short sentence and body copy within a comfortable reading measure.
- **Do** use mono for compact measurements and tabular figures for changing values.
- **Do** label illustrative values, observed events and inferred interventions separately; leave content-calibration disclosures adjacent to the pilot action.
- **Do** ship a truthful resting value for every live counter, so a slow or failed fetch still renders a real number.
- **Do** wrap every hover treatment in `@media (hover: hover)`.
- **Do** use inline SVG at 15–20px sitting directly next to its label.

### Don't:

- **Don't** put a kicker or eyebrow above a heading. The inherited `.eyebrow` and `.mono-label` classes are set to `display: none` inside `.mm` on purpose — the headline is the entry point.
- **Don't** use volt as decorative glow, halo, spread or text-shadow. A solid keyboard-focus outline remains a functional state.
- **Don't** set volt or Volt Edge as body-text colour on paper. Volt-as-text is a night-only privilege.
- **Don't** add a zero-offset shadow. Ambient depth always has vertical offset; the only zero-offset value in the system is the field focus ring.
- **Don't** reach for a translucent or blurred card. `.glass` is explicitly reduced to a flat white panel with `backdrop-filter: none` inside `.mm`; the only surviving blur is the dock's, behind an `@supports` guard.
- **Don't** build icon tiles — an icon inside a rounded coloured square as a feature marker. Icons are inline, at text size, next to their label.
- **Don't** lay features out as a bento or card grid. They are alternating full-width rows separated by hairlines.
- **Don't** animate anything on a marketing page beyond the drill's rehearsed resolution, the breathing live dot, the count-up, the headline decode, and the reveal rise. Everything else is still and legible.
- **Don't** add an animation library to a marketing page. The device floor is a budget Android on patchy 4G; the count-up and the decode are hand-rolled for exactly this reason.
- **Don't** treat the older drill hero or numbered steps as the current recovery homepage composition.
- **Don't** turn illustrative marks, repeated questions or uncalibrated score differences into improvement claims.
- **Don't** reach into the legacy app classes (`.glass`, `.btn-volt`, `.q-option`, `.stat`) or the `.mmx-` sheet when building a new marketing surface. Their appearance inside `.mm` is a compatibility shim for pages not yet converted, not a pattern to extend.

**Not canonized:** the unused recovery eyebrow selector and the legacy assistant launcher's glowing orb visible in the development lab screenshots are not recovery design patterns. Local lab color literals are documented only within their component; they do not redefine the inherited palette. The four screenshots establish the recorded composition, while source establishes states that a static image cannot exercise; no live production calibration, checkout or student progress is inferred from these artifacts. Reference rationale remains in `docs/brain/DESIGN-REFERENCES.md`.

---

## Landing world: Night Arena (October 2, 2026)

**Supersedes the paper homepage described above, for `/` only.** The owner reviewed the
paper rebuild against the previous mockmob.in, prepium.in and ug.preparoo.app and
rejected it as less polished. Marketing sub-pages, `/login` and `/signup` keep the paper
world. Authenticated app screens are untouched.

- Scope `.mm.lp` (`src/app/landing.css`). It re-tokens the `.mm` system to night
  (`--paper #070908`, `--paper-raised #0e120e`, `--ink #f2f4ec`), so the shared nav,
  footer, FAQ, dock and drill follow without forks. Volt `#D2F000` stays the only accent.
- Depth: hairline grid + dot matrix aligned to its intersections (CSS), a volt dot layer
  revealed under the pointer (fine pointer only, one rAF, two CSS variables), soft volt
  aurora, bottom fade. Product screens are raised surfaces with a top-edge highlight.
- Motion: only `opacity` and `transform` animate. `Reveal` flips `data-in` on scroll; CSS
  does the rest (stagger via `--i`, bars grow, palette cells arrive in order, step rules
  draw). Hero uses CSS keyframes, never hiding the H1. Marquee pauses on hover. Floating
  chips are ambient only. Reduced motion shows everything and animates nothing.
- Hover and focus change colour, border or shadow only. Never size or position. The old
  scrambling headline word (`DecodeWord`) re-ran on hover and reflowed the page; it is
  deleted. `MorphWord` stacks all words in one grid cell so its width is constant.
- Responsive: base rule is the 320px rule. Headline uses container-query units capped by
  `svh`, so it fits any column and any viewport height. Root font scales at 1920, 2560
  and 3400px so ultrawide screens scale the whole page instead of floating a small one.
  Short landscape phones switch to a two-column hero.
- Honesty rules unchanged: product screens are labelled illustrative; chips say Example;
  question counts come live from `/api/stats`; no testimonials unless `src/lib/voices.js`
  holds real consented quotes.

## October 2 refinement: optional daylight and NTA-style rehearsal

The existing Night Arena implementation is retained and refined. The shared
marketing theme preference uses #0b100e/#131a16 for dark ground/raised surfaces and
#f4f5f0/#ffffff for light. Light text uses #172016, #424f3e and #5c6855; lime-family
text uses #526700 for contrast. Volt #d2f000 remains an action fill. Product stills
stay slate. The animated sun/moon switch respects reduced motion and persists the
visitor's choice; dark remains the default.

The hero is a framed live practice card with a compact status header and purpose
rail. Campus cards use 14px radii and original gouache-style illustrations, visibly
identified as illustrations. Four cards become a two-column mobile grid. The
comparison uses the same five sample answers across skins, with all five palette
states and an explicit illustrative timer. The conventional NTA-style skin uses
Arial, blue #32688f chrome, white paper, green #319d15 answered, orange #db4800
not answered and purple #512593 review shapes. Those colours, small palette labels,
3–6px console radii and Arial are intentional exceptions to the marketing system,
required by the user's screenshot. They are not new marketing primitives.

Detailed decisions and actual verification: docs/brain/HOMEPAGE-REFINEMENT-2026-10-02.md.

## October 2 second pass: theme roles and the Arena

Theme-dependent colour in marketing CSS goes through roles, never literals: `--accent-text`
(volt on night, #526700 on paper), `--accent-line`, `--accent-wash`, `--tint` (RGB channels for
translucent washes), `--surface-hover`, `--edge-light`, `--warn-text`, `--bad-text`, `--good-text`.
`marketing-theme.css` defines them per theme and resets them to night values inside `.mm-screen`
and `.mm-foot`, which stay dark in both themes. Volt stays a fill; as text on paper it fails contrast.

## October 4: mobile refinement and Mobi

The owner approved **Mobi** as the public companion name. Existing `Pip` file names and
asset identifiers are internal compatibility names. Phone/tablet reactions stay inside
reserved illustration boxes; desktop keeps its existing travel lane. Reduced motion uses
static artwork. Never place the companion inside the timed answering interface.

The landing Lab begins only when its bounded reading region clears the header/dock.
One elapsed clock drives tiles and steps, pauses offscreen or while the document is hidden,
and preserves progress on return. Manual step selection pauses autoplay; Replay restarts it.
Phone controls use four short labels, with complete accessible names. Overlapping panels
reserve their tallest natural height so transitions do not move following content.

Phone Practice uses a full-width start action beneath the cost. Result Find initially shows
one chapter and one observation, with remaining details available through disclosure.
Arena More opens a scrollable menu between its actual header and bottom navigation;
Escape returns focus to the opener. The header must not sit inside a body overflow container.
Verification and remaining release gates: `docs/brain/MOBILE-REFINEMENT-IMPLEMENTATION-2026-10-04.md`.

The switch is the sun or moon itself (inset-shadow crescent), with a circular View Transition
reveal from the switch. Hero bay: framed bay, lit slate card, two-card stack, skeleton explanation.

Signed-in screens now share the Night Arena language through `src/app/(app)/arena.css`, scoped to
`.app-shell`: ground #0b100e, raised #131a16, hairline #253026, sentence-case labels, the volt
keycap as the single primary action, and a Study/Tools navigation. The NTA-style console keeps its
conventional skin. `/preview/arena` renders the Arena with a mock user in development only.
