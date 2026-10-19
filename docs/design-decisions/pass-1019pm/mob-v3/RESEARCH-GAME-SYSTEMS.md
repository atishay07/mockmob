# Mob v3: game systems research and proposals (19 Oct 2026, evening)

Scope: streaks, Free versus Pro, live play, and extra mechanics for the Mob. Research first (cited as [S1] and so on, list at the end), then four proposals. Nothing is built or shipped. Numbers marked "guess" are to be tested with real students. Where a source could not be verified I say so; I did not fill gaps from memory unless marked "my judgement".

Fixed inputs I did not reopen (owner, 19 Oct): Den with Arena's energy; podium by CUET marks (+5, -1, 0) inside one game, switch per Mob; only Pro members START Mob games; weekly Mob streak; 6-character codes; Mob of 2 to 5; preset characters; Pro is Rs 99 on the web (a season pass to 31 Jul 2027, about Rs 10 a month) and Rs 150 on Play. Truth and minors' safety rules from the brief hold everywhere.

---

## 1. What the research says

### 1.1 Streaks (Duolingo, Snapchat, and the research on harm)
| Finding | Source | What MockMob takes or refuses |
|---|---|---|
| Duolingo lets a learner hold up to 2 Streak Freezes; allowing 2 raised daily active learners 0.38% without causing more days off. Reaching a 7-day streak makes a learner 3.6 times likelier to finish the course (a correlation). | [S1] | Take: slack in the system. A freeze is cheap and does not cause skipping. Refuse the "equip it first" step; ours applies itself. |
| Elaborate milestone animations on chosen days raised 7-day retention of brand-new learners by 1.7%. Early gains feel bigger (2 to 3 days is +50%; 200 to 201 is +0.5%). Duolingo says new learners respond to visible momentum, long-streak learners to loss aversion. | [S1] | Take: a dense early ladder (3, 7, 14) and big celebrations; refuse to lean on loss aversion for the long runs, because our users are 16 to 17. |
| Freeze and Repair cost gems, so, if gems run out, money (third-party guides; 200 gems a freeze is unverified). In June 2026 Duolingo ran a revival event: restore one streak of 30+ days by finishing three lessons in one sitting. | [S2], [S3] | Refuse money for streak safety. Take the shape of the revival: repair by effort, not by payment. |
| Friend Streak: up to 5 friends, a separate streak per friend, both must do the daily lesson; learners with one are 22% likelier to complete the daily lesson (correlation; the post does not discuss pressure). The cap of 5 came from retention data by friend slot. | [S4], [S5] | Take: accountability with a friend needs no chat. Refuse: a daily pair streak that one person can break for another. |
| Friends Quests: weekly, cooperative, five days to finish, pre-written nudges only, can be turned off. Duolingo's own claim: followers of friends are 5.6 times likelier to finish a course (correlation). | [S6] | Take: shared weekly target, preset nudges, an off switch. |
| Leagues: 30 strangers ranked by XP weekly, 10 tiers, demotion, notifications such as "Miller took your spot" and "Last chance to get promoted"; critics note loss aversion and guilt-toned messages (third-party analysis; the "+25%" headline is unsourced). | [S7] | Refuse leagues of strangers, XP ranking, demotion and rival-named alerts. They need crowds we do not have and they expose minors. |
| Snapchat streaks: both must send a snap daily; an hourglass warns the streak is about to expire; lost streaks can be restored once free, then for a price. | [S8], [S9] | The pattern to avoid: a mutual daily chain, a countdown emoji, and paid restore. |
| Bits of Freedom (300 respondents aged 13 to 21): 86% keep streaks; of those, 51% feel bad if a friend breaks it, 33% say it affects screen time, 25% paid at least once to restore one; 42% would drop streaks if they could choose. | [S10] | Strong reason for no pair streaks, no payment, and a switch to hide streaks. Small, self-reported study. |
| van Essen and Van Ouytsel (2023, 2,483 Belgian early adolescents, mean age 13.5): streak engagement was associated with problematic smartphone use; FOMO and low self-control correlated with number of streak friends and days, weakly; girls streaked more. Cross-sectional, no causation. I could not read the full text. | [S11] | Be cautious, not alarmist: keep streaks personal and gentle, never social-obligation shaped. |
| Silverman and Barasch (consumer psychology): a streak makes a goal feel serious, but breaking it is especially demotivating; broken-streak reminders can make users feel they are failing. A related paper says repairability softens the effect (via a secondary summary; not verified in the primary paper). | [S12] | Take: a break must be a soft restart, with the best run kept on show, and repair must exist. |
| I found no study that directly measures anxiety from streak loss in teens. Evidence is mixed and mostly correlational. | searches | Say so: we design conservatively and measure our own "dropped after a break" rate. |

