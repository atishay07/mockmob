# The Mob: MockMob's one social loop (app and website)

Written 16 Oct 2026 (evening) by the orchestrator-synthesizer. This is a spec. Nothing is built, applied or deployed.

## Status

The spec ships behind `MOB_ENABLED` (off) and lives on staging only until the owner answers D-S1 and D-S2 (section 14).

## Inputs

- **Brain.**
  - `design-2026-10-13/directions-final.md` C.1 and E.3: a mob with no social graph, no contacts and no feed.
  - `onboarding-research.md` around line 160 (contacts: SKIP) and section 6.2 (no public leaderboard of under-18 names).
  - `CTO-LOOP.md` growth loop 5: a share card first; a friend invite for credits is an owner decision.
  - `APP-API-CONTRACT.md` gap G7.
  - DPDP assumption A6 and decision D2 (consent for minors is unresolved).
- **Research brain.**
  - AGENT_RULES 5, 14, 17, 21, 22 (T005), 37 and 38, and the MockMob overlay.
  - No social-specific evidence ID exists, so the loop's effect is an [I] hypothesis to test (rules 37 and 38).
- **Outside direction.** Duolingo's Q2 and Q3 2024 shareholder letters: friends and Friends Streak, small cooperative groups. These are self-reported and correlational, so they give direction only and are not a cited effect (rule 6).

## 1. The decision

The one social loop is **the Mob**: a private group of 2 to 5 students who sit **one shared 10-question paper each week** from MockMob's central bank. They fill **one shared ring** together, and they learn from **the Mob's shared trap**.

Why this one and not another:

- **It uses the moat.** Unlimited fresh papers from one central bank means a new identical paper every week for every Mob. That truthful, calm story is the headline differentiator, and the Mob turns it into a reason to come back.
- **It is cooperative.** The ring only fills. Nobody is ranked, nobody loses a streak, and the Mob never shows who has not sat. That keeps it inside Rule 22 (T005: no shame, no coercive loss).
- **It is safe for minors by construction.**
  - It is invite-only and tiny.
  - It carries no free text except a short display name.
  - There is no chat, no DMs, no photos, no contacts, no search and no public profile.
- **It needs no new tab.** It lives inside Today, Practice and Review, the IA the owner approved. The rejected-cut rule holds: nothing is removed to make room.

Rejected, with reasons, in section 12: leagues and a public leaderboard; open community (chat, comments, rooms, contacts); friend-invite credits (deferred).

## 2. User stories

1. **Start a Mob.** As a student, I start a Mob for one subject in two taps and get a link I can send on WhatsApp. Nobody can find my Mob without that link.
2. **Join from a link.** As an invited friend, I open the link and see what a Mob is and what it asks of me ("one 10-question paper a week, about 12 minutes"). I can try 5 sample questions before making an account (T003). After sign-in, I join with my first name already filled in, which I can edit (T001).
3. **Sit the paper.** As a member, I see this week's Mob paper on Today and in Practice. I sit it any time before Sunday 11:59 PM on my own phone. It is the same 10 questions my friends get.
4. **See who sat.** As a member, I see the ring fill as friends sit ("3 of 4 sat this week"), with the initials of those who sat. I never see a list of who has not.
5. **Learn from the shared trap.** As a member who has sat, once 3 or more of us have sat, I see "Your Mob's trap: 3 of 4 picked B on question 6", with the trap's name. One tap opens the repair for it (if I got it wrong) or the reason B is wrong (if I got it right).
6. **Choose what I share.** My score is private. I may turn on "Show my score to my Mob". Even then, the Mob never sorts us by score.
7. **Ask the others.** After I sit, I can send one "Sit it with me" note a week to the members who have not sat. I never learn who they are. They see it on their Mob card.
8. **Leave, block, report.** I can leave at any time in one tap. I can "Leave and block" a member, so we never share a Mob again. I can report a name or a nudge. Deleting my account removes everything Mob-related about me.
9. **Website.** All of the above works the same on the website (`/mob`, `/join/<code>`), against the same server state.

## 3. Privacy and minor-safety rules

Each rule is testable and is enforced on the server, not only in the UI.

- **P1. Closed.**
  - A Mob is reachable only through an invite code: 8 characters of Crockford base32, about 40 bits.
  - There is no Mob search, no directory, no member search, no "people you may know" and no contacts permission (brain: contacts SKIP).
- **P2. Tiny.**
  - At most 5 members.
  - A student is in at most 1 Mob.
  - An invite expires after 7 days and allows only as many uses as there are seats left.
  - A new invite revokes the old one.
- **P3. The only free text is a display name.**
  - 2 to 18 characters, matching `^[\p{L}][\p{L} .'-]{1,17}$`.
  - It is checked against a server blocklist (`data/mob_name_blocklist.json`), and a member can report it.
  - It is never shown outside the Mob, and never on the public join page.
  - Avatars are an initial on one of 8 token colours. There are no photos and no emoji (standards s10 item 11).
- **P4. No contact channel.**
  - No chat, DMs, comments, reactions, images or links between students.
  - The only student-to-student signal is the preset "Sit it with me" note, once per sender per week, with no text input.
