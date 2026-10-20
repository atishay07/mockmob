// The Mob's sections on /privacy and /terms, written for Mob v3 (20 Oct 2026). Server components, plain words, and every
// statement is true of the code it describes:
//   games, marks, the podium, ghosts, moments, the trap, Fix it together   src/lib/mob/games.mjs, src/lib/server/mob/games.js
//   the share switch (show_score) and the podium switch (mobs.show_podium) src/lib/server/mob/service.js patchMe, games.js settings
//   stickers (a fixed set of 8, 30 days)                                    games.js STICKERS, mob_game_settle in the v3 games migration
//   the weekly paper, its side-by-side, nudges, extra papers                service.js, src/lib/mob/compare.mjs, model.mjs
//   quest, chain, Folds, the mic                                            quest.mjs, mobChain.mjs, folds.mjs, starts.mjs
//   leaving, blocking, reports and their 180-day purge                      mob_leave, mob_block, api/internal/refresh-inventory
//   deleting an account                                                     accountDeletion.js DELETION_STEPS
// Behaviour described as fact that ships with the same release: when a member turns sharing off their run takes no place and
// shows no marks, their moment line only says they finished, their right answers are left out of the "together" total and
// their run is not used as a ghost; and Leave and block separates the two students in every Mob they share.
// Live rooms are not on (MOB_LIVE_ENABLED), so they are not described here. Add them in the change that turns them on.
// The pages render these only when MOB_ENABLED is 'true'.

export const mobEnabledForLegal = () => process.env.MOB_ENABLED === 'true';

