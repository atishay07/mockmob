# Round 7 brief (3 Nov 2026, about 8:30 pm IST): LK59-LK62

Owner's words (read them all first): `C:\Users\atish\Desktop\mockmob copy\mockmob-next\docs\brain\OWNER-FEEDBACK-2026-10-31-LEARN.md`,
sections "2 Nov 2026, about 10 am", "3 Nov 2026, about 1:30 pm" and "3 Nov 2026, about 3:15 pm"; ledger rows LK36-LK62 in
`mockmob-next/docs/brain/OWNER-MASTER-LEDGER.md`. Rules from R6-SPEC.md (same folder, ../r6/) apply: own worktree and branch, never push,
merge, deploy, write to production or sign in to production; dev servers through preview_start after taking a dev slot file; never remove a
worktree holding a node_modules junction; kill only your own processes.

His standing rules: refine, don't rebuild; never cut a feature; Night stays subtle; he judges a live prototype on his phone, not screenshots;
plain, warm, correct English, no hype. Owner's UI standards: `C:\Users\atish\Desktop\AI OS\wiki\concepts\ui-ux-standards.md`; his research brain
rules (DESIGN.md points to them). DESIGN.md and PRODUCT.md win over generic taste.

**Prototype links rule (3 Nov lesson):** the owner opens links on his phone over Wi-Fi at `http://192.168.1.8:<port>`. The dev preview hides
Learn v2 and breaks Explore unless the address carries `decks=real&study=on` (and `student=commerce`, `plan=pro|free`), and the preview's
own tabs drop those settings. Every link you report must land directly on the changed screen; open each one yourself at 375 x 812 first.
Working examples (port 3463 is the r6-cards prototype):
- Learn home: `/preview/arena?decks=real&study=on&plan=pro&student=commerce&view=learn2&subject=accountancy`
- Explore: `/preview/arena?view=explore&plan=pro&data=ready&study=on&decks=real&student=commerce`
- Feed: `/preview/arena?decks=real&study=on&plan=pro&student=commerce&view=learn2-feed&chapter=accountancy.admission-of-partner&min=10`

## W: the phone website as a full experience, and recommendations that read well (LK62, LK59)
He: "The mobile UI of the website is now somewhat an exact copy of the app, but the website has more features and needs to be a full-fledged
experience ... especially the Learn thing"; "you have added some intelligent recommendation. But it's making the overall UI very much more
cluttered ... the implementation in the UI is just not good."
1. Audit (phone 390 and desktop 1440, Night and Day): which web features exist that the phone layout hides, flattens or makes hard to find
   (Learn's Find, sets, Cards view, print sheet, roadmap sort and parts, Explore single questions and filters, Saved, Revise, Papers, Mob,
   Wallet, Colleges, Ask Mobi), and every "intelligent recommendation" surface (Learn home Or rows, offer lines, "For you" lines on covers,
   "Needs work · from your papers" chips, Today's suggestions, Mobi notes): what each says, where, how it looks, and why it reads cluttered.
2. Write `docs/brain/learn-1031/r7/W-WEB-FULL.md`: the problems with numbers, then a plan: the phone web as the full product (richer than the
   app: more of Learn on one screen where it helps, the web-only tools within reach), recommendations as one clear, well-made module (one
   voice, one place, real reasons, never three competing lines).
3. Build it on branch `web/1103-webfull` (worktree wt-1103-webfull, based on web/1103-proto so the new cards and top bar are included), as a
   live prototype; report one verified link per change.

## I: branded icons instead of vague ones (LK60)
He: "Don't use these vague icons and stuff like this either. Make them into a proper branded icon, a generated image, or something else."
1. Inventory every icon on Learn, Explore, Practice's More ways in, the chapter page's shelf rows and the top bar (web and app): which are
   generic line icons standing in for a meaning.
2. Propose the replacement: a small branded set in MockMob's own visual language (Mobi, the lime/volt accent, the illustrated subject art
   the app already uses), as images or as custom drawn icons; generated images are allowed (`codex exec` image generation, GPT-6-Luna high,
   lean CODEX_HOME `.codex-alt`; see the memory note "Codex image gen, cheap"). Keep the set small and consistent.
3. Produce the assets, a showcase page in the dev preview (one link) and the swap on branch `web/1103-icons` (worktree wt-1103-icons, based
   on web/1103-proto). The app swap follows after his look.

## E: the English, everywhere in Learn (LK61)
He: "the English that you write for everything ... we want it to be improved."
1. Collect every student-facing line of Learn v2, Explore and the Key cards screens (web `data/learn/words.js`, `data/learn/allowance.js`,
   `src/components/learn2/**`, `src/components/keycards/**`, `src/components/feed/**`; app `flutter_app/lib/features/learn2/**`, keycards).
2. Rewrite what is stiff, unclear, too long or not how a 16-17-year-old Indian student reads easily: plain, warm, concrete, correct grammar,
   Indian English spelling the product already uses, no hype, no build talk. Keep meaning and every fact; keep the shared words shared.
3. Write `docs/brain/learn-1031/r7/E-ENGLISH.md`: a table (where, before, after, why), most-seen lines first. Do not change code yet;
   the changes land after the W and I branches, so they do not collide.