- **P5. Never ranked.**
  - Members always appear in join order.
  - Scores are hidden unless their owner opts in. Opt-in shows only "7 of 10" beside that member, never sorted, and never as a gap.
  - The API never returns other members' scores to a member unless that member opted in.
- **P6. Never names a non-sitter.**
  - The ring shows sitters' initials, and the remaining seats as unlabelled segments.
  - The nudge goes to non-sitters without telling the sender who they are.
- **P7. The shared trap is aggregate.**
  - It shows only when 3 or more members have sat that week.
  - It shows only an option picked by 2 or more sitters, and by 50% or more of the sitters.
  - It never names who picked it.
  - It shows only to members who have sat, so it does not spoil the paper.
- **P8. Analytics stay off for minors and unknown ages** (existing server rule).
  - Mob rows are feature state needed to deliver the service the student asked for. They are not behavioural analytics.
  - Metrics (section 13) are counted only as aggregates over Mobs, with groups under 5 suppressed (`MIN_REPORTABLE`).
  - No Mob event goes to `usage_events` for a minor or unknown-age account.
- **P9. Leave and delete.**
  - Leaving deletes the membership row and that member's sittings and nudges in that Mob, through the foreign-key cascade. The member disappears from the ring.
  - Account deletion cascades through `users` (existing deletion processor).
  - Reports keep no user link after deletion (`on delete set null`), and are purged after 180 days.
- **P10. Block.**
  - "Leave and block" records `(blocker, blocked)`.
  - A join is refused when any current member and the joiner have blocked each other in either direction. The joiner sees the generic "This invite can't be used", which does not reveal the block.
- **P11. Rate limits.** Persistent, through `checkPersistentRateLimit`:
  - invite: 5 a day per user;
  - public code lookup: 30 per 10 minutes per IP;
  - join: 10 an hour per user;
  - nudge: 1 a week per sender per Mob;
  - report: 10 a day per user;
  - other writes: 60 an hour.
- **P12. Counsel review before May 2027.** DPDP Rule 10 (from about 13 May 2027) and D2 are open. The feature stays behind `MOB_ENABLED` until the owner decides D-S1. The privacy page gets a Mob section in the same change that enables it.
- **P13. Night/Day parity, 48 dp / 44 px targets, plain copy, 12-hour IST times,** and reduced motion everywhere.

## 4. Data model and migration

Migration file: `supabase/migrations/20261017100000_mob.sql`. Undo: `supabase/undo/20261017100000_mob.undo.sql`.

- **Conventions.** These follow `20261016090000_my_colleges.sql`:
  - additive and idempotent;
  - RLS on, with no anon or authenticated policy;
  - service role only;
  - `users.id` is text.
- **Order.** Apply on staging first, run the undo, then re-apply. Never apply to production in this pass.

