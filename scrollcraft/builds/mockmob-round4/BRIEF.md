# MockMob round 4: Pip as a guide

Self-authored under explicit creative delegation (owner, 3 October 2026: "explore, choose,
implement and verify. Do not ask me to choose routine variants"). This extends
`../mockmob-round3/BRIEF.md`; its brand, evidence and boundary sections still hold.

## The eight topics (authored, with the owner's own words where given)

1. Vibe: night study companion, volt and graphite, warm not cute, tech-superior. References:
   a cartoon co-pilot in a cockpit HUD; Duolingo's owl only in its restraint between lessons.
2. Journey, owner's words: "hero greeting, Mistake Lab thinking, Compass pointing, demo
   celebration, closing encouragement."
3. Energy: calm open, focused middle, a lift at the demo, a quiet resolved close.
4. Feeling and the one moment: see curve and peak below.
5. Unlike any site seen: the guide reacts to what *you* just did on the page (answered the drill,
   watched the leak become a move, tried the exam console) rather than to scroll position alone.
6. Distance from premium-minimal: playful character inside an otherwise disciplined page.
7. One world or scenes: scenes. The homepage stays semantic sections; Pip is the thread.
8. Assets: the seven existing original PNGs and their WebP derivatives. Nothing new generated.

Owner constraints carried verbatim in spirit: no random perpetual floating, no stretched raster,
never cover content, phones get their own choreography, no animated mascot while answering.

## Feeling curve (written before devices)

1. Welcome: someone is here at 11pm. Pip waves from the hero and reacts to the drill answer.
2. Curiosity, then relief (the peak): Pip watches the replay thinking, and the instant the
   leak turns into one next move it jumps.
3. Orientation: Pip faces the Compass headline and points at the numbers.
4. Delight: in the exam preview Pip cheers the visitor's own answers.
5. Resolve: Pip lands for the last time, encouraging, beside the one action.

Adjacent feelings all differ. The act before the peak (hero) is quieter than it.

## Peak, tell-someone sentence, signature move

Peak, as a visitor would say it: "the little volt guy was thinking while the replay ran, and when
it found my one next move he literally jumped."

Tell-someone: "It's the site where a tiny scout hops down the page after you and reacts to what
you just did."

Signature move: **the perch handoff.** One Pip. When a new station takes the middle of the
viewport, Pip leaves the perch it was on, travels on a hop arc (independent X and Y curves, a lean
into the direction of travel) and lands on the next perch with a settle and a blink. Empty perches
keep a contact shadow, so the page remembers where Pip has been. Reverse scrolling sends Pip back
up the same way. Reactions are driven by page events, not scroll.

## Grammar and device score

Grammar: guided working journey (unchanged from round 3; the fingerprint row is the homepage's).
Pip is a fixed-chrome thread outside the act stack, which uniqueness.md allows when the grammar
bans pinning: the peak lives in the character, not in a pinned act.

| Station | Pose | Device | Why |
| --- | --- | --- | --- |
| Hero | greeting | in-flow perch, reacts to DemoDrill | first screen must already be complete |
| Mistake Lab (peak) | thinking, jumps on "one next move" | perch handoff + event reaction | relief needs the replay's tension first |
| Compass | pointing at the headline | handoff, perch on the left | the hand must point at content, never off-page |
| Exam preview | idle, cheers answers | handoff + event reaction | the visitor's own action is the cause |
| Close | encouraging | final landing, holds | ending resolves and stays |

Phones: no travel across long distances under a thumb. The same perches; Pip drops in from just
above the next perch (short hop, under half a second). No pinning, no floating follower, nothing
over the mobile dock.

Reduced motion: no flights, no hops, no blinks. Every perch shows its static pose (the round-3
fallback), so meaning survives.

## Prototype comparison (recorded after building, see ../../lab/pip-journey/)

Three structurally different directions were built at a dev-only /preview/pip-journey route (sources archived in artifacts/round4/prototypes/pip-journey after the decision):
1. Lane: a fixed side lane; Pip's height in the lane is scrubbed by scroll, pose by section.
2. Perches: every station keeps its own Pip that greets you on arrival (enter from scroll side).
3. Handoff: one Pip that travels between perches on scroll handoff and reacts to page events.

Decision and evidence are in docs/brain/ROUND4-NOTES.md.

## Authored silence

Between the Compass and the exam preview (DU tools, colleges) and between the preview and the
close (pricing, FAQ) Pip stays on its last perch, offscreen. That silence is intended: the guide is
not a follower.