### 1.2 Studying together (Yeolpumta, Forest, Study Bunny, Focus Friend, Discord)
- Yeolpumta (YPT) is a study stopwatch and planner with study groups that show friends' study status live and category rankings; about 5 million users per its own store page [S13]. Ranking by hours rewards volume, and I would not copy that (my judgement).
- Forest's Plant Together: create a room or share a code; if anyone leaves the app, everyone's tree dies [S14]. High stakes bind a group, but one person's slip punishes friends: refuse that kill rule.
- Study Bunny is a solo pet and coins timer; Hank Green's Focus Friend is solo with app blocking. I found no evidence of friend rooms in either [S15]. So the proven pull is a character you look after and a calm timer, not a social obligation.
- Discord "study servers" run silent voice rooms for body doubling, with no peer-reviewed evidence found that they work; NPR reports experts and users calling the presence of another person helpful, which is anecdotal [S16]. Presence-only rooms are cheap and kind, but sell it as company, not as proven science.

### 1.3 Live quiz games (Kahoot, Quizizz, Blooket, Gimkit)
- Join by code or QR is the norm; Blooket and Kahoot use a game code; Kahoot praised for QR join [S17].
- Gimkit: a correct answer earns in-round money to buy power-ups such as multipliers; Blooket: collectible avatars (Blooks) and coins, with random events [S17]. Randomness and spending mechanics are exactly where a minors' exam app must not follow (see 5.1).
- A 593-student study found audio and points each add to concentration, engagement, enjoyment and motivation; the worst case was both off; it also found no learning-outcome difference [S18]. So sound and scoring are worth doing for feel, but do not claim they teach more.
- Meta-analysis of 29 studies (Ho, Hung and Kwan): gamification helps learning moderately; the edge of competition over non-competition was not robust; separately, reviews warn leaderboards can demotivate low performers [S19]. So: rank inside a single game only (owner's choice), with ties and the off switch, and make the weekly chain cooperative.
- Free versus paid in this space: Gimkit Basic keeps live play but rotates 3 modes; Blooket keeps live play free and charges for homework and reports [S20]. Teachers' live play stays free; the paywall sits on extras.

### 1.4 Fair Free versus paid splits
- Spotify Jam: only Premium users start and host a Jam; free users can join, but remotely only with Premium; hosts can remove people and decide whether guests change the queue [S21]. This is the closest model to the owner's rule, and also shows the unfair edge (a Free friend cannot join remotely) which we must not copy.
- Strava (2020): full segment leaderboards, route building and analysis moved to subscribers; uploading, history and friends stayed free [S22]. Paid = depth, not participation.
- Discord: core chat and calls are free; Nitro Basic and Nitro sell expression and bigger limits; community posts complain when "basic" features land only in Nitro [S23].
- Duolingo Super and Max: paid removes ads and the heart limit, Max adds AI features [S24]. A paid unlimited-hearts model gates continuity of learning, so I would not copy it into the Mob.
- Lesson: sell hosting, depth, insight and looks. Never sell participation, safety (streak protection) or marks.

---

## 2. Proposal 1: a streak system with two chains and no guilt

Principle: two things count, never one fragile number. A personal chain (daily, private, forgiving) and the Mob chain (weekly, shared, group-owned so no one person can break it). No daily pair streak, ever [S10].

### 2.1 Personal chain: "days in a row"
- **A day counts** when you answer 5 questions in any mode (practice, Mob game, mock, Daily Five) on the IST calendar day; a session that starts before midnight counts for the day it started. Skips do not count (a pick is an attempt).
- **Look**: a paper chain, one link per day, drawn as a paper check (the flame is a loss idiom, per Den v2). Rested days show as a folded link, not red.
- **Rest passes (the freezes), earned only**: one gift on day 3; then one for every 7 days of chain; one for every 3 mistakes you fix and pass the Wednesday check on. Hold up to 2 (the number Duolingo tested [S1]); 3 in the final stretch. A pass **applies itself** on a missed day; you are told the next time you open the app: "You rested on Tuesday. Your chain is still 12."
- **Make it up (repair), by effort, free on every plan**: within 48 hours of a miss with no pass left, 10 questions today restore the chain (the missed day is marked made up). Once every 14 days. This follows the shape of Duolingo's revival event (three lessons in one sitting) [S3] without any payment.
- **If it still breaks**: the next open says "A new chain starts today. Your best is 23 days." The best stays on the shelf and never drops. No red, no sad Mobi (Mobi shows `rest`, never `oops`), no push, no "you lost".
- **Exam-time pause**: a student can set up to 14 pause days in the season ahead for school exams or boards; the chain holds and the calendar shows a moon. It is set by the student, never inferred.
- **Honest numbers**: the chain number counts chain days, rested and made-up days included, and the calendar shows which is which; "days practised" is a separate line. Never a number that hides a rest.
- **Privacy**: the chain is yours alone. Switch "Show my practice days" (Den S8, off by default) shows only that you practised today, never how much. A "Hide streaks" switch turns the chain off entirely for students who find it a weight [S10].
- **Pro changes nothing about the chain.** Pro gets the exam-season calendar view (see 3), not safer streaks.
- **Reconcile**: `weeksMetStreak` and goals in `rhythm.js` stay as the data behind the weekly goal; the headline is days, and "goal weeks" appear in the weekly summary.

### 2.2 Milestones and celebrations (dense early, then sparser, tied to CUET)
| Days | Weight | Moment (existing tokens: milestone 500 ms, momentT2 1200, momentT3 2000) | Reward (earned) |
|---|---|---|---|
| 3 | small | link clicks in, paper-check ink 500 ms, one haptic | first Rest pass |
| 7 | medium | Mobi `proud` 1.2 s, chain draws across the week | Rest pass; "Week" stamp |
| 14, 21 | medium | same, plus a shelf object slides in | page of the story (see 5, H) |
| 30 | large | 2 s moment, a lamp-lit subject object from the app's art | shelf object; share card |
| 50, 75 | medium | calm; no confetti spam | ribbon |
| 100 | large | full scene (`scene-milestone-*`), sound sting | share card; best-run plaque |
| 150, 200, then every 50 | large | Mobi `celebrate`, one line | |
Rules: milestones fire once; reduced motion paints the end state; sound is optional and off in silent mode; copy states the fact ("30 days. You practised 30 days in a row.") and no loss threat. A **perfect week** (7 of 7 with no pass used) adds a ribbon to that week's stamp; it is shown only in the Sunday summary, never as pressure to avoid passes.

### 2.3 Mob chain: "weeks in a row" (the owner's weekly Mob streak)
- **A week counts** when the Mob finishes that week's quest (Monday 12:00 AM to Sunday 11:59 PM IST, the existing week window).
- **Quest counts questions answered, not marks**: the Den used marks, but marks reward the strongest member and can feel like dead weight to others; questions answered rewards effort and cannot go down. Sources: the weekly Mob paper plus every Mob game, plus an opt-in per-member switch "Count my practice" (off by default) that adds only a sum, never a per-person split, so a Mob with no Pro member can still reach it.
- **Size (guess)**: 15 questions per member, so 30 for two and 75 for five; the weekly paper alone gives 10 per sitter. A member can step out with **Resting this week** (exams, illness): the quest resizes quietly, "Quest sized for 3 this week", naming nobody.
- **Never a countdown, warning, push or "waiting on you"**; the Den shows the bar and, on Sunday evening, the same bar, nothing more.
- **Slack**: the Mob earns a Week pass for every 4 chain weeks (hold 1, auto-applied). The person who started the Mob can pause the chain for one week, up to 2 a season, for exams.
- **Break copy**: "A new chain starts this week. Your best is 6 weeks." The best never drops.
- **Milestones**: 2, 4, 8, 12, 20 weeks, each unlocking a Mob shelf item. Celebration plays once per member the first time they open the Den afterwards. Final-stretch weeks can be named ("Week 3 of the final stretch").
- **Why weekly and group-owned**: it removes the exact failure Snapchat's pair streak has (one person's slip costs a friend; 51% feel bad [S10]) while keeping what Duolingo found useful, accountability to friends without chat [S5].