```sql
-- The Mob: a private group of 2 to 5 students who sit one shared 10-question paper a week.
-- Additive and idempotent. Service role only: RLS on, no anon or authenticated policy, every write
-- through the API (SOCIAL-SPEC section 6). users.id is text. Not applied to any remote database by
-- this change. Undo: supabase/undo/20261017100000_mob.undo.sql

create table if not exists public.mobs (
  id uuid primary key default gen_random_uuid(),
  subject text not null check (subject ~ '^[a-z][a-z_]{1,40}$'),
  created_at timestamptz not null default now()
);

create table if not exists public.mob_members (
  mob_id uuid not null references public.mobs(id) on delete cascade,
  user_id text not null references public.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 18),
  colour smallint not null default 0 check (colour between 0 and 7),
  role text not null default 'member' check (role in ('owner', 'member')),
  show_score boolean not null default false,
  nudges_muted boolean not null default false,
  joined_at timestamptz not null default now(),
  primary key (mob_id, user_id),
  constraint mob_members_one_mob unique (user_id)
);
create index if not exists mob_members_mob_idx on public.mob_members (mob_id, joined_at);

create table if not exists public.mob_invites (
  code text primary key check (code ~ '^[0-9A-HJKMNP-TV-Z]{8}$'),
  mob_id uuid not null references public.mobs(id) on delete cascade,
  created_by text references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  max_uses smallint not null check (max_uses between 1 and 4),
  uses smallint not null default 0 check (uses >= 0),
  revoked_at timestamptz
);
create index if not exists mob_invites_mob_idx on public.mob_invites (mob_id) where revoked_at is null;

-- One frozen paper per Mob per IST week (Monday). question_ids is the ordered list every member gets.
create table if not exists public.mob_papers (
  mob_id uuid not null references public.mobs(id) on delete cascade,
  week_start date not null,
  subject text not null,
  question_ids jsonb not null check (jsonb_typeof(question_ids) = 'array' and jsonb_array_length(question_ids) between 5 and 20),
  created_at timestamptz not null default now(),
  primary key (mob_id, week_start)
);

-- One sitting per member per week. picks: canonical option index per question (-1 = blank),
-- kept only to compute the Mob's shared trap; never returned to other members.
create table if not exists public.mob_sittings (
  mob_id uuid not null,
  week_start date not null,
  user_id text not null,
  session_id text not null,
  score numeric not null,
  max_score numeric not null check (max_score > 0),
  picks smallint[] not null,
  sat_at timestamptz not null default now(),
  primary key (mob_id, week_start, user_id),
  foreign key (mob_id, user_id) references public.mob_members(mob_id, user_id) on delete cascade,
  foreign key (mob_id, week_start) references public.mob_papers(mob_id, week_start) on delete cascade
);

create table if not exists public.mob_nudges (
  mob_id uuid not null,
  week_start date not null,
  from_user text not null,
  sent_at timestamptz not null default now(),
  primary key (mob_id, week_start, from_user),
  foreign key (mob_id, from_user) references public.mob_members(mob_id, user_id) on delete cascade
);

-- Who has seen a nudge (so a recipient's card shows it once, and the sender learns nothing).
create table if not exists public.mob_nudge_seen (
  mob_id uuid not null,
  week_start date not null,
  from_user text not null,
  to_user text not null,
  seen_at timestamptz not null default now(),
  primary key (mob_id, week_start, from_user, to_user),
  foreign key (mob_id, week_start, from_user) references public.mob_nudges(mob_id, week_start, from_user) on delete cascade,
  foreign key (mob_id, to_user) references public.mob_members(mob_id, user_id) on delete cascade
);

create table if not exists public.mob_blocks (
  blocker_id text not null references public.users(id) on delete cascade,
  blocked_id text not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create table if not exists public.mob_reports (
  id bigint generated always as identity primary key,
  mob_id uuid references public.mobs(id) on delete set null,
  reporter_id text references public.users(id) on delete set null,
  reported_id text references public.users(id) on delete set null,
  reason text not null check (reason in ('name', 'nudge', 'safety')),
  reported_name text check (char_length(reported_name) <= 18),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

-- Join by code in one transaction. Returns joined | invalid | expired | full | already | blocked.
create or replace function public.mob_join(p_user_id text, p_code text, p_name text, p_colour smallint)
returns text language plpgsql security invoker set search_path = public as $$
declare inv public.mob_invites%rowtype; n int;
begin
  select * into inv from public.mob_invites where code = p_code for update;
  if not found or inv.revoked_at is not null then return 'invalid'; end if;
  if inv.expires_at < now() or inv.uses >= inv.max_uses then return 'expired'; end if;
  perform pg_advisory_xact_lock(hashtext('mob:' || inv.mob_id::text));
  if exists (select 1 from public.mob_members where user_id = p_user_id) then return 'already'; end if;
  if exists (select 1 from public.mob_members m join public.mob_blocks b
             on (b.blocker_id = m.user_id and b.blocked_id = p_user_id) or (b.blocker_id = p_user_id and b.blocked_id = m.user_id)
             where m.mob_id = inv.mob_id) then return 'blocked'; end if;
  select count(*) into n from public.mob_members where mob_id = inv.mob_id;
  if n >= 5 then return 'full'; end if;
  insert into public.mob_members (mob_id, user_id, display_name, colour) values (inv.mob_id, p_user_id, p_name, p_colour);
  update public.mob_invites set uses = uses + 1 where code = p_code;
  return 'joined';
end $$;

-- Leave. The earliest remaining member becomes owner; an empty Mob is deleted (cascades papers, invites).
create or replace function public.mob_leave(p_user_id text)
returns text language plpgsql security invoker set search_path = public as $$
declare m uuid; was_owner boolean;
begin
  select mob_id, role = 'owner' into m, was_owner from public.mob_members where user_id = p_user_id;
  if m is null then return 'not_member'; end if;
  perform pg_advisory_xact_lock(hashtext('mob:' || m::text));
  delete from public.mob_members where user_id = p_user_id;
  if not exists (select 1 from public.mob_members where mob_id = m) then
    delete from public.mobs where id = m; return 'left_and_closed';
  end if;
  if was_owner then
    update public.mob_members set role = 'owner'
    where (mob_id, user_id) = (select mob_id, user_id from public.mob_members where mob_id = m order by joined_at limit 1);
  end if;
  return 'left';
end $$;

alter table public.mobs enable row level security;
alter table public.mob_members enable row level security;
alter table public.mob_invites enable row level security;
alter table public.mob_papers enable row level security;
alter table public.mob_sittings enable row level security;
alter table public.mob_nudges enable row level security;
alter table public.mob_nudge_seen enable row level security;
alter table public.mob_blocks enable row level security;
alter table public.mob_reports enable row level security;
revoke all on public.mobs, public.mob_members, public.mob_invites, public.mob_papers, public.mob_sittings,
  public.mob_nudges, public.mob_nudge_seen, public.mob_blocks, public.mob_reports from public, anon, authenticated;
grant all on public.mobs, public.mob_members, public.mob_invites, public.mob_papers, public.mob_sittings,
  public.mob_nudges, public.mob_nudge_seen, public.mob_blocks, public.mob_reports to service_role;
revoke all on function public.mob_join(text, text, text, smallint), public.mob_leave(text) from public, anon, authenticated;
grant execute on function public.mob_join(text, text, text, smallint), public.mob_leave(text) to service_role;
```

