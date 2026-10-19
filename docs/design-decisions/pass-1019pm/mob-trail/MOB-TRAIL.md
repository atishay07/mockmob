# The Trail (key: trail): a Mob direction for the owner to compare (R8)

Designer: Opus subagent, 19 Oct 2026 PM. Mock-up: `mockup.html` (open in a browser; Replay buttons; tap S5 tiles). PNGs: `mockmob-next/tmp/design-1019pm/mob-trail/`. Everything here is a proposal: nothing is built, and all names, scores and codes in the mock-up are illustrative.

## 1. The concept in two lines
Each week the Mob walks one shared trail to a flag: every question any member practises moves the whole group forward together, and every game the Mob plays leaves its mark on the trail.
Mobi's family of folded-paper characters walks it with you, and every game ends in the one place MockMob is best at: the question the Mob missed most, fixed together and checked later.

Why a trail: it is Duolingo's clearest idea (one path, one next step, visible progress) turned cooperative. The group never splits into winners and losers on the trail; competition lives only inside short games (sprints and races), where losing costs nothing.

## 2. The game loop

**A day (2 to 15 minutes).** Open the Mob tab. The lobby shows the trail, everyone's character, whose lantern is lit today and one yellow key. The key is always the most useful next move: play the challenge a friend sent; or, if none is waiting, "Play with your Mob". A sprint is 5 questions (about 4 minutes). Practice anywhere in the app also moves the Mob along the trail for members who share their practice days (see 6). At most one Mob notification a day.

