# Storyboards for the top two video ideas (M-009), 18 Oct 2026

Text storyboards, written for the owner to react to. Nothing here spends Higgsfield money. The idea round (lenses A-G and the scoring pass in HIGGSFIELD-IDEAS-2026-10-16.md) has not been run, so "top two" here means the two seed ideas that match his 16 Oct direction best: I2 (app onboarding) and I1 (landing scroll). The still frames still need to be made with his GPT image account in our art style (step 3 of the loop); that is not something this session can do.

Rules both obey (from the ideas file): real UI stays real; no AI Mobi, he stays the code rig; motion answers something; the still renders first; about 1 MB a clip; still only under reduced motion or Save-Data; Night and Day both work; every claim true.

## Storyboard 1 (I2): "The room wakes up", app first launch

**Where and when:** the welcome screen, the first time only. Skippable by a tap. Never again.
**Asset to match:** the last frame must equal `flutter_app/assets/art/scene-welcome-hero-night.webp` (1296 by 1620, portrait), so the hand-off to the live screen has no jump. The video is Night only; in Day the existing still shows, no video.
**Length and format:** 3 to 4 s, portrait, 720p, one take. Target size about 1 MB.

| Time | Frame | Camera | Light | Sound and haptic |
|---|---|---|---|---|
| 0.0 s | The painted room in the dark. Desk, shelf and window are shapes against near-black. Mobi's place is empty (the code rig arrives after the video). | Fixed, a very slow push-in of about 2 percent | Only a faint window glow | None |
| 0.8 s | A small click. The desk lamp turns on. | Same | A warm pool of light on the desk, its edge soft | One light haptic tick on the click; no audio |
| 1.4 s | Light spreads: the paper on the desk, the shelf spines and the window frame pick up colour. | Push-in continues | Falloff widens across the room | None |
| 2.4 s | Dust in the lamp beam drifts once. | Push-in ends | Steady | None |
| 3.0 to 3.5 s | Settles on the welcome still. The title and the Start key fade in over it as in the live screen. | Locked | Matches the still | None |

**Cut line:** if the opening takes longer than 4 s on a slow phone, show the still at once.
**Video model plan** (from the plan, not a new decision): drafts on Wan 3.0 at 480p with a fixed seed, final on Wan or Kling; about USD 0.5 to 1.
**Risks:** the lamp must be the light source that already exists in the still, or the last frame will pop; the first frame must look intentional if the video is late (show the dark still, not a spinner).
**Question for him:** keep the haptic tick on the lamp click, or silent?

## Storyboard 2 (I1): "The bank deals a fresh paper", landing scroll

**Where:** the landing section "One question bank. As many mocks as you want with Pro." It makes the headline differentiator visible.
**Technique:** scroll-scrubbed, not autoplay. Either a GOP-1 video or a canvas image sequence of about 60 to 90 WebP frames, picked by weight; test on a budget Android phone in Chrome. The poster frame (frame 0) is the LCP-safe still and loads first.
**Length and format:** 6 to 8 s of material scrubbed across about one and a half screens of scroll; 16:9 for wide screens, a 4:5 crop for phones (shot once, framed for both). Under reduced motion or Save-Data: show frame 0 and the last frame as two stills, no scrub.

| Scroll | Frame | What moves | Words on screen (code text, never in the video) |
|---|---|---|---|
| 0 percent | A lamp-lit library wall: rows of question cards in drawers, shelves, warm light. Calm. | Nothing | The section heading |
| 20 | Cards lift from different drawers, a few at a time. | Slow rise, slight rotation | None |
| 45 | The cards drift toward the centre and align into a paper: the top card is the header, the rest stack beneath it in order. | Convergence, soft trails | "From one bank." |
| 70 | The paper settles on a desk and its edges square up. A second, different stack is faintly visible behind it. | Settle, a small bounce | "A fresh paper." |
| 100 | Hold on the paper; the real UI card for "Start a mock" (code, not video) slides in beside it. | Video stops, UI animates | The true line about Pro mocks |

**Truth guard:** the scene must not suggest a paper never repeats. The landing already says an answered question can come back; the faint second stack stays, and no text says "never".
**Real UI stays real:** the paper in the video carries no readable questions or marks; the readable paper is the live component.
**Video model plan:** draft on Wan at 480p, final on Seedance 2.5 at 720p (or Wan at 1080p); about USD 2 to 3.
**Risks:** weight (a 7 s clip at 720p can pass 1 MB: a canvas sequence at 960 px wide is the likely answer); the landing's mobile LCP is already about 4.7 s, so nothing in this section may load before the hero.
**Question for him:** a warm library wall (above) or a single cool vault door that opens onto the cards?

## What happens next
1. He reacts to these two text boards (and to the two questions).
2. Make the start, end and two middle frames of the chosen one with his GPT image account.
3. Only after he picks: /estimate, then drafts, logged in `tmp/higgsfield/LEDGER.csv`.