Undo (`supabase/undo/20261017100000_mob.undo.sql`, not a migration):

```sql
-- Undo for supabase/migrations/20261017100000_mob.sql. NOT a migration: it lives outside
-- supabase/migrations, so the Supabase CLI never applies it by itself.
-- Dropping these tables loses every Mob, membership, weekly paper, sitting, nudge, block and report.
-- Nothing else depends on them: with MOB_ENABLED off every /api/mob route answers 404 MOB_DISABLED.
drop function if exists public.mob_leave(text);
drop function if exists public.mob_join(text, text, text, smallint);
drop table if exists public.mob_reports;
drop table if exists public.mob_blocks;
drop table if exists public.mob_nudge_seen;
drop table if exists public.mob_nudges;
drop table if exists public.mob_sittings;
drop table if exists public.mob_papers;
drop table if exists public.mob_invites;
drop table if exists public.mob_members;
drop table if exists public.mobs;
```

Report retention: the existing nightly cron (`/api/internal/refresh-inventory`) gets one more step: `delete from mob_reports where created_at < now() - interval '180 days'`. This is not a new cron, and `vercel.json` stays at 2 crons.

## 5. Server logic (`src/lib/server/mob/`)

- **`week.js`.**
  - `mobWeek(now)` returns `weekStart(localDay(now, 'Asia/Kolkata'))`, reusing `rhythm.js`.
  - The window closes Sunday 11:59 PM IST.
- **`paper.js`.** `ensureMobPaper(mobId, week)`:
  - Select 10 questions for the Mob's subject from the central bank in `quick` mode with no personal exclusions. Reuse the same selector `startPractice` uses, with `userId` omitted. If the selector requires a user, add a by-subject variant in this file; do not change `practiceSessions.js`'s selection.
  - Insert into `mob_papers` with `on conflict do nothing`, then re-read, so two members starting at once get one paper.
  - Options keep their canonical order for a Mob paper. If a layout shuffle exists, it is off for Mob papers, so "picked B" means the same option for everyone.
- **Start.** `POST /api/mob/paper/start` calls `startPractice(userId, { experience:'practice', mode:'quick', count:10, subject, generationKey, mobPaper:{ mobId, weekStart } })`.
  - The one hook in `practiceSessions.js`: when `input.mobPaper` is set, take the questions from `mob_papers.question_ids` instead of the selector, and stamp `selection_meta.mobPaper`.
  - The credit and allowance rules are exactly those of a quick 10 (D-S2 default). The confirm sheet states the real cost (AGENT_RULES 19 and 23; APP-PASS AP3-08).
- **Finish.** In `finishPractice`, when the session's `selection_meta.mobPaper` is set and the session finished before the window closed, upsert `mob_sittings` (`on conflict do nothing`) with the server score and picks. This is idempotent, and nothing changes for any other session.
- **`trap.js`.** `mobTrap(mobId, week)` reads the week's sittings.
  - If fewer than 3 sittings, return null.
  - For each question, count wrong picks by option. Keep options with count 2 or more and count at least 50% of sitters. Take the highest count; on a tie, the lowest question number.
  - The trap name comes from `trapAtlas.js` when that option is tagged. Otherwise the line reads "a common wrong pick".
  - Return `{ questionNumber, questionId, option, count, of, trapName }` to members who have sat. Never return who picked it.
- **`memberId`.** `hmac(MOB_ID_SECRET or NEXTAUTH_SECRET, mobId + ':' + userId)`, the first 12 characters in base32. User ids never leave the server.

## 6. API contract

**Envelope.**
- Successful responses are JSON with `Cache-Control: no-store`.
- Errors are `{ "error": { "code", "message" } }`, the unified shape (G11). The message is a plain sentence a student can read.

**Auth.**
- Every route except the public code lookup needs a signed-in session (cookie or app bearer).
- The routes use `mobileOptions` CORS, like `/api/sessions`.
- With `MOB_ENABLED` not `true`, every route answers 404 `MOB_DISABLED`.