export function MobPrivacySection() {
  return (
    <section id="mob">
      <h2>The Mob: studying with friends</h2>
      <p>A Mob is a private group of up to 5 students. You can only join one through an invite link or code that a member sends you, and an invite works for 7 days. There is no Mob search, no member search, no chat, no messages, no photos, and MockMob never asks for your contacts. A Mob&apos;s name comes from a fixed list of names, so there is no free text.</p>
      <p><b>Games.</b> Any member can start a game for the Mob: a sprint of 5 questions, or a round of 10, 15 or 20 questions, taken from MockMob&apos;s question bank. A game stays open for 24 hours. Each member plays it once, on their own, at any time in those 24 hours. Marks are CUET marks: 5 for a right answer, minus 1 for a wrong answer and 0 for a skipped question. When the game closes, the answers and explanations open for every member of the Mob.</p>
      <p><b>What the other members of your Mob see.</b> Your Mob display name (you choose it, 2 to 18 characters, starting with a letter) and colour, and your Fold, the small picture you pick for your seat. When you finish a game, they see that you finished it and when. If you share your marks, they also see your marks and your place on the podium, and one short line about how your game went, picked from a fixed list, such as every question right, three right in a row or the quickest finish. Nobody sees which option you picked on a question in a game, and nobody is told who has not played. Only the members of that same Mob see any of this. It is never shown to anyone else and never on a public page.</p>
      <p><b>The podium.</b> Once you have finished a game you can open its podium. Members who share their marks are placed by CUET marks, highest first, and members on the same marks share a place. Places are on by default. The member who started the Mob can switch places off for the whole Mob, and then the podium shows marks with no places.</p>
      <p><b>Ghosts.</b> While you play, you can race ghosts. A ghost replays the pace of another member&apos;s finished run: the times they took to reach each question, shown with their display name, colour and Fold. A ghost never shows what that member picked or whether they were right. On a rematch, your own earlier run can be a ghost too.</p>
      <p><b>Sharing is on by default, and you can turn it off.</b> In your Mob&apos;s settings, turn off &quot;Share my marks in games&quot;. From then on your run takes no place and shows no marks on the podium, your moment line only says you finished, your right answers are left out of the Mob&apos;s together total (the number of questions the Mob got right as a group), and your run is not used as a ghost for others. Other members still see that you finished a game and when. You can turn sharing back on at any time. The same switch covers the weekly paper, below.</p>
      <p><b>The trap.</b> When 3 or more members have finished a game, and one wrong answer on one question was the pick of at least 2 members and half or more of them, the Mob is shown that question as a trap: most of you picked the same wrong answer. It is worked out for the Mob as a group, and it never names anyone or shows how many members picked it.</p>
      <p><b>Fix it together.</b> After a game closes with a trap, each member can answer a fresh question like it, once straight away and once in a check a few days later. We keep whether you got each one right. The Mob only sees how many members have fixed the trap, never who.</p>
      <p><b>The weekly paper.</b> A Mob can also sit a 10-question paper each week, the same questions for every member, and a Mob member with Pro can make extra papers on a chapter. A paper has no podium and no places. Unless you turn sharing off, the other members see your score on a paper and, for each question, the option you picked, whether you changed your answer and how long you spent, but only if they share theirs too: you see another member&apos;s answers only while you share yours. Once 3 or more members have sat a paper, members who sat it can see how many picked each option and the Mob&apos;s most common wrong answer, with no names, and a member who keeps their answers private is never counted in the option counts.</p>
      <p><b>Nudges.</b> After you sit the weekly paper, you can send one &quot;Sit it with me&quot; note a week to the members who have not sat it. It carries your display name and no text. You are never told who has not sat. You can mute nudges in the Mob&apos;s settings.</p>
      <p><b>Stickers.</b> Members can send each other stickers from a fixed set of 8, such as &quot;Nice one&quot; and &quot;So close&quot;. There is no free text and there are no photos. The Mob sees who sent which sticker and when. Stickers are kept for 30 days. Older ones are deleted the next time one of the Mob&apos;s games closes.</p>
      <p><b>Quest, chain and Folds.</b> Every question answered in the Mob&apos;s games and papers counts toward one weekly quest for the whole Mob. It is counted by game or paper, never by person. A member can step out of a week&apos;s quest, which makes the goal smaller; the Mob is never shown who stepped out. Weeks in a row with the quest done make the Mob&apos;s chain. You can earn Folds and den items by playing. They are earned, never bought, and the Fold you pick for your seat is shown to your Mob.</p>
      <p><b>Passing the mic.</b> A member with Pro can pass the mic to another member of the Mob, which lets that member start a game. The member who gets it sees who passed it.</p>
      <p><b>The invite page</b> shows the subject, the Mob&apos;s name, how many seats are taken and when the link stops working, never anyone&apos;s name. A signed-in visitor also sees the display name of the member who made the link.</p>
      <p><b>Leaving and blocking.</b> You can leave a Mob at any time. Your membership, your game runs and answers, your paper sittings and the stickers you sent in that Mob are deleted when you leave. What the quest has already counted stays, with no name on it. Leave and block takes you out of that Mob and out of every other Mob you share with that person (in a Mob you own, that person is removed instead), and neither of you can join a Mob the other is in. They are not told that you blocked them.</p>
      <p><b>Reporting.</b> You can report a member&apos;s name, their nudges, or anything that makes you feel unsafe. The moderation list shows the reason, the reported display name and the date, not who reported. A moderator can remove a member from a Mob. Reports are deleted after 180 days.</p>
      <p><b>Deleting your account</b> removes all your Mob data within 30 days of the request, like the rest of your account: your memberships and display names, your game runs, answers and marks, your paper sittings, the stickers you sent, mics passed to or by you, your Fix it together answers, your step-outs, nudges and blocks, your seat Fold and the Folds you earned, and your chain settings. Reports you made or that name you lose any link to your account. Games, extra papers, invite links and Mobs you started stay with the Mob, with no record of who made them.</p>
      <p><b>What we keep to run the Mob.</b> A note that you used your free weekly game start or your free side-by-side, so leaving and joining again cannot be used to get more; it is deleted with your account. We count Mob use only as totals across all Mobs (for example, how many papers were sat in a week), with groups under 5 never shown. No Mob activity is used for advertising.</p>
    </section>
  );
}

export function MobTermsSection() {
  return (
    <section id="mob">
      <h2>The Mob</h2>
      <p>The Mob lets you play quick games and sit a weekly paper with up to 4 friends you invite. Use a display name that is not offensive and does not pretend to be MockMob or someone else. Do not use stickers, nudges or reports to harass anyone. Inside a Mob, members see each other&apos;s marks and places unless they turn sharing off, and the member who started the Mob can switch places off for everyone, as the <a href="/privacy#mob">Privacy Policy</a> explains. We may remove a member from a Mob, pause invites, or restrict the Mob for misuse.</p>
    </section>
  );
}