**A week.** Monday: a new quest and flag ("Walk 120 questions together"; the target is 30 per member by default, and the owner of the Mob may pick 20, 30 or 50). During the week: challenges, races and the Sunday paper (today's weekly paper, kept). Sunday 11:59 PM: the flag closes. If the Mob reached it, the week becomes a landmark on the Mob's season trail and the "weeks in a row" count grows. If not, nothing is lost: the trail is kept, and a new flag goes up on Monday.

## 3. Mechanics

What he asked for:
- **Characters instead of photos**: 24 originals (section 7), colour and one accessory, 8 unlocked by Mob quests.
- **Flexible play**: Sprint (5 questions), Race (5 or 10 minutes, as many as you can), Your way (chapter plus 5 to 20 questions), Full mock together (50 in 60), Sunday paper (10, the same for all), Rematch.
- **Mobs of 2 to 5**, join by a 6-character code, WhatsApp card or QR.
- **Shared streak**: "4 weeks in a row" counts weeks the Mob reached its flag. Weekly, not daily, so a school exam day never breaks it.
- **Weekly Mob quest**: the flag.
- **Reactions**: preset stickers only.

Seven mechanics he did not ask for:

| # | Mechanic | Why it works for a 16-17-year-old preparing for CUET | Truth | Safety for minors |
|---|---|---|---|---|
| M1 | **Ghost runs.** In a challenge, friends who played earlier appear as faded markers moving at their real recorded pace, question by question. | Async play feels live, so a Mob of 2 is fun at 11 PM even when the friend played at 6 PM. It is also pacing practice: CUET is a timed paper. | Built from seconds per question that `mob_sittings.detail.t` already stores. Labelled "Kabir played yesterday at 7:40 PM". Never invented. | Shows position only, never correctness, during play. |
| M2 | **Fix it together.** Every results screen ends on the question the Mob missed most: see why the trap option looks right, then each person who missed it gets one fresh question on the same idea on Wednesday. When all of them get it right, the trail gains a "Fixed" landmark. | It turns a game into marks: find, fix, check, which is Score Recovery, done socially. Teens learn more when a friend also got it wrong. | Uses the existing trap rule (3+ players, option picked by 2+ and half+). The check is a real question; the landmark appears only after real right answers. | Aggregate only ("three of you picked B"); no names on wrong answers. |
| M3 | **Marked like CUET.** Sprints and races score +5 right, -1 wrong, 0 skipped. Highlights include "Skipped one instead of guessing". | Teaches the exam's real strategy (when to skip) inside a game. Most students new to CBT do not know negative marking changes the best move. | The marking is CUET's published scheme. Highlights are computed from real answers. | Neutral; no money or rank outside the Mob. |
| M4 | **Lanterns.** A member's lantern is lit on days they practised. The lobby line names only who did: "Riya, Kabir and you practised today." | A gentle, visible "we are all doing this" signal without pressure; teens copy their friends' habits. | Lit only from real saved sessions. A member who turns sharing off shows an unlit lantern every day, so unlit never means "did not study". | Never counts or names who did not practise; no last-active time. |
| M5 | **One highlight for everyone.** Results give each player one true, positive line: "Perfect five", "Quickest right answer, 9 seconds", "Up 2 on the last sprint", "Played all five". | Last place still leaves with something real to feel good about, so friends keep playing. | Picked from a fixed list of computed facts; "Played all five" is the honest fallback. | No negative highlights, ever. |
| M6 | **Preset Mob names and a flag.** A Mob picks a name from a curated list (Quiet Comets, Steady Kites, Midnight Mangoes...), shown on its flag and share card. | Identity and belonging: a Mob name is something to be proud of and send on WhatsApp. | Nothing to fake. | No free text, so no unkind or identifying names. |
| M7 | **The season trail.** Past weeks stay as landmarks (flags reached, first full mock together, traps fixed). The trail only grows; it never shrinks. | Long-term pride through May 2027 without a streak that can be lost. | Each landmark is a real event with a date. | No loss framing (T005). |

Later, if the Mob grows (not first build): **Quiet hour** (co-study presence: avatars sit at one table while each practises on their own; needs Realtime) and **Relay** (a 10-question paper split across members, each answering 2 or 3 in their own time).

## 4. Screen by screen (copy is exact; R6 read aloud)

**S1 Mob home, the lobby.** Header: your character's head, the Mob name "Quiet Comets", "Economics, 4 friends", Ask Mobi. A 312 dp trail scene: paper hills, a winding paper road, milestone stones 30, 60, 90, a yellow flag "120 questions", the walked part inked in volt, the whole Mob standing together at the front of the ink, each with a name tag and a lantern. Top left: "4 weeks in a row". Below: "This week's quest", "Walk 120 questions together", "84 of 120", lantern line "Riya, Kabir and you practised today." Dominant key: "Play Riya's sprint", then "5 questions, open until 9:40 PM tomorrow" and the link "More ways". If no challenge is waiting, the key reads "Play with your Mob". Below the fold: "Sunday paper", "The same 10 questions for everyone", "3 of 4 sat"; then Members and Settings, as today. Bottom bar unchanged (H5).
- R2: "My friends and I are walking to a flag this week. The yellow button plays Riya's sprint."

**S2 Play picker** (sheet). "Play with your Mob", subject chip "Economics". Segmented control: "Send a challenge" | "Play now with Riya" (the second only when a friend is really here now; otherwise it reads "Nobody else is here right now" and is disabled). Explainer: "Your Mob gets 24 hours to play it. Each run shows up as it lands, and anyone who plays when you do appears live." Rematch row: "Rematch the last sprint", "With Riya, Kabir and Aarav". Sprint tile (selected): "Sprint", "5 questions, about 4 minutes", "Marked like CUET: +5 for right, -1 for wrong, 0 for skipped". "Race", "As many as you can before the clock stops.", 5 min / 10 min. "Your way", "Pick a chapter and 5 to 20 questions." Rows: "Full mock together", "50 questions in 60 minutes, sat this week"; "Sunday paper", "10 questions, the same for the whole Mob", "3 of 4 sat". Key: "Send the sprint to your Mob".
- R2: "Pick how to play. Send a sprint now, or play live with Riya because she is here."

**S3 In play.** "Economics sprint", "Question 3 of 5", pill "+5 right, -1 wrong". A track of five stones: your character on 3, Riya on 4 with a green "here now" dot, Kabir's faded ghost on 2. Line: "Riya is playing right now. Kabir played yesterday at 7:40 PM, so his faded marker moves at his real pace." Question and options as in the app runner; "Skip" and "Next question". No correctness shown until the end.
- R2: "Answer this question. Riya is a step ahead right now, and Kabir's faded run is behind me."

**S4 Results.** "Sprint done", "Your Mob got 15 of 20 right together." A paper podium (ties share a height; tied players are never split), each character on its stone with "5 of 5" etc., then name and one highlight. "Send a sticker": Nice one, Teach me, So close, Respect, Rematch?, Same time tomorrow. Mobi card: "The question your Mob missed most", "On question 4, three of you picked B. Fix it together now, and each of you gets one fresh question on it on Wednesday." Keys: "Rematch" (outline) and "Fix it together" (volt, dominant).
- R2: "Riya won, everyone got a line, and the button fixes the question we all got wrong."

**S5 Avatar picker** (sheet). "Your character", "Only your Mob sees it". Stage with the chosen character on a paper plinth, "Fennec the fox", "Spots a trap option from a mile away." Eight colour swatches (the existing Mob colours), six accessories (none, headphones, scarf, pencil, star pin, glasses), "All 24 characters", "8 unlock with Mob quests", grid with locked silhouettes; tapping a locked one says "Unlocks when your Mob does this: Fix 3 traps together." Key "Use Fennec".
- R2: "Choose who I am in the Mob, and tweak the colour and one extra."

**S6a Create.** Preview strip of your flag ("Your Mob's flag reads", "Quiet Comets"). "Name your Mob", "Pick one you like. Every name comes from our list, so names stay friendly." Six name chips and "Show six more". "Subject for your Mob's papers". "You join as Fennec", "First name in the Mob: Ananya", "Change". "A Mob is 2 to 5 friends. Only your Mob sees your name and character, and MockMob never asks for your contacts." Key "Start the Quiet Comets".
- R2: "Pick a name from the list and a subject, then start."

**S6b A Mob of one.** Trail with only you at the start and four dashed seats. "Bring one friend to start the trail", "Your first quest begins when a friend joins. A Mob plays best with 2 to 5 friends." Share card preview: your character, "Ananya started the Quiet Comets on MockMob", "Join with code K7P 2M9", QR; "This is the card your friends see in WhatsApp." Key "Invite on WhatsApp"; "Show QR code" and "Copy code".
- R2: "It is just me. Send this card on WhatsApp or show the code."

**S6c Join with a code** (sheet that sits above the keyboard, so the keyboard never covers the field: fixes H10 by layout). "Join a friend's Mob", "Type the 6-character code from their invite.", six boxes, found preview "Quiet Comets", "Economics, 3 of 5 seats taken", key "Join the Quiet Comets", "Scan their QR code instead". Wrong code: "That code didn't find a Mob. Check it with your friend." (A bad code and a block read the same, P10.)
- R2: "Type my friend's 6-character code; it found their Mob, so press Join."

## 5. Motion spec (tokens from `motion_tokens.g.dart`; R5 frame plan)

| Moment | What moves | Duration and curve | Why |
|---|---|---|---|
| Lobby enter (once) | Trail ink draws from the start to the Mob's position | sweep 700 ms on glide, 150 ms delay | Shows how far the Mob has come |
| | Characters hop in, staggered | 420 ms, settle curve (bounce at most 0.12), 620 ms + 60 ms each | The group arrives together |
| Lobby at rest | Breath (scaleY 1.022) | 3200 ms, sweep curve, alternate, offset per member | Alive, not busy |
| | Blink | 120 ms close and open inside a 4.6 to 6.4 s cycle per member | Character |
| | Flag pennant wave; lit lantern glow | 2800 ms and 2400 ms, sweep curve | The goal and the "practised today" signal |
| | All rest loops pause when the tab is not visible; reduced motion paints still frames | | Battery, R-155 |
| Results reveal (2.4 s; tap skips to the end state) | Title, subtitle | 260 ms out, 0 and 120 ms | |
| | Stones rise, lowest score first | emphasized 420 ms, 300 ms + 120 ms each | Suspense, then the top |
| | Characters hop onto stones | 460 ms pop, 640 ms + 120 ms each | |
| | Scores count up | numberRoll 520 ms out, from 1060 ms | |
| | Top player: happy eyes, a small hop, six paper flecks | iconPop 420 ms, flecks 760 ms, at 1500 ms | Only for a real top score |
| | Highlights fade up | 240 ms out, 1640 ms + 45 ms each | Everyone gets a line |
| | "Fix it together" card rises | enter 360 ms emphasized, 1950 ms | The learning ending |
| | Stickers, keys | 200 to 240 ms, 2200 to 2250 ms | |
| Reaction | Sticker flies in an arc to the friend's character, the tag pops, their eyes go happy | 420 ms emphasized, pop 420 ms, happy eyes 900 ms | Feedback that it landed |
| Choosing a character | Old character exits; new one drops in; name and line cross-fade | exit 180 ms; 380 ms pop; 200 ms | |
| In play | Live friends move stone to stone; ghosts move at recorded seconds | card 240 ms per step, out curve | Truthful pace |

R5 frame plan: `tmp/design-1019pm/mob-trail/frames/` holds 14 reveal frames (0 to 3400 ms) and 10 lobby frames (0 to 4400 ms), plus `s4-night-filmstrip.png` and `s1-night-filmstrip.png`. On device, capture the same timestamps at 360 dp, Night and Day, and compare.

## 6. Truth and safety rules
- Every number is from real data with its denominator: "84 of 120", "3 of 4 sat", "15 of 20 right". No fake activity, no "1,200 Mobs playing now". Everything works in a Mob of 2; nothing depends on crowds.
- Live only when it is real: "here now" needs presence; until Realtime exists the switch says "Nobody else is here right now", and ghosts carry the async feeling.
- Lanterns need a per-member sharing switch ("Show my practice days to my Mob"), on by default with that sentence at join; unlit and private look the same.
- Scores follow the existing `show_score` switch; a private player appears on the podium as "Played" with no number.
- No free text anywhere: names come from the existing 2 to 18 letter rule (first names), Mob names from a list, reactions are 6 stickers. No photos, no chat, no contacts.
- At most 1 Mob notification a day and only for something real (a challenge sent to you, the flag reached). Never "you're letting your Mob down", never a countdown, never a loss threat (T005). A missed flag simply resets the weeks-in-a-row count, with no warning beforehand.
- Unlocks are cosmetic and only through Mob quests. Never money, never credits (D101 spirit, T009).
- Ranking appears only inside a game's results, among friends; ties share; the weekly paper stays cooperative.
- The existing report, leave-and-block and remove flows remain unchanged.

## 7. The avatar family: "The Folds"
**Shape grammar taken from Mobi:** each character is one sheet of paper folded into an object a student knows (kite, boat, envelope, lantern...). It is drawn as flat facets lit from the upper left (light, base and shade tones of one colour, like Mobi's lime fold), with Mobi's dark visor (gradient 2B2926 to 0B0A09 with a gloss band) and capsule eyes in FFFAEE, and Mobi's black rubber-hose legs and big boots. No mouth: expression lives in the eyes (open, happy, focus, wow, sleepy, wink). Owl uses round eyes; Kandil has amber eyes.
**Palette:** paper colour = the member's existing Mob colour (8; `mob_ring.dart`), the same in both themes (Mobi's rule: only the light changes). Volt lime is reserved for Mobi and the action key. Accessories: amber scarf, black headphones, yellow pencil, amber star pin, cream glasses.
**The 24** (name, object, one line; * = unlocked by a Mob quest): Patang (kite) "Climbs higher when the paper gets harder."; Zip (paper plane) "Answers fast, then flies back to check."; Kashti (paper boat) "Stays steady through a long paper."; *Sarus (crane) "Reads every option twice before landing." (first Mob quest); *Koko (fortune teller) "Never guesses. Rules out three, keeps one." (fix 3 traps together); Hop (frog) "Skips the hard one and hops back for it."; Fennec (fox) "Spots a trap option from a mile away."; Chitthi (envelope) "Always turns up for the Sunday paper."; *Tara (star) "Collects perfect fives and shares the trick." (a perfect sprint in your Mob); Hoot (owl) "Does its best thinking after dark."; Pankha (fan) "Stays cool when the timer turns amber."; Chai (paper cup) "Runs on one cup and one more question."; *Kandil (paper lantern) "Lights the way when the Mob gets stuck." (every lantern lit in one day); Firki (pinwheel) "Spins up the moment the clock starts."; Dabba (box) "Keeps every formula packed and labelled."; *Bloop (whale) "Big, calm and never rushed by question 40." (a full mock together); Bud (tulip) "Grows a little every single day."; Tab (bookmark) "Never loses its place in a chapter."; Memo (sticky note) "Remembers every mistake, kindly."; Topi (paper hat) "Thinks first and marks second."; Dash (rabbit) "Quick on its feet, and still checks the units."; *Titli (butterfly) "Changes an answer only for a good reason." (a 4-week trail); *Kachua (turtle) "Slow, sure, and zero negative marks." (500 questions together); *Haathi (elephant) "Never forgets a chapter it has read." (fix 10 traps together).
Sheet: `tmp/design-1019pm/mob-trail/avatars-24.png`. In Flutter they become one parametric painter (polygon facets plus a visor and eyes), like `MobiFigure lite`: no raster assets, so there is no download cost.

## 8. Build cost and order
| Piece | Cost | First build or later |
|---|---|---|
| Avatars: painter, picker, `mob_members.avatar` and `accessory` columns, PATCH /me | M | First |
| Lobby trail scene with real quest numbers and weeks in a row (computed from sittings plus shared attempts) | M | First |
| Lantern flag (per-member daily practice bit plus a sharing switch) | S/M | First |
| Challenges: Sprint, Race, Your way on top of `mob_extras` (lengths 5 to 20, everyone may create, a 24-hour window, a per-day cap) | M | First |
| Ghost runs from `detail.t` | S | First |
| Results reveal, highlights, Fix it together with a Wednesday check question | M | First |
| Stickers (`mob_reactions`, fixed enum) | S | First |
| Preset Mob names, 6-character codes, WhatsApp card image, QR | S/M | First |
| Season trail landmarks | S | Second |
| Live presence and "Play now with Riya" (Realtime Broadcast authorised by the API, room lifecycle) | L | Later |
| Push for "a challenge was sent to you" (FCM sender) | L | Later |
| Web parity (the web Mob follows the app's pick) | M | After the app |

## 9. Self-critique (done on the PNGs)
**12-part anti-slop test** (pass, partial or fail): 1 identity with the logo hidden: pass (the paper trail and Folds belong only to MockMob). 2 one primary action: pass on every screen (S4 has two keys, but volt marks one). 3 true content: pass in the spec; the mock-up's data is labelled illustrative. 4 hierarchy at first scan: pass (S1: scene, quest, key). 5 intentional composition: pass for S1, S4 and S6b; partial for S2 (four kinds of tile on one sheet). 6 typography by role: pass (Bricolage condensed figures, Hanken UI). 7 every state: partial (the mock-up shows the main states; empty, offline, private-score and no-presence states are specified in words only). 8 accessible interaction: partial (48 dp targets; podium needs a screen-reader order by score; sticker meaning is in words). 9 no pseudo-evidence: pass. 10 motion with a reason: pass (each item has a purpose; rest loops are capped). 11 one leading metric plus one guardrail: leading = Mob sessions per member per week; guardrails = reports per 100 members and leaving within 7 days (existing stop rule), plus a check that solo practice does not fall. 12 "what would be better without this?": the 30/60/90 stones could go; kept because they make the trail readable as progress.

**12-dimension rubric (0/1/2):** task fit 2, information architecture 2, content truth 2, readable hierarchy 2, visual specificity 2, accessibility 1, functional states 1, trust 2, intentional motion 2, performance 1 (a trail scene plus 4 animated characters on low-end Android needs profiling), responsive integrity 1 (360 dp only; 412 dp and the web are not drawn), instrumentation 1 (metrics named, events not specified). Total 19 of 24. This is an internal checklist, not proof.

**Redone after review:** S4 (the first podium misaligned names and highlights, and short stones clipped "of 5"; rebuilt with a fixed name row, taller stones, larger characters). S6b (dashed seats collided with the trail and its milestones; the trail now starts at you and climbs away from the seats). S1 (wrapped caption and link fixed; Sunday paper row added to fill the dead band above the bar). S5 (the accessory previews were unreadable; redrawn). S6a (plain form; added the flag preview). Characters: Hop read as a cat and Haathi as boxes; both redrawn with curves. A 25th character was cut to keep 24.

## 10. Honest weaknesses
- The trail scene is the hero and costs about 40% of the first screen; a student with many Mobs sees it once per Mob. It must stay fast on cheap phones (profile it).
- Ranking inside games goes against SOCIAL-SPEC P5 ("never ranked"); his 19 Oct words invite it, but he should confirm podiums for sprints and races.
- The lantern reveals practice days to friends; even with "unlit equals private", a teen can infer who did not practise. It needs his and counsel's view (DPDP for minors is still open, P12).
- "Weeks in a row" can still feel like a loss when it resets, even though it is never announced or threatened.
- Live play is drawn but is L-cost; at launch most Mobs will see ghosts, not live friends. The ghost idea carries the experience only if challenges actually get played.
- The quest counts practice outside the Mob only for members who share; a Mob where nobody shares will walk slowly, which may confuse them. Copy must say why.
- The characters are drawn as flat SVG, cruder than Mobi's rendered art; a production pass (rim light, paper texture, poses for cheer and oops) is needed before they are 10/10.
- Only Night and Day at 360 dp are drawn; the 412 dp layout and the web Mob are not designed here.