| Route | Body / query | 200 response | Errors |
|---|---|---|---|
| `GET /api/mob` | none | `{ mob: null }`, or `{ mob: { subject, you: { memberId, name, colour, role, showScore, nudgesMuted }, members: [{ memberId, name, colour, you, sat, score? }], week: { start, closesAt, paper: { count: 10, durationSec: 720, cost: { type: 'included'|'allowance'|'credits', credits?, balance? } }, sat: n, size: n, youSat, yourResultId? }, trap: {...} or null, nudge: { canSend, received: { fromName } or null }, invite: { code, url, expiresAt, usesLeft } or null } }` | 401 |
| `POST /api/mob` | `{ subject, name, colour }` | 201 with the `GET` shape | 409 `ALREADY_IN_MOB`, 422 `NAME_INVALID` or `SUBJECT_INVALID`, 429 |
| `POST /api/mob/invite` | none | `{ code, url: 'https://www.mockmob.in/join/<code>', expiresAt, usesLeft }` (revokes the previous code) | 404 `NOT_IN_MOB`, 409 `MOB_FULL`, 429 `RATE_LIMITED` |
| `GET /api/mob/join/<code>` (public) | none | `{ valid: true, subject, size, seatsLeft, expiresAt }`. No names, ever. | 404 `INVITE_INVALID`, 410 `INVITE_EXPIRED`, 429 |
| `POST /api/mob/join` | `{ code, name, colour }` | 200 with the `GET` shape | 404 `INVITE_INVALID` (also returned when blocked; P10), 410 `INVITE_EXPIRED`, 409 `MOB_FULL` or `ALREADY_IN_MOB`, 422 `NAME_INVALID`, 429 |
| `PATCH /api/mob/me` | any of `{ name, colour, showScore, nudgesMuted }` | 200 with the `GET` shape | 404, 422, 429 |
| `POST /api/mob/leave` | `{ block?: memberId }` | `{ left: true }` | 404 |
| `POST /api/mob/remove` (owner only) | `{ memberId }` | 200 with the `GET` shape | 403 `NOT_OWNER`, 404 |
| `POST /api/mob/report` | `{ memberId, reason: 'name'|'nudge'|'safety', alsoLeave?: boolean, block?: boolean }` | `{ reported: true }` | 404, 422, 429 |
| `POST /api/mob/nudge` | none | `{ sent: true, to: n }`. `n` is a count only and can be 0. | 409 `NOT_SAT_YET` (you sit first), 409 `ALREADY_NUDGED`, 429 |
| `POST /api/mob/nudge/seen` | none | `{ ok: true }` | 404 |
| `POST /api/mob/paper/start` | `{ generationKey }` | The same response as `POST /api/sessions` for a practice start | 409 `PAPER_ALREADY_SAT`, 410 `WEEK_CLOSED`, 402 `CREDITS`, 503 `MIGRATION` |

**Rate limits** are as in P11. A 429 carries `Retry-After`.

**Report handling.** A report row is visible on the moderation page (`/moderation`, moderators only), as a new "Mob reports" list: reason, reported name and date. There are no other details. The moderator can remove a member through the owner-equivalent service path.

## 7. Website screens

### `/mob` (arena, signed in)

- **Navigation.** In `src/lib/arenaNavigation.js`, the "Community" group becomes: "Your Mob" (`/mob`, new, first), "Your standing" (`/leaderboard`, renamed; see slice 0), then "Contribute" and "My uploads". Nothing is removed. The dock is unchanged.
- **No Mob** (top to bottom):
  1. Eyebrow "Your Mob".
  2. H1 "Sit one paper a week with up to 4 friends."
  3. Three short lines: "Same 10 questions for everyone, fresh each week." "You see who sat, never who didn't." "Scores stay private unless you choose."
  4. Subject picker, from your subjects, as 44 px chips.
  5. Display name field, prefilled with your first name and editable (T001), plus 8 colour dots.
  6. One volt button, "Start a Mob". If you were sent a link instead, open the link.
- **In a Mob** (top to bottom):
  1. **Ring card.** A large ring with up to 5 segments and "3 of 4 sat this week". Below it, the sitters' initials discs in join order. The line "Closes Sunday 11:59 PM".
  2. **Primary action, one per viewport.**
     - If you have not sat: "Sit this week's paper (10 questions, about 12 min)", with the cost line under it from `paper.cost` ("Included with Pro", "Free today", or "10 credits. You have 40.").
     - If you have sat: "See your answers", and the nudge as an outline button, "Ask the others to sit it" (disabled with the reason once it has been sent this week).
  3. **Shared trap card** (members who sat, 3 or more sitters): "Your Mob's trap: 3 of 4 picked B on question 6. Trap: <name>." with "Repair it" or "See why B is wrong".
  4. **Members list.** Each row is 48 px: initial disc, name, "Sat" or nothing, and "7 of 10" only if that member opted in. Each row has a "..." menu with "Report" and "Leave and block". The owner also gets "Remove from Mob".
  5. **Invite row.** "Invite a friend (2 seats left)" opens a dialog with the link, a Copy button and the native share (Web Share API when present). The expiry reads "Link works until Fri 23 Oct, 9:40 PM".
  6. **Settings.** "Show my score to my Mob" (switch, off by default), "Mute nudges" (switch), "Change name or colour", and "Leave Mob" (confirm dialog: "Leave your Mob? Your sittings leave with you.").
- **States.**
  - Loading: a skeleton of the ring and rows, shimmer at most 4 sweeps.
  - Error: the cause named in the card, plus "Try again".
  - Week closed: "This week's paper closed. Next one opens Monday."
  - Alone (1 member): the ring reads "1 of 1 sat"; the invite row is the primary action until someone joins.
  - `MOB_ENABLED` off: `/mob` returns 404.
- **Motion.** All of it through motion-kit tokens; reduced motion means static.
  - Each new sitter's segment inks once, in order, 220 ms each with a 60 ms step, on `--mm-ease-out`. "New" means since your last view, using a local memory key.
  - Your own segment inks only after the server ack.
  - When the ring completes, it settles once (scale 1, then 1.03, then 1 over 420 ms on the settle spring).
  - The trap card arrives with `mk-rise`.
