# Mob v3 build spec: Den Arena with Den Live's best (19 Oct 2026, night)

This is the spec two builders follow without guessing: a **server builder** (Next.js plus Supabase, from live main `4af47969` in `wt-rel11`) and an **app builder** (Flutter, from `ui/v15.4-1019pm` in `wt-v15-3/flutter_app`). Nothing in it is built, committed or deployed yet.

**Authority, newest first.**
- The owner's decisions D127, D128, D129 and D133 (`docs/brain/OWNER-FEEDBACK-2026-10-19.md`, from "4:30 pm" on).
- This spec. Where the design packs disagree, this spec decides, and section 0.3 lists each call.
- `design-arena/MOB-V3-ARENA.md` is the base. Grafts come from `design-live/MOB-V3-LIVE.md`.
- `MOB-V3-JUDGE-GENZ.md` and `MOB-V3-JUDGE-CRAFT.md`: every fatal issue they list is fixed here (section 0.2).
- `RESEARCH-GAME-SYSTEMS.md`, `BRAND-MOTION-KIT.md` and `CHARACTER-WORLD.md` give the rules and the motion language.
- `../MOB-FACTS.md` describes the code as it stands.

**House rules that still hold.**
- Every number on screen comes from a server field.
- No free text between users, no photos, first names only (2 to 18 characters).
- Nothing in the Mob is for sale, and no price appears inside the Mob.
- No production write, deploy or paid step without the owner's yes (D122).
- Migrations are dry-run on staging `onwkqxmjqjrhfbjjdydu` only.

---

## 0. Decisions this spec makes

### 0.1 The build in one paragraph
The Mob tab becomes **the Den**: the app's lamp-lit room with each member's **Fold** standing in the lamp pool, the Mob's **pennant** (its weekly chain) on the wall, and the **shelf**. One volt key plays the most useful game. A game is a frozen paper of 5 to 20 questions that a member starts. It is played **live** (a room with a shared 3, 2, 1 on the server clock and a ruler race of full-body Folds) or **anytime in 24 hours** (racing friends' real recorded runs as ghosts). Every live room is also a 24-hour game. Results are a **stage-lit podium** by CUET marks (+5, -1, 0) that says "so far" until the game closes. Then come everyone's moment, "Fix it together" (only after close), and a preset sticker. Every answered question fills the **weekly quest**. A finished quest stitches a week onto the pennant, and on the first quest a **parcel** opens and a Fold climbs out. Each student also keeps a private **daily chain** with rest passes that apply themselves, a free make-up and an exam pause.

