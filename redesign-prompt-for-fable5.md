# MockMob full redesign — mobile-first, impeccable-driven

## Context

MockMob is a web platform for CUET (Common University Entrance Test) mock exams and practice questions — Indian students prepping for the 2027 CUET. The current site is desktop-first and reads as a generic SaaS/EdTech marketing template; it needs a **complete visual redesign**, not a polish pass, and it needs to be **rebuilt mobile-first** since the real audience overwhelmingly browses and studies on phones.

This is not a refinement. Treat the existing look as evidence of what the product is (CUET prep, mock tests, subject hubs, pricing/checkout, credits system) and as anti-reference for what it becomes. Preserve: product truth, copy facts (CUET 2027 plan details, pricing, subject list), working checkout (Razorpay), the demo-drill mechanic (5-question no-signup trial), the live-stats band (real numbers via `/api/stats`, never fabricated testimonials), and the kinetic/scramble-text personality the owner explicitly wants kept — the brand voice is "tech-superior, premium, unique," not a standard marketing page. Everything else — layout, type, color, motion, component vocabulary — is open for full replacement.

Surfaces in scope: landing/home, pricing, about, contact, the CUET subject hubs, the CUET-2027 page, and the credits/checkout modal flow. Landing, pricing, about, contact, subject hubs = **Persuade** mode. Any in-app screens (dashboard, test-taking UI) you touch = **Operate** mode — do not let marketing expression compromise task clarity there.

## Required process — follow the skill's actual mechanism, don't shortcut it

1. Run `node .claude/skills/impeccable/scripts/context.mjs --target <route>` before touching each surface. Follow what it loads.
2. **No PRODUCT.md exists yet** — run `init` first to capture durable product truth (audience: CUET 2027 aspirants; job: pass a specific exam; proof available: real stats, real subject coverage, real pricing) before anything else.
3. This is a **new/replacement visual world** — load `new-work.md` and follow it exactly, including the parts that are easy to skip:
   - Do not invent a palette or a "vibe" directly. Name the product's real mechanism, the student's real scene (late night, phone in hand, exam anxiety, limited time), and derive **seven concrete visual systems** from that world — not generic EdTech/SaaS defaults.
   - Run `concept-seed.mjs --scope direction --mode persuade` and honor its assignment. This is a hard requirement, not optional ceremony — it's the mechanism that stops the result from converging on the same cream-serif or dark-neon-glow look every model defaults to. Present the assigned direction plus its dealt challengers to me for a decision before building.
   - Apply the **calibration check** from new-work.md explicitly: if the result could be guessed from "EdTech landing page" alone, it failed. No warm-cream-plus-serif, no near-black-plus-neon-accent-glow unless the rolled direction genuinely earns it.
   - Pick a deliberate **color strategy** (Restrained / Committed / Full palette / Drenched) before picking colors — Persuade mode has permission to go bold here.
   - Choose type faces with a point of view, not the trained-in defaults (no reflex Fraunces/Playfair/Space Grotesk unless the rolled direction specifically earns it).

4. **Mobile-first is a hard constraint, not a breakpoint** — apply `adapt.md` at the architecture level:
   - Author base styles for mobile first, layer up with `min-width` queries. Never design desktop then shrink it.
   - Single-column, thumb-reachable primary actions, bottom-anchored navigation/CTAs where it fits the world, 44×44px minimum touch targets, generous tap spacing.
   - Content-driven breakpoints (stretch until it breaks, not fixed device widths), `env(safe-area-inset-*)` for notches, `srcset`/`picture` for responsive imagery.
   - Progressive disclosure on mobile (don't cram desktop density into a phone) but never hide core functionality — every task that works on desktop must work on mobile.
   - Desktop and tablet are then the adaptation *up* from the mobile base, not a separate design.

5. Apply `craft-floor.md` as a hard floor on every screen, mobile viewport included:
   - No same-size icon+heading+text card grids as page structure, no hero-metric templates, no kicker/eyebrow labels, no gradient text, no decorative glass/blur, no hard offset neobrutalist shadows unless the rolled direction is genuinely neobrutalist, no emoji-as-icon, no system-font display type.
   - Contrast ≥4.5:1 body / ≥3:1 large text, real depth (offset+blur shadows, not zero-offset glow), type measure 65-75ch, 4.5.rem/type scale intentional, dark/light chosen from the actual use scene (phone, low light, late-night study — don't default).

6. Once the direction and comp are locked, layer in as needed: `colorize.md` (color as hierarchy/meaning across the new component system), `typeset.md` (role scale, not decoration), `layout.md` (reading order, rhythm, grouping — run its mechanical scan), `animate.md` (one authored focal motion per key surface, not scattered hover effects — the hero mechanism deserves the "one rehearsed sequence," not generic fade-ins), `delight.md` (make the demo-drill and stats-band moments feel earned, not generic celebration), `onboard.md` (the no-signup demo drill IS the onboarding — get a visitor to the "aha" of solving a real CUET question inside seconds, mobile-first).
7. Consider `overdrive.md` only for the hero mechanism if it's the kind of thing that benefits from real technical ambition (canvas/WebGL/view-transitions) — propose 2-3 directions and let me choose before building; do not default into it.
8. Before shipping, run `harden.md` thinking: empty states, error states on checkout/credits, slow-connection behavior, i18n-safe copy lengths, real edge cases (long subject names, zero-stats state before traffic arrives).
9. Finish per new-work.md section 7: batched desktop+mobile screenshot inspection (mobile viewport is not secondary here — inspect it first), fix in one batch, one confirm round, then hand off to the shipped finish-reviewer and documenter so `DESIGN.md` gets written from the built result, not from intention.

## What "done" looks like

A visitor opening MockMob on a phone in bad light at 11pm, mid-CUET-panic, understands in one viewport what this is, feels it's sharper than every other prep site they've seen, and can be solving a real question within seconds — with the desktop and tablet experience following from that mobile core, not the reverse.