- **Mobi.** Once, when the ring completes (all members sat), on `/today` only (below), never on `/mob`.

### `/join/<code>` (public)

1. Logo.
2. H1 "You're invited to a Mob."
3. "A small group sitting one 10-question <Subject> paper each week. 3 of 5 seats taken." No names.
4. Primary: "Sign in to join". The code survives sign-in in `sessionStorage` (1 hour).
5. Secondary: "Try 5 sample questions first", which opens the existing guest sample (T003).
6. One line: "MockMob never asks for your contacts. You can leave any time."
7. After sign-in: the name and colour step, then "Join".

- **States.** Invalid or expired: "This invite can't be used. Ask your friend for a new link." The page is not indexed (`robots: noindex`).

### Leaderboard (slice 0, see section 10)

`/leaderboard` becomes "Your standing".

## 8. App screens (Flutter, `lib/features/mob/**`, new)

- **Today Mob card.** Shown only when you are in a Mob, below the road section and above Recent papers.
  - It holds the ring (64 dp), "3 of 4 sat this week", and one action: "Sit this week's paper", or "See your Mob" once you have sat.
  - A received nudge adds one line: "Riya sat it and asked you to sit it too."
  - The Mobi moment, once per completed week per member, respecting CelebrationMode and MobiRation (one per screen, never if the header Mobi is mid-act): Mobi "proud" at 72 dp beside the ring for one act (the T2 cap of 1200 ms), with the line "Your Mob sat it, all 4." Then he leaves.
- **Mob page** (pushed from the card or from You). The same sections as `/mob`, top to bottom.
  - The invite uses `ShareSurface` (`core/platform/share_image.dart`) with the link text. A QR code is v1.1, because it needs a new package and the owner's OK.
  - Sheets use `MmSheet`. Destructive actions use a confirm sheet.
- **Join sheet.** Opened by `https://www.mockmob.in/join/<code>`: add `/join` and `/mob` `pathPrefix` entries to the verified intent filter in `AndroidManifest.xml`, plus the ActionRouter mapping. Signed out: the link goes to sign-in first and the code survives in secure storage.
- **Practice.** When in a Mob, a row in the Practice tab reads "Mob paper, <Subject>, 10 questions", with the same cost line. If you have sat, it reads "Sat. See your answers".
- **Review.** When a trap exists for you, the Review list gets one row at the top of its section: "Your Mob's trap, question 6". Tapping it opens the existing repair flow.
- **You hub.** The permanent entry, "Your Mob" (or "Start a Mob" when not in one), as a 48 dp row.
- **Motion.**
  - Ring segments ink 220 ms each, 60 ms step, on `Motion.out`.
  - The completion settle uses `Springs.settle` with a `segmentTick` haptic. The success haptic fires only after the server ack (haptic grammar).
  - Entrances use `MmStagger` (the AP1-04 lead rule).
  - Reduced motion: static fills, with the same text.
- **Goldens.** Ring at 0, 1, 3 and 5 of 5; no Mob; alone; trap; closed week; error. All at 360 and 412, Night and Day, and at 1.3x text.

## 9. Entry points (present, not in the face)

| Where | No Mob | In a Mob |
|---|---|---|
| Today (app and web) | Nothing | One Mob card (the ring and one action). At most one Mobi moment a week. |
| Practice | Nothing | "Mob paper" row |
| Review | Nothing | The trap row, when it exists and you sat |
| You hub (app) / sidebar "Community" (web) | "Start a Mob" row / "Your Mob" item | "Your Mob" row / item |
| Practice result (after a finished Quick 10) | One 13 sp text line, "Sit next week's paper with friends", at most once a week, dismissable for good | Nothing |
| Landing | Hand-off to wt-land2 after D-S1: one calm section, "Study with friends, without the noise", described truthfully, with no counts until real ones exist | n/a |

No push notifications in v1: the server has no push sender. A nudge is in-app only. No pop-ups, and nothing during a timed paper.

## 10. Slice 0: the public leaderboard (privacy fix, before any Mob work)

- **Problem.**
  - `GET /api/leaderboard` is public and unauthenticated. It returns the name, image and user id of every ranked student, many of them minors, and it scans all attempts on each call (G7).
  - It also mixes in 12 invented "Practice rival" students with realistic Indian names, which breaks AGENT_RULES 5 and the "no fake dashboards" overlay.
  - `/api/learning/summary` `topContributors` returns other users' ids and names.
- **Fix.**
  - `GET /api/leaderboard` requires sign-in and returns only `{ you: { rank, of, tests, average } or null, window: '30 days' }`.
  - Filter at the route, and do not edit `data/db.js`, which conflicts with `fix/security-2-1016` and `web/auth-cache-1016`.
  - Remove `PRACTICE_RIVALS`.
  - `topContributors` keeps only counts (no ids or names).
  - `/leaderboard` becomes "Your standing": "14th of 212 students who sat a mock in the last 30 days", with your tests and average, and a link to "Your Mob".
  - The Practice page stat (`DashboardPageClient.jsx` line 601) reads the new shape.
  - The landing wording is a wt-land2 hand-off (WEB-PASS).