### 2.4 Exam-season sense (CUET is in May)
Three phases, dates set by the owner once NTA publishes them: Build, Sharpen, Final stretch (last 4 weeks).
- Build: dense milestones, gentle quest, pass cap 2.
- Sharpen: Wednesday checks and trap work lead the Mob (the loop in the brief); full mock together appears as a format.
- Final stretch: cap 3 passes; a 5-card revise of fixed traps counts as a chain day; Mob quest is lowered to 10 per member (guess); the day before the exam counts as a rest day for everyone, with one line from Mobi.
- **Never a countdown in the Mob.** "Days to CUET" stays an opt-in line in You.

---

## 3. Proposal 2: Free versus Pro

Rules both plans live under (never bent):
1. Participation is free: any member plays every game in any Mob they belong to, forever.
2. Safety is free: streak protection, rest passes, make-up, Rest week, blocking, reporting, hiding things.
3. Marks are equal: same scoring, same time, no hints, no power-ups, no extra attempts, no view of friends' answers that Free lacks. Pro never wins against a friend.
4. Collectibles are earned, never bought. Pro may buy looks (themes), never trophies.
5. Free sees every Pro thing, locked and honest, with a one-line reason; no fake locks, no nags in play.

| Capability | Free | Pro (Rs 99 web, Rs 150 Play) | Why it is fair |
|---|---|---|---|
| Join Mobs, up to 12; join by 6-character code, link or QR | yes | yes | Participation |
| Play every game and room others start; weekly Mob paper in every Mob | yes, unlimited (today: one Mob paper a week across all Mobs; I propose lifting it) | yes | A friend's game is never shut to you |
| Create a Mob | 1 | up to 3 | Unchanged from today |
| **Start a game**: sprint, race, custom length, chapter pick, rematch, live room, scheduled game | no | yes (owner's rule) | The one headline gate |
| Study Room (company only: shared timer, no marks, no podium) | can start (proposal, needs his yes) | can start, scheduled and custom timer | A taste of live, with no scores |
| Ask for a game (preset sticker "Play?" to the Mob) | yes | sees requests | Free is never mute |
| Pass the mic: let a Free friend host one game under your pass | receive | 2 passes a week to give | A single Pro member lifts the whole Mob; Spotify's host controls are the model [S21] |
| First game of each new Mob | any member may start it, once | n/a | The "try once" hook from SOCIAL-SPEC D-S2 (needs his yes) |
| 24 characters, 8 colours, all stickers, earned shelf, Mob shelf | all | all | Identity is not a paywall |
| Personal chain, Rest passes, make-up, exam pause, milestones | identical | identical | Safety (rule 2) |
| Podium, marks, ties, moments, trap, Wednesday check | all, in every game you play | all | Equal play (rule 3) |
| Side-by-side with friends | last week of each Mob, marks and right or wrong per question | every week; plus seconds per question and changed answers | Strava's pattern: depth, not participation [S22] |
| **Mob Insights**: where the Mob loses marks (top 3 chapters), guess-or-skip read, trends over weeks, "what to play next" (aggregates; min 3 sitters) | weekly one-line summary | full | Insight is the real Pro value |
| Past weeks and **Season recap** (Mob chain, collective questions, traps fixed, shareable card) | this week + last week; share card for chain milestones | every week; monthly and season recap | Depth |
| Full mock together, up to 30 questions, Exam-hall rehearsal live format | no | yes (locked and visible if billing is off) | Heavy to host |
| Den and character looks (6 den lamp themes, character colour sets) | default theme | all themes | Looks only |
| Mob Time reminders, Mob calendar | join and get reminders | schedule them | Hosting |
| AI: Mobi explains a trap to the whole Mob | uses the member's 10 monthly credits | 50 a month; one cached explanation serves the whole Mob | Existing credit rules; AI only via gpt-6-luna or Claude Haiku 5.5 |
| Extra papers (3 a Mob a week) | sit them | make them (unchanged) | Existing |

How it feels worth Rs 99: for a student who hosts, it is the loop (start, schedule, rematch, mock together); for the group it is Mob Insights and recaps; across about 9 months it is under Rs 10 a month (my arithmetic, check at pricing). The honest pitch is "run your Mob like a room, and see where your Mob loses marks".

**Needs his decision before build (risks I found):**
1. **Billing-off dead end.** D127 says with billing off the start control is "visible but locked". Then nobody can start a game at launch and the Mob has only the weekly paper. A control nobody can unlock breaks the first-time-student test. Recommend: while billing is off, any member can start, with the line "Starting games becomes a Pro feature soon"; or at minimum the first-game-free hook above.
2. **Lift "one Mob paper a week across all Mobs" for Free** (a free-claims ledger today). It costs us no AI and it conflicts with "play everything".
3. **Study Room startable by Free** (it is not a sprint, race or round).
4. **First game of a Mob free** and **Pass the mic**: both soften his "Pro only" rule; he should confirm.

---

## 4. Proposal 3: live play as a first-class mode

### 4.1 What live means with 2 to 5 friends
Live is a **shared start and shared presence**, not a forced shared pace. Everyone sees "3, 2, 1" from the server clock, then answers at their own pace on the same frozen paper while seeing where friends are (question number, and nothing about right or wrong). This is the S7 screen he liked, made honest.
Formats (all on one frozen paper, started by a Pro host or by a pass):
- **Live sprint**: 5 questions, own pace, finish when everyone is done or after 5 minutes plus a 60-second grace.
- **Live race**: 5 or 10 minutes, as many as you can; questions answered and marks both counted; podium by marks.
- **Exam-hall rehearsal** (Pro, 20 questions, 20 minutes): the real CBT chrome (palette, mark for review, timer), same start for all. For students new to computer-based tests, it makes the exam room familiar. (my judgement)
- **Study Room**: no questions in the room; a shared 25-minute timer with 5 minutes' break, everyone practising their own thing. At the end: "Together: 3 of you, 25 minutes" and, only for members who allow it, a summed question count. (Presence-only company, in the spirit of focus rooms; evidence is anecdotal [S16].)
Reveal rules: the podium shows only when all present have finished or the window closes ("so far" labels before then, per Arena fixes); answers and the trap stay locked until close; presence broadcasts carry no correctness.

### 4.2 How it works on Supabase (checked against the docs)
- **Channels**: one **private** channel per room, topic `mob-room:<room_id>`, created with `private: true` in the Flutter client (`RealtimeChannelConfig(private: true)`); **Presence** for "here, playing, done" and the question index; **Broadcast** for the start signal, stickers, and "finished" [S25], [S26].
- **Authorization**: turn off public access in Realtime settings; add RLS policies on `realtime.messages` (select to receive, insert to send or track) that call a `security definer` function `mob_can_join_room(realtime.topic(), auth.uid())`. A function is needed because today all `mob_*` tables are service-role only with no client policy. Permission is checked when joining and then cached for the life of the connection; a removed member keeps receiving until their JWT expires [S26]. Therefore broadcasts carry **no names, no marks, no answers**, only the opaque memberId, state and question index, and keep JWT life short.
- **To check at build**: the app has a Supabase session (`auth_service.dart`); how the web signs the Mob API (cookie session) is not a Supabase JWT in what I read, so the web may need a short-lived token minted by the API for Realtime.
- **Truth stays in Postgres**: a room is an extension of `mob_extras` (mode, `starts_at`, `window_ends_at`, frozen `question_ids`), so a live game and its 24-hour async twin are one object. Picks go to the existing API per question; the server times them from its own clock and writes marks; the client shows a countdown from the `server_now` that `/paper/start` returns. Broadcast is for feel; the result is whatever the server stored. This also stops anyone faking a podium.
- **Quotas** (Supabase, current docs): Free plan 200 concurrent connections, 100 messages a second, 20 presence messages a second; Pro plan 500, 500 and 50 [S25]. A live game is up to 5 connections, so Free plan holds about 40 live Mobs at once and Pro plan about 100. Only 4 students attempted a paper in the last 30 days at the 18 Oct count, so we are far below either. Safeguards: connect only while a room is open (not on the Den), idle drop after 10 minutes, room life cap of 30 minutes (Study Room 2 hours). On a `too_many_connections` error the app says "Live is busy right now. Play now and your Mob can catch up", which falls back to async.
- **Reconnect and cheating**: a dropped player rejoins within 60 seconds and resumes from stored picks. Collusion over WhatsApp cannot be stopped, so friend games are not proctored; marks count only inside the game.
- **Cost**: no AI calls in play; messages per game are in the tens. Presence is used only inside rooms because Supabase advises using it sparingly [S25].

### 4.3 Knowing a room is open (no push exists)
FCM is not wired, so we promise nothing we cannot deliver. A host's "Start live" opens the system share sheet with a plain message ("Riya's room is open: Goodwill sprint, 8:00 PM. Code K7P 2M9") over WhatsApp, and the Den shows "Riya opened a room at 8:02 PM" on the next read. That wording states a time, not a claim that Riya is online. **Mob Time** (see 5, A) turns this into a weekly habit with an opt-in local reminder, which the existing local notification planner can already do.

### 4.4 When nobody is online (honest by construction)
- The lobby shows only real presence: "You're the first here." Never a bot, never "3 friends are online" unless three presence entries exist.
- It offers three choices: wait (15 minutes), **play now** (async), or send the code again.
- **Async with ghost runs**: the game stays open 24 hours. Each friend who plays later returns as a **ghost**: a real recorded run, labelled with name and time ("Kabir, 4:55 PM"), moving at the real pace of that run, as in Den S3. No synthetic ghosts, no "AI rival".
- **Your own ghost**: race your previous run on the same paper. This works for a Mob of one and with no friend online.
- Results say plainly who has played: "3 of your 4 have played. One more can play until 2:05 PM tomorrow." It names nobody who has not.
- Never count dormant members as opponents; a Mob of one still gets the weekly paper and Study Room solo (as a timer with the character).

---

## 5. Proposal 4: more mechanics he has not asked for

### 5.1 What I refuse (from the research)
Daily pair streaks; countdown or hourglass icons; paid restores; XP leagues of strangers; demotion and "X took your place" alerts; random rewards, loot boxes, gacha or any spending that rewards luck (Gimkit and Blooket patterns [S17]); ranking by volume of study (Yeolpumta's pattern); group-death rules (Forest's [S14]); "N friends online" without presence; Pro-only safety.

### 5.2 The mechanics
| # | Mechanic | Why it works for a 16 to 17-year-old preparing for CUET | Truth and safety |
|---|---|---|---|
| A | **Mob Time**: the Mob picks one weekly slot (Sunday 8:00 PM). The Den shows "Next: Sun 8:00 PM"; each member may opt into a local reminder 5 minutes before; a Pro host can open the room then | Same time and place is how habits form [S1]; teens have school and coaching, so a fixed slot beats ad hoc | Local, opt-in reminders only, within the existing quiet hours; no push; no count of who came |
| B | **Study Room / Together Hour**: 25 and 5 shared timer, character at the table | Company without talking; focus rooms are popular [S14], [S16]; works on a bad-mood day because there is no score | Presence only inside the room, 2-hour cap, no marks, no free text |
| C | **Daily Five with a spoiler-free share grid**: the same 5 questions for every student each day; the result is a row of squares (right, wrong, skipped) a student can paste to WhatsApp, with no question text and no name | 3 minutes, fits a school day; a shared daily puzzle gives friends something to compare outside the app, and it is free marketing (the grid idea is from Wordle; my judgement, not sourced) | It is the student's own result; no crowd percentages shown at launch; bank questions only, no AI; the card has no personal data |
| D | **Why did it slip?**: after a wrong answer, pick one of four reasons (I rushed, I forgot the rule, I misread it, I guessed); the Mob sees only the tally ("2 rushed, 1 forgot the rule") | The app's loop is find where marks slip and fix each mistake; naming the cause turns a loss into a plan (my judgement; exam-wrapper idea) | Aggregate only, never named; preset options, no free text; tally needs 3 answers to show |
| E | **Guess or skip read**: after a game, privately "You tried 6 guesses: 2 right, 4 wrong, +6 marks net"; the Mob sees only a pooled line | CUET marks +5 and -1, so students must learn when a guess pays; this is a real, teachable skill | Computed from marks; private by default; pooled needs 3 sitters; no judgement words |
| F | **Pass the mic**: a Pro member lets a Free friend host one game (two a week) | Gives the Mob a stable ritual of rotating hosts; makes one Pro member useful to all (Spotify's host controls [S21]) | Pro gives, never forces; the receiver can decline; marks unaffected |
| G | **Rest week and Luck sticker**: a member steps out for a week without naming a reason; the quest resizes quietly; friends may send a preset "Good luck for your exam" sticker to the Mob | 16 to 17-year-olds have school tests and boards; the Mob must survive a quiet week without guilt | Names nobody; the sticker set is fixed; Rest week is self-set |
| H | **Earned Pages**: a 12-page story per season (the Paper Family at the Den, each page a character and a short caption); pages unlock by deterministic events only: first fixed trap, 3 stamps, 7 or 30 days, Mob chain weeks 2, 4, 8, Wednesday checks passed | Gives the toy-figure idea a direction and a story, answers "collectibles but how"; each page is a real achievement, which makes a share-worthy screenshot (his marketing hope) | Never random, never sold; each page names the rule that gave it; same pages for Free and Pro |
| I | **Exam-hall rehearsal** (live format, 4.1) | Many are new to CBT; rehearsing together lowers exam-day nerves (my judgement) | Pro host; marks as normal; no answers broadcast |
| J | **Your own ghost** (4.4) | Beats yesterday's self without needing friends; teaches pace | Only your own recorded run |

### 5.3 Marketing hooks (his 4:42 pm note), no extra product claims
Page cards (H) and the Daily Five grid (C) are the two shareable artefacts: one tells a story about progress, the other starts a game among friends. Both carry only first-name-free data.

---

## 6. Checks before anyone builds
- **Every number has a query**: chain days (attempts by IST day), rest and made-up days (ledger rows), quest progress (sum of answered questions in `mob_sittings`, extras and the opt-in switch), podium (server marks), presence (a live channel entry) and "played today" (Mob games only). A number with no row is cut.
- **No crowd dependence**: nothing shows percentages of "all students"; thresholds of 3 sitters for any Mob aggregate; counts under 5 stay hidden as already decided.
- **Safety grep list**: no free text, no photos, first names only, no loss or guilt copy, no countdown, no named non-players, no random reward, no payment for streak or collectible.
- **Tests that lock it**: chain maths (day boundary, pass and make-up order), quest resize on Rest week, room authorization policy (a non-member cannot join `mob-room:*`), fallback when the connection quota errors, and copy lint for the safety list.
- **Migration**: 6-character codes (old 8 keep working), `mob_members.avatar`, room columns on `mob_extras`, a rest-pass ledger, a chain ledger. All additive; staging gate first; no production write without his say (D122).
- **Open questions for him**: the four in section 3; quest size (15 per member is a guess); whether a Free member may start a Study Room; whether Exam-hall rehearsal is worth a Pro-only slot; and Realtime access from the web (token approach).

---

## Sources (all fetched 19 Oct 2026; a "third-party" tag means not the company's own page)
- [S1] Duolingo, "The Duolingo Streak Uses Habit Research to Keep You Motivated": https://blog.duolingo.com/how-duolingo-streak-builds-habit
- [S2] Duolingo streak freeze and repair, third-party guides (price unverified): https://duolingo.fandom.com/wiki/Shop/Streak_freeze
- [S3] Android Authority, Duolingo streak revival, June 2026: https://androidauthority.com/duolingo-revive-broken-streak-event-3673004/
- [S4] Duolingo, "Friend Streak": https://blog.duolingo.com/friend-streak/
- [S5] Duolingo, "How We Built the Friend Streak": https://blog.duolingo.com/product-lessons-friend-streak/
- [S6] Duolingo, "Introducing Friends Quests": https://blog.duolingo.com/friends-quests/
- [S7] Duolingo leagues analysis (third-party): https://duolingo.deconstructoroffun.com/mechanics/leagues
- [S8] Snapchat Help, how streaks work: https://help.snapchat.com/hc/en-us/articles/7012394193684-How-do-Streaks-work-and-when-do-they-expire
- [S9] Snapchat Help, restoring a streak: https://help.snapchat.com/hc/en-us/articles/7012318024852-I-lost-my-Streak-How-do-I-restore-it
- [S10] EDRi on the Bits of Freedom study of Snapchat gamification: https://edri.org/our-work/new-study-reveals-how-young-people-are-influenced-by-gamification-features-on-snapchat/
- [S11] van Essen and Van Ouytsel 2023, Telematics and Informatics Reports 11, 100087: https://doaj.org/article/7e7e45c958c74b29ba203607b6f4a840
- [S12] Silverman and Barasch on streaks (press summary, not the papers): https://www.earth.com/news/streaks-can-be-a-powerful-tool-for-motivation
- [S13] YPT App Store page: https://apps.apple.com/us/app/-/id1441909643
- [S14] Forest Plant Together (guide and review): https://makeheadway.com/blog/forest-app-review/
- [S15] Focus Friend coverage (Study Bunny: product pages only): https://blog.washcoll.edu/wordpress/theelm/2025/09/new-focus-friend-study-app-by-hank-green-explodes-in-popularity/
- [S16] NPR on virtual body doubling: https://www.npr.org/2024/07/25/nx-s1-4860330/come-study-with-me-how-virtual-buddy-might-help-you-get-things-done
- [S17] Blooket, Gimkit, Kahoot comparisons (third-party): https://www.teachfloor.com/blog/blooket-vs-gimkit-vs-kahoot--vs-quizizz and https://nibble-app.com/blog/blooket-vs-gimkit
- [S18] "Effect of points and audio in Kahoot", ECGBL 2016: https://folk.idi.ntnu.no/alfw/publications/ECGBL2016-Effect_of_points_and_audio_in_Kahoot.pdf
- [S19] Ho, Hung and Kwan 2021 meta-analysis (summary): https://universityxp.com/research/2022/4/22/the-impact-of-peer-competition-and-collaboration-on-gamifed-learning-performance-in-educational-settings-a-meta-analytical-study
- [S20] Blooket and Gimkit free versus paid (third-party): https://www.differentiatedteaching.com/blooket
- [S21] Spotify Support, Jam: https://support.spotify.com/us/article/jam/
- [S22] Strava 2020 subscriber changes: https://www.singletracks.com/mtb-news/strava-makes-segment-leaderboards-other-features-exclusive-to-subscribers/
- [S23] Discord Nitro tiers (third-party) and a user thread: https://eesel.ai/blog/discord-pricing and https://support.discord.com/hc/es/community/posts/1500001276561-Stop-adding-basic-features-to-Nitro
- [S24] Duolingo Help, Super and Max: https://www.duolingo.com/help/what-is-duolingo-max
- [S25] Supabase Realtime quotas: https://supabase.com/docs/guides/realtime/quotas and Getting started: https://supabase.com/docs/guides/realtime/getting_started
- [S26] Supabase Realtime Authorization (private channels, RLS on `realtime.messages`, caching): https://supabase.com/docs/guides/realtime/authorization ; Flutter private channel and presence examples via context7 (supabase docs) and the Supabase Flutter multiplayer game post (URL inferred from the docs repo path, not opened): https://supabase.com/blog/flutter-real-time-multiplayer-game