### 0.2 Fatal issues from the judges, and the fix in this spec
| # | Issue | Fix (where) |
|---|---|---|
| F1 | Answer leaks: Live showed "It was C" and the working while the 24-hour twin was open | The server never sends a correct option or an explanation for a game before `closes_at`. The answer route returns only your own right or wrong and your marks change. Review, trap and Fix it together open after close (3.6, 3.7, 4.4, test SV-7). |
| F2 | "Played" tags under friends expose who did not play | The den lineup never carries a per-member played or not-played state. Runs are a row of their own: "Runs so far: Riya, 2:10 PM. Kabir, 4:55 PM." Nothing counts non-players; there is no "3 of 4" and no "one more can play" (5.3 D2, copy lint C-3). |
| F3 | Trap lines and moments identify people in a small Mob | Game trap copy never states a count: "Question 4 caught most of you." Moments never mention the trap question. A skip fact is never shown on the trap question (3.7, `moments.mjs`, test SV-9). |
| F4 | Price inside the Mob, and paid cosmetics (Live's "lamp themes 1 vs 6") | No price string, currency sign or plan price anywhere under `lib/features/social`. "See what Pro adds" opens the existing paywall. Lamp themes and every finish are earned (section 0.4). Lint C-1. |
| F5 | Earn rules contradict each other across three documents | One canonical earn table (0.4), owned here, in `src/lib/mob/folds.mjs` and `lib/features/social/folds/fold_catalog.dart`, kept equal by a contract test. |
| F6 | Full-screen 100% volt flash on Go live; loot-box sunburst on the reveal | The go-live wipe stops at a circle covering at most 40% of the screen, at 22% volt opacity (Night) or 30% (Day), and fades out by 900 ms. The reveal is Live's parcel with a warm leak and no rays (5.6 M2, M9). |
| F7 | The countdown "3" renders as a mangled glyph, numerals overlap, and the pivot covers the digit | One numeral at a time on its own layer above the dial art: out ends before in starts. The brass pivot is drawn under the numeral layer. Golden frames per beat (5.6 M3, test G-4). |
| F8 | The quest counter stopped at 60 when 70 were answered | Counters show the true total past the goal: "70 answered. The quest needed 60." The bar draws full, and the number keeps counting (5.3 Q, test SV-11). |
| F9 | Late-night framing for minors: Kandil "Lights up the den on late nights", the Mob name "Night Owls" | Kandil's line is now "Keeps the desk lit for everyone." with an awake idle pose. "Night Owls" is removed from the name list. Copy lint C-4 bans night-study wording. Live rooms open only from 6:00 AM to 11:00 PM IST (section 6). |
| F10 | Live podium count-up showed the winner below second and third | Every count rolls up from the marks of the place below, and the order is true in every frame (5.6 M7, frame test G-6). |
| F11 | Last place lit alone for about 1 s | Floor members appear together, with the collective line at 400 ms, before the plinths. They are never alone on stage (M7). |
| F12 | Arena's room showed the Mob's invite code ("Send the code") | Live rooms have no code. They are Mob-only, reached from the den (5.3 L1). |
| F13 | Live's Mob chain extended to week 5 while the quest read 41 of 60 | The stitch plays only after the server says `quest.done` for that week (M8 waits for the server ack). |
| F14 | Pro-only start left a Mob with nothing to play | With billing off, anyone may start. Free gets 1 start per Mob per week plus Pass the mic (3.3). |

### 0.3 Calls this spec makes where the packs differ
1. **The race view is Live's ruler with full-body Folds** (his S7). Two Folds on one number stand in depth: the later arrival sits 10 dp up, at 0.86 scale and 70% brightness, behind the other. With 5 players in a room, the ruler compacts: Folds go to 48 dp and names to initials plus a colour tab. Arena's OMR lanes are **not built**.
2. **The countdown is Arena's stopwatch with Live's stamped paper numerals** (Gen Z judge graft 4).
3. **The podium has Live's staging and Arena's content**: the lamp narrows and the label says "so far", with the collective line, shared places, the floor for 4th and 5th, and a visible "Skip".
4. **The reveal is Live's parcel climb-out**, built from the generated parcel stills (5.7), with no rays.
5. **The chain strip is Live's**: paper ticks, today's live "2 of 5", and the 14-day arc with Mobi cheering.
6. **Free and Pro copy is Arena's.** No price, and no one's plan is ever labelled. Hosting a room or passing the mic can imply Pro once billing is on; the spec accepts that and never states it.
7. **Story pages, the season recap, sound, QR scan and Study Room are later** (section 1.2).
8. **Mob names come from a fixed kind list** (Arena S21), with no free text. Existing Mobs keep showing their subject until the owner of the Mob picks a name.
9. **One Fold per student**, shown in every Mob (a seat identity, like a profile picture). The member colour stays per Mob.

### 0.4 The canonical earn table (owned here, F5)
Rules:
- 12 Folds plus Mobi. Mobi is never collected.
- **Four starters are free to everyone** from the first Mob moment.
- The other eight are earned by deterministic, stated events. They are never random, bought, traded or gifted.
- Pro and Free get the same table.
- A locked Fold shows its true silhouette with the rule and a real count ("2 of 3").
- You may sit as any Fold you own. Owned Folds are kept forever, including after leaving a Mob.
- Fold counts in the card corner are 1 for a starter, 2 for one you earned yourself, 3 for one your Mob earned together.

| Fold | Colour (paper) | Folds | How it is earned | Server source | Shelf line |
|---|---|---|---|---|---|
| Dart | sky `56B8F0` | 1 | Starter | none | "Answers first, then learns to check." |
| Dog-ear | rose `FF7A8A` | 1 | Starter | none | "Learning to trust the first pick." |
| Hexa | teal-green `3FC6A8` | 1 | Starter | none | "Builds each answer step by step." |
| Kandil | amber `F2A93B` | 1 | Starter (awake idle pose) | none | "Keeps the desk lit for everyone." |
| Hop | teal | 3 | Your Mob finishes its **first** weekly quest (all members at that moment, plus anyone who joins later and is in the Mob when a later quest is done) | `mob_weeks.done_at` | "Bounces back after a wrong one." |
| Crane | violet `B98CFF` | 3 | Your Mob fixes **3 traps** together (3.7: a trap is fixed when 2 or more members get its Wednesday check right) | `mob_traps.fixed_at` count | "Folds it until it is right." |
| Stamp | cream | 3 | Your Mob's chain reaches **4 weeks in a row** | Mob chain compute | "Seals every fix that held." |
| Naav | periwinkle `6E8BFF` | 2 | Finish your **first full-length mock** | `attempts` with mock mode, count ≥ 1 | "Steady in the last ten minutes." |
| Tally | coral-cream | 2 | Finish **3 Mob games with no minus marks** | `mob_game_runs` with `wrong = 0` and `finished_at` set | "Counts the minus marks too." |
| Patang | rose-red | 2 | **Beat your own best score** in a subject's full mock | `attempts` with mock mode, score > previous best of that subject | "Rises against the wind." |
| Sticky | sage | 2 | **5 fixes that held** (a right answer on a later check, from a repair or a Mob Wednesday check) | repair hold rows (the rows behind `rhythm.js` `firstHoldAt`) + `mob_fix_checks` | "Remembers the formula for you." |
| Cutting | coral `E58E5A` | 2 | **Come back after 3 or more days away** (`RETURNING_AFTER_DAYS` in `rhythm.js`) | chain days | "Knows a break is part of the plan." |

**Finishes (build 1: Plain and Foil only).** Foil edge for the Fold you sit as is earned at a **30-day personal chain** and is drawn by the foil shader (D). Graph paper, glow ink and pencil sketch come later.

**Den objects (Mob chain milestones), all earned.**
| Week | Item |
|---|---|
| 2 | Den stamp |
| 4 | Stamp (Fold) and the desk bell |
| 8 | Brass lamp (a den light look) |
| 12 | Foil seal on the pennant |
| 20 | A second den stamp row |

**Personal chain milestones.** 3: rest pass. 7: rest pass. 14: none. 21: rest pass. 30: Foil edge. 50, 75, 100, 150: a ribbon on the chain (no item). Each fires once.

**The weekly quest parcel** always shows its true contents' silhouette in advance:
- until the Mob owns Hop, the parcel holds Hop;
- after that, it holds the next Mob-chain item if finishing this week reaches its milestone;
- otherwise it holds "This week's stitch" (the stitch itself, no parcel open).

---

## 1. Scope

### 1.1 First build (two phases, one release)
**Phase A, the async loop.** It ships even if Phase B slips, behind `MOB_V3_ENABLED`.
1. The Den (quiet, open game, waiting, Mob of one, loading, offline, failed) with Folds, pennant, shelf, quest strip and chain chip.
2. Folds: first-Fold pick, the shelf with earned and locked items and foil, the seat Fold, the parcel reveal.
3. Games: **Sprint** (5 questions) and **Your own round** (10, 15 or 20, a chapter or the whole subject), and **Rematch** (same format, new questions). All are "anytime in 24 hours", with ghost runs.
4. Server-graded answers: your own right or wrong after each lock-in, with the answer held until close (F1).
5. Podium by CUET marks with ties, "so far", the switch, floor places, and everyone's moment.
6. Fix it together (Now plus the Wednesday check) after close; Mob traps feed Crane.
7. Personal daily chain: rest passes, make-up, exam pause, "Hide my chain", milestones (14-day arc).
8. Mob weekly chain: quest, step out, week pass, pennant stitch, milestones.
9. Free and Pro starts: open while `PLAY_BILLING_ENABLED` is not `true`; Free 1 start per Mob per week; Pass the mic (2 a week to give); Pro unlimited.
10. Lift "one Mob paper a week across all Mobs" for Free ("Free members join and play everything").
11. 6-character join codes, with old 8-character codes working until they expire; Mob names from a list; a WhatsApp invite card.
12. Preset stickers on results and in the den.

**Phase B, live.** Behind `MOB_LIVE_ENABLED`. When it is off, the app shows only "anytime in 24 hours".
13. Live rooms for Sprint and Round: a private Realtime channel, ticketed access, presence ("Here", "Ready"), server broadcasts (start, progress, finished, done), the lobby, the countdown, the live ruler race, a friend finishing, the reconnect, and the quota fallback.

### 1.2 Later (not in this build; each needs its own spec)
| Item | Why later |
|---|---|
| Timed **Race** (5 or 10 minutes, as many as you can) | Needs a question stream and a different podium rule |
| **Full mock together** (50 in 60 minutes), **Exam-hall rehearsal** (NTA chrome) | Pro formats, but long sessions; reuse the NTA runner; 2 weeks |
| **Study Room** (shared timer, no marks) | Owner's yes needed on Free starting it |
| **Mob Time** weekly slot with local reminder | Local notification planner work |
| Story pages "The Long Paper" | Writing and art; owner to approve the name |
| Graph paper, glow ink, pencil finishes | 36 more images or shaders |
| Sound (about 15 clips) | Owner's nod and an audio package |
| Scan QR / show QR | New packages (`mobile_scanner`, `qr_flutter`) |
| Mob Insights, season recap, "Count my practice" quest switch | Depth features for Pro after the loop proves out |
| Web parity for v3 screens | The web keeps today's Mob and stays API-compatible (3.0) |
| Push for "a room is open" | FCM is not wired |
| Final-stretch rules (3 passes, 10 per member) | Need season dates from NTA |

---

## 2. Data model

### 2.0 Rules for every migration
- Additive and idempotent, in the existing style: RLS on, no `anon` or `authenticated` policy on `public.mob_*` tables, `grant all ... to service_role`, and functions `security invoker set search_path = public` that take the acting user id from the API. **The only `security definer` function** is the Realtime check (2.4), because it runs inside an RLS policy for `authenticated`. It has `set search_path = ''` and fully qualified names.
- Each file has a header saying what it does, "Applied to staging only by this change", and the undo path. Each has `supabase/undo/<same name>.undo.sql` that drops exactly what it added. Data moves are recorded in `mob_data_moves` so they never run twice.
- `src/lib/server/accountDeletion.js` gets an explicit step for every new table that holds a user id. Old build 9 apps keep working: every existing route keeps its request and response shape (3.0).
- **The server computes every number shown.** Marks, places, counts, times, quest totals, chain days, passes, progress counts on locked Folds and the collective line all come as numbers from the API. The app formats them and never derives them, except the ghost pace chip (5.3 R3). That chip uses a fixed formula over server-sent times and is unit-tested on both sides.

### 2.1 `20261020100000_mob_v3_core.sql` (undo `supabase/undo/20261020100000_mob_v3_core.undo.sql`)
```sql
-- 6-character codes; old 8-character codes keep working until they expire.
alter table public.mob_invites drop constraint if exists mob_invites_code_check;
alter table public.mob_invites add constraint mob_invites_code_len
  check (code ~ '^[0-9A-HJKMNP-TV-Z]{6}$' or code ~ '^[0-9A-HJKMNP-TV-Z]{8}$');

-- A Mob's name from a fixed kind list (src/lib/mob/names.mjs, 24 keys; null = show the subject) and the podium switch.
alter table public.mobs add column if not exists name_key smallint check (name_key between 0 and 23);
alter table public.mobs add column if not exists show_podium boolean not null default true;

-- The student's seat Fold, one for every Mob.
create table if not exists public.mob_profiles (
  user_id text primary key references public.users(id) on delete cascade,
  fold text not null check (fold in ('dart','dogear','hexa','kandil','hop','crane','stamp','naav','tally','patang','sticky','cutting')),
  finish text not null default 'plain' check (finish in ('plain','foil')),
  updated_at timestamptz not null default now()
);

-- Earned Folds and finishes (starters are implicit). Kept forever; mob_id has no FK so it outlives the Mob.
create table if not exists public.fold_unlocks (
  user_id text not null references public.users(id) on delete cascade,
  fold text not null,
  finish text not null default 'plain' check (finish in ('plain','foil')),
  source text not null check (source in ('mob_quest','mob_traps','mob_weeks','first_full_mock','clean_games','beat_best','fixes_held','came_back','chain_30')),
  mob_id uuid,
  earned_at timestamptz not null default now(),
  primary key (user_id, fold, finish)
);

-- Preset stickers. No free text: kind is an enum. Kept 30 days (a cleanup in mob_v3_games settle).
create table if not exists public.mob_reactions (
  id bigint generated always as identity primary key,
  mob_id uuid not null references public.mobs(id) on delete cascade,
  game_id uuid,
  from_user text not null,
  kind text not null check (kind in ('nice_one','so_close','teach_me','again','good_luck','lets_go','one_sec','ready')),
  created_at timestamptz not null default now(),
  foreign key (mob_id, from_user) references public.mob_members(mob_id, user_id) on delete cascade
);
create index if not exists mob_reactions_mob_idx on public.mob_reactions (mob_id, created_at desc);

-- One-time moments a student has seen (reveal played, milestone shown, pass notice read).
create table if not exists public.mob_seen (
  user_id text not null references public.users(id) on delete cascade,
  key text not null check (char_length(key) <= 80),
  seen_at timestamptz not null default now(),
  primary key (user_id, key)
);

-- "Resting this week": the quest resizes without naming anyone.
create table if not exists public.mob_step_outs (
  mob_id uuid not null, user_id text not null, week_start date not null,
  created_at timestamptz not null default now(),
  primary key (mob_id, user_id, week_start),
  foreign key (mob_id, user_id) references public.mob_members(mob_id, user_id) on delete cascade
);
```
Functions (all `security invoker`, service role only, revoke from `public, anon, authenticated`, grant execute to `service_role`, as in `20261017100000_mob.sql`):
- `mob_create_named(p_user_id text, p_subject text, p_name text, p_colour smallint, p_max_mobs int, p_name_key smallint) returns jsonb`. This is `mob_create` (with fix_1017's `created_by`) plus `name_key`. The old function stays for the undo.
- `mob_settings_set(p_user_id text, p_mob_id uuid, p_show_podium boolean, p_name_key smallint) returns text`: `ok | not_member | not_owner`. Owner only; a null leaves the field as it is.
- `mob_profile_set(p_user_id text, p_fold text, p_finish text) returns text`: `ok | locked`. A starter, or a row in `fold_unlocks` for that fold and finish.
- `mob_fold_grant(p_user_id text, p_fold text, p_finish text, p_source text, p_mob_id uuid) returns text`: `new | had`. Idempotent (`on conflict do nothing`).
- `mob_sticker(p_user_id text, p_mob_id uuid, p_game_id uuid, p_kind text) returns text`: `ok | not_member`. When the game has a room in `lobby` or `running`, it calls `realtime.send(jsonb_build_object('m', p_member_id, 'k', p_kind), 'sticker', 'mob-room:' || p_game_id, true)`. Because of that, the signature also takes `p_member_id text`, computed by the API.
- `mob_step_out(p_user_id text, p_mob_id uuid, p_week date, p_on boolean) returns text`: `ok | not_member | done`. `done` means the week's quest is already finished, so it cannot change.
- `mob_seen_mark(p_user_id text, p_keys text[]) returns int`.
- `mob_state` is replaced (`create or replace`, same signature) to add `mob.name_key`, `mob.show_podium`, `members[].fold` and `members[].finish` (joined from `mob_profiles`), `step_outs` (count only, never who), `reactions` (the last 20 of the last 7 days), `games` (open, plus closed in the last 7 days, via `mob_game_json`), and `week` (2.2). The old keys stay unchanged for build 9.

### 2.2 `20261020100100_mob_v3_games.sql` (undo `supabase/undo/20261020100100_mob_v3_games.undo.sql`)
```sql
create table if not exists public.mob_games (
  id uuid primary key default gen_random_uuid(),
  mob_id uuid not null references public.mobs(id) on delete cascade,
  created_by text references public.users(id) on delete set null,
  started_via text not null check (started_via in ('open','pro','free_weekly','mic')),
  format text not null check (format in ('sprint','round','rematch')),
  mode text not null check (mode in ('live','async')),
  subject text not null,
  chapter text check (chapter is null or char_length(chapter) <= 120),
  question_ids jsonb not null check (jsonb_typeof(question_ids) = 'array' and jsonb_array_length(question_ids) between 5 and 20),
  seconds_per_question smallint not null default 60 check (seconds_per_question between 30 and 120),
  week_start date not null,
  rematch_of uuid references public.mob_games(id) on delete set null,
  opened_at timestamptz not null default now(),
  closes_at timestamptz not null,                -- opened_at + 24 hours: the answers open after this, never before
  room_state text check (room_state in ('lobby','running','done','cancelled')),  -- null for async games
  room_starts_at timestamptz,
  room_ends_at timestamptz,                      -- room_starts_at + n * seconds + 60 s grace
  closed_settled_at timestamptz                  -- set once by the settle after closes_at (trap, quest, unlocks)
);
create index if not exists mob_games_mob_idx on public.mob_games (mob_id, opened_at desc);
create index if not exists mob_games_open_idx on public.mob_games (mob_id) where closed_settled_at is null;

create table if not exists public.mob_game_runs (
  game_id uuid not null references public.mob_games(id) on delete cascade,
  mob_id uuid not null,
  user_id text not null,
  live boolean not null default false,
  started_at timestamptz not null,               -- server time; for a live run, the room's start
  ends_at timestamptz not null,                  -- started_at + n * seconds + 60 s grace
  finished_at timestamptz,
  right_n smallint not null default 0, wrong_n smallint not null default 0, skipped_n smallint not null default 0,
  marks smallint not null default 0,             -- 5 * right - 1 * wrong, written by the server
  primary key (game_id, user_id),
  foreign key (mob_id, user_id) references public.mob_members(mob_id, user_id) on delete cascade
);

-- One locked answer per question. The pick never leaves the server for another member before closes_at.
create table if not exists public.mob_game_answers (
  game_id uuid not null, user_id text not null, q smallint not null check (q between 0 and 19),
  pick smallint not null check (pick between -1 and 3),   -- -1 = skipped
  correct boolean,                                        -- null for a skip
  answered_at timestamptz not null default clock_timestamp(),
  elapsed_ms integer not null check (elapsed_ms >= 0),    -- answered_at - run.started_at
  primary key (game_id, user_id, q),
  foreign key (game_id, user_id) references public.mob_game_runs(game_id, user_id) on delete cascade
);

-- Free: one start per Mob per IST week. It outlives the membership, so leaving and rejoining cannot refresh it.
create table if not exists public.mob_start_claims (
  user_id text not null references public.users(id) on delete cascade,
  mob_id uuid not null, week_start date not null, game_id uuid,
  claimed_at timestamptz not null default now(),
  primary key (user_id, mob_id, week_start)
);

-- Pass the mic: a Pro member hands one start to another member of that Mob; 2 to give per IST week.
create table if not exists public.mob_mics (
  id uuid primary key default gen_random_uuid(),
  mob_id uuid not null references public.mobs(id) on delete cascade,
  giver_id text references public.users(id) on delete set null,
  receiver_id text not null references public.users(id) on delete cascade,
  week_start date not null,
  given_at timestamptz not null default now(),
  used_game_id uuid references public.mob_games(id) on delete set null
);
create index if not exists mob_mics_giver_idx on public.mob_mics (giver_id, week_start);
create index if not exists mob_mics_receiver_idx on public.mob_mics (receiver_id, mob_id, week_start) where used_game_id is null;

-- Quest ticks: answered questions per source, with no user id, so leaving never lowers a quest (F8).
-- source_key = md5(source_id || ':' || user_id) so a sitting counts once.
create table if not exists public.mob_quest_ticks (
  mob_id uuid not null references public.mobs(id) on delete cascade,
  week_start date not null,
  source text not null check (source in ('paper','extra','game','fix')),
  source_id text not null,          -- week, extra id, game id
  source_key text not null,
  answered smallint not null default 0 check (answered >= 0),
  primary key (mob_id, source_key)
);
create index if not exists mob_quest_ticks_week_idx on public.mob_quest_ticks (mob_id, week_start);

-- A Mob week, written when the quest is done or the week ends (settle). The pennant reads these rows.
create table if not exists public.mob_weeks (
  mob_id uuid not null references public.mobs(id) on delete cascade,
  week_start date not null,
  target smallint not null,                 -- 15 * members not stepped out, at least 15
  answered integer not null default 0,
  done_at timestamptz,                      -- the moment the quest was finished (never cleared)
  pass_used boolean not null default false, -- a week pass kept the chain
  settled_at timestamptz,
  primary key (mob_id, week_start)
);

-- A game's trap (after close) and the Fix it together path.
create table if not exists public.mob_traps (
  game_id uuid not null references public.mob_games(id) on delete cascade,
  q smallint not null, question_id text not null, mob_id uuid not null,
  opened_at timestamptz not null,          -- = game.closes_at
  check_opens_at timestamptz not null,     -- next Wednesday 12:00 AM IST at least 48 hours after opened_at
  check_closes_at timestamptz not null,    -- that Sunday 11:59 PM IST
  fixed_at timestamptz,                    -- 2 or more members got the check right
  primary key (game_id, q)
);
create table if not exists public.mob_fix_checks (
  game_id uuid not null, q smallint not null, user_id text not null,
  stage text not null check (stage in ('now','check')),
  question_id text not null,
  correct boolean,                          -- null until answered
  issued_at timestamptz not null default now(), answered_at timestamptz,
  primary key (game_id, q, user_id, stage),
  foreign key (game_id, q) references public.mob_traps(game_id, q) on delete cascade
);
```
Functions (`security invoker`, service role; `p_now` always passed by the API so one clock decides):
- `mob_game_open(p_user_id, p_mob_id, p_format, p_mode, p_subject, p_chapter, p_ids jsonb, p_via, p_week date, p_rematch_of uuid, p_now timestamptz, p_max_open int) returns jsonb`: `{status: ok|not_member|start_used|mic_none|open_limit|room_open, id}`. It takes `pg_advisory_xact_lock(hashtext('mob:'||p_mob_id))`, checks membership, and refuses with `open_limit` if games with `closes_at > p_now` number `p_max_open` (3) or more. For `p_mode = 'live'`, it refuses with `room_open` if any room in this Mob is in `lobby` or `running`. It claims `mob_start_claims` (`free_weekly`) or marks the oldest unused `mob_mics` row for this receiver, Mob and week (`mic`). It inserts the game with `closes_at = p_now + interval '24 hours'`, and for live with `room_state = 'lobby'`.
- `mob_run_start(p_user_id, p_game_id, p_now) returns jsonb`: `{status: started|resumed|finished|closed|not_member, started_at, ends_at, answers:[{q,pick,correct,elapsed_ms}]}`. For a game with `room_state='running'` and `p_now <= room_starts_at + 30 s`, it is a live run with `started_at = room_starts_at`. Otherwise it is an async run with `started_at = p_now`. `closed` means `p_now + n*seconds > closes_at`: a run cannot start that it cannot finish.
- `mob_game_answer(p_user_id, p_game_id, p_q smallint, p_pick smallint, p_correct_index smallint, p_member_id text, p_now) returns jsonb`: `{status: ok|exists|expired|finished|no_run, correct, delta, marks, elapsed_ms, finished}`. The API reads `p_correct_index` from the bank, so the correct option is never in the request or the response. The function:
  1. inserts the answer;
  2. updates the run's counts and `marks`;
  3. upserts the quest tick for `(game, user)` when `p_pick >= 0`;
  4. on the last question, sets `finished_at`;
  5. if the run is live and the room is `running`, calls `realtime.send(jsonb_build_object('m',p_member_id,'q',p_q+1,'done',finished),'progress','mob-room:'||p_game_id,true)`;
  6. when the last live run finishes, sets `room_state='done'` and sends `room.done`.

  After `ends_at`, the result is `expired` and the run is finished with the rest skipped.
- `mob_run_finish(p_user_id, p_game_id, p_member_id, p_now) returns jsonb`: skips the rest and finishes the run ("Finish now").
- `mob_game_json(p_game_id, p_user_id, p_now) returns jsonb`: the game. `runs` holds every run's user id (mapped to a memberId by the API), `started_at`, `finished_at`, `marks`, `right_n`, `wrong_n`, `skipped_n`, and `arrivals` (`elapsed_ms` per answered question, in order; **no picks**). `mine` holds your own picks. `closed` is a boolean. **Other members' picks are never in this JSON.**
- `mob_game_picks_closed(p_game_id, p_now) returns jsonb`: every pick, **only when `p_now >= closes_at`** (null otherwise). Server-only, for the trap and the review.
- `mob_game_settle(p_game_id, p_now, p_trap jsonb) returns text`: once, after close. Writes `mob_traps`, sets `closed_settled_at`, and deletes reactions older than 30 days. The trap is computed in JS (`games.mjs`) and passed in.
- `mob_quest_week(p_mob_id, p_week, p_now) returns jsonb`: `{target, answered, done_at, by_source:[{source, source_id, answered}]}`. It sets `done_at` the first time `answered >= target`, and upserts `mob_weeks`. The target is `greatest(15, 15 * (members - step_outs))` from the live membership until the week ends, then frozen at settle.
- `mob_mic_give(p_giver, p_mob_id, p_receiver, p_week, p_max smallint) returns text`: `ok | limit | not_member | self`.
- `mob_fix_issue(p_user_id, p_game_id, p_q, p_stage, p_question_id, p_now) returns text`: `ok | not_yet | closed | had`.
- `mob_fix_answer(p_user_id, p_game_id, p_q, p_stage, p_correct boolean, p_now) returns jsonb`: `{status, fixed_now: boolean}`. It sets `mob_traps.fixed_at` when the second right `check` lands.
- `mob_record_sitting` and `mob_extra_record` are replaced (same signatures) to also upsert a quest tick (`answered = count of picks >= 0`).
- `mob_free_claim` stays (the old app calls `/paper/start`). The service simply stops calling it (3.3).

### 2.3 `20261020100200_mob_v3_chains.sql` (undo `supabase/undo/20261020100200_mob_v3_chains.undo.sql`)
The chains are **computed, not stored**, by pure functions (`src/lib/chain/chain.mjs`, `src/lib/mob/mobChain.mjs`) from daily answered counts, pauses and the clock. So they are deterministic, testable and repairable. The tables keep only what must never drop and what the student set:
```sql
create table if not exists public.chain_prefs (
  user_id text primary key references public.users(id) on delete cascade,
  hidden boolean not null default false,          -- "Hide my chain"
  best_days integer not null default 0,           -- monotonic: chain_best_bump only raises it
  updated_at timestamptz not null default now()
);
create table if not exists public.chain_pauses (    -- exam pause days, set ahead by the student
  user_id text not null references public.users(id) on delete cascade,
  day date not null,
  set_at timestamptz not null default now(),
  primary key (user_id, day)
);
create table if not exists public.mob_chain_best (
  mob_id uuid primary key references public.mobs(id) on delete cascade,
  best_weeks integer not null default 0
);
```
Functions:
- `chain_daily(p_user_id text, p_from date) returns jsonb`: `[{day, answered}]` by IST day of `completed_at`. It counts `attempts.total - attempts.unattempted`, plus `mob_game_answers` with `pick >= 0`, plus answered `mob_fix_checks`. Skips do not count.
- `chain_pause_set(p_user_id, p_days date[], p_today date) returns text`: `ok | past | limit`. Only days after today; at most 14 in a season (1 Aug to 31 Jul).
- `chain_pause_clear(p_user_id, p_days date[], p_today) returns text`. Only future days can be cleared.
- `chain_prefs_set(p_user_id, p_hidden boolean) returns text`.
- `chain_best_bump(p_user_id, p_days int) returns int`, and `mob_chain_best_bump(p_mob_id, p_weeks int) returns int`.

**Personal chain algorithm** (`computeChain({ daily, pauses, fixesHeldByDay, today })`). It is pure. It walks from the first day with 5 or more answered questions to yesterday:
```
state: chain = 0, passes = 0, gifted = false, lastMakeUp = null, best = 0
for each day d (IST) up to yesterday:
  if d in pauses:             mark d 'paused'; chain unchanged
  elif answered(d) >= 5:      mark 'practised'; chain += 1
  elif passes > 0:            mark 'rested';  passes -= 1; chain += 1        -- applies itself
  elif makeUpOk(d):           -- 10+ answered on d+1 or d+2, and no make-up in the 14 days before
                              mark 'made_up'; chain += 1; lastMakeUp = d
  elif d+2 >= today:          mark 'open'; stop walking (the outcome is not known yet; the chain shows as held)
  else:                       mark 'missed'; chain = 0
  earn after the day: chain == 3 && !gifted -> +1 (gifted); chain > 0 && chain % 7 == 0 -> +1;
                      every 3rd held fix (all time) on day d -> +1; passes = min(passes, 2)
  best = max(best, chain)
today: 'practised' if answered(today) >= 5 (chain + 1), else 'today' with progress answered(today) of 5
```
- Milestones are 3, 7, 14, 21, 30, 50, 75, 100 and 150. "Seen" is tracked with `mob_seen` key `chain:<n>`.
- Notices for the next open come from rested and made-up days not yet seen (`mob_seen` key `rest:<day>`).
- The response says `days` (the chain), `practised`, `rested`, `madeUp`, `paused`, `best` (the max of the stored and computed values, then bumped), `passes`, `today: {answered, needed: 5}`, `calendar` (this month and last month, one state per day), `next` (the next milestone and the days to it), `makeUp` (when a day is `open`: `{day, needed: 10, by: <ISO end of d+2>}`), and `notices`.

**Mob chain algorithm** (`computeMobChain({ weeks, today })`):
- A week is stitched when `done_at` is set.
- A missed week uses a week pass if one is held. A week pass is earned at every 4th stitched week, and the Mob holds at most 1.
- Otherwise the chain restarts at 0. `best_weeks` is bumped.
- The current week is never "missed" before it ends.

### 2.4 `20261020100300_mob_v3_realtime.sql` (undo `supabase/undo/20261020100300_mob_v3_realtime.undo.sql`)
```sql
-- Tickets: the API issues one when a member opens a live room; Realtime checks it on join.
-- auth_uid is the Supabase identity id from the session (it can differ from users.id for old email-keyed rows).
create table if not exists public.mob_room_tickets (
  game_id uuid not null references public.mob_games(id) on delete cascade,
  auth_uid uuid not null,
  user_id text not null,
  member_id text not null check (member_id ~ '^[0-9A-Z]{12}$'),
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null,           -- min(room_ends_at, issued_at + 45 min) + 5 min
  revoked_at timestamptz,
  primary key (game_id, auth_uid)
);
alter table public.mob_room_tickets enable row level security;
revoke all on public.mob_room_tickets from public, anon, authenticated;
grant all on public.mob_room_tickets to service_role;

create or replace function public.mob_room_ok(p_topic text)
returns boolean language sql stable security definer set search_path = '' as $$
  select p_topic like 'mob-room:%' and exists (
    select 1 from public.mob_room_tickets t
    where t.game_id::text = substr(p_topic, 10)
      and t.auth_uid = (select auth.uid())
      and t.revoked_at is null and t.expires_at > now())
$$;
revoke all on function public.mob_room_ok(text) from public, anon;
grant execute on function public.mob_room_ok(text) to authenticated;

-- Receive broadcasts and presence on your room only.
create policy mob_room_receive on realtime.messages for select to authenticated
  using ( public.mob_room_ok((select realtime.topic())) );
-- Send presence only. Clients never broadcast: every event comes from the server (realtime.send in SQL).
create policy mob_room_presence on realtime.messages for insert to authenticated
  with check ( realtime.messages.extension = 'presence' and public.mob_room_ok((select realtime.topic())) );

-- Leaving, removal and blocking revoke tickets at once (a member who left keeps nothing new after their JWT refreshes).
create or replace function public.mob_room_revoke_on_leave() returns trigger language plpgsql security invoker set search_path = public as $$
begin
  update public.mob_room_tickets t set revoked_at = now()
  from public.mob_games g where g.id = t.game_id and g.mob_id = old.mob_id and t.user_id = old.user_id and t.revoked_at is null;
  return old;
end $$;
create trigger mob_room_revoke after delete on public.mob_members for each row execute function public.mob_room_revoke_on_leave();
```
Also: `mob_room_ticket(p_user_id, p_auth_uid uuid, p_game_id, p_member_id, p_now) returns jsonb` (`ok | not_member | not_live | closed`, with `expires_at`), `mob_room_start(p_user_id, p_game_id, p_starts_at, p_now)` (`ok | not_host | started | closed`; sets `running`, `room_starts_at`, `room_ends_at`; sends `room.start {startsAt}`), and `mob_room_cancel(p_user_id, p_game_id)` (host, lobby only; sends `room.cancel`; the game stays as a 24-hour game).

**Dashboard step (owner's yes):** in Realtime settings on staging, then production, turn **off** "Allow public access". Nothing else in MockMob uses Realtime today (MOB-FACTS 2.5), so this breaks nothing. The undo turns it back on.

### 2.5 Rate limits (added to `LIMITS` in `src/lib/server/mob/http.js`)
| Name | Limit | Window | By | Success-only | Used by |
|---|---|---|---|---|---|
| `gameOpen` | 8 | 1 day | user | yes | `POST /game` |
| `run` | 30 | 1 hour | user | no | `POST /game/[id]/run` |
| `answer` | 150 | 10 min | user | no | `POST /game/[id]/answer` (20 questions times a few retries) |
| `ticket` | 20 | 1 hour | user | yes | `POST /game/[id]/room/ticket` |
| `room` | 20 | 1 hour | user | no | room start and cancel |
| `sticker` | 30 | 1 hour | user | yes | `POST /sticker` (the app also spaces sends 3 s apart) |
| `mic` | 10 | 1 day | user | yes | `POST /mic` (the rule of 2 a week lives in SQL) |
| `fix` | 40 | 1 hour | user | no | `/fix/*` |
| `chainWrite` | 20 | 1 day | user | no | `/api/me/chain` writes |

Existing limits stay. `read` (120 per 10 minutes) also covers `GET /game/[id]`, `/review`, `/shelf` and `GET /api/me/chain`. These are product caps, not rate limits: 3 open games per Mob, 1 live room per Mob at a time, and 30 live rooms across MockMob at once (`MOB_LIVE_MAX_ROOMS`, see 4.5).

---

## 3. API contract

### 3.0 Shared rules
- Every route goes through `handleMob`. `MOB_ENABLED` not `true` gives 404 `MOB_DISABLED`. New v3 routes also need `MOB_V3_ENABLED=true`, else 404 `MOB_DISABLED`. Live routes also need `MOB_LIVE_ENABLED=true`, else 409 `LIVE_OFF`, which the app treats as "only 24-hour games".
- Signed in through the web cookie or the app Bearer token. JSON errors look like `{ error: { code, message, detail? } }`, with `Cache-Control: no-store`.
- Members are addressed only by `memberId` (12 Crockford characters). User ids, emails and plan status of others never leave the server.
- **Backward compatibility.** Build 9 apps and the current web keep calling every existing route. `GET /api/mob` keeps all its old keys and adds a `v3` object. `POST /api/mob/invite` returns a 6-character `code`, which old clients display fine (they show the string). `/paper/start` no longer refuses with `FREE_PAPER_USED`.
- Times are ISO strings from the server. `serverNow` is in every game response, so the app can keep its offset.
- Contract file: `docs/design-decisions/pass-1019pm/mob-v3/contract/MOB-V3-CONTRACT.json`, with fixtures in `contract/fixtures/*.json`. The app builds against these. A server test (`data/tests/mob_v3_contract.test.mjs`) asserts the real responses match the shapes.

### 3.1 Changed routes
**`GET /api/mob?mob=<id>`** keeps the old body and adds `v3`:
```json
{ "...old keys...": "unchanged",
  "v3": {
    "name": { "key": 0, "text": "Chai Circle" },                  // null key: text is the subject name
    "showPodium": true, "youOwn": true,
    "members": [ { "memberId": "K7P2M9QXA1B2", "name": "Riya", "colour": 3, "fold": "patang", "finish": "plain", "you": false, "owner": false } ],
    "games": [ {
      "id": "uuid", "format": "sprint", "mode": "async", "count": 5, "chapter": "Goodwill", "subjectName": "Accountancy",
      "host": { "memberId": "...", "name": "Riya" },
      "openedAt": "...", "closesAt": "...", "closed": false,
      "room": null,                                                  // or { "state": "lobby|running|done|cancelled", "startsAt": "..." }
      "runs": [ { "memberId": "...", "name": "Riya", "at": "2026-10-22T08:40:00Z" } ],   // finished runs only, in time order
      "yourRun": "none|playing|finished",
      "podiumReady": false                                           // true once you finished, or the game closed
    } ],
    "quest": { "week": "2026-10-19", "target": 60, "answered": 51, "done": false, "doneAt": null,
               "sizedFor": 4, "youSteppedOut": false,
               "bySource": [ { "label": "Monday's Mob paper", "answered": 37 }, { "label": "Riya's sprint", "answered": 14 } ],
               "parcel": { "kind": "fold", "fold": "hop" } },          // or { "kind": "item", "item": "desk_bell" } or { "kind": "stitch" }
    "mobChain": { "weeks": 3, "best": 3, "passes": 0, "stitchedThisWeek": false, "next": { "at": 4, "item": "stamp" } },
    "shelf": { "items": ["den_stamp"], "nextItem": { "at": 4, "item": "desk_bell" } },
    "starts": { "billingOn": false, "can": true, "via": "open", "modes": ["live","async"], "formats": ["sprint","round","rematch"],
                "freeLeft": null, "mics": 0, "micsToGive": null },
    "chainChip": { "hidden": false, "days": 13, "todayDone": false },
    "reactions": [ { "memberId": "...", "kind": "nice_one", "at": "..." } ],
    "moments": [ "quest_done:2026-10-19", "reveal:hop" ],            // one-time moments due for you, in play order
    "live": { "enabled": true, "hoursOk": true }
  } }
```
- `starts` when billing is on and you are Free with your start unused: `{"billingOn":true,"can":true,"via":"free_weekly","modes":["async"],"formats":["sprint","round"],"freeLeft":1,"mics":0}`. With your start used and no mic: `{"can":false,"reason":"used","freeLeft":0}`. As Pro: `{"via":"pro","micsToGive":2}`. `micsToGive` is only for Pro, and only you see it.
- `runs` lists finished runs only, as a row (F2). Nobody is ever reported as not having played.

**`POST /api/mob`** (create) also takes `"nameKey": 0..23` and `"fold": "dart"`. A `fold` the student does not own gives 422 `FOLD_LOCKED`.

**`POST /api/mob/join`** also takes `"fold"`. **`GET /api/mob/join/[code]`** accepts 6 or 8 characters (normalised: uppercase; `O`→`0`, `I` and `L`→`1`; spaces and hyphens dropped). The preview has no names (judge F7): `{"status":"valid","subject":"accountancy","subjectName":"Accountancy","name":"Chai Circle","size":3,"seatsLeft":2}`. The signed-in invite line keeps `inviter`.

**`POST /api/mob/invite`** returns `{"code":"K7P2M9","display":"K7P 2M9","url":"https://www.mockmob.in/join/K7P2M9","expiresAt":"..."}`.

### 3.2 New routes
Every request body below is JSON. Every route needs a session.

| Route | Request | 200 response | Errors |
|---|---|---|---|
| `PATCH /api/mob/settings` | `{ "mob": "uuid", "showPodium": false, "nameKey": 4 }` | the `GET /api/mob` view | `NOT_OWNER_SETTINGS` 403, `NAME_KEY_INVALID` 422 |
| `PUT /api/mob/profile` | `{ "fold": "hop", "finish": "plain" }` | `{ "fold": "hop", "finish": "plain" }` | `FOLD_INVALID` 422, `FOLD_LOCKED` 409 |
| `GET /api/mob/shelf` | none | see 3.5 | none |
| `POST /api/mob/game` | `{ "mob": "uuid", "format": "sprint\|round\|rematch", "mode": "live\|async", "count": 5, "chapter": "Goodwill or null", "rematchOf": "uuid?" }` | 201 `{ "game": <game view 3.4> }` | `START_PRO` 402, `START_USED` 409, `START_FORMAT` 402, `GAMES_OPEN_LIMIT` 409, `ROOM_OPEN_ALREADY` 409, `LIVE_OFF` 409, `LIVE_HOURS` 409, `LIVE_BUSY` 503, `LENGTH_INVALID` 422, `CHAPTER_INVALID` 422, `BANK_THIN` 409 |
| `GET /api/mob/game/[id]` | none | `{ "game": <game view> }` | `GAME_NOT_FOUND` 404 |
| `POST /api/mob/game/[id]/run` | `{}` | `{ "run": { "startedAt", "endsAt", "serverNow", "live": false, "answers": [ {"q":0,"pick":1,"correct":true,"elapsedMs":41000} ] }, "questions": [ {"q":0,"stem":"...","options":["...","...","...","..."],"passage":null} ], "ghosts": <3.4 ghosts> }` (`questions` never carry the correct index or the explanation) | `GAME_NOT_FOUND`, `GAME_CLOSED` 410, `RUN_DONE` 409 |
| `POST /api/mob/game/[id]/answer` | `{ "q": 2, "pick": 1 }` (`pick` -1 = skip) | `{ "correct": true, "delta": 5, "marks": 14, "elapsedMs": 72100, "answered": 3, "count": 5, "finished": false, "serverNow": "..." }`; for a skip `{ "correct": null, "delta": 0 }`; for a retry of the same question, the stored result | `Q_INVALID` 422, `RUN_EXPIRED` 410 (with the stored run), `NO_RUN` 409 |
| `POST /api/mob/game/[id]/finish` | `{}` | `{ "run": { "finished": true, "marks": 14 } }` | `NO_RUN` |
| `GET /api/mob/game/[id]/podium` | none | 3.6 | `PODIUM_NOT_YET` 409 (you have not finished and it is open) |
| `GET /api/mob/game/[id]/review` | none | 3.7 | `REVIEW_NOT_YET` 409, with `detail.opensAt` |
| `POST /api/mob/game/[id]/room/ticket` | `{}` | `{ "topic": "mob-room:<id>", "memberId": "...", "expiresAt": "...", "room": { "state": "lobby", "startsAt": null, "hostMemberId": "..." }, "serverNow": "..." }` | `LIVE_OFF`, `GAME_CLOSED`, `NOT_LIVE` 409 |
| `POST /api/mob/game/[id]/room/start` | `{}` (host only) | `{ "startsAt": "<serverNow + 4000 ms>", "serverNow": "..." }` | `ROOM_NOT_HOST` 403, `ROOM_STARTED` 409 |
| `POST /api/mob/game/[id]/room/cancel` | `{}` | `{ "ok": true }` | `ROOM_NOT_HOST`, `ROOM_STARTED` |
| `POST /api/mob/sticker` | `{ "mob": "uuid", "game": "uuid?", "kind": "nice_one" }` | `{ "ok": true }` | `STICKER_INVALID` 422 |
| `POST /api/mob/mic` | `{ "mob": "uuid", "to": "<memberId>" }` | `{ "micsToGive": 1 }` | `START_PRO` 402 (giver not Pro, billing on), `MIC_LIMIT` 409, `MIC_SELF` 422, `NOT_FOUND` 404, `BILLING_OFF` 409 |
| `POST /api/mob/step-out` | `{ "mob": "uuid", "on": true }` | the view | `STEP_OUT_DONE` 409 |
| `POST /api/mob/fix/start` | `{ "game": "uuid", "q": 3, "stage": "now\|check" }` | `{ "question": { "stem", "options", "passage" }, "trap": { "q": 3, "why": "<explanation of the trap question>", "yourPick": 0, "correctIndex": 2 } }` (`trap` only after close; it is your own question) | `FIX_NOT_YET` 409 (`detail.opensAt`), `FIX_CLOSED` 410 |
| `POST /api/mob/fix/answer` | `{ "game", "q", "stage", "pick" }` | `{ "correct": true, "correctIndex": 2, "explanation": "...", "fixedTogether": false, "fixed": { "count": 1, "of": 3 } }` | as above |
| `POST /api/mob/seen` | `{ "keys": ["reveal:hop","chain:14"] }` | `{ "ok": true }` | none |
| `GET /api/me/chain` | none | 3.8 | none |
| `PATCH /api/me/chain` | `{ "hidden": true }` | 3.8 | none |
| `POST /api/me/chain/pause` | `{ "days": ["2026-11-10","2026-11-11"] }` | 3.8 | `PAUSE_PAST` 422, `PAUSE_LIMIT` 409 |
| `DELETE /api/me/chain/pause` | `{ "days": [...] }` | 3.8 | `PAUSE_PAST` |

**New error sentences** (added to `ERRORS` in `src/lib/mob/model.mjs` and to `MobCopy.failure` in `lib/features/social/copy.dart`, kept equal by the existing parity test):
- `START_PRO` 402: "Starting games is part of Pro. You can play every game your Mob starts."
- `START_USED` 409: "You started this week's game in this Mob. You can start another on Monday, or a friend with Pro can pass you the mic."
- `START_FORMAT` 402: "Live rooms are part of Pro. You can start this game for anytime in 24 hours."
- `GAMES_OPEN_LIMIT` 409: "Your Mob already has 3 games open. A new one can start when one closes."
- `ROOM_OPEN_ALREADY` 409: "A live room is already open in your Mob. Join it from the den."
- `LIVE_OFF` 409: "Live rooms are not on yet. Start it for anytime in 24 hours."
- `LIVE_HOURS` 409: "Live rooms open from 6:00 AM to 11:00 PM. You can start it for anytime in 24 hours."
- `LIVE_BUSY` 503: "Live is busy right now. Play now, and your Mob can catch up within 24 hours."
- `GAME_NOT_FOUND` 404: "That game is not in your Mob."
- `GAME_CLOSED` 410: "This game has closed. Its answers are open now."
- `RUN_DONE` 409: "You already played this game. Your marks are on the podium."
- `RUN_EXPIRED` 410: "Your time on this game ran out. Questions you did not answer count as skipped."
- `NO_RUN` 409: "Start the game first."
- `Q_INVALID` 422: "That question is not in this game."
- `PODIUM_NOT_YET` 409: "Finish your run first, then you can see the podium."
- `REVIEW_NOT_YET` 409: "The answers open for everyone when this game closes."
- `NOT_LIVE` 409: "This game is played anytime, not live."
- `ROOM_NOT_HOST` 403: "Only the member who opened this room can start it."
- `ROOM_STARTED` 409: "This room has already started."
- `STICKER_INVALID` 422: "Choose one of the stickers."
- `MIC_LIMIT` 409: "You passed the mic twice this week, the most a week allows. You can pass it again on Monday."
- `MIC_SELF` 422: "Pass the mic to a friend in your Mob."
- `BILLING_OFF` 409: "Everyone can start games right now, so there is no mic to pass."
- `NOT_OWNER_SETTINGS` 403: "Only the member who started the Mob can change this."
- `NAME_KEY_INVALID` 422: "Choose one of the names."
- `FOLD_INVALID` 422: "Choose one of the Folds."
- `FOLD_LOCKED` 409: "You have not earned that Fold yet. Its card says how."
- `STEP_OUT_DONE` 409: "This week's quest is already done, so there is nothing to step out of."
- `FIX_NOT_YET` 409: "This opens when the game closes."
- `FIX_CLOSED` 410: "This check has closed. A new trap brings a new one."
- `PAUSE_PAST` 422: "Pause days have to be after today."
- `PAUSE_LIMIT` 409: "You have used the 14 pause days this season allows."

### 3.3 Free and Pro start rules, enforced on the server (`src/lib/mob/starts.mjs`, pure)
```
startRight({ billingOn, pro, mode, format, claimUsed, micsHeld, liveOn, inLiveHours }):
  if mode == 'live' and !liveOn         -> refuse LIVE_OFF
  if mode == 'live' and !inLiveHours    -> refuse LIVE_HOURS
  if !billingOn                         -> allow via 'open'      (D133: starts stay open for everyone while PLAY_BILLING is off)
  if pro                                -> allow via 'pro'
  if mode == 'async' and format in {sprint, round, rematch} and !claimUsed -> allow via 'free_weekly'
  if micsHeld > 0                       -> allow via 'mic'       (a passed mic allows live and async, every build-1 format)
  if mode == 'live'                     -> refuse START_FORMAT if !claimUsed else START_PRO
  else                                  -> refuse START_USED
```
- `billingOn` is `playBillingEnabled()` from `src/lib/payments/playBilling.js`, read on every request. Nothing from the client is read.
- `pro` is the server's `isPremium`, the same as today.
- `claimUsed` and `micsHeld` are read in SQL inside `mob_game_open` under the Mob lock, so two taps cannot both start a game.
- Free's start is per member, per Mob, per IST week. Rematch counts as a start.
- Joining and playing are never gated. Runs, answers, podium, review, fix, stickers, shelf, chains, step out and pause are identical for Free and Pro. Pro changes nothing about marks, chains, passes or what can be earned.
- "Free members join and play everything" lifts today's free weekly paper claim. `startPaper` stops calling `mob_free_claim`. The table and function stay, for the undo and for old rows.
- Pass the mic is visible only when `billingOn` is true. The giver must be Pro. The limit is 2 per giver per IST week, across Mobs. A mic is used by the receiver's next start in that Mob, and an unused one expires at Sunday 11:59 PM IST. The receiver sees "Riya passed you the mic." The API never tells anyone a member's plan.

### 3.4 The game view (`GET /api/mob/game/[id]`, also inside `POST /game`)
```json
{ "id": "uuid", "mobId": "uuid", "format": "sprint", "mode": "async", "count": 5, "secondsPerQuestion": 60,
  "subjectName": "Accountancy", "chapter": "Goodwill", "title": "Riya's sprint",
  "host": { "memberId": "...", "name": "Riya", "you": false },
  "openedAt": "...", "closesAt": "...", "closed": false, "serverNow": "...",
  "room": { "state": "lobby", "startsAt": null, "endsAt": null },
  "runs": [ { "memberId": "...", "name": "Riya", "colour": 3, "fold": "patang", "at": "...", "finished": true } ],
  "you": { "run": "none|playing|finished", "marks": null, "answered": 0 },
  "ghosts": [ { "memberId": "...", "name": "Riya", "colour": 3, "fold": "patang", "playedAt": "2026-10-22T08:40:00Z",
                "arrivalsMs": [41000, 79000, 130000, 151000, 190000], "finishedMs": 190000 } ],
  "podiumReady": true }
```
- `ghosts` are the finished runs of others, plus your own earlier run on a rematch. Arrivals are the server's `elapsed_ms`. There are no picks and no correctness.
- `runs` includes unfinished runs only for a live room, as `finished: false` with `answered`. This is only for members in the room, and it carries no marks.

### 3.5 The shelf (`GET /api/mob/shelf`)
```json
{ "seat": { "fold": "dart", "finish": "plain" },
  "folds": [ { "key": "dart", "owned": true, "starter": true, "folds": 1, "finishes": { "foil": { "owned": false, "rule": "chain_30", "have": 14, "need": 30 } } },
             { "key": "crane", "owned": false, "folds": 3, "rule": "mob_traps", "have": 1, "need": 3, "mob": "Chai Circle" } ],
  "mobItems": [ { "mobId": "...", "name": "Chai Circle", "items": [ { "item": "den_stamp", "owned": true }, { "item": "desk_bell", "owned": false, "have": 3, "need": 4 } ] } ] }
```
`have` and `need` are always real counts from the server. For a Mob-earned Fold, `have` is the best value across the student's Mobs, and `mob` names that Mob.

### 3.6 The podium (`GET /api/mob/game/[id]/podium`), computed by `src/lib/mob/games.mjs`
```json
{ "soFar": true, "closesAt": "...", "showPodium": true,
  "headline": { "kind": "together", "right": 15, "of": 20 },
  "places": [ { "memberId": "...", "name": "Riya", "fold": "patang", "colour": 3, "marks": 20, "place": 1, "you": false },
              { "memberId": "...", "name": "Aarav", "marks": 19, "place": 2, "you": true },
              { "memberId": "...", "name": "Kabir", "marks": 19, "place": 2 },
              { "memberId": "...", "name": "Zoya", "marks": 13, "place": 4, "floor": true } ],
  "tie": { "place": 2, "names": ["You", "Kabir"], "marks": 19 },
  "moments": [ { "memberId": "...", "kind": "fastest_right", "q": 5, "seconds": 17 } ],
  "trap": null }
```
- **Places:** `place = 1 + count(runs with marks strictly greater)` (standard competition ranking, so ties share a place). `floor` is true when the place is greater than 3. Only finished runs are placed.
- **Headline:** `right = sum(right_n)`, `of = sum(count)` over finished runs.
- **Moments** come from a fixed kind list, assigned in place order. Each player gets the first true kind not yet used by another, else `finished_all`. A moment **never refers to the trap question**, and only after close is there a trap. The kinds:
  - `all_right` "All 5 right."
  - `fastest_right` "Fastest right answer: question 5 in 17 seconds."
  - `quickest_finish` "Quickest finish: all 5 in 2:20."
  - `three_in_a_row` "Three right in a row: questions 1 to 3."
  - `no_minus` "No minus marks."
  - `finished_all` "Played all 5."
- **Trap:** `null` before close. After close it is `{ "q": 4, "caught": "most" }` when at least 3 finished runs, a wrong option was picked by at least 2, and by at least half. It is never a number (F3).
- `showPodium: false` returns `places` with no `place` fields and no `tie`.

### 3.7 The review (`GET /api/mob/game/[id]/review`, after `closesAt` only)
```json
{ "questions": [ { "q": 0, "stem": "...", "options": ["...","...","...","..."], "correctIndex": 1, "explanation": "...", "yourPick": 1 } ],
  "trap": { "q": 4, "caught": "most", "fix": { "now": "open", "check": { "opensAt": "...", "closesAt": "..." }, "fixed": { "count": 0, "of": 3 } } } }
```
- No other member's pick is returned, ever. The "How your Mob picked" counts in today's compare stay a Pro feature of the weekly paper and are not part of games.
- **Trap settle** (on the first read after `closesAt`): `check_opens_at` is the next Wednesday 12:00 AM IST at least 48 hours after close, and `check_closes_at` is that Sunday 11:59 PM IST.
- The "now" fresh question and the check question come from the trap atlas for that option when one exists (`trapForOption`), else the same chapter.
- A trap is **fixed together** when at least 2 members answer its check right. The Mob's fixed count feeds Crane, and each right check feeds the student's own held fixes (passes and Sticky).

### 3.8 The chain (`GET /api/me/chain`)
```json
{ "hidden": false, "days": 14, "practised": 13, "rested": 1, "madeUp": 0, "best": 14,
  "today": { "answered": 2, "needed": 5, "done": false },
  "passes": { "held": 2, "max": 2, "next": { "kind": "days", "at": 21 } },
  "week": [ { "day": "2026-10-16", "state": "rested" }, { "day": "2026-10-22", "state": "today", "answered": 2 } ],
  "calendar": [ { "day": "2026-10-01", "state": "practised|rested|made_up|paused|missed|open|none" } ],
  "milestones": [ { "at": 3, "reward": "rest_pass", "done": true }, { "at": 30, "reward": "foil", "done": false, "left": 16 } ],
  "makeUp": null,
  "pause": { "days": [], "usedThisSeason": 0, "max": 14 },
  "notices": [ { "key": "rest:2026-10-16", "kind": "rested", "day": "2026-10-16", "days": 12 } ],
  "due": [ "chain:14" ] }
```
`makeUp`, when a day is open, is `{ "day": "2026-10-20", "needed": 10, "answeredToday": 4 }`. There is no deadline clock (the copy names the day, never a countdown).

---

## 4. Realtime

### 4.1 Channels
- One **private** channel per live room: topic `mob-room:<game_id>`. The app subscribes only while the lobby, countdown or live run screen is open. It never subscribes from the den, which shows the room state from `GET /api/mob` and refreshes on focus and on pull.
- Flutter: `supabase.channel('mob-room:$id', opts: const RealtimeChannelConfig(private: true))`. Web, later: `supabase.channel(topic, { config: { private: true } })` on `getSupabaseBrowserClient()`.

### 4.2 Access (no custom token needed)
1. The app calls `POST /game/[id]/room/ticket`. The API checks membership and the room, and writes a `mob_room_tickets` row with `auth_uid` = the session's Supabase identity id. **Server task:** make `auth()` return the Supabase identity id as `session.user.authUid` beside `users.id`. Both the cookie and the Bearer paths already hold it.
2. The ticket lives until the room ends plus 5 minutes, at most 50 minutes, and is revoked on leave, removal or block (trigger).
3. Then the app joins the channel with its normal Supabase session (the app's `supabase_flutter` session, or the web's `@supabase/ssr` browser session). The RLS policies (2.4) call `mob_room_ok(realtime.topic())`.
4. Supabase caches the check for the connection until the JWT refreshes (about 1 hour), so a revoked member might still receive for a while. That is why **broadcasts carry no names, no marks, no picks and no correctness**. The app also calls `channel.unsubscribe()` on leave.
5. The web needs no extra token: its browser client already has the Supabase session. A web client without a session gets no ticket.

### 4.3 Presence (client → room; the only thing clients send)
```json
{ "m": "K7P2M9QXA1B2", "st": "here|ready", "v": 1 }
```
- `track()` on joining the lobby with `st: "here"`, `ready` after "I'm ready", and `untrack()` on leaving.
- The app maps `m` to name, Fold and colour from the game view it already has.
- An `m` that is not in the Mob's member list is ignored.
- Presence is shown only as "Here", "Ready" and "Host". It is never counted as "N online" anywhere else.

### 4.4 Broadcast events (server → room, sent by `realtime.send` inside the SQL functions)
| Event | Payload | Sent by | The app does |
|---|---|---|---|
| `room.start` | `{ "startsAt": "ISO" }` | `mob_room_start` | runs the countdown so that Go lands on `startsAt` (offset from `serverNow`), then calls `/run` |
| `progress` | `{ "m": "<memberId>", "q": 3, "done": false }` | `mob_game_answer` (live runs only) | moves that Fold to number `q` on the ruler; `done` raises their pennant |
| `room.done` | `{}` | the last live finish, or the first read after `room_ends_at` | ends the live phase; "See the podium" |
| `room.cancel` | `{}` | `mob_room_cancel` | "Riya closed the room. The game stays open until 8:52 PM tomorrow." |
| `sticker` | `{ "m": "<memberId>", "k": "good_luck" }` | `mob_sticker` | the sticker floats over that member's Fold |

There is no event with a pick, an option, a mark or right or wrong. A test asserts the payload keys (SV-14).

### 4.5 Quota and fallback
- Supabase Free plan: 200 concurrent connections, 100 messages a second, 20 presence messages a second. Pro plan: 500, 500 and 50 (RESEARCH-GAME-SYSTEMS 4.2). A room has at most 5 connections. **Check which plan production is on before Phase B ships.**
- Server cap: `MOB_LIVE_MAX_ROOMS` (default 30, so 150 connections). Opening room 31 gives `LIVE_BUSY`. The app then offers "Start it for anytime in 24 hours", and the room was not created.
- Client: connect only on room screens. Drop the channel 10 minutes after the last tap in the lobby. The room's live phase ends at `room_ends_at`, and a lobby that is not started closes after 15 minutes (then the game is simply a 24-hour game).
- On `CHANNEL_ERROR`, `TIMED_OUT` or a `too_many_connections` close, the app shows "Live is busy right now. Play now, and your Mob can catch up." and continues the same run without the ruler's live updates (answers still go to the API).
- **Reconnect:** within the run's `ends_at`, reopening loads `/run` (stored answers) and resubscribes. The Fold reappears at its question with no animation.

---

## 5. The app

### 5.0 Global rules for every Mob screen
- The bottom bar is unchanged (H5). The Mob tab keeps the shell; only the den content animates in (judge: Live's black first frame).
- Copy: plain, warm and grammatical, with no exclamation marks, no arrows and no emoji. Times use the 12-hour clock in IST ("8:52 PM tomorrow"). No price, and nobody's plan. Never say "lost", "behind", "last", "waiting on you", "hurry" or "streak at risk". No count of non-players.
- One volt thing per screen: the primary key, or the thing just earned.
- At least three of these on every screen: paper, a stamp or seal, lamp light, the one volt light, exam stationery.
- `Motion.reduced` gives 120 ms fades, no particles, no squash, no sheen and no loops. Order and information stay. Every show moment has a visible "Skip", and any tap lands the end state in 200 ms.
- Mobi appears once per moment at most (the owner relaxed "once per screen" for the Mob, BRAND-MOTION-KIT 4).
- Quality tiers follow `glass_quality.dart`. Lite halves the particles and drops the shader and blur.
- `pro_nudge`: when `starts.billingOn` is false, no Pro word appears in the picker, the start sheet or the den (the plain facts only). "What Pro adds" is visible only when `proNudgesOnProvider` is true.

### 5.1 New motion tokens (`shared/motion-tokens.json`, then regenerate `motion_tokens.g.dart` and the web CSS)
- `mob.beat` 600 ms, and `mob.halfBeat` 300 ms.
- `mob.squashX` 1.08 and `mob.squashY` 0.88, held 90 ms.
- `moment.T4` ceiling 6000 ms (the podium only). T2 1200 and T3 2000 stay.
- `mob.rollCallStep` 90 ms (Live's measured fix: 45 ms read as one lump across four Folds).
- Springs used are the existing `smooth`, `snappy`, `settle`, `iconPop`, `celebrate` (520 ms, bounce 0.22, Folds and seals only) and `lift`.

### 5.2 Fold rendering (`FoldPuppet`, technique C)
- One still per pose. Shipped poses: `idle`, `cheer`, `think`, `shrug` (the calm "not this one", never sad) and `wave`.
- Moves on its own `RepaintBoundary`, pivoted at the boots:
  - breathe: scaleY 1 to 1.028 on a 3600 ms sweep, offset 120 ms per member, in the den only;
  - sway: ±2° on 6400 ms, in the lobby only;
  - blink: a visor-coloured rounded rect over each eye, scaling y 1→0.1→1 over 120 ms every 4 to 7 s at a seeded random, never in sync. Eye boxes come from `folds.json`.
- Squash 1.08/0.88 for 90 ms on landings. A pose change cross-fades in 120 ms on the squash low point.
- The contact shadow is a painted ellipse (18% black Night, 12% `3B2A12` Day) that grows with height.
- Loops stop 10 s after the last touch and when the tab is hidden.
- Locked: the same still through `ColorFiltered` to `ink4` at 100% (a true silhouette) with a 1 dp paper edge.
- Head discs (24 to 40 dp) use `fold-<key>-head@128.webp`.
- Fallback when a Fold file is missing: the member's `InitialDisc` (today's widget), never a broken image.

### 5.3 Screens, states and exact copy
R2 means: what does a first-time student think this screen wants? The fixture is Chai Circle, Accountancy: Aarav (you, Dart), Riya (Patang), Kabir (Naav), Zoya (Cutting). All times are Thursday 22 Oct.

**D0. No Mob** (`den_start_screen.dart`, replaces `StartMobForm._startPage`)
- Title "Your Mob". Den preview: the lamp-lit room with your starter Fold and four dashed paper seats.
- Lead: "Sit papers and play quick games with up to 4 friends. Your friends see your marks in games, never your answers."
- Key **"Start a Mob"**, secondary "Join with a code".
- No subjects chosen: "Choose your CUET subjects first. A Mob plays in one of them." with the key "Choose your subjects".
- R2: "Start a group or join a friend's."

**D0a. Start a Mob** (sheet, Arena S21)
- "Pick your Mob's name". Chips from the name list, six at a time, then "Show six more". The list (24 keys, `names.mjs` and `mob_names.dart`): Chai Circle, Quiet Comets, Margin Makers, Steady Kites, Ledger Club, Paper Planes, Tea Break Crew, Bright Folds, Page Turners, Desk Mates, Little Lamps, Sharp Pencils, Kind Keys, Graph Gang, Inkwell, Clear Skies, First Light, Long Paper, Neat Notes, Blue Margins, Five Desks, Steady Hands, Fresh Pages, Calm Clocks. "Night Owls" is gone (F9).
- Under the chips: "Names come from our list, so every Mob name is kind."
- "Subject you will play": chips for your subjects.
- "Pick your Fold" (first time only; later it shows "You play as Dart" with a "Change" link): four starter cards (Dart, Dog-ear, Hexa, Kandil), each with its line.
- Name field "Your name in the Mob", hint "First name", note "Only your Mob sees it. 2 to 18 letters."
- Colour: 8 swatches.
- Note "Your Mob sees your marks in games. One switch in Mob settings keeps them private."
- Key **"Start Chai Circle"**, with "Next, you can invite up to 4 friends." under it.
- Errors: inline, the server sentence.
- R2: "Pick a name, a subject and who I'll be, then start."

**D1. The den, quiet** (no open game, in a Mob)
- Header "Chai Circle", subtitle "Accountancy, 4 of you". Trailing: the chain chip `<days> days` (paper link icon; hidden when the chain is hidden) and Ask Mobi.
- Stage:
  - the room (`scene-empty-nothing-{night,day}.webp`) with the lamp pool;
  - the Folds in join order, each with a name tag;
  - the pennant on the wall with "3 weeks";
  - the shelf with the earned items and the next one as a silhouette.
- Card: "Nothing is open right now". Line: "Start a 5-question sprint for your Mob, or sit this week's Mob paper." Key **"Start a game"**, with the link "Sit this week's paper" (or "See your answers" when sat).
- If you cannot start (Free, used): the card says "Ask your Mob for a game" with the key **"Send "Again?""** (a sticker), and the line "Anyone with a start left can open one."
- Quest strip: "This week's quest", "51 of 60 questions", with the parcel icon showing its silhouette.
- R2: "Nothing is on; I can start a game or sit the paper."

**D2. The den, a game is open that you have not played** (Arena S1, F2 fix)
- Card: avatar head of the host, then "Riya opened a sprint".
- Line: "5 Goodwill questions. Race the runs so far. Open until 2:05 PM tomorrow."
- Runs row (only when at least 1 finished run): "Runs so far: Riya, 2:10 PM. Kabir, 4:55 PM. Zoya, 6:30 PM." (names and times, never tags under figures).
- Key **"Play Riya's sprint"**. Link "More ways to play" opens the picker.
- Several open games: the card shows the one closing soonest, with "2 more games are open" as a link to the picker.
- R2: "My friends played Riya's sprint; I tap the key and race their runs."

**D3. The den, you played and the game is still open**
- Card "Riya's sprint", "You played at 8:44 PM. Places can change until 2:05 PM tomorrow."
- Key **"See the podium so far"**. A sticker row under it: Nice one, So close, Teach me, Again?
- R2: "I've played; I can see where I stand for now."

**D4. The den, a live room is open** (Arena S2)
- "Here" tags appear only over Folds of members whose presence is live. The den does not subscribe; it reads `room` from the view. So the den says only "Riya opened a live room at 8:52 PM" and the lobby shows who is here.
- Card: "Riya opened a live room". Line: "A sprint with 5 new Goodwill questions." Key **"Join Riya's room"**. Link "Play it later, until 8:52 PM tomorrow".
- Room already running: "The room started at 8:53 PM. You can still play it until 8:52 PM tomorrow." Key **"Play it now"** (this is an async run).
- R2: "Friends are in a room right now; I can join or play later."

**D5. A Mob of one** (Arena S23, Live 23)
- Header "Chai Circle", "Accountancy, just you". Den with you and "4 open seats".
- Title "Save a seat for a friend". Line "A Mob is 2 to 5 friends. Send the card; they tap it and take a seat."
- Card preview (WhatsApp): the group art with the wordmark, "Aarav saved you a seat in Chai Circle", "An Accountancy Mob on MockMob. Code K7P 2M9."
- Key **"Invite on WhatsApp"**. Secondary "Copy the code". Line "Works for 7 days, for up to 4 friends."
- Below: "This week's Mob paper. 10 questions, 10 minutes. Sit it now; friends who join can too." with "Sit it". And "Start a sprint" (your own ghost works later).
- R2: "Invite a friend; I can still play alone."

**D6. Loading, offline, failed**
- Skeleton: the room art with the lamp, no Folds. Pennant and card as paper blocks pulsing 1.0 to 0.6 on the 1200 ms sweep; still in reduced motion.
- Offline strip, today's.
- Failed: "Your Mob didn't load." with "Try again".

**P1. Play picker** (sheet, Free and billing on; Arena S5 plus Live 05's "Open now")
- Title "Play with your Mob".
- Section "Open now": rows per open game ("Riya's sprint", "5 questions. Open until 2:05 PM tomorrow.", button "Play"), plus the weekly paper row ("This week's Mob paper", "You sat it on Monday." with "Answers", or "10 questions, 10 minutes." with "Sit it").
- Section "Start a game":
  - with a start left: "You have 1 start in Chai Circle this week." Tiles: Sprint "5 questions", Your own round "10 to 20 questions". The Live and Full mock tiles show a lock and "Pro".
  - with none left: "Your start this week is used. It comes back on Monday." The tiles show a lock. Line "Anyone in your Mob with Pro can start one, then everyone plays it free."
  - With a mic: "Riya passed you the mic. You can start one game, live or anytime."
- Secondary key "Ask your Mob for a game" (sends the "Again?" sticker). Link "What Pro adds" (only when `proNudgesOnProvider`).
- **Billing off:** no sections about plans. "Start a game" shows Sprint, Your own round, and Live (when live is on). Line "Anyone in your Mob can start a game."
- R2: "I can play what's open now, or use my start."

**P2. Start a game** (sheet, Arena S6)
- Format tiles: Sprint "5 questions" (default selected), Your own round "10, 15 or 20 questions" (a length stepper appears).
- "What it covers": "Goodwill, the chapter of your Mob's last trap" with "Change" (the existing chapter chooser; default the latest trap's chapter, else the whole subject).
- "How your Mob plays it": segmented "Live now" or "Anytime in 24 hours".
  - Live line: "Live starts everyone on one 3, 2, 1. Anyone who misses it gets the same questions for 24 hours."
  - Async line: "Everyone gets the same questions for 24 hours and races the runs before them."
  - Live is shown only when `live.enabled`; outside live hours: "Live rooms open from 6:00 AM to 11:00 PM."
- Pro with billing on: a row "Pass the mic", "Let a friend start one game. 2 left this week." It opens P3.
- Key: **"Open the room"** (live) or **"Start the sprint"** / **"Start the round"** (async). Under it: "Everyone in Chai Circle plays it free. Marks count the same for all."
- Errors are inline sentences (3.2). On `LIVE_BUSY` the sheet switches to async with the sentence.
- R2: "Pick the game and how my friends play it, then start."

**P3. Pass the mic** (sheet, Pro, billing on)
- "Pass the mic". Line "Let a friend start one game in Chai Circle this week."
- Member rows (others only), with a radio.
- Key **"Pass the mic to Kabir"**. Note "You can pass it 2 times a week."
- After: toast "Kabir can start one game this week."
- R2: "Let a friend host."

**P4. Free and Pro in the Mob** (sheet, only when billing is on; Arena S7)
- Lead: "Pro never changes marks, chains or what you can earn. It adds hosting."
- "Free, always":
  - Play every game your Mob starts, as often as you like.
  - The weekly Mob paper, in every Mob you are in.
  - One start a week in each Mob.
  - Your chain, rest passes and make-up days.
  - The podium, your marks and Fix it together.
  - Every Fold and sticker you earn.
- "Pro adds":
  - Start as many games as you like, live or anytime.
  - Open live rooms.
  - Pass the mic to a friend, twice a week.
  - Start up to 3 Mobs.
- Line "Nothing you earn in the Mob is for sale."
- Key **"See Pro plans"** (the existing paywall; no price here).
- R2: "Free plays everything; Pro is for hosting."

**L1. Live lobby** (Arena S8 with Live 08's stickers; F12: no code)
- Header "Riya's room", "Live sprint, 5 questions", with a "Live" dot.
- Stage in the lamp pool: Folds of members present, with paper tags "Host", "Here" or "Ready", and an "Open seat" outline for each member not present (the count of seats only, no names).
- Line "Same 5 questions, same start. You see where friends are, never what they picked."
- Sticker row "Send a sticker": Good luck, Let's go, One sec, Ready.
- Key for a guest: **"I'm ready"**, then the disabled "Waiting for Riya to start". For the host: **"Start for everyone"** (enabled any time), with the line "Start when everyone here is ready."
- Link "Play it later instead".
- Only you: "You're the first one here. Your Mob sees the room in the den." This uses presence only.
- Host left the room before the start: "Riya stepped away. The room stays open until 9:07 PM, and the game until 8:52 PM tomorrow."
- R2: "Tap ready; Riya starts it."

**L2. Countdown** (Arena S9, F7) is described in M3. Under the heads: "Question 1 of 5 is next. +5 if right, -1 if wrong, 0 if you skip."

**R1. The run** (live or async; Live 10 ruler with full-body Folds)
- Header: the title, then "Live, 3 of you in the room" (live) or "3 runs to race" (async). The stopwatch chip shows elapsed `m:ss`.
- Ruler strip (a 160 dp card): the paper ruler with numbers 1 to n and a flag at the end, Folds at 64 dp standing over their question number (48 dp at 5 players), and a name above each. Ghosts are drawn at 55% opacity with a dashed shadow. Caption under it: "Where everyone is. Never what they picked."
- "Question 3 of 5", with "+5 if right, -1 if wrong" on the right. The question uses today's runner text styles (17/26). Options A to D use today's option component.
- Keys: "Skip" and **"Lock in B"** (disabled "Pick an answer" until a pick is made).
- Saving state: "Saving your answer". This appears after 600 ms with no reply; retries are idempotent.
- R2: "Answer at my own pace; skipping costs nothing."

**R2. Right** (Arena S11)
- The option turns good, a tick draws, and "+5" floats. The panel rises:
  - "Right." on its own; or, at exactly 3 in a row, "Right. Three in a row." with the paper stamp.
  - Line: "+5 marks. Your Mob only sees that you moved on."
- Key **"Next question"**.

**R3. Not this one** (Arena S11b, F1)
- Your option takes the wrong surface, with "-1" in ink2.
- Panel: "Not this one.", "-1 mark. The right answer and why open for everyone when the game closes at 2:05 PM tomorrow."
- The right option is **not** marked. No red flash, no shake, no buzz.
- Key **"Next question"**.

**R4. Ghost pace chip** (async)
- The chip is "4 s ahead of Kabir" or "4 s behind Kabir".
- Formula: `you = server elapsedMs of your latest answer`, `k` = the latest index you answered, and the ghost is the one whose `arrivalsMs[k]` is nearest to `you`. `delta = round((ghost.arrivalsMs[k] - you) / 1000)`. Positive means "ahead". If |delta| < 1, the chip reads "Level with Kabir".
- Between answers, ghosts move by their arrival times against the local clock offset from `serverNow`.
- The chip appears only after your first answer.

**R5. A friend finishes** (live; Arena S12)
- Their Fold walks to the flag, and the pennant rises in their colour.
- Toast "Riya finished. Take your time." It never counts who is still playing (F2).

**R6. Your run is done**
- "You played all 5." with your marks in figure 52 ("19 marks").
- When the podium is ready: key **"See the podium"**. While a live room is still running: "Riya and Kabir are still playing. The podium opens when the room ends." This names only players present in the room, so nobody absent is named.
- R2: "I'm done; the podium is next."

**R7. Podium** (Live 15 staging plus Arena S14 content; M7)
- Header: the title. Sub: "So far" (open) or "Final" (closed).
- Title, open: "Riya is on top so far". Closed: "Riya came first".
- Line, open: "Places can change until 2:05 PM tomorrow." With a tie: "You and Kabir tie on 19, so you share second."
- Collective line: "Your Mob got 15 of 20 right together."
- The stage: plinths with numerals (two plinths of the same height for a shared place) and fold marks in the corner (1, 2 or 3 creases). The floor holds places over 3, with names and marks and no numeral. Name and marks are under each ("19 marks").
- Visible "Skip" pill top right during the reveal.
- Key **"See everyone's moment"**. Icon button "Ask for a rematch": the Pro host or anyone with a start opens P2 with format and chapter prefilled; otherwise it sends "Again?".
- Switch off (`showPodium: false`): title "Everyone's marks". The Folds stand on one paper table in time order. No places, no numerals.
- Only you finished: "You're the first to finish. Places fill in as friends play." Your Fold sits on the table.
- R2: "Riya is ahead for now; I share second."

**R8. Everyone's moment** (Arena S15, F3)
- Title "Everyone's moment". One row per player: head disc, name, and the moment sentence (3.6 kinds).
- Closed with a trap: the card "The question that caught most of you", "Question 4 caught most of you." Steps: "1. Now: See why, then one fresh question." and "2. Wednesday 28 Oct: One more checks the fix holds." Progress: "Chai Circle has fixed 0 of 3 traps. Crane comes at 3."
- Open: the card reads "The answers open when the game closes at 2:05 PM tomorrow. Fix it together starts then."
- "Send your Mob a sticker": Nice one, So close, Teach me, Again?
- Key: **"Fix question 4 together"** (closed with a trap), else **"Back to the den"**.
- R2: "Everyone did something good; the question we missed is next."

**R9. Fix it together** (Live 17 answer sheet, after close only)
- Subtitle "Chai Circle, one trap".
- The lamp-lit answer sheet: "Question 4", "Why it looked right", the OMR bubbles with **your** pick struck in pencil and the right one filled, then the bank's explanation. Mobi thinking at its side.
- Path: "Now. One fresh question like it, only for you." and "Wednesday 28 Oct. One more, to check the fix holds."
- Shelf strip: "When 2 of you pass on Wednesday, the trap counts as fixed. 3 fixed traps bring Crane to every shelf." with Crane's silhouette and "0 of 3".
- Key **"Try a fresh question"**. Then the question uses today's practice option UI with immediate feedback. This is your own fresh question, so the answer and the why show at once.
- The check before it opens: "Your check opens on Wednesday 28 Oct." in the den card and here. No timer.
- R2: "Do one question now; Wednesday checks it stuck."

**C1. Chains, You** (Live 03 strip plus Arena S3)
- Tabs "You" and "Chai Circle".
- Number figure "14", "days in a row". Line "13 practised, 1 rested. Your best run." (or "Your best is 23 days.").
- The strip: seven paper ticks with today last.
  - Today undone: today shows "2 of 5" and the line "Answer 3 more questions today to count it." This is not a warning; it is shown only on this screen.
  - Rested days show a dashed link with a moon.
- Passes: "2 rest passes, the most you can hold", "Miss a day and one is used for you. You earn one every 7 days, and one for every 3 fixes that hold."
- Make-up, when open: "Tuesday was missed and no pass was left. Answer 10 questions today or tomorrow and Tuesday counts." Once used: "A make-up can be used once every 14 days."
- After a break: "A new chain starts today. Your best is 23 days."
- Calendar for the month: ticks, moons (rested), paper notches (made up), a lamp dot (paused), plain (none). Caption "Moon: a rest pass kept the chain."
- Milestones: "Rest pass at 3", "Rest pass at 7", "Rest pass at 21", "Foil edge at 30". The next shows "16 more days", never a countdown to lose.
- Links "Exam pause days" (P5) and "Hide my chain".
  - Hidden: the screen shows "Your chain is hidden. It still counts, and nobody else ever sees it." with "Show my chain".
- R2: "This is my run of days; a missed day won't wipe it."

**C2. Chains, Chai Circle** (Arena S4, F8)
- The pennant figure "3", "weeks in a row". Line "A week is stitched each time Chai Circle finishes the weekly quest. Nobody can break it alone." "Best run: 3 weeks".
- Quest card: "This week's quest", "Ends Sunday 11:59 PM", "Answer 60 questions together in Mob games and papers.", "56 of 60 answered". A 12-segment bar.
  - Past the goal: "70 answered. The quest needed 60."
- "What filled it": rows by game, never by person, and never "N of you" (judge on Live 04). For example "Monday's Mob paper 37", "Riya's sprint 14".
- Parcel: Hop's silhouette, "Hop is folded in this week's parcel. Finish the quest and everyone in Chai Circle gets Hop."
- "How it counts": "Every question answered in a Mob game or paper counts, right or wrong. Sized for 4 of you: 15 each. Resting this week? Step out, and the quest gets smaller without your name."
  - Step out link, or "You stepped out this week. Step back in".
- Path: "Den stamp at 2", "Stamp and the desk bell at 4", "Brass lamp at 8", "Foil seal at 12".
- Missed week: "A new chain starts this week. Your best is 3 weeks."
- R2: "Four more questions from any of us finishes the week."

**P5. Exam pause** (sheet)
- "Exam pause days". Line: "Set days ahead for school exams. Your chain holds on those days. You have 14 a season, and 14 are left."
- A month calendar with multi-select of future days. Key **"Pause 3 days"**.
- Remove: "Clear these days".
- R2: "Protect my chain on exam days."

**M-sheets (moments; full-screen routes over the shell, each with Skip and a close X)**
- **K1. Milestone** (Live 18 arc, Arena S16 copy): "14", "days in a row". Line "You practised 13 of them and rested 1. It is your best run so far." Reward chip "A rest pass" when that milestone gives one. Key **"Back to the den"**.
- **K2. Quest done** (Arena S18): "Quest done". Line "Chai Circle answered 70 questions this week. The quest needed 60, so week 4 of your chain is stitched." Heads in a row. Parcel. Key **"Open the parcel"** (when it holds a Fold or item), else **"See the pennant"**.
- **K3. Week stitched** (Arena S19): "4", "weeks in a row". Line "Chai Circle finished this week's quest together, so week 4 is stitched for all four of you." When there is a reward: the card "A desk bell for your den", "It stays on your den's shelf." Key **"Back to the den"**.
- **K4. Reveal** (Live 19, F6): "New on your shelf", "Hop", "Bounces back after a wrong one." Fact: "Chai Circle finished its first weekly quest, so everyone in it gets Hop. Nobody can buy him." Keys **"Play as Hop"** and "See your shelf".
- **K5. Pass notice** (inline toast on the den, once per day): "Friday was covered by a rest pass. Your chain is still 12."

**S1. Shelf** (Arena S20 with B's base, D133)
- Title "Your shelf", "Every one is earned. None can be bought."
- "You play as Dart" with "Change", which picks among owned Folds only.
- Grid: each Fold on a paper plinth (painted base). Owned ones are coloured. Locked ones are a true silhouette with the rule and count: "Crane. Your Mob fixes 3 traps together. 1 of 3, in Chai Circle." Fold-count creases in the card corner.
- Section "Finishes": "Foil edge. 30 days in a row. 14 of 30."
- Section "Chai Circle's shelf": the den items, owned and next.
- R2: "Here is what I have and exactly how to earn the rest."

**J1. Join with a code** (Arena S22, Live 22)
- "Join a Mob". Line "Type the 6-character code your friend sent."
- Six boxes shown as K7P 2M9. Paste of an 8-character code or a whole link is accepted; the boxes grow to 8 for an old code.
- Preview, with no names: silhouettes of the members' Folds, "Chai Circle, Accountancy", "3 of 5 seats taken".
- "Pick who you'll be": the four starters, or owned Folds.
- Name field. Line "MockMob never asks for your contacts. Only your Mob sees your name. You can leave any time."
- Key **"Join Chai Circle"**.
- Today's failure states stay (invalid, expired, full, paused) with the server sentences.
- R2: "Type the code, pick a Fold, join."

**SET. Mob settings** (existing settings section, added rows)
- "Show a podium" switch (the owner of the Mob only; others see "Chai Circle shows a podium. Riya can change this." as text). Note: "Games show places by marks. Off: everyone's marks, with no places."
- "Mob name" (owner only), with the chip list.
- "Resting this week" switch (everyone).
- "Share my marks in games", which is today's `show_score` switch, relabelled. Off: your Fold stands on the podium with "Private" instead of marks, and you get no place. The collective line still counts your answers.

### 5.4 The den motion and layers
Layers, back to front:
1. ground and grain;
2. room art (`scene-empty-nothing-*`);
3. lamp light field (`CustomPainter` radial, lamp 26% Night and 17% Day);
4. floor and table;
5. Fold shadows;
6. Folds;
7. tags;
8. pennant and shelf;
9. particles;
10. cards and chrome.

Each is a `RepaintBoundary`. Only transform and opacity animate, except the light field.

### 5.5 Sizes and layout
- At 360 dp: the den stage is 280 dp tall, Folds 72 dp (64 at 5 members), name tags `label` 13/18.
- At 412 dp: the stage is 300 dp, Folds 80 dp.
- Large text (1.3): the stage keeps its height and tags wrap to 2 lines. Names are never truncated below 13 sp.
- Day: the header over the bright room uses a 40% ground-to-transparent top scrim for contrast. This answers the craft judge's accessibility note.

### 5.6 Motion specs per moment
Durations are in ms. Curves and springs are the tokens in 5.1. "Haptic" uses `haptics.dart` verbs only. All moments are on `mob.beat` unless stated. Each has its own `AnimationController` and a skip that lands the end state in 200 ms.

| # | Moment | Timeline | Layers | Haptic | Reduced motion | Technique |
|---|---|---|---|---|---|---|
| M1 | Enter the den (T2, 1100) | 0 lamp pool 0.6→1 and the dim 62%→0 (glide 420); 120 room rises 14 dp (emphasized 360); 160 pennant swings in, decaying ±2.4°, -1.2°, 0.4° (out 900); 200 + 90 per Fold: rise 14 dp, scale 0.92→1 (iconPop), shadow settles 60 ms later; 420 name tags engrave whole words (engrave 280); 420 card rises 14 dp (emphasized 360); 465 quest strip; 700 idle breathe and blink start. The shell and bar never fade. | 2-10 | none | 120 ms fade of the den content; still Folds | A + C; painter for the lamp (B) |
| M2 | Go live (T2, 900) | 0 key 0.96 (snappy); 180 release (release spring); 180-540 a volt circle grows from the key to a radius covering **at most 40% of the screen**, fill volt at **22% (Night) / 30% (Day)** (out 360); 540-900 the circle fades to 0 while the lamp pool brightens 1→1.2; lobby fades in under it from 440; Folds turn 4° toward the centre (240); each joiner (a presence entry) hops in: rise 36 dp past -18, land with squash 90 ms, settle (celebrate), then the "Here" tag engraves 360 later | key, wash, lobby, Folds, tags | light at release; selection per joiner | 120 ms fade, no circle, no hop | A; `ClipPath` circle radius tween; C |
| M3 | Countdown (3000) | Beats at 0, 600, 1200. Each numeral is a `Text` in BricolageCondensed 96/86 tabular on **its own layer above the stopwatch art**; the pivot is part of the art layer beneath. Stamp in 0-180 (scale 1.25→1, out); hold; leave 460-600 (scale 0.92 and fade, leave). **The next numeral starts only after the previous one is gone** (no overlap). The stopwatch tilts ±1.5° per beat (inOut 600); the volt arc segment fills each beat (B, 600 linear); heads bob 3 dp; scrim 0→45% across the beats (glide). 1800: a volt paper tile with "Go" stamps 1.4→1 (celebrate), one ring burst 0.6→1.6 (420) and 4 glints. 2400: the stage exits and the question rises 14 dp (glide 300). Go lands on `startsAt` (offset from `serverNow`; a late arrival joins at the current beat). | scrim, stopwatch art, arc, numeral layer, heads, particles | selection on 3, 2, 1; light on Go | numerals cross-fade in place, 120 ms; beats kept | A + B (`CustomPainter` arc and ring), a `Ticker` on server time |
| M4 | Lock in (T1, 320) | 0 tap: option 0.96 (100) and its lip sinks 2 dp; key label becomes "Lock in B"; on the key: a paper clip drops 8 dp onto the option corner (snappy 140), other options dim to 60% (160), your Fold nods 3° (240); after the server ack, your Fold steps to the next number on the ruler (glide 300, a 6 dp hop) | option, clip, key, ruler | selection on pick; light on lock | clip appears, dim 120 ms, no nod or hop | A; B for the clip; C |
| M5 | Right (T1, 560) | 0 option fills `goodText` tint (200); 120 a tick draws on its edge (drawIn 450, `PathMetric`); 160 "+5" floats 12 dp and fades (700, ink2 tabular); 160 the panel rises (drawer 360); 240 your Fold nod-hops (420, `cheer` pose cross-fade at the low point). At 3 in a row: a paper stamp "3 in a row" lands 1.4→1 with a 2° settle (celebrate 520) and 4 glints, once per run | option, tick, mark, panel, stamp, ruler | light (live only) | tint and tick in 120 ms; no float | A + B + C |
| M5b | Not this one (T1, 560) | 0 your option takes the wrong surface and border (200); "-1" in ink2; your Fold tilts 6° and back (420) with the `shrug` pose; the panel rises (drawer 360). No other option changes. **The question change is fade out 140, then fade in 200; never both at once** (judge: Live's double exposure). | option, panel, ruler | none | 120 ms | A + C |
| M6 | A friend finishes (T1, 600) | 0 their Fold glides to the flag (glide 300); 120 their last number fills in their colour; 240 a hop with squash (celebrate); 300 the pennant rises from the pole (iconPop 280, their colour); 500 toast slides in (glide 300); 8 paper bits | ruler, Fold, pennant, toast | none (nothing buzzes for others) | pennant and toast fade 120 | A + B + C |
| M6b | Ghost race | Ghosts move by recorded arrivals in real time; each ghost hops 6 dp on arrival at a number; the chip pops (iconPop) only when its text changes | ruler, chip | none | ghosts jump to their current number | B ruler painter, A, C |
| M7 | Podium (T4, 4800 open / 4800 closed) | 0-400 scrim to 35%, lamp cone narrows to 62% (emphasized). 120 the title, then the collective line at 400 **together with the floor members** (all at once, marks shown static, never alone, F11). Plinths unfold rotateX 90→0 (emphasized 420), third at 1000, second at 1600 (shared places unfold together), first at 2200. Each Fold drops 60 dp (220, leave), squashes 90 ms, settles (celebrate); 10 paper bits stop at the floor. Marks roll up with countUp 720, **starting from the marks of the place below** (third rolls from the highest floor mark or 0, second from third's, first from second's), so the order is true in every frame (F10). The numeral engraves 280 after landing. 2820 first: the lamp swells to 60%, the foil sheen sweeps the plinth (sweep 700), 40 paper bits and 8 glints over 1400, the winner hops once. 3700 the tie line; 4200 keys rise; 4200-4800 the scrim clears. "So far": the plinth paper stays plain and the sheen still runs (it is a place, not a final). | wall, cone, scrim, plinths, shadows, Folds, names and marks, particles, text, keys | light per landing; medium on first; confirm after the podium read (server ack) | three 120 ms fades 300 ms apart (third, second, first); about 1 s total | A (`Matrix4.rotationX` with perspective 0.0015), B particles (cap 60), C, D foil shader (Lite: a gradient mask) |
| M8 | Week stitched (T3, 2000) | Plays only after the server reports `quest.done` for this week (F13). 0 lamp brightens and the pennant lifts 8 dp, -1.5° (300); 180 the number rolls n-1→n (numberRoll 500); 300 a needle sews the new stitch along the border (drawIn 450, inOut; the needle rides `PathMetric.getTangentForOffset`), then the thread holes appear; 780 the pennant settles at 1.03 with a decaying sway (900); 820 glints ride the stitch; 900 the title engraves; 1080 heads pop (iconPop, 45 step); 1300 the reward card rises; 1520 the desk bell wobbles (600) | lamp, pennant, number, stitch, needle, text, heads, card | confirm | number cross-fades, stitch appears | A + B |
| M9 | Reveal (T3, 2000; F6) | 0-300 scrim, lamp narrows; 300 the parcel still (`parcel-sealed`) pulls back 0.94 (120), then two 3° wobbles (2×160); 560 the warm leak grows from the seam: lamp 0→90→50% (radial, no rays); 640 swap to `parcel-pop` (the seal pops, scale 1.2 and fade 200); 700 swap to `parcel-open`; 760 four painted flaps fold back 60 ms apart (emphasized 420) over the open still; 900 the Fold rises 90 dp out of the parcel (celebrate) with 22 paper bits floored above the name; 1000 its shadow grows; 1400 the name engraves; 1620 the line rises; 1900 keys rise. **No sunburst, no rays, no rarity colour.** | scrim, lamp, leak glow, parcel stills and flaps, shadow, Fold, text, particles, keys | light at pull-back; medium at open; confirm after the seen-mark ack | parcel cross-fades to the Fold, 120 ms | C (3 stills) + A + B; no image sequence |
| M10 | Quest done (T3, 1900; F8) | 0-600 the count rolls from the last seen value to the **true total** (70) while the bar fills to full at the target and stays full; 700 the bar pulses 1.04; 760 segments bloom in order (lift 1 dp, 14% volt glow, 22 step); 1080 the bar folds away (leave); 1120 a **square paper seal** (not a coin disc; craft judge) stamps 1.4→1 with a 2° settle (celebrate), with a ring of 12 glints; 1160 "Quest done" engraves; 1300 heads pop; 1400 the parcel arrives (celebrate) | lamp, bar, seal, text, heads, parcel | medium at the seal; confirm after the ack | bar full, seal fades in at 120 | A + B; seal = `stamp-seal.webp` (new, 5.7) |
| M11 | Milestone (T3, 2000) | 0 lamp; 120 an arc of n paper ticks drops in 70 ms apart (the rested day as a dashed moon link), today's lands with celebrate; 600 the number rolls n-1→n with a 1.25 stamp; 820 Mobi `cheer` pops (iconPop); 900 glints and bits floored above the number; 1000 title and line; 1300 the reward chip unfolds (rotateX 70→0, emphasized 420) | lamp, ticks, number, Mobi, text, chip | confirm | all fade in 120 | A + B; Mobi raster |
| M12 | Sticker | flies 24 dp up from the sender's Fold, scale 0.9→1 (iconPop), holds 1800, fades 300; at most 3 visible at once | sticker layer | selection on send | fade in and out 120 | A; painted paper sticker (B) |
| M13 | Switch Mobs | fade through, 90 out and 210 in | den | selection | 120 | A |

Moment queue: the den plays `v3.moments` in order (quest done → week stitched → reveal → milestone), one per open, after Enter the den. Each marks `seen` only after it has fully shown or been skipped (`POST /seen`). It never plays during a run.

### 5.7 Assets
| Asset | Count | Source | Format and size | Where |
|---|---|---|---|---|
| Fold poses `fold-<key>-<pose>@256.webp` (idle, cheer, think, shrug, wave) | 12 × 5 = 60 | `tmp/design-1019pm/mob-v3/characters/final` (being made now; style C; Hop redrawn as a frog, Patang slimmer with sticks, Crane's visor wider, Kandil awake) | WebP alpha q90, about 20 KB each | `assets/folds/` |
| Fold large `fold-<key>-idle@512.webp`, `-cheer@512.webp` | 24 | same | about 60 KB | reveal, podium first, shelf detail |
| Heads `fold-<key>-head@128.webp` | 12 | cropped from idle around the visor (not generated) | about 8 KB | discs, chips |
| `folds.json` | 1 | hand-made | eye boxes per pose (x, y, w, h as fractions), boot pivot, width class (`narrow`, `wide`), paper colour | `assets/folds/` |
| Parcel stills `parcel-sealed.webp`, `parcel-pop.webp`, `parcel-open.webp` | 3 | generate in style C from `REVEAL-unfold.webp` (square paper seal, no coin; CHARACTER-WORLD 7.3) | 512 px, about 60 KB | M9 |
| Stamp seal `stamp-seal.webp` | 1 | generate: square scalloped paper seal with a tick, lamp-lit | 256 px | M10 |
| Group art `group-desk.webp` | 1 | `characters/GROUP-mob-with-mobi.webp` | 1200 × 800, about 120 KB | invite card, D0 |
| Room | 0 new | `scene-empty-nothing-{night,day}.webp` (in the app) | existing | den |
| Stopwatch, desk bell, metronome, foil | 0 new | `assets/art/hybrid-*.webp`, `foil-seal.webp` | existing | M3, K3 |
| Foil sheen shader | 1 | new `shaders/foil_sheen.frag` (Impeller; precache on Mob open; Lite tier gradient mask) | | M7, foil finish |

The bundle adds about 2.9 MB: 60 × 20 + 24 × 60 + 12 × 8 + about 250 KB of stills. Everything is bundled; no download path in build 1.
- **Missing art rule:** a missing file falls back to `InitialDisc`, and a CI test (`fold_assets_test.dart`) fails the build if any listed file is missing.
- Not used in build 1: Rive, Lottie and image sequences. The craft judge found none needed. Rive is reconsidered only if the puppets feel dead on the emulator walk.

### 5.8 Files to create or change (app, `lib/features/social/`)
**New, data.**
- `data/mob_v3_models.dart`: `MobV3`, `MobGame`, `GameRun`, `Ghost`, `Podium`, `Moment`, `Review`, `Quest`, `MobChain`, `StartRight`, `Shelf`, `FoldKey`, `ChainState`; `fromJson` exactly per the contract.
- `data/mob_game_repository.dart`: open, run, answer (idempotent retry), finish, podium, review.
- `data/mob_room.dart`: the Realtime wrapper. It handles ticket → channel → presence → events, with a quota fallback, an unsubscribe on dispose, and a 10-minute idle drop.
- `data/chain_repository.dart` for `/api/me/chain`.
- `data/mob_fixtures.dart` (debug and test only) loads `contract/fixtures`.

**New, logic.**
- `logic/ghost_pace.dart` (R4 formula).
- `logic/mob_names.dart` (24 keys, equal to the server's).
- `logic/fold_catalog.dart` (the 0.4 table: lines, colours, fold counts; rule copy by key).
- `logic/moment_queue.dart`.
- `logic/den_copy_state.dart` (which card D1 to D5 shows).

**New, screens.**
- `den_screen.dart` (replaces the body of `mob_screen.dart`; the old file keeps settings and members).
- `den_start_screen.dart`.
- `game_lobby_screen.dart`.
- `game_run_screen.dart`, a new runner. It does **not** use `features/runner`, because that runner shows answers.
- `podium_screen.dart`, `moments_screen.dart`, `fix_together_screen.dart`, `chains_screen.dart`, `shelf_screen.dart`.
- `moment_overlay.dart` (K1 to K4).

**New, widgets.**
- `den_stage.dart`, `fold_puppet.dart`, `ruler_race.dart`, `countdown_stopwatch.dart`, `podium_stage.dart`.
- `pennant.dart`, `quest_bar.dart`, `parcel.dart`, `paper_particles.dart` (cap 60, deterministic seed, per-burst floor above text), `chain_strip.dart`, `chain_calendar.dart`.
- `play_picker_sheet.dart`, `start_game_sheet.dart`, `mic_sheet.dart`, `free_pro_sheet.dart`, `pause_sheet.dart`.
- `sticker_row.dart`, `code_boxes.dart`, `invite_card.dart` (rendered off-screen to PNG for `share_plus`), `fold_picker.dart`.

**Changed.**
- `copy.dart`: every string above lives here as `MobCopy` constants and functions. The failure map gains the 3.2 sentences.
- `mob_routes.dart`: `/mob/game/:id`, `/mob/game/:id/run`, `/mob/game/:id/podium`, `/mob/game/:id/fix`, `/mob/chains`, `/mob/shelf`, `/join/:code` (6 or 8).
- `mob_repository.dart`: parses `v3`.
- `widgets/mob_join_code.dart`: 6 boxes.
- `screens/mob_join_screen.dart`: Fold pick, no names in the preview.
- `widgets/mob_extras.dart`: hidden when `v3` is present (Your own round replaces it).
- `social.dart`: exports.

**Core.**
- `shared/motion-tokens.json` and the regenerated `motion_tokens.g.dart` (5.1).
- `pubspec.yaml`: `assets/folds/`, `shaders/foil_sheen.frag`.
- `core/router/router.dart`: routes.

**Not changed:** the bottom bar, Today's Mob block rule (D105), and `features/runner`.

### 5.9 Server files (for reference by both builders)
**New.**
- `src/lib/mob/games.mjs`: marks, places, headline, moments, trap, ghosts. Pure.
- `src/lib/mob/starts.mjs`: 3.3. Pure.
- `src/lib/mob/folds.mjs`: the 0.4 table and rule progress. Pure.
- `src/lib/mob/names.mjs`.
- `src/lib/mob/quest.mjs` (target, labels).
- `src/lib/chain/chain.mjs` (2.3) and `src/lib/mob/mobChain.mjs`.
- `src/lib/server/mob/games.js`: the service for games, rooms, fix, shelf and unlock checks.
- `src/lib/server/mob/realtime.js`: room cap counting.
- `src/lib/server/chain.js`.
- Routes: `src/app/api/mob/{settings,profile,shelf,sticker,mic,step-out,seen}/route.js`, `src/app/api/mob/game/route.js`, `src/app/api/mob/game/[id]/{route.js,run,answer,finish,podium,review,room/ticket,room/start,room/cancel}/route.js`, `src/app/api/mob/fix/{start,answer}/route.js`, `src/app/api/me/chain/route.js`, `src/app/api/me/chain/pause/route.js`.
- The four migrations and the four undo files (2.1 to 2.4).

**Changed.**
- `src/lib/mob/model.mjs`: `CODE_RE` accepts 6 or 8; new codes are 6 (`codeFromBytes(bytes, 6)`); `normalizeCode`; ERRORS.
- `src/lib/server/mob/service.js`: `view` adds `v3`; create and join take the Fold and the name key; `startPaper` drops the free claim; `recordFromAttempt` adds quest ticks via the replaced SQL.
- `src/lib/server/mob/http.js`: ACTIONS and LIMITS.
- `src/lib/server/mob/deps.js`: `playBillingEnabled`, `loadCorrectIndex(ids)`, `authUid`, and the trap atlas for the fix.
- `src/lib/auth.ts`: exposes `authUid`.
- `src/lib/server/accountDeletion.js`: steps for `mob_profiles`, `fold_unlocks`, `mob_reactions`, `mob_seen`, `mob_step_outs`, `mob_game_runs`, `mob_game_answers`, `mob_start_claims`, `mob_mics`, `mob_fix_checks`, `chain_prefs`, `chain_pauses` and `mob_room_tickets`.
- `/admin/funnel` metrics: games opened per week, Mobs with 2 or more members playing 1 or more games a week (**the leading metric**), quest completion rate, and live rooms per day. Guardrails: the existing stop rule plus "Hide my chain" adoption.

**Unlock checks.** `games.js` runs `checkUnlocks(userId)` after every run finish, quest settle, fix answer and chain read. It grants through `mob_fold_grant` and adds `reveal:<fold>` to the due moments. It is idempotent.

---

## 6. Safety for minors and privacy
1. **No free text between users.** Stickers are an 8-value enum. Names are 2 to 18 characters, use the existing blocklist, and are first names only. Mob names come from a list. No photos. Folds are preset art.
2. **Who played.** Nothing shows a per-member "not played" state anywhere: no tags, no dimmed Folds, no "3 of 4", no "one more can play". Runs appear only as a list of finished runs with times (F2).
3. **Who got it wrong.** The trap is "most of you", never a count. Moments are only positive and never touch the trap question. Fix it together shows only your own pick (F3).
4. **Answers.** No correct option or explanation before `closes_at`, on any route or broadcast (F1). Collusion over WhatsApp cannot be stopped, so games are not proctored and marks count only inside the game.
5. **Plan status.** The API never returns another member's plan. Copy never names who has Pro. Hosting a live room or passing the mic may imply it once billing is on; this is accepted and never stated.
6. **No sale and no price.** No price, currency or "buy" inside `lib/features/social`. Every collectible and finish is earned, by deterministic rules shown on the item. Nothing random, no loot-box idioms (no rays, no rarity colours, no coin shapes).
7. **No pressure.**
   - No flames, countdowns or warnings on either chain.
   - No push and no local reminder from the Mob in build 1.
   - Rest passes apply themselves. Make-up is free on every plan. There is an exam pause and "Hide my chain".
   - The best run never drops. Pro changes nothing.
   - The weekly chain is group-owned, and step-outs are anonymous.
   - No daily pair streak.
8. **No late-night framing.**
   - No copy that praises late study.
   - Kandil's line is "Keeps the desk lit for everyone."
   - "Night Owls" is removed.
   - Live rooms open only from 6:00 AM to 11:00 PM IST (`LIVE_HOURS`); the 24-hour game itself stays open. **Owner to confirm the hours.**
   - Lint C-4 bans "late night", "all-nighter", "night owl", "up late", "midnight" and "burn the" in Mob copy.
9. **Presence** only inside rooms, only "Here", "Ready" and "Host". The den never shows who is online.
10. **Realtime** carries no names, marks, picks or correctness. Access is by an expiring ticket, and leaving, removal or a block revokes it.
11. **Data minimisation.** Quest ticks hold no user id. Reactions are kept 30 days. Answers are kept with the game, and a member who leaves loses their runs and answers.
12. **Reporting and blocking** are unchanged (Report, Leave and block, Remove). A block also revokes room tickets.
13. **DPDP for minors** stays an open item for counsel (P12) and is not changed by this build.
14. **The stop rule** stays: over 2 reports per 100 members, or over 40% leaving within 7 days, pauses invites.

---

## 7. Test plan

### 7.1 Server (node:test on PGlite with the real migrations; `data/tests/`)
- **SV-1 `mob_v3_migrations.test.mjs`.**
  - Apply 0001 → all → the v3 four, then undo the v3 four in reverse; the schema returns to the pre-v3 dump.
  - Apply twice (idempotent).
  - The 8-character codes still look up, join and expire.
  - Realtime: PGlite has no `realtime` schema, so the test creates a stub `realtime.messages` and `realtime.topic()`, and `auth.uid()`, to run the policies.
- **SV-2 codes.** New invites are 6 characters. Lookups normalise O/0, I/L/1, spaces and hyphens. An 8-character code works until `expires_at`.
- **SV-3 starts** (`starts.mjs` table test, every row of 3.3), plus SQL races: two `mob_game_open` calls with `free_weekly` at once give one `ok` and one `start_used`; a used mic cannot be used twice; leave and rejoin cannot refresh a free start.
- **SV-4 billing flag.** With `PLAY_BILLING_ENABLED` unset, a Free user opens a live game (`via: 'open'`). With it `true`, the same call gives `START_FORMAT`.
- **SV-5 marks.**
  - +5, -1 and 0 per answer.
  - A retry of the same `q` returns the stored result and changes nothing.
  - Answers after `ends_at` give `RUN_EXPIRED` with the rest skipped.
  - `elapsed_ms` is from server time only.
- **SV-6 places.** The fixture gives Riya 20 → 1, You 19 and Kabir 19 → 2 and 2, Zoya 13 → 4 on the floor. All tie → all 1. One run → place 1. `showPodium:false` gives no places. Private marks give no place.
- **SV-7 no leak.**
  - Before close, a response scan of `/game/[id]`, `/run`, `/answer`, `/podium` and `/review` finds no `correctIndex`, no `explanation`, and no `pick` of another member.
  - After close, `/review` has them for your own picks only.
  - `mob_game_json` never contains another member's picks (assert on the SQL output).
- **SV-8 ghosts.** The arrivals equal the stored `elapsed_ms`, and there are no ghosts from unfinished async runs.
- **SV-9 trap and moments.**
  - The trap needs 3 runs, 2 picks and half. The copy kind is only "most".
  - A moment never names the trap `q`.
  - The fixture's Arena S15 situation ("Riya skipped question 4" with the trap on 4) produces no skip moment on 4.
- **SV-10 quest.**
  - The target is 15 × (members − step-outs), at least 15.
  - Leaving does not lower `answered`.
  - `done_at` is set once.
  - Step-out after done gives `STEP_OUT_DONE`.
  - The by-source labels have no person.
- **SV-11 truthful counters.** `answered` 70 with a target of 60 is returned as 70, and `done` is true.
- **SV-12 chain maths** (`chain.test.mjs`, at least 40 cases):
  - day boundary at 11:59 PM and 12:00 AM IST;
  - 5 answered across two sessions counts;
  - skips do not count;
  - pass gift on day 3, then +1 each 7 days;
  - a pass per 3 held fixes;
  - the cap of 2;
  - a pass applies before the make-up;
  - make-up within d+1 or d+2 with 10 answered;
  - only one make-up in 14 days;
  - `open` state before the outcome is known;
  - pauses hold the chain and do not add;
  - pause in the past is refused, and the 14-day season cap holds;
  - hidden still computes;
  - the best never drops, even if history is deleted;
  - Cutting after a 3-day gap.
- **SV-13 Mob chain.** A stitch on done. A week pass at 4 (hold 1). A missed week restarts with the best kept. Milestone items at 2, 4, 8 and 12.
- **SV-14 Realtime payloads.** Every `realtime.send` call site's payload keys are a subset of `{m, q, done, k, startsAt}` (static scan plus a runtime spy).
- **SV-15 room auth.**
  - A member with a ticket passes `mob_room_ok`. A non-member, an expired ticket and a revoked ticket after leave or block fail.
  - Insert of `broadcast` by `authenticated` is refused, and `presence` is allowed.
- **SV-16 live.** `room.start` gives `startsAt` = now + 4000. A run started within 30 s of the start is live with `started_at = startsAt`, and later it is async. The last finish sets `done`. A lobby not started for 15 minutes closes. Opening room 31 gives `LIVE_BUSY`.
- **SV-17 unlocks.** Every 0.4 row is granted exactly once from its source, and never from anything else. The shelf `have` and `need` match.
- **SV-18 contract.** The responses match `MOB-V3-CONTRACT.json`. The old routes' shapes are unchanged (existing `mob.test.mjs`, `mob_plans.test.mjs` and `mob_fix_1017.test.mjs` all pass).
- **SV-19 rate limits.** Each new limit gives a 429 with the real wait sentence. The success-only ones give back on failure.
- **SV-20 account deletion.** Every new table is cleared for the user.
- **Copy lint (both repos), C-1 to C-4.**
  - C-1: no `₹`, `Rs`, "price", "buy" or "per month" under `lib/features/social` or `src/components/mob`.
  - C-2: no "!".
  - C-3: no "of you have not", "still to play", "one more can play", "waiting on", "Played" as a tag.
  - C-4: the night-study words listed in section 6.
- Run `npm run test:recovery` and the existing question and payment suites (AGENTS.md).

### 7.2 App unit and widget (`test/unit/social/`, `test/widget/social/`)
- `ghost_pace_test.dart`: the R4 formula, including the fixture's flip from "4 s behind" to "4 s ahead of Kabir".
- `fold_catalog_test.dart`: equal to the server's `folds.mjs` (a JSON copy checked into `contract/`).
- `mob_names_test.dart`.
- Models parse every fixture. Unknown fields are ignored. A missing `v3` falls back to today's Mob screen.
- `den_copy_state_test.dart`: D1 to D5 from fixtures. No played tag is rendered (widget find by text "Played" is 0).
- `game_run_screen_test.dart`:
  - lock-in sends one request;
  - a retry after a timeout uses the same `q`;
  - "Not this one" never highlights another option;
  - a skip costs 0.
- `podium_stage_test.dart`:
  - the order is true at **every** 16 ms frame across the 4800 ms reveal (pump and read the marks text of each place; assert first ≥ second ≥ third at every frame, F10);
  - the skip lands the end state within 200 ms;
  - the reduced-motion path runs about 1 s;
  - floor members appear with the collective line.
- `countdown_test.dart` (F7): at each 20 ms frame, at most one numeral is visible with opacity > 0.05. The numeral layer is above the art layer in the paint order.
- `quest_bar_test.dart`: 70 of 60 shows "70 answered. The quest needed 60." The bar is full.
- `chain_strip_test.dart`: "2 of 5" today, the moon on a rested day, no "!" or countdown text.
- `mob_room_test.dart` (fake channel):
  - presence maps `m` to names;
  - an unknown `m` is ignored;
  - a quota error falls back with the sentence;
  - dispose unsubscribes.
- `fold_assets_test.dart`: every file in `folds.json` exists.

### 7.3 Goldens (`test/golden/social/`, 360 and 412 dp, Night and Day, text scale 1.0 and 1.3)
D0, D0a, D1, D2, D3, D4, D5, P1 (billing off, Free with a start, Free used, with a mic), P2, P3, P4, L1, R1 (3 and 5 players), R2, R3, R5, R6, R7 (open, closed, tie, switch off, only you), R8, R9, C1 (normal, make-up open, after a break, hidden), C2 (normal and 70 of 60), P5, K1 to K4, S1, J1, SET. Frame goldens:
- G-4: the countdown at 0, 180, 450, 600, 780, 1200, 1800 and 2400 ms;
- G-6: the podium at 400, 1000, 1600, 2200, 2820 and 4800 ms;
- G-9: the reveal at 300, 640, 900 and 1900 ms;
- G-2: go live at 360 and 540 ms, asserting the volt coverage is at most 40% (pixel count).

### 7.4 Emulator walk (device truth; the AVD `mockmob_budget` 720×1600, 2 to 3 GB, the RAM rule)
**Setup.**
- The app is built against the local server pointing at staging `onwkqxmjqjrhfbjjdydu` with the v3 migrations dry-run applied.
- `MOB_V3_ENABLED=true`. Live is on only for the live walk.
- The owner signs in once on the emulator; agents never complete a hosted sign-in.
- A staging seed script, `scripts/mob/seed-v3-staging.mjs` (staging only, refuses any other project ref), makes:
  - **Fresh account:** a new account with no Mob, no attempts, no chain.
  - **Heavy account:** in 3 Mobs, one with 4 members (seeded staging users Riya, Kabir, Zoya). It has 2 open games (one with 3 finished runs), 1 closed game with a trap, a quest at 51 of 60, a Mob chain of 3 weeks, a personal chain of 13 days with one rested day, 2 passes, and Crane at 1 of 3. Hop is not yet owned, so the heavy walk can play the reveal.

**Fresh walk, screenshot after each step.** Each step's R2 line must read true to a first-time student.
1. Mob tab → D0. R2: "Start a group or join a friend's."
2. Start → D0a: pick a name, subject and Fold; keyboard open with the name field visible.
3. → D5, a Mob of one. Invite card and Copy. R2: "Invite a friend; I can still play alone."
4. Start a sprint (billing off, P2) → R1 with no ghosts.
5. Lock in → R2/R3 → R6 → R7 "only you".
6. Back in the den → D3.
7. Chains → C1 with today "5 of 5" and day 1.
8. Shelf → S1, four starters owned and eight locked with true counts.
9. Join with a code from the heavy account's Mob (a 6-character code) → J1, the preview with no names.

**Heavy walk.**
1. Den D2 with the runs row and no Played tags. Zoom on the Folds row.
2. Play Riya's sprint → R1 with ghosts → the pace chip flips → R3 shows no correct option.
3. Podium "so far" → frame sequence.
4. Everyone's moment with "The answers open when the game closes".
5. Closed game → R8 trap "most of you" → R9 Fix it together → answer the fresh question.
6. C2 70-of-60 (seeded) → K2 → K3 → K4 reveal of Hop → "Play as Hop" → the den shows Hop.
7. C1 make-up state (seeded miss) → P5 pause 2 days.
8. Settings: Show a podium off → the podium shows "Everyone's marks".
9. Billing-on simulation on staging (`PLAY_BILLING_ENABLED=true` on the local server only): P1 Free with a start → use it → P1 used. Then the Pro account passes the mic (P3) → the Free account sees "Riya passed you the mic".

**Live walk** (Phase B): the emulator plus a second player in Chrome on the staging web, signed in once by the owner. A web test page `src/app/(app)/mob/dev-room` is behind `NODE_ENV !== 'production'` and is never deployed. The steps are L1 ready-up with presence, M3 countdown, R1 ruler with the second Fold moving on `progress`, R5, then the podium. Then kill the emulator's network for 20 s, so the run resumes from stored answers with no animation. Force the quota fallback with `MOB_LIVE_MAX_ROOMS=0`.

**Frame sequences (R5), recorded with `adb shell screenrecord`, then frames cut every 50 ms into strips.**
- Required: Enter the den, Go live, Countdown, Lock in, Right and wrong, Friend finishes, Ghost race, Podium, Week stitched, Reveal, Quest done and Milestone.
- Night and Day for Den, Podium and Reveal; reduced motion for Podium, Countdown and Reveal.
- Each strip is read by eye against F6, F7, F10 and F11 and the 5.6 timings.
- `flutter run --profile` frame timing on the emulator: no frame over 32 ms in the den idle, the podium or the reveal on the Lite tier.

**Done check.** Every screen in 5.3 is screenshotted on the emulator at 720×1600, Night and Day, with the keyboard where there is a field, scrolled to the bottom. The owner's UI standards done check (`ui-ux-standards`) is run, and the 12-part anti-slop test is filled in with evidence. The report is per screen with the screenshot path. Goldens alone never close an item.

---

## 8. Owners, order and estimates

### 8.1 Owners
- **Server builder** (Sonnet): a new worktree from main `4af47969` (`wt-rel11` HEAD), branch `mob/v3-server`. Migrations are **dry-run on staging `onwkqxmjqjrhfbjjdydu` only**: apply, test, undo, re-apply, and save the dry-run report to `docs/brain/` with the schema diff. No production migration, deploy or Realtime setting change without the owner's yes (D122).
- **App builder** (Sonnet; Opus only for the podium, reveal and countdown moments, per the subagent rule): a new worktree from `ui/v15.4-1019pm`, branch `ui/mob-v3`.
- **Art:** the agent making `characters/final` delivers the 60 poses, 24 large, 3 parcel stills and the seal. The app builder crops the heads and writes `folds.json`.
- **Main session:** owns the contract file, the copy in this spec, the judge pass on the frames, and the owner's decisions.

### 8.2 Order
1. **Day 0, main session, S.** `contract/MOB-V3-CONTRACT.json` and fixtures (fresh, heavy, every 5.3 state, billing on and off, live lobby events). Both builders start from it.
2. **Server, in parallel with the app:**
   - S1 migrations plus undo plus the dry-run on staging (M);
   - S2 codes, names, profile and settings (S);
   - S3 games, runs, answers, podium, moments and ghosts (L);
   - S4 starts, Free, mic and billing flag (M);
   - S5 quest, Mob chain, step out and unlock checks (M);
   - S6 personal chain compute, routes and pause (M);
   - S7 review, trap settle and fix (M);
   - S8 Realtime tickets, policies, `realtime.send`, room routes and quota cap (L);
   - S9 account deletion, metrics, copy lint and the contract test (S).
3. **The app against fixtures before the server lands.** Everything in 5.3 renders from `mob_fixtures.dart` behind a debug flag, and every moment in 5.6 runs from fixture data:
   - A1 models and repositories (S);
   - A2 den stage, Fold puppet and Enter the den (M);
   - A3 start, join, Fold pick, invite card and settings (M);
   - A4 picker, start, mic and Free/Pro sheets (S);
   - A5 game runner, ruler, ghosts, lock-in and right/wrong (L);
   - A6 podium, moments and Fix it together (L);
   - A7 chains You and Mob, pause, milestone and week stitched (M);
   - A8 quest done, parcel reveal and shelf (M);
   - A9 live lobby, countdown, room wrapper and fallback (M, needs S8 for the real channel; builds on a fake channel first);
   - A10 tokens, shader, assets and goldens (M).
4. **Integration on staging:** the app points at the local server with staging data. Phase A first (S1 to S7 with A1 to A8 and A10), then Phase B (S8 with A9).
5. **Walks (7.4)**, fresh then heavy, then live. Fix and re-walk. Then the visual critique at 390 and 1440 for the web pages that still show the old Mob (they must not break), Night and Day.
6. **The owner's yes** for: the production migration, the Realtime "Allow public access" off, the flags `MOB_V3_ENABLED` and `MOB_LIVE_ENABLED`, and a Play internal-testing build.

### 8.3 Estimates (one builder each; S ≤ 1 day, M 2 to 4 days, L 5 or more)
| Piece | Size |
|---|---|
| Contract and fixtures | S |
| S1 migrations and undo, staging dry-run | M |
| S2 codes, names, profile, settings | S |
| S3 games core (open, run, answer, podium, moments, ghosts) | L |
| S4 starts, Free, mic, billing | M |
| S5 quest, Mob chain, step out, unlocks | M |
| S6 personal chain | M |
| S7 review, trap, fix | M |
| S8 Realtime and live rooms | L |
| S9 deletion, metrics, lint, contract test | S |
| A1 models and repos | S |
| A2 den stage and puppets | M |
| A3 start, join, Fold pick, invite, settings | M |
| A4 picker and sheets | S |
| A5 runner, ruler, ghosts, feedback | L |
| A6 podium, moments, fix | L |
| A7 chains | M |
| A8 quest, reveal, shelf | M |
| A9 live lobby, countdown, room | M |
| A10 tokens, shader, assets, goldens | M |
| Walks, frame strips, fixes | M |

**Timing.** Phase A takes about 3 weeks of one server builder and 3 to 4 weeks of one app builder in parallel; Phase B adds about 1 week each. With 2 app builders on A2 to A8, plan about 2 weeks for Phase A (the owner's rule: size plans for parallel agents).

---

## 9. Still for the owner to decide (defaults in this spec in brackets)
1. **The weekly Mob paper's answers.** Today a sitter sees them right after sitting, while friends can still sit it until Sunday. Hold them until Sunday 11:59 PM like games? [unchanged in build 1]
2. **What Free's weekly start covers.** [async Sprint or Round only; live needs Pro or a passed mic]
3. **What a passed mic allows.** [any build-1 format, live included]
4. **Live room hours.** [6:00 AM to 11:00 PM IST]
5. **Quest size.** [15 per member, at least 15; a guess to test with students]
6. **The four starters.** [Dart, Dog-ear, Hexa, Kandil, chosen for four clearly different colours and shapes; Hop, which reads as a cat, becomes the first quest prize after its redraw]
7. **Mob names from a fixed list.** [yes, 24 kind names]
8. **Sound, story pages, QR, Study Room, timed Race, full mock together.** [later, section 1.2]
9. **Supabase plan for production Realtime quotas.** [check before Phase B; the cap is 30 rooms]
10. **The T4 podium tier** (6000 ms ceiling) and **Mobi once per moment** in the Mob. [yes, as both packs proposed]