- **Authority.** This exposes minors' names publicly. The main session should decide whether it falls under the owner's 12 Oct standing OK for crucial security fixes. If not, it is owner decision D-S3. Nothing is removed from the student's view: the page stays, and shows their own standing.
- **Tests.**
  - Unauthenticated: 401.
  - The response contains no `name`, `image` or `userId` keys.
  - No `isSynthetic` rows.
  - `topContributors` has no `id` or `name`.

## 11. What is NOT built

- No chat, DMs, comments, reactions, voice, images or links between students.
- No free-text messages. The display name is the only free text.
- No public profiles, no member search, no "people you may know", no contacts or phone-book access, no follower graph.
- No leagues, no ranking or ordering of members by score, no public board of names, no all-India rank, no score gaps.
- No streak that can be lost, no "your Mob is waiting on you" pressure, no countdown banners, no shame copy (Rule 22, T005).
- No friend-invite credits or rewards in v1 (deferred to D-S4).
- No push notifications in v1.
- No Mob for timed full mocks or NTA (v1 is a 10-question paper).
- No Mob analytics events for minors or unknown ages.

## 12. Rejected alternatives

1. **Leagues and a public leaderboard** (Duolingo-style and Indian test-prep-style).
   - It exposes minors' names, which the brain forbids (section 6.2).
   - Rank pressure and easy-point farming hurt learning.
   - It conflicts with the no-rank-prediction rule and Rule 22.
   - The current board pads with invented students.
   - What survives is a private "your standing" (slice 0).
2. **Open community** (chat, comments, study rooms, a contacts-based friend graph).
   - Moderation and grooming risk with minors.
   - The contacts permission was marked SKIP.
   - It contradicts the "mob without a social graph" direction.
   - It needs staff MockMob does not have.
3. **Friend invite for credits.** It invites gaming and money questions, and it is an owner decision in CTO-LOOP. The loop works without it.

## 13. Measure it (AGENT_RULES 37 to 39)

- **Leading metric.** Mob papers sat per active Mob per week (an active Mob has at least 2 members).
- **Second metric.** Week-over-week return of members against non-members.
  - This is observational, with selection bias, so it is not a causal claim (rule 38).
  - If the owner approves, hold out 10% of new accounts from the "Sit next week's paper with friends" line for 4 weeks, as a cleaner comparison.
- **Guardrails.**
  - Leave rate within 7 days of joining.
  - Block and report rate per 100 members.
  - Share of Mob sittings started between 11 PM and 5 AM IST (late-night use).
  - Credit spend on Mob papers by free students.
- **Method.** Server-side aggregate counts over `mob_*` tables, nightly, groups under 5 suppressed (`MIN_REPORTABLE`), on the existing `/admin/funnel` page as a "Mob" block. No per-user event stream.
- **Stop rule.** If reports exceed 2 per 100 members in a week, or the 7-day leave rate exceeds 40%, the main session pauses invites (env flag `MOB_INVITES_ENABLED=false`) and tells the owner.

## 14. Build slices, packets and owner decisions

**Owner decisions** (ask in one message, with this spec linked):
- **D-S1.** Turn on the Mob for under-18 students before counsel review of DPDP Rule 10 and D2?
  - Recommended: build it now on staging, enable it in production only after counsel review, or for adults only (`age_band = 'adult'`) as an interim.
- **D-S2.** Does a Mob paper cost what a quick 10 costs (the default), or is it free once a week? Free is cleaner for the loop and costs about 10 credits per member per week.
- **D-S3.** Slice 0 (the leaderboard privacy fix), if the main session judges it outside the standing security OK.
- **D-S4 (later).** Invite rewards.

**Packets.** The files are disjoint from APP-PASS and WEB-PASS.

