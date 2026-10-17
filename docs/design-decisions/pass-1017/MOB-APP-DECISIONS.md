# The Mob in the app: design decisions (17 Oct 2026)

User task: sit one shared paper a week with friends, see who sat, learn from where the Mob split. Behind the server flag MOB_ENABLED (off): with it off every route answers 404 MOB_DISABLED and the app draws no Mob entry anywhere.

- **Contract.** Shapes are the website's data/tests/fixtures/mob (byte for byte in flutter_app/test/fixtures/mob). Every call after create/join names its Mob (`mob` in the body or query). The error sentence for every one of the 37 codes equals the server's (tested).
- **Open to everyone (D-S1).** No age step, no consent step. A test scans lib/features/social for such words.
- **Free and Pro (D-S2).** The plan is read from the view (`plan`, `compare.access`); the app never decides it and never sells: Pro is only named as "Included with Pro", with no price, button or link (the app's action router already refuses pricing links). Free: one Mob, the weekly paper free of credits, the ring, your own result, the teaser line, the first side-by-side once. Pro: side-by-side every week, past weeks, extra papers (chapter, length), up to 3 Mobs (switcher).
- **One primary action per state (rule 7).** Not sat: Sit this week's paper. Sat: See your answers. Alone: Invite. The Today card key does what its label says. One volt key per screen; everything else is outlined.
- **No shame (rule 22, T005).** No "Sat" chip on member rows (a blank would read as "has not sat"), no list of who has not sat, no count-down. Scores only for members who share; share is reciprocal; private members are counted, never named.
- **Evidence.** T001 (name prefilled, editable), T003 (value before the account wall: the invite link opens on who invited you and one key), T005, T006 and T008 (the cost line is the server's, before the tap), rules 13, 14, 18, 19, 22, 31. The loop's effect is an [I] hypothesis to measure (rules 37, 38).
- **Draft row.** A Mob paper has its own draft key (`mm:mob:<user>:<mob>:<week or extra>`), so it never overwrites an ordinary quick 10 of the same subject; a paper already running on the phone resumes.
- **States drawn.** Loading, failed (offline named), off, no Mob, alone, in a Mob, all sat, closed week, free paper used elsewhere, locked side-by-side, hand-back (Today card, once a week).
- **Not done here.** The Practice row and the Review row (spec section 9) live in files other passes own; the result-screen row (the Mob ring after a Mob paper) waits for the result rework. Emulator walk not run (not asked).