- **SP-0 (web, Sonnet high).** Slice 0.
  - Files: `src/app/api/leaderboard/route.js`, `src/app/(app)/leaderboard/**`, `src/app/(app)/dashboard/DashboardPageClient.jsx` (the stat only; rebase on wt-usp's commit, which also touches this file), `src/app/api/learning/summary/route.js`, and `data/tests/leaderboard_privacy.test.mjs`.
- **SP-1 (web and server, Sonnet high, Opus review of the SQL and RLS).** Slices 1 to 3.
  - Files: the migration and undo above; `src/lib/server/mob/**`; `src/app/api/mob/**`; `src/lib/server/practiceSessions.js` (the two `mobPaper` hooks only); `src/lib/server/accountDeletion.js` (verify the cascade, add a test only); `src/app/api/internal/refresh-inventory/route.js` (the report purge step; rebase on batch 3, which edits this route); `data/mob_name_blocklist.json`; `data/tests/mob*.test.mjs`.
  - Staging only: apply, undo, re-apply, and record it in `docs/brain/STATUS.md`.
- **SP-2 (web UI, Opus for the ring motion, Sonnet for the rest).** Files: `src/app/(app)/mob/**`, `src/app/join/[code]/**`, `src/components/mob/**`, `src/lib/arenaNavigation.js`, and the moderation "Mob reports" list in `src/app/(app)/moderation/**`.
  - The Today card on the web is `src/components/mob/MobTodayCard.jsx`. The one import line in `src/app/(app)/today/page.jsx` lands after WEB-PASS WP-B merges, since WP-B owns that file.
- **SP-3 (app, Opus for the ring and Mobi moment, Sonnet for the rest).** Files: `lib/features/mob/**`, `test/unit/mob/**`, `test/golden/mob/**`, and the `/join` and `/mob` intent-filter lines in `android/app/src/main/AndroidManifest.xml`.
  - These hook-ins wait for the v12 merge, because they are v12 files and not motion edits: the Today card insertion (`today_body.dart`), the Practice row, the Review row, the You hub row, the router and ActionRouter mapping (`core/router/**`).
  - Each is one widget insertion or one route line, done by the v12 lead or by SP-3 after the merge.
  - The Practice row (`practice/practice_screen.dart`) and the Review row (`review/screens/review_screen.dart`) also wait for APP-PASS AP-1 to merge, because AP-1 owns those two files during the pass.
- **Order.** SP-0, then SP-1, then SP-2 and SP-3 in parallel (both read SP-1's contract fixture `data/tests/fixtures/mob/get_v1.json`). Then a joint walk.

**Tests (all must pass before any merge).**

- **SQL and RLS** (SP-1, run on staging and PGlite):
  - anon and authenticated get permission denied on every `mob_*` table and function;
  - a 6th join returns `full`;
  - a second Mob returns `already`;
  - blocked either way returns `blocked`;
  - an expired code returns `expired`;
  - leave as owner passes the role on;
  - the last leave deletes the Mob and cascades;
  - deleting a user removes members, sittings and nudges, and nulls the report links;
  - the undo drops cleanly and the migration re-applies.
- **API:**
  - every route gives 401 when signed out, except the public lookup;
  - the public lookup never contains a name (fuzz 50 codes);
  - `GET /api/mob` never returns another member's score unless that member set `showScore`;
  - members are ordered by `joinedAt`, never by score;
  - the trap is null under 3 sitters, and the trap payload has no member ids;
  - the nudge reply carries only a count;
  - rate limits return 429 with `Retry-After`;
  - `MOB_ENABLED` off returns 404 everywhere;
  - display-name validation (length, regex, blocklist);
  - the `mobPaper` start gives every member identical question ids and option order;
  - a sitting after `closesAt` is not recorded;
  - the cost line equals the quote's charge type.
- **Web:**
  - hit-tests on every control at 360, 390 and 1440, Night and Day;
  - the reduced-motion capture is static;
  - `/join` is `noindex`;
  - the copy has no arrows, no exclamation marks and no times in 24-hour format.
- **App:**
  - unit tests of the ring state and of the one-Mobi-per-screen rule with the Mob moment and the header Mobi;
  - deep-link routing for `/join/<code>` when signed in and when signed out;
  - goldens as in section 8;
  - a rig walk on staging with two test accounts, made through the staging service role only (never the owner's): create, invite, join, both sit, ring fills, trap shows, nudge, leave and block, delete.

## 15. Owner decisions, 17 Oct 2026 about 1:45 am IST (these override sections 1-14 where they differ)

- **D-S1: open to everyone, final.** His words: "Everyone can use it... Open to everyone is the direction, and that's final." He accepts the legal risk and does not want age gating or a consent flow for the Mob. Remove any adults-only restriction. The Mob still has no chat, no DMs, no public profiles and no free text beyond a display name.
- **D-S2: neither all free nor Pro-only. Free and Pro must differ clearly, and something must make people try it once.** His words: "It should not entirely be free... It should not be entirely locked behind the pro plan." The main session's decision, under his delegation:
  - **Free:**
    - start or join a Mob (one active Mob you created; join any you are invited to);
    - sit the weekly 10-question Mob paper free of practice credits;
    - see the shared ring and your own result;
    - see a one-line teaser of where the Mob split ("You and Riya split on 3 questions").
  - **Pro:**
    - the full side-by-side for each Mob paper: per question, who picked what, who changed an answer, time spent, and the Mob's shared trap with its repair entry;
    - Mob history for past weeks;
    - extra Mob papers on demand (a chosen chapter and length, beyond the weekly one);
    - up to 3 Mobs across subjects.
  - **The try-once hook (not a trial):**
    - the invite link opens "Riya invited you to this week's 10-question paper" with one key;
    - your first Mob week shows the full side-by-side once, free, as a sample (like the first free Repair);
    - after that the side-by-side is Pro, with the teaser line for free.
- **His bar:** "a 10/10 idea if the execution is 10/10... a 0/10 idea even if the execution is like a 5/10". Nothing ships until the gate and the emulator walk show it polished.
- **Cost to host:** effectively zero. The Mob calls no AI model. Each member writes a few rows per week (membership, the weekly paper's question ids, one attempt), and the paper is drawn from the existing bank. Egress is a few KB per member per week, within the current Vercel and Supabase plans.
